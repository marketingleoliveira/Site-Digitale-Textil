import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const TEXTILE_CNAES = [
  "1311-1/00", "1321-9/00", "1330-8/00", "1340-5/01",
  "1411-8/01", "1412-6/01", "1412-6/02", "1413-4/01", "1422-3/00",
];

const SUSPICIOUS_DOMAINS = ["gmail.com", "hotmail.com", "outlook.com", "yahoo.com", "icloud.com", "live.com", "bol.com.br", "uol.com.br"];

function validateCNPJ(cnpj: string): boolean {
  cnpj = (cnpj || "").replace(/\D/g, "");
  if (cnpj.length !== 14) return false;
  if (/^(\d)\1+$/.test(cnpj)) return false;
  const calc = (base: string, weights: number[]) => {
    const sum = base.split("").reduce((acc, d, i) => acc + parseInt(d) * weights[i], 0);
    const r = sum % 11;
    return r < 2 ? 0 : 11 - r;
  };
  const w1 = [5,4,3,2,9,8,7,6,5,4,3,2];
  const w2 = [6,5,4,3,2,9,8,7,6,5,4,3,2];
  const d1 = calc(cnpj.slice(0,12), w1);
  const d2 = calc(cnpj.slice(0,12) + d1, w2);
  return cnpj.endsWith(`${d1}${d2}`);
}

function validateWhatsApp(num: string): boolean {
  const n = (num || "").replace(/\D/g, "");
  if (n.length !== 11) return false;
  const ddd = parseInt(n.slice(0,2));
  if (ddd < 11 || ddd > 99) return false;
  if (n[2] !== "9") return false;
  return true;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { lead_id } = await req.json();
    if (!lead_id) {
      return new Response(JSON.stringify({ error: "lead_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!SUPABASE_URL || !SERVICE_KEY || !LOVABLE_API_KEY) {
      throw new Error("Configuração do backend indisponível");
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    const { data: lead, error: leadErr } = await supabase
      .from("fabric_leads")
      .select("*")
      .eq("id", lead_id)
      .single();
    if (leadErr || !lead) throw new Error("Lead não encontrado");

    // Marca como "validating"
    await supabase.from("lead_validations").upsert({
      fabric_lead_id: lead_id,
      status: "validating",
      score: 0,
    }, { onConflict: "fabric_lead_id" });

    // Validações determinísticas
    const cnpjValid = validateCNPJ(lead.cnpj);
    const cnaeMatch = lead.cnae ? TEXTILE_CNAES.includes(lead.cnae) : false;
    const waOk = validateWhatsApp(lead.whatsapp);
    const emailDomain = (lead.email || "").split("@")[1]?.toLowerCase() || "";
    const isCorporate = emailDomain.endsWith(".com.br") || emailDomain.endsWith(".ind.br");
    const isFreeMail = SUSPICIOUS_DOMAINS.includes(emailDomain);
    const emailDomainOk = isCorporate && !isFreeMail;

    // Chamada à IA — análise aprofundada
    const prompt = `Você é um analista B2B sênior de uma indústria têxtil brasileira. Avalie este lead potencial e determine a probabilidade real de venda.

DADOS DO LEAD:
- Empresa (e-mail): ${lead.email}
- CNPJ: ${lead.cnpj} (válido: ${cnpjValid})
- CNAE declarado: ${lead.cnae || "não informado"} (compatível com têxtil/confecção: ${cnaeMatch})
- WhatsApp: ${lead.whatsapp} (formato BR válido: ${waOk})
- Tecido solicitado: ${lead.fabric_name}
- Domínio do e-mail: ${emailDomain} (corporativo: ${isCorporate}, e-mail gratuito: ${isFreeMail})
- Data do contato: ${new Date(lead.created_at).toLocaleString("pt-BR")}

TAREFA:
1. Avalie a coerência entre o tecido solicitado e o perfil da empresa (sugerido pelo nome do domínio).
2. Identifique sinais de risco (e-mail genérico, CNPJ inválido, CNAE incompatível).
3. Identifique sinais positivos (CNPJ válido + CNAE têxtil + e-mail corporativo).
4. Forneça um score de 0 a 100 (probabilidade de virar venda real).
5. Recomende uma ação clara.

Use a função register_validation para retornar a análise estruturada.`;

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "Você é um analista B2B têxtil rigoroso. Responda SEMPRE chamando a função register_validation." },
          { role: "user", content: prompt },
        ],
        tools: [{
          type: "function",
          function: {
            name: "register_validation",
            description: "Registra a análise do lead",
            parameters: {
              type: "object",
              properties: {
                score: { type: "number", description: "0-100" },
                status: { type: "string", enum: ["qualified", "suspicious", "rejected"] },
                recommendation: { type: "string", description: "Curto: Contatar agora | Avaliar depois | Descartar" },
                company_analysis: { type: "string", description: "Análise da empresa em 2-3 frases" },
                positive_signals: { type: "array", items: { type: "string" } },
                risk_signals: { type: "array", items: { type: "string" } },
                ai_summary: { type: "string", description: "Resumo executivo em 1 frase" },
              },
              required: ["score", "status", "recommendation", "company_analysis", "positive_signals", "risk_signals", "ai_summary"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "register_validation" } },
      }),
    });

    if (aiResp.status === 429) {
      return new Response(JSON.stringify({ error: "Limite de requisições atingido. Tente novamente em instantes." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (aiResp.status === 402) {
      return new Response(JSON.stringify({ error: "Créditos de IA esgotados. Adicione créditos em Configurações > Workspace." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!aiResp.ok) {
      const txt = await aiResp.text();
      throw new Error(`AI gateway error ${aiResp.status}: ${txt}`);
    }

    const aiData = await aiResp.json();
    const toolCall = aiData?.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("IA não retornou análise estruturada");
    const analysis = JSON.parse(toolCall.function.arguments);

    // Combina score determinístico (40%) + IA (60%) — penaliza falhas duras
    let finalScore = Math.round(analysis.score * 0.6);
    if (cnpjValid) finalScore += 10;
    if (cnaeMatch) finalScore += 12;
    if (emailDomainOk) finalScore += 12;
    if (waOk) finalScore += 6;
    finalScore = Math.max(0, Math.min(100, finalScore));

    let finalStatus: string = analysis.status;
    if (!cnpjValid || !waOk) finalStatus = "rejected";
    else if (finalScore >= 70) finalStatus = "qualified";
    else if (finalScore >= 40) finalStatus = "suspicious";
    else finalStatus = "rejected";

    const { error: upErr } = await supabase.from("lead_validations").upsert({
      fabric_lead_id: lead_id,
      status: finalStatus,
      score: finalScore,
      cnpj_valid: cnpjValid,
      cnae_match: cnaeMatch,
      email_domain_ok: emailDomainOk,
      whatsapp_format_ok: waOk,
      company_analysis: analysis.company_analysis,
      positive_signals: analysis.positive_signals,
      risk_signals: analysis.risk_signals,
      recommendation: analysis.recommendation,
      ai_summary: analysis.ai_summary,
      validated_at: new Date().toISOString(),
    }, { onConflict: "fabric_lead_id" });
    if (upErr) throw upErr;

    if (finalStatus === "qualified") {
      const { error: syncError } = await supabase.functions.invoke("sync-qualified-crm-leads", {
        body: { lead_id },
      });
      if (syncError) {
        console.error("Qualified lead queued; immediate CRM delivery failed:", syncError.message);
      }
    }

    return new Response(JSON.stringify({ success: true, status: finalStatus, score: finalScore }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("validate-lead error:", e);
    const msg = e instanceof Error ? e.message : "Erro desconhecido";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
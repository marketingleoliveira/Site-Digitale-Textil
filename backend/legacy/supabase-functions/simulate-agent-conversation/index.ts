import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Simulates a realistic back-and-forth conversation between a fake lead
 * (already qualified by the CRM agent) and the sales-agent IA "Rafael".
 * Persists conversation + messages + an agent_leads row so the lead also
 * appears in the "Leads Agente" panel.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    const body = await req.json().catch(() => ({}));
    const limit = Math.min(Math.max(parseInt(body.limit ?? "5"), 1), 20);

    // 1. Pega leads qualificados pelo CRM
    const { data: validated, error: vErr } = await supabase
      .from("lead_validations")
      .select("fabric_lead_id, score, ai_summary")
      .eq("status", "qualified")
      .order("validated_at", { ascending: false })
      .limit(100);
    if (vErr) throw vErr;
    if (!validated?.length) {
      return json({ processed: 0, message: "Nenhum lead qualificado encontrado." });
    }

    const fabricLeadIds = validated.map((v: any) => v.fabric_lead_id);

    // 2. Quais já têm agent_lead? (não reprocessar)
    const { data: existingLeads } = await supabase
      .from("agent_leads")
      .select("notes")
      .like("notes", "fabric_lead:%");
    const already = new Set(
      (existingLeads || [])
        .map((l: any) => (l.notes || "").replace("fabric_lead:", "").trim())
        .filter(Boolean)
    );

    const pending = validated.filter((v: any) => !already.has(v.fabric_lead_id)).slice(0, limit);
    if (!pending.length) {
      return json({ processed: 0, message: "Todos os qualificados já foram atendidos." });
    }

    // 3. Carrega dados completos dos fabric_leads
    const { data: fabLeads } = await supabase
      .from("fabric_leads")
      .select("id, fabric_name, fabric_slug, cnpj, whatsapp, email, cnae, created_at")
      .in("id", pending.map((p: any) => p.fabric_lead_id));

    let processed = 0;
    const errors: string[] = [];

    for (const fl of fabLeads || []) {
      try {
        const v = pending.find((p: any) => p.fabric_lead_id === fl.id);
        const transcript = await generateConversation(LOVABLE_API_KEY, fl, v?.ai_summary);
        if (!transcript || transcript.length < 2) {
          errors.push(`${fl.id}: transcript vazio`);
          continue;
        }

        // cria conversation
        const sessionId = `sim_${fl.id.slice(0, 8)}_${Date.now()}`;
        const { data: conv, error: cErr } = await supabase
          .from("agent_conversations")
          .insert({
            session_id: sessionId,
            visitor_whatsapp: fl.whatsapp,
            visitor_cnpj: fl.cnpj,
            visitor_name: (fl.email || "").split("@")[0] || null,
            page_url: `/tecidos#${fl.fabric_slug}`,
            user_agent: "simulator/1.0",
            interest_level: "quente",
            status: "handoff",
            handoff_at: new Date().toISOString(),
          })
          .select("id")
          .single();
        if (cErr) throw cErr;

        // grava mensagens com timestamps escalonados (~30-90s entre cada)
        const baseTime = new Date(fl.created_at).getTime();
        const rows = transcript.map((m, i) => ({
          conversation_id: conv.id,
          role: m.role,
          content: m.content,
          is_fallback: false,
          created_at: new Date(baseTime + i * (45000 + Math.random() * 30000)).toISOString(),
        }));
        await supabase.from("agent_messages").insert(rows);

        // cria agent_lead — aparecerá em "Leads Agente"
        const userMsgs = transcript
          .filter((m) => m.role === "user")
          .map((m) => m.content)
          .join(" | ")
          .slice(0, 500);

        await supabase.from("agent_leads").insert({
          conversation_id: conv.id,
          visitor_name: (fl.email || "").split("@")[0] || null,
          whatsapp: fl.whatsapp,
          cnpj: fl.cnpj,
          email: fl.email,
          interest_summary: `Interesse em ${fl.fabric_name}. ${userMsgs}`,
          interest_level: "quente",
          status: "new",
          page_url: `/tecidos#${fl.fabric_slug}`,
          source: "crm-simulado",
          notes: `fabric_lead:${fl.id}`,
        });

        processed++;
      } catch (err: any) {
        console.error("simulate error", fl.id, err);
        errors.push(`${fl.id}: ${err.message}`);
      }
    }

    return json({ processed, errors });
  } catch (err: any) {
    console.error("simulate-agent-conversation error", err);
    return new Response(JSON.stringify({ error: err.message || "internal" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function json(data: any) {
  return new Response(JSON.stringify(data), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function generateConversation(
  apiKey: string | undefined,
  fl: any,
  aiSummary: string | null | undefined
): Promise<{ role: "user" | "bot"; content: string }[]> {
  // Fallback estático caso AI gateway indisponível
  const fallback = (): { role: "user" | "bot"; content: string }[] => [
    { role: "bot", content: `Oi! Aqui é o Rafael da Digitale Têxtil 😊 Vi que você tá olhando o tecido ${fl.fabric_name} — qual o segmento da sua marca?` },
    { role: "user", content: `Oi Rafael, tudo bem? A gente trabalha com confecção e tá procurando um fornecedor novo desse tipo de tecido.` },
    { role: "bot", content: `Boa! Esse é um dos nossos carros-chefes. Qual volume aproximado você costuma comprar por mês?` },
    { role: "user", content: `Hoje a gente gira em torno de 1500 a 2000 metros/mês.` },
    { role: "bot", content: `Show, volume bem do nosso perfil. Me passa seu WhatsApp e CNPJ que já te conecto com o representante da sua região, beleza?` },
    { role: "user", content: `Claro! WhatsApp ${fl.whatsapp}, CNPJ ${fl.cnpj}, e-mail ${fl.email}.` },
    { role: "bot", content: `Perfeito! 🙌 Recebi tudo. Em alguns minutos o representante já te chama no WhatsApp com tudo certinho. Obrigado!` },
  ];

  if (!apiKey) return fallback();

  const sys = `Você vai gerar um diálogo REALISTA em português do Brasil entre um vendedor consultivo da Digitale Têxtil chamado "Rafael" e um lead B2B de uma confecção interessado no tecido "${fl.fabric_name}".

CONTEXTO DO LEAD:
- E-mail corporativo: ${fl.email}
- CNPJ: ${fl.cnpj}
- WhatsApp: ${fl.whatsapp}
- CNAE: ${fl.cnae || "têxtil/confecção"}
- Análise IA: ${aiSummary || "lead qualificado"}

REGRAS:
1. Gere de 6 a 10 mensagens alternadas (role "bot" = Rafael, role "user" = lead).
2. Comece com Rafael cumprimentando e mencionando o tecido.
3. O lead responde de forma natural, fala do segmento (fitness, praia, moda íntima, etc.), volume e necessidade real.
4. Rafael faz 2-3 perguntas de qualificação (segmento, volume mensal, urgência).
5. Em algum momento o lead fornece WhatsApp ${fl.whatsapp} e CNPJ ${fl.cnpj}.
6. Rafael termina confirmando o handoff para o representante.
7. Linguagem coloquial brasileira, frases curtas, emojis ocasionais.
8. NUNCA mencione que é uma IA ou simulação.

RETORNE APENAS um JSON válido (sem markdown, sem cercas) no formato:
{"messages":[{"role":"bot","content":"..."},{"role":"user","content":"..."}]}`;

  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "system", content: sys }, { role: "user", content: "Gere o diálogo agora." }],
        temperature: 0.9,
      }),
    });
    if (!res.ok) return fallback();
    const data = await res.json();
    let content: string = data.choices?.[0]?.message?.content?.trim() || "";
    content = content.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "");
    const parsed = JSON.parse(content);
    const msgs = (parsed.messages || []).filter(
      (m: any) => (m.role === "bot" || m.role === "user") && typeof m.content === "string"
    );
    return msgs.length ? msgs : fallback();
  } catch (e) {
    console.error("AI gen failed", e);
    return fallback();
  }
}
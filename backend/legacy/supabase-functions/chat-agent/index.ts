import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ChatRequest {
  conversation_id?: string;
  session_id: string;
  message: string;
  page_url?: string;
  user_agent?: string;
  page_context?: string; // 'tecidos' | 'estampas'
}

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s]/g, " ")
    .trim();
}

function findKnowledgeMatch(message: string, knowledge: any[]): any | null {
  const norm = normalize(message);
  let best: { item: any; score: number } | null = null;

  for (const item of knowledge) {
    const keywords = (item.keywords || "")
      .split(",")
      .map((k: string) => normalize(k))
      .filter(Boolean);
    let score = 0;
    for (const kw of keywords) {
      if (kw && norm.includes(kw)) score += kw.length;
    }
    const qNorm = normalize(item.question);
    const qWords = qNorm.split(/\s+/).filter((w) => w.length > 3);
    for (const w of qWords) {
      if (norm.includes(w)) score += 1;
    }
    if (score > 0 && (!best || score > best.score)) {
      best = { item, score };
    }
  }
  return best && best.score >= 4 ? best.item : null;
}

// Extract phone (BR) and CNPJ from a free-text message
function extractContactData(text: string): { whatsapp?: string; cnpj?: string } {
  const result: { whatsapp?: string; cnpj?: string } = {};
  const onlyDigits = (s: string) => s.replace(/\D/g, "");

  // CNPJ: 14 digits
  const cnpjMatch = text.match(/\d{2}[.\s-]?\d{3}[.\s-]?\d{3}[.\s-]?\d{4}[.\s-]?\d{2}/);
  if (cnpjMatch) {
    const d = onlyDigits(cnpjMatch[0]);
    if (d.length === 14) result.cnpj = d;
  } else {
    const allDigits = onlyDigits(text);
    if (allDigits.length === 14) result.cnpj = allDigits;
  }

  // WhatsApp BR: 10 or 11 digits, optional +55
  const phoneRegex = /(?:\+?55\s?)?\(?\d{2}\)?\s?9?\s?\d{4}[\s-]?\d{4}/g;
  const matches = text.match(phoneRegex);
  if (matches) {
    for (const m of matches) {
      const d = onlyDigits(m).replace(/^55/, "");
      if (d.length === 10 || d.length === 11) {
        result.whatsapp = d;
        break;
      }
    }
  }
  return result;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    const body: ChatRequest = await req.json();
    if (!body.session_id || !body.message?.trim()) {
      return new Response(JSON.stringify({ error: "missing fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Load settings + knowledge
    const [{ data: settings }, { data: knowledge }] = await Promise.all([
      supabase.from("agent_settings").select("*").eq("key", "main").maybeSingle(),
      supabase.from("agent_knowledge").select("*").eq("is_active", true),
    ]);

    if (settings && settings.is_enabled === false) {
      return new Response(JSON.stringify({ error: "agent disabled" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get/create conversation
    let conversationId = body.conversation_id;
    let conversation: any = null;
    if (!conversationId) {
      const { data: existing } = await supabase
        .from("agent_conversations")
        .select("*")
        .eq("session_id", body.session_id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existing) {
        conversationId = existing.id;
        conversation = existing;
      } else {
        const { data: newConv, error: convErr } = await supabase
          .from("agent_conversations")
          .insert({
            session_id: body.session_id,
            page_url: body.page_url,
            user_agent: body.user_agent,
          })
          .select("*")
          .single();
        if (convErr) throw convErr;
        conversationId = newConv.id;
        conversation = newConv;
      }
    } else {
      const { data: c } = await supabase
        .from("agent_conversations")
        .select("*")
        .eq("id", conversationId)
        .maybeSingle();
      conversation = c;
    }

    // Try to extract WhatsApp/CNPJ/email/name from this user message and persist
    const extracted = extractContactData(body.message);
    const emailMatch = body.message.match(/[\w._%+-]+@[\w.-]+\.[A-Za-z]{2,}/);
    const updateData: any = {};
    if (extracted.whatsapp && !conversation?.visitor_whatsapp) {
      updateData.visitor_whatsapp = extracted.whatsapp;
    }
    if (extracted.cnpj && !conversation?.visitor_cnpj) {
      updateData.visitor_cnpj = extracted.cnpj;
    }
    if (Object.keys(updateData).length) {
      await supabase.from("agent_conversations").update(updateData).eq("id", conversationId);
      Object.assign(conversation, updateData);
    }

    // Detect handoff: when we have AT LEAST WhatsApp (CNPJ é bônus) → transfer to human
    const hasWhats = !!conversation?.visitor_whatsapp;
    const justQualified = hasWhats && !conversation?.handoff_at;

    // Save user message
    await supabase.from("agent_messages").insert({
      conversation_id: conversationId,
      role: "user",
      content: body.message,
    });

    // Load recent history
    const { data: history } = await supabase
      .from("agent_messages")
      .select("role, content")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true })
      .limit(20);

    let reply = "";
    let isFallback = false;
    let matchedId: string | null = null;

    // If lead just provided contact, send handoff message immediately (skip AI/KB)
    if (justQualified) {
      reply = `Perfeito! 🙌 Recebi seu contato. Vou transferir pro representante especialista no seu segmento agora — ele vai te chamar no WhatsApp em alguns minutos com tudo certinho. Muito obrigado!`;
      isFallback = false;
      await supabase
        .from("agent_conversations")
        .update({
          handoff_at: new Date().toISOString(),
          interest_level: "quente",
          needs_followup: true,
          status: "handoff",
        })
        .eq("id", conversationId);

      // Cria lead na tabela agent_leads (uma vez por conversa)
      const { data: existingLead } = await supabase
        .from("agent_leads")
        .select("id")
        .eq("conversation_id", conversationId)
        .maybeSingle();

      if (!existingLead) {
        // Resumo de interesse: últimas mensagens do visitante
        const userMsgs = (history || [])
          .filter((m: any) => m.role === "user")
          .map((m: any) => m.content)
          .slice(-5)
          .join(" | ");

        await supabase.from("agent_leads").insert({
          conversation_id: conversationId,
          visitor_name: conversation?.visitor_name || null,
          whatsapp: conversation?.visitor_whatsapp || null,
          cnpj: conversation?.visitor_cnpj || null,
          email: emailMatch ? emailMatch[0] : null,
          interest_summary: userMsgs.slice(0, 500),
          interest_level: "quente",
          status: "new",
          page_url: conversation?.page_url || null,
          source: "agente-vendedor",
        });
      }
    }

    // Try direct knowledge match (only if not handoff)
    const match = !justQualified ? findKnowledgeMatch(body.message, knowledge || []) : null;

    if (!justQualified && match) {
      reply = match.answer;
      matchedId = match.id;
    } else if (!justQualified && LOVABLE_API_KEY) {
      // Use AI with knowledge as context
      const knowledgeContext = (knowledge || [])
        .map((k: any) => `- ${k.question}\n  Resposta: ${k.answer}`)
        .join("\n");

      const persona = settings?.persona || "Você é um vendedor consultivo brasileiro.";
      const fallback = settings?.fallback_message || "Vou confirmar com nosso time e te retorno pelo WhatsApp.";
      const agentName = settings?.agent_name || "Rafael";
      const qualificationQs: string[] = Array.isArray(settings?.qualification_questions)
        ? settings.qualification_questions
        : [];
      const replyInBlocksPrompt = settings?.reply_in_blocks !== false;
      const qsList = qualificationQs.length
        ? qualificationQs.map((q, i) => `   ${i + 1}. ${q}`).join("\n")
        : "   (nenhuma definida — peça contato após 1-2 trocas)";

      // Per-page focus: tailor qualification flow to the page the visitor is on
      const pageFocus = (() => {
        if (body.page_context === "tecidos") {
          return `\nFOCO DESTA CONVERSA: TECIDOS. O lead está navegando na página de tecidos. Personalize as perguntas para entender:\n  - Qual tipo de peça produz (fitness, moda íntima, praia, esportivo, profissional)?\n  - Que tipo de tecido busca (suplex, microfibra, dryfit, helanca, etc.)?\n  - Volume aproximado mensal de metros?\n  - Está em fase de pesquisa, troca de fornecedor ou compra ativa?\nDirecione o papo para tecidos técnicos da Digitale e o benefício de ter um fornecedor industrial direto.`;
        }
        if (body.page_context === "estampas") {
          return `\nFOCO DESTA CONVERSA: ESTAMPAS. O lead está navegando na página de estampas. Personalize as perguntas para entender:\n  - Para qual coleção/segmento ele quer estampas (fitness, praia, moda íntima)?\n  - Procura estampa exclusiva (desenvolvimento próprio) ou estampas do nosso catálogo?\n  - Já tem arte pronta ou precisa que a Digitale desenvolva?\n  - Quantos metros aproximadamente por estampa?\nDirecione o papo para o nosso ateliê de estampas, exclusividade, qualidade de impressão e desenvolvimento sob demanda.`;
        }
        return "";
      })();

      const haveWhats = !!conversation?.visitor_whatsapp;
      const haveCnpj = !!conversation?.visitor_cnpj;
      const stage = haveWhats && haveCnpj
        ? "FECHAMENTO"
        : haveWhats || haveCnpj
        ? "COLETANDO_DADOS"
        : "QUALIFICACAO";

      const systemPrompt = `${persona}

Seu nome é ${agentName}. Você trabalha na Digitale Têxtil (indústria têxtil brasileira de tecidos de alta tecnologia para confecções).

ETAPA ATUAL DESTA CONVERSA: ${stage}
- WhatsApp já recebido? ${haveWhats ? "SIM (" + conversation.visitor_whatsapp + ")" : "NÃO"}
- CNPJ já recebido? ${haveCnpj ? "SIM (" + conversation.visitor_cnpj + ")" : "NÃO"}

SEU OBJETIVO PRINCIPAL (CRÍTICO): Captar o WhatsApp do lead a TODO custo, de forma natural e consultiva. Cada interação deve avançar para esse objetivo.

SEU FLUXO COMO VENDEDOR (siga sempre):
1. APRESENTAÇÃO: Já se apresentou na saudação. Não repita.
2. DESCOBERTA / QUALIFICAÇÃO: Faça as perguntas abaixo, UMA POR VEZ, em ordem, antes de pedir WhatsApp/CNPJ. Adapte a linguagem ao tom da conversa, mas cubra todos os tópicos:
${qsList}
3. GERAR DESEJO: Use a base de conhecimento para responder e SEMPRE conecte a resposta a um benefício comercial.
4. PEDIR CONTATO: SOMENTE depois de cobrir as perguntas de qualificação acima (ou se o lead já demonstrou alta intenção pulando etapas), peça WhatsApp e CNPJ de forma consultiva: "Show, com essas infos eu te conecto com o representante certo. Me passa seu WhatsApp e o CNPJ da empresa?".
5. Se ele perguntar QUALQUER COISA sobre preço, MOQ, prazo, amostras, condições — RESPONDA pedindo o WhatsApp imediatamente: "Esses detalhes o representante te passa direto. Me manda seu WhatsApp que em 5 min ele te chama com tudo."
6. Após receber o WhatsApp, o sistema fará o encerramento automaticamente.
7. Se o lead não quiser dar contato, INSISTA EDUCADAMENTE 2 vezes mais com ângulos diferentes (urgência, exclusividade, valor). Nunca seja chato, mas nunca desista no primeiro "não".
8. Se mesmo após 2 insistências o lead recusar deixar WhatsApp/CNPJ, OU se ele pedir explicitamente pra falar direto no WhatsApp/com um humano, ofereça um atalho incluindo a TAG ESPECIAL **[FALAR_REPRESENTANTE]** no final da mensagem. Essa tag será convertida automaticamente num botão "FALAR COM REPRESENTANTE" que abre o WhatsApp oficial. Use no máximo 1x por conversa. Exemplo: "Sem problema! Se preferir, fala direto com a gente aqui ó: [FALAR_REPRESENTANTE]".

REGRAS CRÍTICAS:
1. NUNCA admita ser uma IA, robô, bot ou assistente virtual. Você é um vendedor humano do time comercial.
2. Use linguagem coloquial, calorosa, brasileira. Pode usar "tá", "pra", "né", emojis ocasionais.
3. Respostas CURTAS (1-3 frases). Vendedor não escreve textão.${replyInBlocksPrompt ? `
3a. RESPOSTA EM BLOCOS: você PODE dividir sua resposta em até 3 mensagens curtas separando com a marca "||" (duas barras verticais). Ex: "Show, entendi!||Pra qual segmento é a sua marca?". Use isso pra parecer mais humano (mensagem curta + pergunta separada). Não exagere — só quando fizer sentido.` : ""}
4. NÃO invente dados (preço, MOQ, prazo, condições). Pra esses, peça WhatsApp e diga que o representante passa os detalhes.
5. Use APENAS as informações da base de conhecimento abaixo pra responder sobre produtos/empresa.
6. NUNCA forneça preços, MOQ, prazos de produção, condições de pagamento — sempre redirecione pro representante humano via WhatsApp.
7. Faça UMA pergunta por vez. Termine quase toda mensagem com uma pergunta que avance a venda.
8. SEJA COMERCIAL E PERSUASIVO. Você é um vendedor que precisa bater meta — toda conversa precisa virar lead.

BASE DE CONHECIMENTO DA EMPRESA:
${knowledgeContext}

PÁGINAS DO SITE: Tecidos, Estampas, Segmentos, Sustentabilidade, Sobre Nós, RADAR DIGITALE, Trabalhe Conosco.`;

      const finalSystemPrompt = systemPrompt + pageFocus;

      const messages = [
        { role: "system", content: finalSystemPrompt },
        ...(history || []).map((m: any) => ({
          role: m.role === "bot" ? "assistant" : "user",
          content: m.content,
        })),
      ];

      const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages,
          temperature: 0.7,
        }),
      });

      if (aiRes.status === 429 || aiRes.status === 402) {
        reply = fallback;
        isFallback = true;
      } else if (!aiRes.ok) {
        reply = fallback;
        isFallback = true;
      } else {
        const aiData = await aiRes.json();
        reply = aiData.choices?.[0]?.message?.content?.trim() || fallback;
        if (reply.toLowerCase().includes(fallback.substring(0, 30).toLowerCase())) {
          isFallback = true;
        }
      }
    } else if (!justQualified) {
      reply = settings?.fallback_message || "Vou confirmar com nosso time e te retorno pelo WhatsApp.";
      isFallback = true;
    }

    // Save bot reply
    await supabase.from("agent_messages").insert({
      conversation_id: conversationId,
      role: "bot",
      content: reply,
      matched_knowledge_id: matchedId,
      is_fallback: isFallback,
    });

    if (isFallback) {
      await supabase
        .from("agent_conversations")
        .update({ needs_followup: true })
        .eq("id", conversationId);
    }

    // Split reply into blocks if enabled (split by "||" or double newlines)
    const replyInBlocks = settings?.reply_in_blocks !== false;
    let blocks: string[] = [reply];
    if (replyInBlocks) {
      blocks = reply
        .split(/\s*\|\|\s*|\n\s*\n/)
        .map((s: string) => s.trim())
        .filter(Boolean);
      if (blocks.length === 0) blocks = [reply];
    }

    return new Response(
      JSON.stringify({
        conversation_id: conversationId,
        reply,
        blocks,
        is_fallback: isFallback,
        typing_speed_ms: settings?.typing_speed_ms ?? 30,
        min_typing_delay_ms: settings?.min_typing_delay_ms ?? 800,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("chat-agent error", err);
    return new Response(JSON.stringify({ error: err.message || "internal" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
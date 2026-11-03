import express from "express";
import crypto from "node:crypto";

import { db } from "../database.js";

const router = express.Router();

const PORTAL_AI_URL =
  process.env.PORTAL_AI_LEAD_URL
  || "http://127.0.0.1:8114/api/integrations/ai-leads";


const PORTAL_SITE_URL =
  process.env.PORTAL_LEAD_URL
  || "http://127.0.0.1:8114/api/integrations/site-leads";
function clean(value, max = 1000) {
  if (value === undefined || value === null) return null;
  return String(value).trim().slice(0, max) || null;
}

function normalize(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function onlyDigits(value) {
  return String(value || "").replace(/\D/g, "");
}


function isValidCnpj(value) {
  const digits = onlyDigits(value);

  if (/^\d{14}$/.test(digits) === false) return false;
  if (/^(\d)\1{13}$/.test(digits)) return false;

  const calculateDigit = (base, weights) => {
    const sum = base
      .split("")
      .reduce(
        (total, digit, index) =>
          total + Number(digit) * weights[index],
        0
      );

    const remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };

  const firstDigit = calculateDigit(
    digits.slice(0, 12),
    [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
  );

  const secondDigit = calculateDigit(
    digits.slice(0, 12) + String(firstDigit),
    [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
  );

  return digits.slice(-2) === String(firstDigit) + String(secondDigit);
}

function isValidBrazilianPhone(value) {
  let digits = onlyDigits(value);

  if (
    digits.startsWith("55")
    && (digits.length === 12 || digits.length === 13)
  ) {
    digits = digits.slice(2);
  }

  if (digits.length !== 10 && digits.length !== 11) return false;
  if (/^(\d)\1+$/.test(digits)) return false;

  const ddd = digits.slice(0, 2);

  const validDdds = new Set([
    "11","12","13","14","15","16","17","18","19",
    "21","22","24","27","28",
    "31","32","33","34","35","37","38",
    "41","42","43","44","45","46","47","48","49",
    "51","53","54","55",
    "61","62","63","64","65","66","67","68","69",
    "71","73","74","75","77","79",
    "81","82","83","84","85","86","87","88","89",
    "91","92","93","94","95","96","97","98","99"
  ]);

  if (validDdds.has(ddd) === false) return false;

  const local = digits.slice(2);

  if (digits.length === 11) {
    return /^9\d{8}$/.test(local);
  }

  return /^[2-5]\d{7}$/.test(local);
}
function extractChatContact(value, options = {}) {
  const text = String(value || "").trim();
  const allowStandalonePhone = Boolean(options.allowStandalonePhone);

  const emailMatch = text.match(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i);

  const cnpjMatch = /cnpj/i.test(text)
    ? text.match(/(?:\d[\s.\/-]?){14}/)
    : null;

  let cnpjDigits = cnpjMatch ? onlyDigits(cnpjMatch[0]) : null;
  if (cnpjDigits && isValidCnpj(cnpjDigits) === false) cnpjDigits = null;

  const phoneContext =
    /(whats(?:app)?|telefone|fone|celular|contato|me chama|pode me chamar|me liga)/i.test(text)
    || (allowStandalonePhone && /^\s*(?:\+?55[\s().-]*)?\d[\d\s().-]{8,16}\s*$/.test(text));

  const phoneMatch = phoneContext
    ? text.match(/(?:\+?55[\s().-]*)?(?:\(?\d{2}\)?[\s.-]*)?\d{4,5}[\s.-]*\d{4}/)
    : null;

  let phoneDigits = phoneMatch ? onlyDigits(phoneMatch[0]) : null;
  if (phoneDigits && (phoneDigits.length < 10 || phoneDigits.length > 13)) phoneDigits = null;
  if (phoneDigits && isValidBrazilianPhone(phoneDigits) === false) phoneDigits = null;
  /* PHONE_NORMALIZE_BR */
  if (phoneDigits && phoneDigits.startsWith("55") && (phoneDigits.length === 12 || phoneDigits.length === 13)) {
    phoneDigits = phoneDigits.slice(2);
  }

  const nameMatch = text.match(/(?:meu nome (?:é|e)|me chamo)\s+([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ -]{1,60})/i);

  return {
    name: clean(nameMatch?.[1], 180),
    email: clean(emailMatch?.[0], 254)?.toLowerCase() || null,
    phone: phoneDigits,
    cnpj: cnpjDigits && cnpjDigits.length === 14 ? cnpjDigits : null,
  };
}

function parseJson(value, fallback) {
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(String(value));
  } catch {
    return fallback;
  }
}

function splitKeywords(value) {
  const parsed = parseJson(value, null);
  if (Array.isArray(parsed)) {
    return parsed.map((item) => clean(item, 120)).filter(Boolean);
  }
  return String(value || "")
    .split(/[,;\n|]+/)
    .map((item) => clean(item, 120))
    .filter(Boolean);
}

function inferSegment(text) {
  const value = normalize(text);
  const candidates = [
    ["fitness", ["fitness", "academia", "legging", "top", "activewear"]],
    ["moda praia", ["praia", "biquini", "biquíni", "maio", "maiô", "beachwear"]],
    ["moda íntima", ["intima", "íntima", "lingerie", "cueca", "sutia", "sutiã"]],
    ["esportivo", ["esportivo", "esporte", "corrida", "ciclismo", "futebol"]],
    ["profissional", ["profissional", "uniforme", "jaleco", "workwear"]],
  ];
  for (const [segment, words] of candidates) {
    if (words.some((word) => value.includes(normalize(word)))) return segment;
  }
  return null;
}

function calculateInterest(text, historyCount = 0) {
  const value = normalize(text);
  let score = 25 + Math.min(historyCount * 8, 24);

  const hot = [
    "orcamento", "orçamento", "comprar", "pedido", "fechar", "amostra",
    "fornecedor", "preco", "preço", "valor", "urgente", "quanto custa",
    "metros", "quantidade", "prazo"
  ];

  const warm = [
    "tecido", "estampa", "colecao", "coleção", "catalogo", "catálogo",
    "tecnologia", "uv", "aloe", "compressao", "compressão", "sustentavel",
    "sustentável"
  ];

  if (hot.some((word) => value.includes(normalize(word)))) score += 35;
  if (warm.some((word) => value.includes(normalize(word)))) score += 15;

  score = Math.max(0, Math.min(100, score));

  return {
    score,
    level: score >= 75 ? "quente" : score >= 45 ? "morno" : "frio",
  };
}

function wantsHuman(text) {
  const value = normalize(text);
  return [
    "representante",
    "vendedor",
    "atendente",
    "humano",
    "pessoa",
    "falar com alguem",
    "falar com alguém",
  ].some((word) => value.includes(normalize(word)));
}

function requiresRepresentative(text) {
  const value = normalize(text);
  return [
    "preco",
    "preço",
    "valor",
    "quanto custa",
    "prazo",
    "pagamento",
    "condicao de pagamento",
    "condição de pagamento",
    "pedido minimo",
    "pedido mínimo",
    "moq",
  ].some((word) => value.includes(normalize(word)));
}

function findKnowledgeMatch(message, knowledge, contextText = "") {
  const text = normalize(message);
  if (!text) return null;

  const context = normalize(contextText);

  const recommendationIntent =
    /\b(indica|indicam|indicar|recomenda|recomendam|recomendar|melhor|ideal|usar|uso|serve|serviria)\b/.test(text)
    || /\b(qual|que)\s+tecido\b/.test(text)
    || /\btecido\s+(para|pra)\b/.test(text);

  const fabricRecommendationIntent =
    recommendationIntent
    && (
      /\b(qual|que)\s+tecido\b/.test(text)
      || /\btecido\s+(para|pra)\b/.test(text)
      || /\b(preciso|quero|procuro|busco)\b.*\btecido\b/.test(text)
    );

  const fabricNames = [
    "milano",
    "oceanic",
    "oceanic eco",
    "caribe",
    "flow",
    "softskin",
    "veneza",
    "aerodry",
    "lyon",
    "intense",
  ];

  const genericKeywords = new Set([
    "tecido",
    "tecidos",
    "produto",
    "produtos",
    "linha",
    "catalogo",
    "fitness",
    "praia",
    "camiseta",
    "camisetas",
    "pedido",
    "quantidade",
    "segmento",
    "segmentos",
  ]);

  const semanticParts = [text];

  // Só usa o histórico para complementar uma indicação pedida pelo cliente.
  // Assim uma fala antiga não contamina perguntas independentes.
  if (recommendationIntent && context) {
    semanticParts.push(context);
  }

  const baseSemanticText = semanticParts.join(" ");
  const aliases = [];

  if (/\b(academia|treino|gym)\b/.test(baseSemanticText)) {
    aliases.push("fitness");
  }

  if (/\b(encorpado|encorpada|grosso|grossa|firme|sustentacao)\b/.test(baseSemanticText)) {
    aliases.push("compressao alta compressao");
  }

  if (/\b(nao transparente|sem transparencia|nao ficar transparente)\b/.test(baseSemanticText)) {
    aliases.push("zero transparencia");
  }

  if (/\b(secagem rapida|respiravel|respirabilidade)\b/.test(baseSemanticText)) {
    aliases.push("dry fit");
  }

  const semanticText = `${baseSemanticText} ${aliases.join(" ")}`.trim();

  let best = null;

  for (const item of knowledge) {
    const category = normalize(item.category);
    const question = normalize(item.question);
    const answer = clean(item.answer, 5000);

    if (!answer) continue;

    const keywords = splitKeywords(item.keywords);
    let score = 0;
    let meaningfulHits = 0;
    let namedFabricHit = false;

    const seenKeywords = new Set();

    for (const keyword of keywords) {
      const normalizedKeyword = normalize(keyword);

      if (!normalizedKeyword || seenKeywords.has(normalizedKeyword)) continue;
      seenKeywords.add(normalizedKeyword);

      if (semanticText.includes(normalizedKeyword)) {
        if (fabricNames.includes(normalizedKeyword)) {
          score += 10;
          meaningfulHits += 1;
          namedFabricHit = true;
        } else if (genericKeywords.has(normalizedKeyword)) {
          score += 1;
        } else if (normalizedKeyword.includes(" ")) {
          score += 5;
          meaningfulHits += 1;
        } else {
          score += 3;
          meaningfulHits += 1;
        }
      }
    }

    // Tokens da pergunta ajudam no desempate, mas não dominam o resultado.
    const questionTokens = question
      .split(/\s+/)
      .filter((token) => token.length >= 5);

    for (const token of questionTokens) {
      if (text.includes(token)) {
        score += 1;
      }
    }

    // Uma recomendação específica exige intenção real ou sinais suficientes.
    // "fitness" sozinho, por exemplo, não deve disparar Milano.
    if (category === "recomendacao") {
      if (recommendationIntent) {
        score += 4;
      }

      if (
        recommendationIntent === false
        && namedFabricHit === false
        && meaningfulHits < 2
      ) {
        continue;
      }
    }

    /* FABRIC_RECOMMENDATION_PRIORITY_V1 */
    if (fabricRecommendationIntent) {
      if (category === "recomendacao") {
        score += 8;
      }

      if (category === "tecnologia") {
        score -= 4;
      }
    }

    // Entradas de produto individual só devem ganhar por nome do tecido.
    if (category === "produto" && namedFabricHit === false) {
      continue;
    }

    // Reforços para intenções gerais da base.
    if (
      category === "produtos"
      && /\b(quais|qual|tem|trabalham|fazem|fabricam|segmentos|sustentabilidade|estampa|estampas|catalogo)\b/.test(text)
    ) {
      score += 3;
    }

    if (
      category === "tecnologia"
      && /\b(uv|aloe|stretch|elasticidade|transparencia|microcapsulas|hidratacao|tecnologia)\b/.test(text)
    ) {
      score += 3;
    }

    if (
      category === "comercial"
      && /\b(minimo|pedido minimo|pessoa fisica|varejo|unidade)\b/.test(text)
    ) {
      score += 5;
    }

    if (
      category === "contato"
      && /\b(contato|falar|telefone|whatsapp|atendimento)\b/.test(text)
    ) {
      score += 5;
    }

    if (
      category === "empresa"
      && /\b(onde|localizacao|endereco|empresa)\b/.test(text)
    ) {
      score += 5;
    }

    if (!best || score > best.score) {
      best = { ...item, score };
    }
  }

  return best && best.score >= 4 ? best : null;
}


function naturalizeKnowledgeAnswer(matched) {
  const original = clean(matched?.answer, 3500);
  if (!original) return "";

  const category = normalize(matched?.category);

  if (category !== "recomendacao") {
    return original;
  }

  const source = normalize(
    `${matched?.question || ""} ${matched?.keywords || ""} ${original}`
  );

  if (source.includes("milano")) {
    return (
      "Para esse caso, eu indicaria o Milano. "
      + "Ele funciona muito bem em leggings e shorts quando a prioridade é alta compressão, "
      + "além de reunir recuperação elástica, UV 50+, tecnologia antibacteriana, "
      + "Zero Transparência e Aloe Vera."
    );
  }

  if (source.includes("oceanic eco")) {
    return (
      "Se a proposta é uma moda praia mais sustentável, eu indicaria o Oceanic Eco. "
      + "Ele utiliza fibras recicladas de garrafas PET pós-consumo e mantém recursos "
      + "como UV 50+, tecnologia antibacteriana e Aloe Vera."
    );
  }

  if (source.includes("oceanic")) {
    return (
      "Para biquínis, maiôs e sungas, eu indicaria o Oceanic. "
      + "É a nossa principal base cadastrada para moda praia e combina elasticidade, "
      + "secagem rápida, durabilidade, UV 50+, tecnologia antibacteriana e Aloe Vera."
    );
  }

  if (source.includes("caribe")) {
    return (
      "Para camiseta com proteção UV, o Caribe é uma opção bem alinhada. "
      + "Ele tem toque gelado, aspecto opaco, caimento fluido, UV 50+, "
      + "tecnologia antibacteriana e Aloe Vera."
    );
  }

  if (source.includes("flow")) {
    return (
      "Para forro de moda praia, eu indicaria o Flow. "
      + "Ele tem toque macio e sedoso e secagem rápida, além de também poder ser usado "
      + "em moda casual e camisas UV."
    );
  }

  if (source.includes("softskin")) {
    return (
      "Se você procura uma peça mais leve e fluida, o Softskin é uma opção interessante. "
      + "Ele aparece no nosso cadastro para saídas de praia, vestidos, pantalonas, "
      + "pijamas, lingeries e também biquínis."
    );
  }

  if (source.includes("veneza")) {
    return (
      "Para esse efeito mais sofisticado, eu indicaria o Veneza. "
      + "Ele tem acabamento acetinado e brilho elegante, com aplicação em bodys, "
      + "macacões, peças premium e moda praia."
    );
  }

  if (source.includes("aerodry")) {
    return (
      "Para esse caso, eu indicaria o Aerodry. "
      + "Ele é uma base Dry Fit com alta respirabilidade, indicada para camisetas, "
      + "regatas, bermudas e uniformes esportivos."
    );
  }

  return original;
}

function contextualQualificationQuestion({ matched, message, next }) {
  if (!next) return null;

  const category = normalize(matched?.category);
  const text = normalize(message);
  const normalizedNext = normalize(next);

  // Pergunta informativa: responde sem iniciar qualificação à força.
  if (category === "tecnologia" || category === "produto") {
    return null;
  }

  if (category !== "recomendacao") {
    return next;
  }

  if (normalizedNext.includes("segmento da sua marca")) {
    if (
      text.includes("camiseta")
      || text.includes("camisa")
      || text.includes("regata")
    ) {
      return "Essa peça entra na sua linha fitness, esportiva ou profissional?";
    }

    if (
      text.includes("body")
      || text.includes("macacao")
    ) {
      return "Essa peça é para fitness, moda praia ou moda íntima?";
    }
  }

  if (
    normalizedNext.includes("estimativa de metragem")
    || normalizedNext.includes("metragem ou volume")
  ) {
    return "Você já tem uma metragem aproximada para essa produção?";
  }

  if (normalizedNext.includes("fase de pesquisa")) {
    return "Você ainda está pesquisando opções ou já tem uma produção em andamento?";
  }

  return next;
}

function nextQualificationQuestion({ pageContext, segment, historyText, score }) {
  const text = normalize(historyText);

  if (!segment) {
    if (pageContext === "estampas") {
      return "Essa estampa é para qual linha: fitness, praia ou moda íntima?";
    }
    return "Para eu filtrar melhor as opções, qual é o segmento da sua marca ou confecção?";
  }

  if (pageContext === "estampas") {
    if (!text.includes("catalog") && !text.includes("exclusiv") && !text.includes("arte")) {
      return "Você procura uma estampa do nosso catálogo ou um desenvolvimento exclusivo?";
    }
    if (!["metro","metros","quantidade","volume","kg","quilo"].some((word) => text.includes(word))) {
      return "Você já tem uma estimativa de quantidade ou metragem para essa coleção?";
    }
  } else {
    if (![
      "peca","peça","aplic","legging","top","short","bermuda",
      "biquini","biquíni","maio","maiô","camiseta","camisa","body",
      "saida de praia","vestido","pantalona","regata","uniforme",
      "sunga","lingerie","macacao"
    ].some((word) => text.includes(word))) {
      return "Que tipo de peça ou aplicação você pretende produzir com esse tecido?";
    }
    if (!["metro","metros","quantidade","volume","kg","quilo"].some((word) => text.includes(word))) {
      return "Você já tem uma estimativa de metragem ou volume para essa produção?";
    }
  }

  const hasPurchaseStage = [
    "fase de pesquisa",
    "em pesquisa",
    "pesquisando",
    "troca de fornecedor",
    "trocar de fornecedor",
    "ja produzo",
    "em producao",
    "estou produzindo",
    "compra em andamento",
    "pedido em andamento",
    "pedido aberto",
  ].some((phrase) => text.includes(phrase));

  if (!hasPurchaseStage) {
    return "Você está em fase de pesquisa, troca de fornecedor ou já tem uma compra em andamento?";
  }

  if (![
      "compressao", "compressão", "toque", "elasticidade", "acabamento", "gramatura",
      "encorpado", "encorpada", "grosso", "grossa", "firme",
      "transparencia", "transparência", "cobertura", "brilho", "acetinado",
      "opaco", "leve", "fluido", "secagem", "respirabilidade", "dry fit"
    ].some((word) => text.includes(normalize(word)))) {
    return "Qual característica é mais importante para você: compressão, toque, elasticidade ou acabamento?";
  }

  return "Perfeito. Tem mais alguma dúvida sobre o tecido ou o desenvolvimento?";
}

async function saveMessage(connection, {
  conversationId,
  role,
  content,
  matchedKnowledgeId = null,
  isFallback = false,
}) {
  const id = crypto.randomUUID();
  const payload = {
    id,
    conversation_id: conversationId,
    role,
    content,
    matched_knowledge_id: matchedKnowledgeId,
    is_fallback: Boolean(isFallback),
  };

  await connection.execute(
    `INSERT INTO agent_messages
     (
       id,
       data,
       conversation_id,
       role,
       content,
       matched_knowledge_id,
       is_fallback
     )
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      JSON.stringify(payload),
      conversationId,
      role,
      content,
      matchedKnowledgeId,
      isFallback ? 1 : 0,
    ]
  );
}

async function syncPortal(payload) {
  const secret = clean(process.env.PORTAL_LEAD_SECRET, 1000);
  if (!secret) {
    return { ok: false, skipped: true, reason: "portal_secret_missing" };
  }

  try {
    const response = await fetch(PORTAL_AI_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-site-lead-secret": secret,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(5000),
    });

    const body = await response.json().catch(() => ({}));

    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        error: body?.error || "portal_sync_failed",
      };
    }

    return { ok: true, ...body };
  } catch (error) {
    return {
      ok: false,
      error: error?.message || "portal_sync_failed",
    };
  }
}

async function syncPortalSite(payload) {
  const secret = clean(process.env.PORTAL_LEAD_SECRET, 1000);
  if (!secret) {
    return { ok: false, skipped: true, reason: "portal_secret_missing" };
  }

  try {
    const response = await fetch(PORTAL_SITE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-site-lead-secret": secret,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(5000),
    });

    const body = await response.json().catch(() => ({}));

    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        error: body?.error || "portal_site_sync_failed",
      };
    }

    return { ok: true, ...body };
  } catch (error) {
    return {
      ok: false,
      error: error?.message || "portal_site_sync_failed",
    };
  }
}

router.post("/chat-agent", async (req, res) => {
  const body = req.body || {};
  const sessionId = clean(body.session_id, 191);
  const message = clean(body.message, 4000);
  const visitorKey = clean(body.visitor_key, 80);
  const pageUrl = clean(body.page_url, 1500);
  const userAgent = clean(body.user_agent, 1500);
  const pageContext = clean(body.page_context, 80);

  if (!sessionId || !message) {
    return res.status(400).json({
      data: null,
      error: { message: "missing_fields" },
    });
  }

  let connection;

  try {
    connection = await db.getConnection();
    await connection.beginTransaction();

    const [settingsRows] = await connection.execute(
      `SELECT *
       FROM agent_settings
       WHERE \`key\` = 'main'
       LIMIT 1`
    );

    const settings = settingsRows[0] || {};
    if (Number(settings.is_enabled) === 0) {
      await connection.rollback();
      return res.status(403).json({
        data: null,
        error: { message: "agent_disabled" },
      });
    }

    const [knowledge] = await connection.execute(
      `SELECT *
       FROM agent_knowledge
       WHERE COALESCE(is_active, 1) = 1
       ORDER BY COALESCE(display_order, 9999), created_at ASC`
    );

    let conversation = null;
    let conversationId = clean(body.conversation_id, 191);

    if (conversationId) {
      const [rows] = await connection.execute(
        `SELECT *
         FROM agent_conversations
         WHERE id = ?
         LIMIT 1`,
        [conversationId]
      );
      conversation = rows[0] || null;
    }

    if (!conversation) {
      const [rows] = await connection.execute(
        `SELECT *
         FROM agent_conversations
         WHERE session_id = ?
         ORDER BY created_at DESC
         LIMIT 1`,
        [sessionId]
      );
      conversation = rows[0] || null;
      conversationId = conversation?.id || null;
    }

    let trackingVisitor = null;

    if (visitorKey && /^[A-Za-z0-9_-]{10,80}$/.test(visitorKey)) {
      const [rows] = await connection.execute(
        `SELECT
           visitor_key,
           lead_name,
           lead_email,
           lead_phone,
           lead_company,
           lead_cnpj,
           score,
           identified_at
         FROM tracking_visitors
         WHERE visitor_key = ?
         LIMIT 1`,
        [visitorKey]
      );
      trackingVisitor = rows[0] || null;
    }

    if (!conversation) {
      conversationId = crypto.randomUUID();

      const initialData = {
        id: conversationId,
        session_id: sessionId,
        page_url: pageUrl,
        user_agent: userAgent,
        visitor_key: visitorKey,
        page_context: pageContext,
      };

      await connection.execute(
        `INSERT INTO agent_conversations
         (
           id,
           data,
           session_id,
           page_url,
           user_agent,
           visitor_name,
           visitor_whatsapp,
           visitor_cnpj,
           status,
           needs_followup
         )
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', 0)`,
        [
          conversationId,
          JSON.stringify(initialData),
          sessionId,
          pageUrl,
          userAgent,
          trackingVisitor?.lead_name || null,
          trackingVisitor?.lead_phone || null,
          trackingVisitor?.lead_cnpj || null,
        ]
      );

      conversation = {
        id: conversationId,
        session_id: sessionId,
        page_url: pageUrl,
        user_agent: userAgent,
        visitor_name: trackingVisitor?.lead_name || null,
        visitor_whatsapp: trackingVisitor?.lead_phone || null,
        visitor_cnpj: trackingVisitor?.lead_cnpj || null,
        status: "active",
      };
    } else {
      await connection.execute(
        `UPDATE agent_conversations
         SET
           page_url = COALESCE(?, page_url),
           user_agent = COALESCE(?, user_agent),
           visitor_name = COALESCE(visitor_name, ?),
           visitor_whatsapp = COALESCE(visitor_whatsapp, ?),
           visitor_cnpj = COALESCE(visitor_cnpj, ?),
           updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [
          pageUrl,
          userAgent,
          trackingVisitor?.lead_name || null,
          trackingVisitor?.lead_phone || null,
          trackingVisitor?.lead_cnpj || null,
          conversationId,
        ]
      );

      conversation = {
        ...conversation,
        visitor_name: conversation.visitor_name || trackingVisitor?.lead_name || null,
        visitor_whatsapp: conversation.visitor_whatsapp || trackingVisitor?.lead_phone || null,
        visitor_cnpj: conversation.visitor_cnpj || trackingVisitor?.lead_cnpj || null,
      };
    }

      const conversationData = parseJson(conversation?.data, {
        id: conversationId,
        session_id: sessionId,
        page_url: pageUrl,
        user_agent: userAgent,
        visitor_key: visitorKey,
        page_context: pageContext,
      });

      /* PREVIOUS_BOT_PHONE_CONTEXT */
      const [previousBotRows] = await connection.execute(
        `SELECT content
         FROM agent_messages
         WHERE conversation_id = ?
           AND role IN ("bot", "assistant")
         ORDER BY created_at DESC
         LIMIT 1`,
        [conversationId]
      );

      const previousBotContent = String(previousBotRows?.[0]?.content || "");
      const allowStandalonePhone =
        /(whats(?:app)?|telefone|fone|celular|número|numero|contato)/i.test(previousBotContent)
        && /(qual|informe|envie|mande|passar|passe|digite|seu|sua)/i.test(previousBotContent);

      const chatContact = extractChatContact(message, { allowStandalonePhone });
      const previousChatIdentity = Boolean(conversationData?.chat_identity);
      const messageHasStableContact = Boolean(chatContact.email || chatContact.phone || chatContact.cnpj);

      const contact = {
        name: chatContact.name || conversation.visitor_name || trackingVisitor?.lead_name || null,
        email: chatContact.email || conversationData?.visitor_email || trackingVisitor?.lead_email || null,
        phone: chatContact.phone || conversation.visitor_whatsapp || trackingVisitor?.lead_phone || null,
        cnpj: chatContact.cnpj || conversation.visitor_cnpj || trackingVisitor?.lead_cnpj || null,
      };

      const chatIdentified = previousChatIdentity || messageHasStableContact;
      const isIdentified = Boolean(trackingVisitor?.identified_at || chatIdentified);

      if (chatContact.name || chatContact.email || chatContact.phone || chatContact.cnpj) {
        const nextConversationData = {
          ...conversationData,
          visitor_email: contact.email,
          chat_identity: previousChatIdentity || messageHasStableContact,
        };

        await connection.execute(
          `UPDATE agent_conversations
           SET
             data = ?,
             visitor_name = COALESCE(?, visitor_name),
             visitor_whatsapp = COALESCE(?, visitor_whatsapp),
             visitor_cnpj = COALESCE(?, visitor_cnpj),
             updated_at = CURRENT_TIMESTAMP
           WHERE id = ?`,
          [
            JSON.stringify(nextConversationData),
            chatContact.name,
            chatContact.phone,
            chatContact.cnpj,
            conversationId,
          ]
        );

        conversation = {
          ...conversation,
          data: JSON.stringify(nextConversationData),
          visitor_name: contact.name,
          visitor_whatsapp: contact.phone,
          visitor_cnpj: contact.cnpj,
        };
      }

    await saveMessage(connection, {
      conversationId,
      role: "user",
      content: message,
    });

    const [historyRows] = await connection.execute(
      `SELECT role, content
       FROM agent_messages
       WHERE conversation_id = ?
       ORDER BY created_at DESC
       LIMIT 30`,
      [conversationId]
    );
      historyRows.reverse();

    const userMessages = historyRows
      .filter((item) => String(item.role).toLowerCase() === "user")
      .map((item) => clean(item.content, 1000))
      .filter(Boolean);

    const historyText = userMessages.join(" | ");
    const segment = inferSegment(historyText);
    const interest = calculateInterest(historyText, userMessages.length);
    const summary = userMessages.slice(-5).join(" | ").slice(0, 1200);

      const previousAssistantMessage = historyRows.slice().reverse().find((item) => ["bot", "assistant"].includes(String(item.role).toLowerCase()))?.content || "";
      const shortAffirmative = ["sim", "pode", "pode sim", "quero", "claro", "ok", "vamos", "por favor"].includes(normalize(message));
      const acceptedHandoff = shortAffirmative && ["encaminhar", "comercial", "representante", "cotacao"].some((term) => normalize(previousBotContent).includes(term));
      const handoffContactRequested = ["whatsapp", "email", "e-mail"].some((term) => normalize(previousBotContent).includes(term))
        && ["encaminhar", "comercial"].some((term) => normalize(previousBotContent).includes(term));
      const contactCompletesHandoff = messageHasStableContact && handoffContactRequested;
    const explicitHandoff = wantsHuman(message) || acceptedHandoff || contactCompletesHandoff;
    const handoffReady = explicitHandoff && isIdentified;
    const commercialQuestion = requiresRepresentative(message);

    /* QUALIFICATION_ANSWER_ONLY_V2 */
    const normalizedMessage = normalize(message);
    const previousUserText = normalize(userMessages.slice(0, -1).join(" | "));
    const userIsAsking =
      /[?]/.test(String(message))
      || /^(qual|quais|quanto|como|onde|tem|possui)\b/.test(normalizedMessage)
      || /\b(recomenda|recomendam|indica|indicam|quero saber|gostaria de saber)\b/.test(normalizedMessage);

    const pieceWords = [
      "legging","top","short","bermuda","biquini","maio",
      "camiseta","camisa","body","saida de praia","vestido",
      "pantalona","regata","uniforme","sunga","lingerie","macacao"
    ];
    const quantityWords = ["metro","metros","quantidade","volume","kg","quilo"];
    const stageWords = ["pesquisa","pesquisando","fornecedor","producao","compra","pedido"];
    const featureWords = [
      "compressao","toque","elasticidade","acabamento","gramatura",
      "encorpado","encorpada","grosso","grossa","firme",
      "transparencia","cobertura","brilho","acetinado","opaco",
      "leve","fluido","secagem","respirabilidade","dry fit"
    ];

    const previousHasSegment = Boolean(inferSegment(previousUserText));
    const currentHasSegment = Boolean(inferSegment(message));
    const previousHasPiece = pieceWords.some((word) => previousUserText.includes(normalize(word)));
    const currentHasPiece = pieceWords.some((word) => normalizedMessage.includes(normalize(word)));
    const previousHasQuantity = quantityWords.some((word) => previousUserText.includes(normalize(word)));
    const currentHasQuantity = quantityWords.some((word) => normalizedMessage.includes(normalize(word)));
    const previousHasStage = stageWords.some((word) => previousUserText.includes(normalize(word)));
    const currentHasStage = stageWords.some((word) => normalizedMessage.includes(normalize(word)));
    const previousHasFeature = featureWords.some((word) => previousUserText.includes(normalize(word)));
    const currentHasFeature = featureWords.some((word) => normalizedMessage.includes(normalize(word)));

    const qualificationAnswerOnly =
      userIsAsking === false
      && (
        (previousHasSegment === false && currentHasSegment)
        || (previousHasPiece === false && currentHasPiece)
        || (previousHasQuantity === false && currentHasQuantity)
        || (previousHasStage === false && currentHasStage)
        || (previousHasFeature === false && currentHasFeature)
      );

    const matched =
      explicitHandoff || qualificationAnswerOnly
        ? null
        : findKnowledgeMatch(message, knowledge, previousUserText);

    let reply = "";
    let matchedKnowledgeId = null;
    let isFallback = false;

    if (explicitHandoff) {
      if (contactCompletesHandoff) {
        reply =
          "Perfeito, contato registrado. Já encaminhei o contexto da conversa para o nosso comercial. "
          + "Você pode continuar diretamente com um representante. [FALAR_REPRESENTANTE]";
      } else if (isIdentified === false) {
        reply =
          "Perfeito. Para eu encaminhar seu atendimento com o contexto completo ao nosso comercial, "
          + "me informe seu WhatsApp com DDD ou e-mail.";
      } else {
        reply =
          "Claro. Já registrei o contexto da conversa para o nosso time comercial. "
          + "Você pode continuar diretamente com um representante. [FALAR_REPRESENTANTE]";
      }
    } else if (commercialQuestion && !matched) {
      reply =
        "Consigo te orientar sobre isso. Valores, prazos e condições podem variar conforme o tecido e a quantidade. "
          + "Qual tecido ou aplicação você está avaliando?";
      } else if (matched) {
        matchedKnowledgeId = matched.id;

        const baseNext = nextQualificationQuestion({
          pageContext,
          segment,
          historyText,
          score: interest.score,
        });

        const next = contextualQualificationQuestion({
          matched,
          message,
          next: baseNext,
        });

        const naturalAnswer = naturalizeKnowledgeAnswer(matched);

        const normalizedNext = normalize(next);
        const normalizedPreviousBot = normalize(previousBotContent);

        const repeatQualification = Boolean(
          normalizedNext
          && normalizedPreviousBot.includes(normalizedNext)
        );

        reply =
          !next || repeatQualification
            ? naturalAnswer
            : `${naturalAnswer}||${next}`;
    } else {
      const next = nextQualificationQuestion({
        pageContext,
        segment,
        historyText,
        score: interest.score,
      });

      if (interest.score >= 85 && next.startsWith("Perfeito.")) {
        reply =
          "Perfeito. Já entendi bem o que você procura.||"
          + (isIdentified
            ? "Se quiser, posso encaminhar esse contexto para o nosso comercial continuar a indicação e a cotação. [FALAR_REPRESENTANTE]"
            : "Se quiser, posso encaminhar esse contexto para o nosso comercial continuar a indicação e a cotação.");
      } else {
        const repeatedNext = Boolean(
          next
          && normalize(previousBotContent).includes(normalize(next))
        );

        if (qualificationAnswerOnly && repeatedNext) {
          const qualificationAck =
            currentHasFeature
              ? "Entendi, vou considerar essa característica na indicação."
              : currentHasQuantity
                ? "Perfeito, vou considerar esse volume."
                : currentHasPiece
                  ? "Entendi, vou considerar essa peça."
                  : currentHasSegment
                    ? "Perfeito, vou considerar esse segmento."
                    : currentHasStage
                      ? "Entendi."
                      : "";

          reply = qualificationAck
            ? `${qualificationAck}||${next}`
            : next;
        } else {
          reply = repeatedNext
            ? "Claro. Pode me dizer primeiro o que você quer saber sobre nossos tecidos, estampas ou tecnologias."
            : next;
        }
      }
      isFallback = false;
    }

    const needsFollowup =
      explicitHandoff
      || commercialQuestion
      || interest.score >= 70
      || isIdentified;

    const handoffAt =
      handoffReady
        ? new Date()
        : null;

    await connection.execute(
      `UPDATE agent_conversations
       SET
         qualification_summary = ?,
         interest_level = ?,
         needs_followup = ?,
         status = ?,
         handoff_at = COALESCE(?, handoff_at),
         updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        summary,
        interest.level,
        needsFollowup ? 1 : 0,
        handoffReady ? "handoff" : "active",
        handoffAt,
        conversationId,
      ]
    );

    let leadId = null;

    if (isIdentified) {
      const [leadRows] = await connection.execute(
        `SELECT id
         FROM agent_leads
         WHERE conversation_id = ?
         ORDER BY created_at DESC
         LIMIT 1`,
        [conversationId]
      );

      const leadPayload = {
        conversation_id: conversationId,
        visitor_name: contact.name,
        whatsapp: contact.phone,
        cnpj: contact.cnpj,
        email: contact.email,
        segment,
        interest_summary: summary,
        interest_level: interest.level,
        status: "new",
        page_url: pageUrl || conversation.page_url || null,
        source: "IA",
      };

      if (leadRows.length) {
        leadId = leadRows[0].id;
        await connection.execute(
          `UPDATE agent_leads
           SET
             data = ?,
             visitor_name = ?,
             whatsapp = ?,
             cnpj = ?,
             email = ?,
             segment = ?,
             interest_summary = ?,
             interest_level = ?,
             status = 'new',
             page_url = ?,
             source = 'IA',
             updated_at = CURRENT_TIMESTAMP
           WHERE id = ?`,
          [
            JSON.stringify({ id: leadId, ...leadPayload }),
            leadPayload.visitor_name,
            leadPayload.whatsapp,
            leadPayload.cnpj,
            leadPayload.email,
            leadPayload.segment,
            leadPayload.interest_summary,
            leadPayload.interest_level,
            leadPayload.page_url,
            leadId,
          ]
        );
      } else {
        leadId = crypto.randomUUID();
        await connection.execute(
          `INSERT INTO agent_leads
           (
             id,
             data,
             conversation_id,
             visitor_name,
             whatsapp,
             cnpj,
             email,
             segment,
             interest_summary,
             interest_level,
             status,
             page_url,
             source
           )
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'new', ?, 'IA')`,
          [
            leadId,
            JSON.stringify({ id: leadId, ...leadPayload }),
            conversationId,
            leadPayload.visitor_name,
            leadPayload.whatsapp,
            leadPayload.cnpj,
            leadPayload.email,
            leadPayload.segment,
            leadPayload.interest_summary,
            leadPayload.interest_level,
            leadPayload.page_url,
          ]
        );
      }
    }

    await saveMessage(connection, {
      conversationId,
      role: "bot",
      content: reply,
      matchedKnowledgeId,
      isFallback,
    });

    await connection.commit();

    let portalSync = { ok: false, skipped: true, reason: "visitor_not_identified" };

    if (trackingVisitor?.identified_at && visitorKey) {
      portalSync = await syncPortal({
        visitor_key: visitorKey,
        conversation_id: conversationId,
        qualification_summary: summary,
        segment,
        page_url: pageUrl || conversation.page_url || null,
        page_context: pageContext,
        interest_level: interest.level,
        score: interest.score,
      });
    }

      /* CHAT_IDENTITY_SITE_TO_AI */
      if (chatIdentified && !(trackingVisitor?.identified_at && visitorKey)) {
        const effectiveVisitorKey =
          visitorKey && /^[A-Za-z0-9_-]{10,80}$/.test(visitorKey)
            ? visitorKey
            : `ai_${crypto.createHash("sha256").update(conversationId).digest("hex").slice(0, 40)}`;

        const siteSync = await syncPortalSite({
          visitor_key: effectiveVisitorKey,
          name: contact.name,
          email: contact.email,
          phone: contact.phone,
          company: trackingVisitor?.lead_company || null,
          cnpj: contact.cnpj,
          source: "IA",
          medium: "chat-agent",
          path: pageUrl || conversation.page_url || null,
          identified_at: new Date().toISOString(),
          score: interest.score,
        });

        if (siteSync.ok) {
          const aiSync = await syncPortal({
            visitor_key: effectiveVisitorKey,
            conversation_id: conversationId,
            qualification_summary: summary,
            segment,
            page_url: pageUrl || conversation.page_url || null,
            page_context: pageContext,
            interest_level: interest.level,
            score: interest.score,
          });

          portalSync = {
            ...aiSync,
            site_sync: siteSync,
          };
        } else {
          portalSync = {
            ok: false,
            status: siteSync.status || null,
            error: siteSync.error || "portal_site_sync_failed",
            site_sync: siteSync,
          };
        }
      }

    const replyInBlocks =
      settings.reply_in_blocks === undefined
      || settings.reply_in_blocks === null
      ? true
      : Boolean(settings.reply_in_blocks);

    let blocks = [reply];

    if (replyInBlocks) {
      blocks = reply
        .split(/\s*\|\|\s*|\n\s*\n/)
        .map((item) => item.trim())
        .filter(Boolean);
    }

    return res.json({
      data: {
        conversation_id: conversationId,
        lead_id: leadId,
        reply,
        blocks,
        is_fallback: isFallback,
        qualification: {
          segment,
          interest_level: interest.level,
          score: interest.score,
          identified: isIdentified,
        },
        portal_sync: {
          ok: Boolean(portalSync?.ok),
          status: portalSync?.status || null,
          error: portalSync?.error || portalSync?.reason || null,
        },
        typing_speed_ms: Number(settings.typing_speed_ms || 24),
        min_typing_delay_ms: Number(settings.min_typing_delay_ms || 650),
      },
      error: null,
    });
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch {}
    }

    console.error("CHAT AGENT:", error?.message || error);

    return res.status(500).json({
      data: null,
      error: {
        message: error?.message || "chat_agent_failed",
      },
    });
  } finally {
    connection?.release();
  }
});

export default router;

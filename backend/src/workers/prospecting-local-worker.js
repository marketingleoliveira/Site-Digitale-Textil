import crypto from "node:crypto";

import { db } from "../database.js";

import {
  recalculateCandidate,
} from "../routes/prospecting.js";


const TIMEZONE =
  "America/Sao_Paulo";

const BRASIL_API =
  "https://brasilapi.com.br/api/cnpj/v1";

const CNPJ_WS =
  "https://publica.cnpj.ws/cnpj";

let lastCnpjWsCall = 0;


const FREE_EMAILS =
  new Set([
    "gmail.com",
    "hotmail.com",
    "outlook.com",
    "live.com",
    "yahoo.com",
    "icloud.com",
    "uol.com.br",
    "bol.com.br",
  ]);


function normalize(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      ""
    )
    .toLowerCase()
    .trim();
}


function digits(value) {
  return String(value || "")
    .replace(/\D/g, "");
}


function localDate() {
  return new Intl.DateTimeFormat(
    "en-CA",
    {
      timeZone: TIMEZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }
  ).format(new Date());
}


function localHour() {
  const value =
    new Intl.DateTimeFormat(
      "en-US",
      {
        timeZone: TIMEZONE,
        hour: "2-digit",
        hour12: false,
      }
    ).format(new Date());

  return Number(value);
}


async function fetchJson(
  url,
  timeout = 12000
) {
  const controller =
    new AbortController();

  const timer =
    setTimeout(
      () => controller.abort(),
      timeout
    );

  try {
    const response =
      await fetch(
        url,
        {
          headers: {
            "User-Agent":
              "DigitaleProspecting/1.0",
            Accept:
              "application/json",
          },
          signal:
            controller.signal,
        }
      );

    if (!response.ok) {
      const error =
        new Error(
          `HTTP_${response.status}`
        );

      error.statusCode =
        response.status;

      throw error;
    }

    return await response.json();

  } finally {
    clearTimeout(timer);
  }
}


function sleep(ms) {
  return new Promise(
    resolve =>
      setTimeout(
        resolve,
        ms
      )
  );
}


function normalizeCnpjWs(data) {
  const establishment =
    data?.estabelecimento
    || {};

  const main =
    establishment
      ?.atividade_principal
    || {};

  const secondary =
    establishment
      ?.atividades_secundarias
    || [];

  const simples =
    data?.simples
    || {};

  const porte =
    data?.porte
    || {};

  const porteDescription =
    String(
      porte?.descricao
      || ""
    );

  const porteNorm =
    normalize(
      porteDescription
    );

  let porteCode = 0;

  if (
    porteNorm.includes(
      "micro"
    )
  ) {
    porteCode = 1;
  } else if (
    porteNorm.includes(
      "pequeno"
    )
  ) {
    porteCode = 3;
  } else if (
    porteNorm.includes(
      "demais"
    )
  ) {
    porteCode = 5;
  }

  const meiRaw =
    normalize(
      simples?.mei
    );

  const mei =
    [
      "sim",
      "s",
      "true",
      "1",
    ].includes(
      meiRaw
    );

  const cnae =
    digits(
      main?.subclasse
      || main?.id
    );

  const secondaryCnaes =
    secondary
      .map(item => ({
        codigo:
          digits(
            item?.subclasse
            || item?.id
          ),
        descricao:
          item?.descricao
          || null,
      }))
      .filter(
        item =>
          item.codigo
      );

  const phone1 =
    `${
      establishment?.ddd1
      || ""
    }${
      establishment?.telefone1
      || ""
    }`;

  const phone2 =
    `${
      establishment?.ddd2
      || ""
    }${
      establishment?.telefone2
      || ""
    }`;

  return {
    cnpj:
      establishment?.cnpj
      || null,

    razao_social:
      data?.razao_social
      || null,

    nome_fantasia:
      establishment
        ?.nome_fantasia
      || null,

    situacao_cadastral:
      establishment
        ?.situacao_cadastral
      || null,

    descricao_situacao_cadastral:
      establishment
        ?.situacao_cadastral
      || null,

    porte:
      porteDescription,

    descricao_porte:
      porteDescription,

    codigo_porte:
      porteCode,

    opcao_pelo_mei:
      mei,

    cnae_fiscal:
      cnae,

    cnae_fiscal_descricao:
      main?.descricao
      || null,

    cnaes_secundarios:
      secondaryCnaes,

    email:
      establishment?.email
      || null,

    ddd_telefone_1:
      phone1 || null,

    ddd_telefone_2:
      phone2 || null,

    municipio:
      establishment
        ?.cidade
        ?.nome
      || null,

    uf:
      establishment
        ?.estado
        ?.sigla
      || null,

    capital_social:
      data?.capital_social
      ?? null,

    data_inicio_atividade:
      establishment
        ?.data_inicio_atividade
      || null,
  };
}


async function lookupCnpj(
  cnpj
) {
  const brasilUrl =
    `${BRASIL_API}/${cnpj}`;

  try {
    const info =
      await fetchJson(
        brasilUrl
      );

    console.log(
      "CNPJ_SOURCE=BRASILAPI",
      cnpj
    );

    return {
      info,
      sourceUrl:
        brasilUrl,
    };

  } catch (error) {
    console.log(
      "BRASILAPI_FALLBACK",
      cnpj,
      error?.message
    );
  }

  const elapsed =
    Date.now()
    - lastCnpjWsCall;

  if (
    lastCnpjWsCall
    && elapsed < 21000
  ) {
    await sleep(
      21000 - elapsed
    );
  }

  const sourceUrl =
    `${CNPJ_WS}/${cnpj}`;

  const raw =
    await fetchJson(
      sourceUrl,
      15000
    );

  lastCnpjWsCall =
    Date.now();

  console.log(
    "CNPJ_SOURCE=CNPJWS",
    cnpj
  );

  return {
    info:
      normalizeCnpjWs(
        raw
      ),
    sourceUrl,
  };
}



async function fetchText(
  url,
  timeout = 10000,
  maxBytes = 1000000
) {
  const controller =
    new AbortController();

  const timer =
    setTimeout(
      () => controller.abort(),
      timeout
    );

  try {
    const response =
      await fetch(
        url,
        {
          redirect: "follow",
          headers: {
            "User-Agent":
              "DigitaleProspecting/1.0 (+https://digitaletextil.com.br)",
            Accept:
              "text/html,text/plain;q=0.9,*/*;q=0.1",
          },
          signal:
            controller.signal,
        }
      );

    if (!response.ok) {
      throw new Error(
        `HTTP_${response.status}`
      );
    }

    const reader =
      response.body?.getReader();

    if (!reader) {
      return "";
    }

    const decoder =
      new TextDecoder();

    let text = "";
    let size = 0;

    while (true) {
      const {
        done,
        value,
      } = await reader.read();

      if (done) {
        break;
      }

      size += value.length;

      if (size > maxBytes) {
        await reader.cancel();
        break;
      }

      text +=
        decoder.decode(
          value,
          {
            stream: true,
          }
        );
    }

    return text;

  } finally {
    clearTimeout(timer);
  }
}


function htmlToText(html) {
  return normalize(
    String(html || "")
      .replace(
        /<script[\s\S]*?<\/script>/gi,
        " "
      )
      .replace(
        /<style[\s\S]*?<\/style>/gi,
        " "
      )
      .replace(
        /<[^>]+>/g,
        " "
      )
      .replace(
        /&nbsp;/gi,
        " "
      )
      .replace(
        /&amp;/gi,
        "&"
      )
      .replace(/\s+/g, " ")
  );
}


function matched(
  text,
  terms
) {
  const normalized =
    normalize(text);

  return terms.filter(
    term =>
      normalized.includes(
        normalize(term)
      )
  );
}

function recentGrowthMatches(
  text,
  terms
) {
  const content =
    normalize(text);

  const now =
    new Date();

  const currentYear =
    Number(
      new Intl.DateTimeFormat(
        "en",
        {
          timeZone:
            "America/Sao_Paulo",
          year:
            "numeric",
        }
      ).format(now)
    );

  const seasonYears = [
    String(currentYear),
    String(currentYear + 1),
  ];

  const recentTokens = [
    ...seasonYears,
  ];

  for (
    let offset = 0;
    offset < 6;
    offset += 1
  ) {
    const date =
      new Date(
        Date.UTC(
          now.getUTCFullYear(),
          now.getUTCMonth() - offset,
          15
        )
      );

    const year =
      date.getUTCFullYear();

    const month =
      String(
        date.getUTCMonth() + 1
      ).padStart(
        2,
        "0"
      );

    const monthName =
      normalize(
        new Intl.DateTimeFormat(
          "pt-BR",
          {
            month: "long",
            year: "numeric",
            timeZone:
              "America/Sao_Paulo",
          }
        ).format(date)
      );

    recentTokens.push(
      monthName,
      `${month}/${year}`,
      `${year}-${month}`
    );
  }

  return terms.filter(
    term => {
      const target =
        normalize(term);

      let index =
        content.indexOf(target);

      while (index >= 0) {
        const context =
          content.slice(
            Math.max(
              0,
              index - 250
            ),
            index
              + target.length
              + 250
          );

        if (
          recentTokens.some(
            token =>
              context.includes(
                token
              )
          )
        ) {
          return true;
        }

        index =
          content.indexOf(
            target,
            index + 1
          );
      }

      return false;
    }
  );
}

function corporateDomain(
  email,
  companyName
) {
  const normalizedEmail =
    String(email || "")
      .trim()
      .toLowerCase();

  if (
    !normalizedEmail.includes("@")
  ) {
    return null;
  }

  const domain =
    normalizedEmail
      .split("@")
      .pop()
      ?.replace(/^www\./, "");

  if (
    !domain
    || FREE_EMAILS.has(domain)
  ) {
    return null;
  }

  const root =
    normalize(
      domain.split(".")[0]
    )
      .replace(/[^a-z0-9]/g, "");

  const ignored =
    new Set([
      "ltda",
      "empresa",
      "industria",
      "comercio",
      "confeccao",
      "confeccoes",
      "moda",
      "modas",
      "brasil",
      "grupo",
    ]);

  const companyTokens =
    normalize(companyName)
      .split(/[^a-z0-9]+/)
      .filter(
        token =>
          token.length >= 4
          && !ignored.has(token)
      );

  const related =
    companyTokens.some(
      token =>
        root.includes(token)
        || token.includes(root)
    );

  return related
    ? domain
    : null;
}


async function robotsAllows(
  origin
) {
  try {
    const robots =
      await fetchText(
        `${origin}/robots.txt`,
        5000,
        200000
      );

    const blocks =
      String(robots || "")
        .split(
          /user-agent\s*:/i
        );

    for (
      const block of blocks
    ) {
      const lines =
        block
          .split(/\r?\n/)
          .map(
            line =>
              line.trim()
          )
          .filter(Boolean);

      if (!lines.length) {
        continue;
      }

      if (
        lines[0] !== "*"
      ) {
        continue;
      }

      const blocksEverything =
        lines.some(
          line =>
            /^disallow\s*:\s*\/\s*$/i
              .test(line)
        );

      if (blocksEverything) {
        return false;
      }
    }

  } catch {
    /*
     * robots.txt ausente ou inacessível:
     * segue somente nas páginas públicas.
     */
  }

  return true;
}

async function crawlCompany(
  domain
) {
  const origins = [
    `https://${domain}`,
    `http://${domain}`,
  ];

  for (
    const origin of origins
  ) {
    try {
      if (
        !(await robotsAllows(origin))
      ) {
        return null;
      }

      const paths = [
        "/",
        "/sobre",
        "/quem-somos",
        "/colecoes",
        "/novidades",
      ];

      let combined = "";
      let sourceUrl = null;

      for (
        const path of paths
      ) {
        try {
          const html =
            await fetchText(
              origin + path
            );

          const text =
            htmlToText(html);

          if (
            text.length >= 100
          ) {
            combined +=
              " " + text;

            sourceUrl =
              sourceUrl
              || origin + path;
          }
        } catch {
          // página secundária pode não existir
        }
      }

      if (
        combined.trim().length >= 300
      ) {
        return {
          text:
            combined.slice(
              0,
              100000
            ),
          sourceUrl:
            sourceUrl || origin,
        };
      }

    } catch {
      // tenta http
    }
  }

  return null;
}


async function evidence(
  candidateId,
  type,
  sourceUrl,
  title,
  evidenceText
) {
  await db.execute(
    `
      INSERT INTO prospecting_evidence (
        id,
        candidate_id,
        evidence_type,
        strength,
        source_url,
        source_title,
        evidence_text,
        observed_at,
        verified,
        data
      )
      VALUES (
        ?, ?, ?, 'strong',
        ?, ?, ?,
        CURRENT_TIMESTAMP(6),
        1,
        ?
      )
    `,
    [
      crypto.randomUUID(),
      candidateId,
      type,
      sourceUrl,
      title,
      String(
        evidenceText || ""
      ).slice(0, 10000),
      JSON.stringify({
        verification:
          "automatic_verified",
        engine:
          "digitale_local_v1",
      }),
    ]
  );
}


async function validation(
  candidateId,
  stage,
  validator,
  passed,
  explanation
) {
  await db.execute(
    `
      INSERT INTO prospecting_validation_runs (
        id,
        candidate_id,
        validation_stage,
        validator,
        passed,
        score,
        decision,
        explanation,
        evidence_ids,
        data
      )
      VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
      )
    `,
    [
      crypto.randomUUID(),
      candidateId,
      stage,
      validator,
      passed ? 1 : 0,
      passed ? 100 : 0,
      passed
        ? "pass"
        : "reject",
      explanation,
      JSON.stringify([]),
      JSON.stringify({
        automated: true,
      }),
    ]
  );
}


async function ensureCampaign() {
  const [rows] =
    await db.execute(
      `
        SELECT id
        FROM prospecting_campaigns
        WHERE name = ?
        LIMIT 1
      `,
      [
        "Prospecção IA Automática",
      ]
    );

  if (rows.length) {
    return rows[0].id;
  }

  const id =
    crypto.randomUUID();

  await db.execute(
    `
      INSERT INTO prospecting_campaigns (
        id,
        name,
        niche,
        region,
        products,
        target_profile,
        exclusions,
        minimum_intent,
        max_candidates,
        status,
        criteria
      )
      VALUES (
        ?,
        'Prospecção IA Automática',
        'Moda fitness, esportiva e praia',
        'Brasil',
        'Leggings, tops, shorts, bermudas, biquínis e maiôs',
        'Marcas e confecções estruturadas, não-MEI, com capacidade comercial',
        'MEI, empresa inativa, multimarcas sem produção própria, academia e revendedores',
        'strong',
        100000,
        'active',
        ?
      )
    `,
    [
      id,
      JSON.stringify({
        source:
          "RFB_CNPJ",
        zero_paid_api:
          true,
        target_daily:
          10,
      }),
    ]
  );

  return id;
}


async function run() {
  const date =
    localDate();

  const hour =
    localHour();

  const [[policy]] =
    await db.query(
      `
        SELECT *
        FROM prospecting_daily_policy
        WHERE id = 1
        LIMIT 1
      `
    );

  if (
    !policy
    || Number(policy.enabled) !== 1
  ) {
    console.log(
      "WORKER=DISABLED"
    );

    return;
  }

  if (
    !process.env.PROSPECTING_FORCE
    && (
      hour < Number(
        policy.start_hour
      )
      || hour > Number(
        policy.end_hour
      )
    )
  ) {
    console.log(
      `WORKER=OUTSIDE_WINDOW HOUR=${hour}`
    );

    return;
  }

  await db.execute(
    `
      INSERT INTO prospecting_daily_runs (
        local_date,
        target_qualified
      )
      VALUES (?, ?)
      ON DUPLICATE KEY UPDATE
        target_qualified =
          VALUES(target_qualified)
    `,
    [
      date,
      Number(
        policy.target_qualified_per_day
      ),
    ]
  );

  const [[run]] =
    await db.execute(
      `
        SELECT *
        FROM prospecting_daily_runs
        WHERE local_date = ?
        LIMIT 1
      `,
      [date]
    );

  if (
    process.env.PROSPECTING_HOURLY_MODE !== "1"
    && Number(run.candidates_qualified) >= Number(policy.target_qualified_per_day)
  ) {
    console.log(
      "WORKER=TARGET_REACHED"
    );

    return;
  }

  const remainingDaily =
    process.env.PROSPECTING_HOURLY_MODE === "1"
      ? Number.MAX_SAFE_INTEGER
      : Number(policy.max_candidates_per_day) - Number(run.candidates_checked);

  if (remainingDaily <= 0) {
    console.log(
      "WORKER=DAILY_LIMIT_REACHED"
    );

    return;
  }

  const limit =
    Math.min(
      Number(
        policy.max_new_candidates_per_cycle
      ),
      remainingDaily
    );

  const [sources] =
    await db.query(
      `
        SELECT *
        FROM prospecting_source_pool
        WHERE source_status = 'new'
        ORDER BY id
        LIMIT ${Math.max(
          1,
          Math.min(limit, 4)
        )}
      `
    );

  if (!sources.length) {
    console.log(
      "WORKER=SOURCE_POOL_EMPTY"
    );

    await db.execute(
      `
        UPDATE prospecting_daily_runs
        SET
          source_exhausted = 1,
          last_cycle_at =
            CURRENT_TIMESTAMP(6)
        WHERE local_date = ?
      `,
      [date]
    );

    return;
  }

  const campaignId =
    await ensureCampaign();

  let cycleQualified = 0;

  for (
    const source of sources
  ) {
    await db.execute(
      `
        UPDATE prospecting_source_pool
        SET
          source_status = 'processing',
          selected_at =
            CURRENT_TIMESTAMP(6)
        WHERE id = ?
          AND source_status = 'new'
      `,
      [source.id]
    );

    let checked = true;
    let rejected = false;

    try {
      const cnpj =
        String(
          source.cnpj || ""
        )
          .replace(
            /[^A-Z0-9]/gi,
            ""
          )
          .toUpperCase();

      let info;
      let registryUrl;

      if (
        source.source_type ===
        "WEB_PUBLIC"
      ) {
        /*
         * O seeder somente grava WEB_PUBLIC
         * depois de validar:
         *
         * - CNPJ válido
         * - empresa ativa
         * - não-MEI
         * - CNAE compatível
         *
         * Não consultar a API novamente.
         */

        const secondaryCnaes =
          String(
            source.secondary_cnaes
            || ""
          )
            .split(",")
            .map(
              value =>
                value.replace(
                  /\D/g,
                  ""
                )
            )
            .filter(Boolean)
            .map(
              codigo => ({
                codigo,
              })
            );

        info = {
          situacao_cadastral: 2,

          descricao_situacao_cadastral:
            "ATIVA",

          porte:
            source.company_size
            || "",

          descricao_porte:
            source.company_size
            || "",

          codigo_porte:
            Number(
              source.company_size_code
              || 0
            ),

          opcao_pelo_mei:
            Number(
              source.is_mei
              || 0
            ) === 1,

          cnae_fiscal:
            String(
              source.cnae || ""
            ).replace(
              /\D/g,
              ""
            ),

          cnaes_secundarios:
            secondaryCnaes,

          nome_fantasia:
            source.company_name
            || null,

          razao_social:
            source.company_name
            || null,

          email:
            source.email
            || null,

          ddd_telefone_1:
            source.phone
            || null,

          ddd_telefone_2:
            null,

          municipio:
            source.municipality_code
            || null,

          uf:
            source.state
            || null,

          capital_social:
            source.capital_social
            ?? null,

          data_inicio_atividade:
            null,
        };

        registryUrl =
          `https://publica.cnpj.ws/cnpj/${cnpj}`;

        console.log(
          "REGISTRY_REUSE=SEEDER",
          cnpj
        );

      } else {

        const registryLookup =
          await lookupCnpj(
            cnpj
          );

        info =
          registryLookup.info;

        registryUrl =
          registryLookup.sourceUrl;
      }

      const active =
        Number(
          info.situacao_cadastral
        ) === 2
        || normalize(
          info.descricao_situacao_cadastral
        ) === "ativa";

      const porte =
        normalize(
          info.porte
          || info.descricao_porte
        );

      const porteCode =
        Number(
          info.codigo_porte || 0
        );

      const epp =
        porteCode === 3
        || porte.includes(
          "pequeno porte"
        );

      const demais =
        porteCode === 5
        || porte === "demais";

      const micro =
        porteCode === 1
        || porte.includes(
          "micro"
        );

      const mei =
        info.opcao_pelo_mei === true
        || String(
          info.opcao_pelo_mei
          || ""
        ).toUpperCase() === "S";

      const nonMei =
        !mei
        && (
          epp
          || demais
          || info.opcao_pelo_mei
             === false
        );

      const primaryCnae =
        String(
          info.cnae_fiscal || ""
        );

      const secondaryCnaes =
        Array.isArray(
          info.cnaes_secundarios
        )
          ? info.cnaes_secundarios
              .map(
                item =>
                  String(
                    item?.codigo || ""
                  )
              )
          : [];

      const cnaeRelevant =
        primaryCnae === "1412601"
        || secondaryCnaes.includes(
          "1412601"
        );

      if (
        !active
        || mei
        || !cnaeRelevant
      ) {
        rejected = true;

        const reason =
          !active
            ? "empresa_inativa"
            : mei
              ? "mei_bloqueado"
              : "cnae_fora_icp";

        await db.execute(
          `
            UPDATE prospecting_source_pool
            SET
              source_status = 'rejected',
              rejection_reason = ?
            WHERE id = ?
          `,
          [
            reason,
            source.id,
          ]
        );

        continue;
      }

      const companyName =
        String(
          info.nome_fantasia
          || info.razao_social
          || source.company_name
          || `CNPJ ${cnpj}`
        ).trim();

      const email =
        String(
          info.email
          || source.email
          || ""
        )
          .trim()
          .toLowerCase();

      const phone =
        digits(
          info.ddd_telefone_1
          || info.ddd_telefone_2
          || source.phone
        );

      const domain =
        source.domain
        || corporateDomain(
          email,
          companyName
        );

      const website =
        domain
          ? `https://${domain}`
          : null;

      const fingerprint =
        crypto
          .createHash("sha256")
          .update(
            `cnpj:${cnpj}`
          )
          .digest("hex");

      const candidateId =
        crypto.randomUUID();

      try {
        await db.execute(
          `
            INSERT INTO prospecting_candidates (
              id,
              campaign_id,
              company_name,
              company_fingerprint,
              cnpj,
              website,
              domain,
              city,
              state,
              segment,
              contact_email,
              contact_phone,
              source_origin,
              status,
              data
            )
            VALUES (
              ?, ?, ?, ?, ?, ?, ?,
              ?, ?, ?,
              ?, ?,
              'IA_PROSPECCAO',
              'discovered',
              ?
            )
          `,
          [
            candidateId,
            campaignId,
            companyName,
            fingerprint,
            cnpj,
            website,
            domain,
            info.municipio || null,
            info.uf || null,
            info.cnae_fiscal_descricao
              || "Confecção",
            email || null,
            phone || null,
            JSON.stringify({
              source_pool_id:
                source.id,
              porte:
                info.porte || null,
              codigo_porte:
                porteCode,
              capital_social:
                info.capital_social
                ?? null,
              data_inicio_atividade:
                info.data_inicio_atividade
                || null,
              registry_source:
                "BrasilAPI/RFB",
            }),
          ]
        );
      } catch (error) {
        if (
          error?.code ===
          "ER_DUP_ENTRY"
        ) {
          await db.execute(
            `
              UPDATE prospecting_source_pool
              SET
                source_status =
                  'duplicate',
                rejection_reason =
                  'empresa_ja_processada'
              WHERE id = ?
            `,
            [source.id]
          );

          rejected = true;
          continue;
        }

        throw error;
      }

      await evidence(
        candidateId,
        "company_registration",
        registryUrl,
        "Cadastro empresarial",
        `Empresa ativa. CNAE ${primaryCnae}. Porte: ${info.porte || "não informado"}.`
      );

      if (nonMei) {
        await evidence(
          candidateId,
          "non_mei",
          registryUrl,
          "Validação não-MEI",
          `Empresa não enquadrada como MEI. Porte informado: ${info.porte || "não informado"}.`
        );
      }

      let registryCapacity =
        epp || demais;

      if (registryCapacity) {
        await evidence(
          candidateId,
          "commercial_capacity",
          registryUrl,
          "Capacidade comercial cadastral",
          `Porte cadastral compatível com prospecção Digitale: ${info.porte || porteCode}.`
        );
      }

      const hasContact =
        Boolean(
          email || phone
        );

      if (hasContact) {
        await evidence(
          candidateId,
          "contact_channel",
          registryUrl,
          "Contato cadastral",
          email
            ? `E-mail cadastrado: ${email}`
            : `Telefone cadastrado: ${phone}`
        );
      }

      const registryPass =
        active
        && nonMei
        && cnaeRelevant
        && hasContact;

      await validation(
        candidateId,
        "full_review",
        "registry_rules_v1",
        registryPass,
        registryPass
          ? "Cadastro, não-MEI, CNAE e contato aprovados."
          : "Falha na validação cadastral."
      );

      let site =
        domain
          ? await crawlCompany(
              domain
            )
          : null;

      let icpOk = false;
      let growthOk = false;
      let intentOk = false;
      let textileOk = false;
      let siteCapacity = false;

      if (site) {
        const icp =
          matched(
            site.text,
            [
              "fitness",
              "activewear",
              "moda fitness",
              "moda praia",
              "biquini",
              "maio",
              "legging",
              "short",
              "sportswear",
              "roupa esportiva",
            ]
          );

        const textile =
          matched(
            site.text,
            [
              "tecido",
              "tecidos",
              "poliamida",
              "elastano",
              "malha",
              "lycra",
              "suplex",
              "materia-prima",
              "confeccao",
              "fabricacao",
            ]
          );

        const growth =
          recentGrowthMatches(
            site.text,
            [
              "nova colecao",
              "lancamento",
              "colecao 2026",
              "nova loja",
              "nova unidade",
              "expansao",
              "estamos crescendo",
              "novos pontos de venda",
            ]
          );

        const intent =
          matched(
            site.text,
            [
              "producao propria",
              "confeccao propria",
              "fabricacao propria",
              "desenvolvimento de colecao",
              "desenvolvimento proprio",
              "materia-prima",
              "fornecedores",
              "tecidos",
              "produzimos",
              "fabricamos",
            ]
          );

        const structure =
          matched(
            site.text,
            [
              "atacado",
              "revendedores",
              "lojas",
              "e-commerce",
              "envio para todo brasil",
              "colecoes",
              "producao propria",
              "fabricacao propria",
              "catalogo",
            ]
          );

        icpOk =
          icp.length >= 2;

        textileOk =
          textile.length >= 2;

        growthOk =
          growth.length >= 1;

        intentOk =
          intent.length >= 1;

        siteCapacity =
          structure.length >= 3
          && growthOk
          && intentOk;

        if (icpOk) {
          await evidence(
            candidateId,
            "icp_fit",
            site.sourceUrl,
            "ICP Digitale",
            `Sinais encontrados: ${icp.join(", ")}.`
          );
        }

        if (textileOk) {
          await evidence(
            candidateId,
            "textile_relevance",
            site.sourceUrl,
            "Relevância têxtil",
            `Sinais encontrados: ${textile.join(", ")}.`
          );
        }

        if (growthOk) {
          await evidence(
            candidateId,
            "growth_signal",
            site.sourceUrl,
            "Crescimento recente observado",
            `Sinais atuais encontrados no site: ${growth.join(", ")}.`
          );
        }

        if (intentOk) {
          await evidence(
            candidateId,
            "buying_intent",
            site.sourceUrl,
            "Necessidade produtiva",
            `Sinais relacionados à produção/matéria-prima: ${intent.join(", ")}.`
          );
        }

        if (
          !registryCapacity
          && micro
          && siteCapacity
        ) {
          await evidence(
            candidateId,
            "commercial_capacity",
            site.sourceUrl,
            "Capacidade comercial operacional",
            `ME com estrutura comercial forte: ${structure.join(", ")}.`
          );

          registryCapacity = true;
        }
      }

      const websitePass =
        Boolean(site)
        && icpOk
        && textileOk
        && growthOk
        && intentOk
        && registryCapacity;

      await validation(
        candidateId,
        "independent_review",
        "website_rules_v1",
        websitePass,
        websitePass
          ? "Site confirmou ICP, crescimento, estrutura e necessidade produtiva."
          : "Evidência digital insuficiente para qualificação."
      );

      const evaluation =
        await recalculateCandidate(
          candidateId
        );

      if (
        evaluation?.eligible_for_crm
      ) {
        cycleQualified += 1;

        await db.execute(
          `
            UPDATE prospecting_source_pool
            SET
              source_status =
                'qualified',
              rejection_reason = NULL
            WHERE id = ?
          `,
          [source.id]
        );
      } else {
        rejected = false;

        // DIGITALE_EVIDENCE_PENDING_V1
        const missing =
          Object.entries(
            evaluation?.hard_gates || {}
          )
            .filter(
              ([, value]) =>
                !value
            )
            .map(
              ([key]) => key
            )
            .join(",");

        await db.execute(
          `
            UPDATE prospecting_candidates
            SET
              status = 'validating',
              rejection_reason = ?
            WHERE id = ?
          `,
          [
            missing
              || "insufficient_evidence",
            candidateId,
          ]
        );

        await db.execute(
          `
            UPDATE prospecting_source_pool
            SET
              source_status =
                'review_pending',
              rejection_reason = ?
            WHERE id = ?
          `,
          [
            missing
              || "insufficient_evidence",
            source.id,
          ]
        );
      }

    } catch (error) {
      console.error(
        "CANDIDATE_ERROR",
        source.id,
        error?.message
      );

      await db.execute(
        `
          UPDATE prospecting_source_pool
          SET
            source_status = 'new',
            rejection_reason = ?
          WHERE id = ?
        `,
        [
          String(
            error?.message
            || "processing_error"
          ).slice(0, 500),
          source.id,
        ]
      );

      checked = false;
    }

    if (checked) {
      await db.execute(
        `
          UPDATE prospecting_daily_runs
          SET
            candidates_checked =
              candidates_checked + 1,
            candidates_rejected =
              candidates_rejected + ?,
            last_cycle_at =
              CURRENT_TIMESTAMP(6)
          WHERE local_date = ?
        `,
        [
          rejected ? 1 : 0,
          date,
        ]
      );
    }
  }

  if (cycleQualified > 0) {
    await db.execute(
      `
        UPDATE prospecting_daily_runs
        SET
          candidates_qualified =
            candidates_qualified + ?,
          last_cycle_at =
            CURRENT_TIMESTAMP(6)
        WHERE local_date = ?
      `,
      [
        cycleQualified,
        date,
      ]
    );
  }

  const [[finalRun]] =
    await db.execute(
      `
        SELECT *
        FROM prospecting_daily_runs
        WHERE local_date = ?
      `,
      [date]
    );

  console.log(
    JSON.stringify({
      worker:
        "digitale_local_v1",
      local_date:
        date,
      processed:
        sources.length,
      qualified_this_cycle:
        cycleQualified,
      qualified_today:
        Number(
          finalRun.candidates_qualified
        ),
      checked_today:
        Number(
          finalRun.candidates_checked
        ),
      target:
        Number(
          policy.target_qualified_per_day
        ),
      crm_delivery_enabled:
        false,
    })
  );
}


run()
  .then(() => {
    process.exit(0);
  })
  .catch(error => {
    console.error(
      "WORKER_FATAL",
      error
    );

    process.exit(1);
  });

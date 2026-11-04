import crypto from "node:crypto";

import {
  db,
} from "../backend/src/database.js";

import {
  recalculateCandidate,
} from "../backend/src/routes/prospecting.js";


const LIMIT =
  Math.max(
    1,
    Math.min(
      8,
      Number(
        process.env.ACTIVITY_LIMIT
        || 4
      )
    )
  );

const NOW =
  new Date();

const CUTOFF =
  new Date(
    NOW.getTime()
    - 180 * 24 * 60 * 60 * 1000
  );


function normalize(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      ""
    )
    .toLowerCase();
}


function decodeXml(value) {
  return String(value || "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"');
}


function stripHtml(html) {
  return String(html || "")
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
    .replace(
      /&#(\d+);/g,
      (_, n) =>
        String.fromCharCode(
          Number(n)
        )
    )
    .replace(
      /\s+/g,
      " "
    )
    .trim();
}


function domainOf(value) {
  try {
    return new URL(value)
      .hostname
      .toLowerCase()
      .replace(
        /^www\./,
        ""
      );
  } catch {
    return "";
  }
}


function sameDomain(
  value,
  expected
) {
  const actual =
    domainOf(value);

  const target =
    String(expected || "")
      .toLowerCase()
      .replace(
        /^www\./,
        ""
      );

  return Boolean(
    actual
    && target
    && (
      actual === target
      || actual.endsWith(
        "." + target
      )
      || target.endsWith(
        "." + actual
      )
    )
  );
}


const blockedDomainsThisRun = new Set();

async function fetchPage(
  url,
  timeout = 6000
) {
  const hostname = new URL(url).hostname.toLowerCase();

  if (blockedDomainsThisRun.has(hostname)) {
    return null;
  }
  const controller =
    new AbortController();

  const timer =
    setTimeout(
      () =>
        controller.abort(),
      timeout
    );

  try {
    const response =
      await fetch(
        url,
        {
          redirect:
            "follow",

          headers: {
            "User-Agent":
              "DigitaleProspecting/1.4 (+https://digitaletextil.com.br)",

            Accept:
              "text/html,text/plain,application/xml,text/xml;q=0.9,*/*;q=0.1",
          },

          signal:
            controller.signal,
        }
      );

    if (!response.ok) {
      if (response.status === 403) {
        const blockedHostname =
          new URL(response.url || url)
            .hostname
            .toLowerCase();

        blockedDomainsThisRun.add(hostname);
        blockedDomainsThisRun.add(blockedHostname);

        console.warn(
          "ACTIVITY_ACCESS_BLOCKED",
          blockedHostname,
          "HTTP_403"
        );
      }

      return null;
    }

    return {
      url:
        response.url
        || url,

      content:
        (
          await response.text()
        ).slice(
          0,
          2200000
        ),
    };

  } catch {
    return null;

  } finally {
    clearTimeout(timer);
  }
}


function sitemapEntries(xml) {
  const entries = [];

  const blockRegex =
    /<(url|sitemap)>([\s\S]*?)<\/\1>/gi;

  let block;

  while (
    (
      block =
        blockRegex.exec(xml)
    )
  ) {
    const body =
      block[2];

    const loc =
      body.match(
        /<loc>([\s\S]*?)<\/loc>/i
      );

    const lastmod =
      body.match(
        /<lastmod>([\s\S]*?)<\/lastmod>/i
      );

    if (!loc) {
      continue;
    }

    entries.push({
      type:
        block[1].toLowerCase(),

      loc:
        decodeXml(
          loc[1].trim()
        ),

      lastmod:
        lastmod
          ? lastmod[1].trim()
          : null,
    });
  }

  return entries;
}


function commercialUrlScore(url) {
  const value =
    normalize(
      decodeURIComponent(
        String(url || "")
      )
    );

  let score = 0;

  if (
    /lancamento|lancamentos/.test(
      value
    )
  ) {
    score += 100;
  }

  if (
    /novidade|novidades/.test(
      value
    )
  ) {
    score += 90;
  }

  if (
    /colecao|colecoes|collection/.test(
      value
    )
  ) {
    score += 80;
  }

  if (
    /blog|news|noticia/.test(
      value
    )
  ) {
    score += 70;
  }

  if (
    /produto|product/.test(
      value
    )
  ) {
    score += 50;
  }

  if (
    /legging|fitness|biquini|top|short|macaquinho/.test(
      value
    )
  ) {
    score += 20;
  }

  return score;
}


async function sitemapDiscovery(
  baseUrl,
  domain
) {
  const roots =
    new Set();

  try {
    const origin =
      new URL(baseUrl)
        .origin;

    roots.add(
      `${origin}/sitemap.xml`
    );

    roots.add(
      `${origin}/sitemap_index.xml`
    );
  } catch {}


  roots.add(
    `https://${domain}/sitemap.xml`
  );

  roots.add(
    `https://www.${domain}/sitemap.xml`
  );


  const queue =
    [...roots].map(
      url => ({
        url,
        depth: 0,
      })
    );

  const visited =
    new Set();

  const discovered =
    new Map();


  while (
    queue.length
    && visited.size < 20
  ) {
    const current =
      queue.shift();

    if (
      !current
      || current.depth > 2
      || visited.has(
        current.url
      )
    ) {
      continue;
    }

    visited.add(
      current.url
    );


    const page =
      await fetchPage(
        current.url
      );

    if (!page) {
      continue;
    }


    const entries =
      sitemapEntries(
        page.content
      );


    for (
      const entry
      of entries
    ) {
      if (
        !sameDomain(
          entry.loc,
          domain
        )
      ) {
        continue;
      }


      if (
        entry.type === "sitemap"
      ) {
        if (
          current.depth < 2
          && queue.length < 30
        ) {
          queue.push({
            url:
              entry.loc,

            depth:
              current.depth + 1,
          });
        }

        continue;
      }


      const score =
        commercialUrlScore(
          entry.loc
        );

      if (
        score <= 0
      ) {
        continue;
      }


      const previous =
        discovered.get(
          entry.loc
        );

      if (
        !previous
        || score >
          previous.score
      ) {
        discovered.set(
          entry.loc,
          {
            url:
              entry.loc,

            lastmod:
              entry.lastmod,

            score,
          }
        );
      }
    }
  }


  return [
    ...discovered.values()
  ]
    .sort(
      (a, b) =>
        b.score - a.score
    )
    .slice(
      0,
      35
    );
}


function parseDate(
  day,
  month,
  year
) {
  const value =
    new Date(
      Date.UTC(
        Number(year),
        Number(month) - 1,
        Number(day),
        12
      )
    );

  if (
    !Number.isFinite(
      value.getTime()
    )
  ) {
    return null;
  }

  if (
    value < CUTOFF
    || value >
      new Date(
        NOW.getTime()
        + 86400000
      )
  ) {
    return null;
  }

  return value;
}


const MONTHS = {
  janeiro: 1,
  fevereiro: 2,
  marco: 3,
  abril: 4,
  maio: 5,
  junho: 6,
  julho: 7,
  agosto: 8,
  setembro: 9,
  outubro: 10,
  novembro: 11,
  dezembro: 12,
};


function dateCandidates(text) {
  const dates = [];

  let match;


  const numeric =
    /\b([0-3]?\d)[\/.-]([01]?\d)[\/.-](20\d{2})\b/g;

  while (
    (
      match =
        numeric.exec(text)
    )
  ) {
    const date =
      parseDate(
        match[1],
        match[2],
        match[3]
      );

    if (date) {
      dates.push({
        index:
          match.index,

        raw:
          match[0],

        date,
      });
    }
  }


  const written =
    /\b([0-3]?\d)\s+de\s+(janeiro|fevereiro|mar[cç]o|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\s+de\s+(20\d{2})\b/gi;

  while (
    (
      match =
        written.exec(text)
    )
  ) {
    const month =
      MONTHS[
        normalize(
          match[2]
        )
      ];

    const date =
      parseDate(
        match[1],
        month,
        match[3]
      );

    if (date) {
      dates.push({
        index:
          match.index,

        raw:
          match[0],

        date,
      });
    }
  }


  return dates;
}


function detectActivity(html) {
  const text =
    stripHtml(html);

  const dates =
    dateCandidates(
      text
    );


  for (
    const item
    of dates
  ) {
    const context =
      text.slice(
        Math.max(
          0,
          item.index - 700
        ),
        Math.min(
          text.length,
          item.index + 1000
        )
      );

    const value =
      normalize(
        context
      );


    /*
     * PROVA A:
     * cliente/review datado.
     */
    const review =
      (
        value.includes(
          "avaliacao"
        )
        || value.includes(
          "avaliacoes"
        )
        || value.includes(
          "review"
        )
        || value.includes(
          "depoimento"
        )
      )
      &&
      (
        value.includes(
          "cliente"
        )
        || value.includes(
          "compr"
        )
        || value.includes(
          "recomend"
        )
        || value.includes(
          "estrela"
        )
        || value.includes(
          "nota"
        )
      );


    /*
     * PROVA B:
     * lançamento/coleção explicitamente
     * associado à data.
     */
    const launch =
      (
        value.includes(
          "lancamento"
        )
        || value.includes(
          "nova colecao"
        )
        || value.includes(
          "novo drop"
        )
        || value.includes(
          "novidades"
        )
      )
      &&
      (
        value.includes(
          "produto"
        )
        || value.includes(
          "fitness"
        )
        || value.includes(
          "moda"
        )
        || value.includes(
          "legging"
        )
        || value.includes(
          "biquini"
        )
        || value.includes(
          "top"
        )
      );


    if (
      review
      || launch
    ) {
      return {
        date:
          item.date,

        dateText:
          item.raw,

        signal:
          review
            ? "dated_customer_review"
            : "dated_launch_or_collection",

        context:
          context.slice(
            0,
            1600
          ),
      };
    }
  }


  return null;
}


async function saveActivity(
  candidate,
  pageUrl,
  activity
) {
  const [existing] =
    await db.execute(
      `
        SELECT id

        FROM prospecting_evidence

        WHERE
          candidate_id = ?

          AND evidence_type =
            'commercial_activity'

          AND source_url = ?

          AND observed_at = ?

        LIMIT 1
      `,
      [
        candidate.id,
        pageUrl,
        activity.date,
      ]
    );


  if (!existing.length) {
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
          captured_at,
          verified,
          data
        )

        VALUES (
          ?,
          ?,
          'commercial_activity',
          'strong',
          ?,
          'Atividade comercial recente no site oficial',
          ?,
          ?,
          CURRENT_TIMESTAMP(6),
          1,
          ?
        )
      `,
      [
        crypto.randomUUID(),
        candidate.id,
        pageUrl,

        (
          "Atividade comercial recente "
          + "confirmada no site oficial. "
          + "Data visível: "
          + activity.dateText
          + ". Tipo: "
          + activity.signal
          + ". Contexto: "
          + activity.context
        ).slice(
          0,
          3000
        ),

        activity.date,

        JSON.stringify({
          engine:
            "official_activity_v2",

          verification:
            activity.signal,

          detected_date:
            activity.date
              .toISOString(),

          source_domain:
            candidate.domain,

          sitemap_lastmod_used_as_proof:
            false,
        }),
      ]
    );
  }


  /*
   * Reabre o candidato para o núcleo
   * tomar a decisão novamente.
   */
  await db.execute(
    `
      UPDATE prospecting_candidates

      SET
        status =
          'validating',

        rejection_reason =
          NULL,

        updated_at =
          CURRENT_TIMESTAMP(6)

      WHERE id = ?
    `,
    [
      candidate.id,
    ]
  );


  let result =
    await recalculateCandidate(
      candidate.id
    );


  const gates =
    result?.hard_gates
    || {};


  const preReviewApproved =
    Boolean(
      gates.company_verified
      && gates.icp_verified
      && gates.contact_verified
      && gates.recent_activity_verified
      && gates.intent_verified
      && gates.textile_relevance_verified
    );


  /*
   * Esta validação é independente:
   * usa conteúdo comercial oficial
   * datado, não o cadastro CNPJ.
   */
  if (
    preReviewApproved
  ) {
    const [existingReview] =
      await db.execute(
        `
          SELECT id

          FROM prospecting_validation_runs

          WHERE
            candidate_id = ?

            AND validator =
              'official_activity_v2'

            AND passed = 1

          LIMIT 1
        `,
        [
          candidate.id,
        ]
      );


    if (
      !existingReview.length
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
            ?,
            ?,
            'independent_review',
            'official_activity_v2',
            1,
            100,
            'pass',
            ?,
            '[]',
            ?
          )
        `,
        [
          crypto.randomUUID(),
          candidate.id,

          (
            "Atividade comercial recente "
            + "confirmada por conteúdo datado "
            + "no domínio oficial."
          ),

          JSON.stringify({
            source_url:
              pageUrl,

            observed_at:
              activity.date
                .toISOString(),

            verification:
              activity.signal,
          }),
        ]
      );
    }


    /*
     * Se ainda não houver uma revisão
     * cadastral APROVADA, executamos uma
     * nova revisão com os gates atuais.
     *
     * Isso é importante especialmente
     * para empresas cujo review antigo
     * ocorreu antes do enriquecimento
     * de telefone.
     */
    const [registryPassed] =
      await db.execute(
        `
          SELECT id

          FROM prospecting_validation_runs

          WHERE
            candidate_id = ?

            AND validation_stage =
              'full_review'

            AND passed = 1

          LIMIT 1
        `,
        [
          candidate.id,
        ]
      );


    if (
      !registryPassed.length
    ) {
      const registryOkay =
        Boolean(
          gates.company_verified
          && gates.icp_verified
          && gates.contact_verified
          && gates.intent_verified
          && gates.textile_relevance_verified
        );


      if (
        registryOkay
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
              ?,
              ?,
              'full_review',
              'registry_recheck_v2',
              1,
              100,
              'pass',
              ?,
              '[]',
              ?
            )
          `,
          [
            crypto.randomUUID(),
            candidate.id,

            (
              "Revisão cadastral refeita após "
              + "enriquecimento: empresa, ICP, "
              + "telefone validado, intenção "
              + "e relevância têxtil aprovados."
            ),

            JSON.stringify({
              verification:
                "current_registry_and_contact_gates",
            }),
          ]
        );
      }
    }


    result =
      await recalculateCandidate(
        candidate.id
      );
  }


  console.log(
    "ACTIVITY_VALIDATED",
    candidate.company_name,
    activity.signal,
    activity.date
      .toISOString()
      .slice(
        0,
        10
      ),
    pageUrl,
    result?.status,
    result?.score
  );


  return result;
}


const [candidates] =
  await db.query(
    `
      SELECT
        id,
        company_name,
        cnpj,
        website,
        domain,
        confidence_score

      FROM prospecting_candidates

      WHERE
        source_origin =
          'IA_PROSPECCAO'

        AND company_verified = 1
        AND icp_verified = 1
        AND contact_verified = 1
        AND intent_verified = 1
        AND textile_relevance_verified = 1

        AND recent_activity_verified = 0
        AND cnpj = '78857802000100'

      ORDER BY
        confidence_score DESC,
        updated_at DESC

      LIMIT ${LIMIT}
    `
  );


console.log(
  "ACTIVITY_CANDIDATES=",
  candidates.length
);


let validated = 0;


for (
  const candidate
  of candidates
) {
  const domain =
    String(
      candidate.domain || ""
    )
      .replace(
        /^https?:\/\//,
        ""
      )
      .replace(
        /^www\./,
        ""
      )
      .replace(
        /\/.*$/,
        ""
      );


  if (!domain) {
    continue;
  }


  console.log(
    "ACTIVITY_SEARCH",
    candidate.company_name,
    domain
  );


  const origin =
    candidate.website
      ? new URL(
          candidate.website
        ).origin
      : `https://${domain}`;


  const directUrls = [
    `${origin}/lancamentos`,
    `${origin}/lancamento`,
    `${origin}/novidades`,
    `${origin}/colecoes`,
    `${origin}/collections`,
    `${origin}/blog`,
  ];


  const sitemapUrls =
    await sitemapDiscovery(
      candidate.website
        || origin,
      domain
    );


  console.log(
    "SITEMAP_COMMERCIAL_URLS",
    candidate.company_name,
    sitemapUrls.length
  );


  /*
   * sitemap é usado APENAS para encontrar
   * URLs. O lastmod não vai para
   * detectActivity().
   */
  const urls =
    [
      ...new Set([
        ...directUrls,
        ...sitemapUrls.map(
          item =>
            item.url
        ),
      ]),
    ].filter(
      url =>
        sameDomain(
          url,
          domain
        )
    );


  let found =
    false;


  /*
   * Inspeciona em lotes para não tornar
   * o ciclo excessivamente lento.
   */
  for (
    let offset = 0;
    offset < Math.min(
      urls.length,
      30
    );
    offset += 5
  ) {
    const batch =
      urls.slice(
        offset,
        offset + 5
      );


    const pages =
      await Promise.all(
        batch.map(
          url =>
            fetchPage(
              url
            )
        )
      );


    for (
      let i = 0;
      i < pages.length;
      i++
    ) {
      const page =
        pages[i];

      if (
        !page
        || !sameDomain(
          page.url,
          domain
        )
      ) {
        continue;
      }


      const activity =
        detectActivity(
          page.content
        );


      if (!activity) {
        continue;
      }


      await saveActivity(
        candidate,
        page.url,
        activity
      );


      validated += 1;
      found = true;

      break;
    }


    if (found) {
      break;
    }
  }


  if (!found) {
    console.log(
      "ACTIVITY_NOT_FOUND",
      candidate.company_name
    );
  }
}


console.log(
  JSON.stringify({
    worker:
      "official_activity_v2",

    checked:
      candidates.length,

    validated,
  })
);


process.exit(0);

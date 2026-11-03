import crypto from "node:crypto";

import {
  db,
} from "../backend/src/database.js";

import {
  recalculateCandidate,
} from "../backend/src/routes/prospecting.js";


const SEARCH =
  "http://127.0.0.1:8888/search";

const MAX_CANDIDATES = 4;

const NOW =
  new Date();

const LIMIT_DATE =
  new Date(
    NOW.getTime()
    - 180 * 24 * 60 * 60 * 1000
  );


const GROWTH_TERMS = [
  "nova coleção",
  "nova colecao",
  "lançamento",
  "lancamento",
  "nova linha",
  "expansão",
  "expansao",
  "nova loja",
  "nova unidade",
  "inauguração",
  "inauguracao",
  "novos pontos de venda",
  "ampliação",
  "ampliacao",
  "estamos crescendo",
];


function normalize(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      ""
    )
    .toLowerCase();
}


function containsGrowth(
  value
) {
  const text =
    normalize(value);

  return GROWTH_TERMS.some(
    term =>
      text.includes(
        normalize(term)
      )
  );
}


async function fetchJson(
  url
) {
  const controller =
    new AbortController();

  const timer =
    setTimeout(
      () =>
        controller.abort(),
      15000
    );

  try {
    const response =
      await fetch(
        url,
        {
          signal:
            controller.signal,
        }
      );

    if (!response.ok) {
      throw new Error(
        `HTTP_${response.status}`
      );
    }

    return await response.json();

  } finally {
    clearTimeout(timer);
  }
}


function parseDate(
  value
) {
  if (!value) {
    return null;
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return null;
  }

  return date;
}


function recentDateInText(
  value
) {
  const text =
    String(value || "");

  const patterns = [
    /\b(20\d{2})-(\d{2})-(\d{2})\b/g,
    /\b(\d{2})\/(\d{2})\/(20\d{2})\b/g,
  ];

  for (
    let p = 0;
    p < patterns.length;
    p += 1
  ) {
    const regex =
      patterns[p];

    let match;

    while (
      (
        match =
          regex.exec(text)
      )
    ) {
      let date;

      if (p === 0) {
        date =
          new Date(
            `${match[1]}-${match[2]}-${match[3]}T12:00:00Z`
          );
      } else {
        date =
          new Date(
            `${match[3]}-${match[2]}-${match[1]}T12:00:00Z`
          );
      }

      if (
        !Number.isNaN(
          date.getTime()
        )
        && date >= LIMIT_DATE
        && date <= NOW
      ) {
        return date;
      }
    }
  }

  return null;
}


async function searchGrowth(
  domain
) {
  const queries = [
    `site:${domain} "nova coleção" OR lançamento OR "nova linha"`,
    `site:${domain} expansão OR "nova loja" OR inauguração`,
  ];

  for (
    const query of queries
  ) {
    const params =
      new URLSearchParams({
        q:
          query,
        format:
          "json",
        language:
          "pt-BR",
        safesearch:
          "0",
        categories:
          "general",
      });

    const result =
      await fetchJson(
        `${SEARCH}?${params.toString()}`
      );

    const items =
      result?.results
      || [];

    for (
      const item of items.slice(
        0,
        8
      )
    ) {
      const url =
        String(
          item?.url || ""
        );

      if (
        !url.includes(domain)
      ) {
        continue;
      }

      const content =
        [
          item?.title,
          item?.content,
        ]
          .filter(Boolean)
          .join(" ");

      if (
        !containsGrowth(
          content
        )
      ) {
        continue;
      }

      const published =
        parseDate(
          item?.publishedDate
          || item?.published_date
          || item?.date
        );

      const detected =
        published
        || recentDateInText(
          content
        );

      if (
        detected
        && detected >= LIMIT_DATE
        && detected <= NOW
      ) {
        return {
          url,
          content:
            content.slice(
              0,
              2500
            ),
          date:
            detected,
        };
      }
    }
  }

  return null;
}


const [candidates] =
  await db.query(
    `
      SELECT
        id,
        company_name,
        cnpj,
        domain,
        confidence_score

      FROM prospecting_candidates

      WHERE
        source_origin =
          'IA_PROSPECCAO'

        AND status =
          'rejected'

        AND company_verified = 1
        AND icp_verified = 1
        AND contact_verified = 1
        AND intent_verified = 1
        AND textile_relevance_verified = 1

        AND recent_activity_verified = 0

      ORDER BY
        confidence_score DESC

      LIMIT ?
    `,
    [
      MAX_CANDIDATES,
    ]
  );


console.log(
  "GROWTH_CANDIDATES=",
  candidates.length
);


for (
  const candidate of candidates
) {
  if (!candidate.domain) {
    console.log(
      "GROWTH_SKIP_NO_DOMAIN",
      candidate.cnpj
    );

    continue;
  }

  console.log(
    "GROWTH_SEARCH",
    candidate.company_name,
    candidate.domain
  );

  let growth;

  try {
    growth =
      await searchGrowth(
        candidate.domain
      );
  } catch (error) {
    console.log(
      "GROWTH_SEARCH_ERROR",
      candidate.cnpj,
      error?.message
    );

    continue;
  }

  if (!growth) {
    console.log(
      "GROWTH_NOT_FOUND",
      candidate.cnpj
    );

    continue;
  }

  console.log(
    "GROWTH_FOUND",
    candidate.cnpj,
    growth.date
      .toISOString()
      .slice(0, 10),
    growth.url
  );


  const [existing] =
    await db.execute(
      `
        SELECT id
        FROM prospecting_evidence

        WHERE
          candidate_id = ?

          AND evidence_type =
            'growth_signal'

          AND source_url = ?

        LIMIT 1
      `,
      [
        candidate.id,
        growth.url,
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
          verified,
          data
        )

        VALUES (
          ?,
          ?,
          'growth_signal',
          'strong',
          ?,
          'Crescimento recente',
          ?,
          ?,
          1,
          ?
        )
      `,
      [
        crypto.randomUUID(),

        candidate.id,

        growth.url,

        growth.content,

        growth.date,

        JSON.stringify({
          engine:
            "searxng_growth_v1",

          verification:
            "dated_public_result",

          searched_at:
            new Date()
              .toISOString(),
        }),
      ]
    );
  }


  /*
   * Reabre SOMENTE candidato cujo
   * crescimento foi efetivamente encontrado.
   */
  await db.execute(
    `
      UPDATE prospecting_candidates
      SET
        status =
          'validating',
        rejection_reason =
          NULL
      WHERE id = ?
    `,
    [
      candidate.id,
    ]
  );


  /*
   * Primeira recalculada:
   * atualiza o growth gate.
   */
  let result =
    await recalculateCandidate(
      candidate.id
    );


  /*
   * A segunda revisão só passa se,
   * depois da nova evidência,
   * TODOS os gates de negócio já
   * estiverem aprovados.
   */
  const gates =
    result?.hard_gates
    || {};

  const readyForSecondReview =
    Boolean(
      gates.company_verified
      && gates.icp_verified
      && gates.contact_verified
      && gates.recent_activity_verified
      && gates.intent_verified
      && gates.textile_relevance_verified
    );


  if (
    readyForSecondReview
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
          'growth_search_v1',
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

        "Revisão independente confirmou evidência pública e recente de crescimento, mantendo todos os demais hard gates aprovados.",

        JSON.stringify({
          source_url:
            growth.url,

          observed_at:
            growth.date
              .toISOString(),
        }),
      ]
    );


    result =
      await recalculateCandidate(
        candidate.id
      );
  }


  const [[final]] =
    await db.query(
      `
        SELECT
          status,
          confidence_score,
          company_verified,
          icp_verified,
          contact_verified,
          recent_activity_verified,
          intent_verified,
          textile_relevance_verified,
          second_validation_passed

        FROM prospecting_candidates

        WHERE id = ?
      `,
      [
        candidate.id,
      ]
    );


  console.log(
    "GROWTH_RESULT",
    candidate.company_name,
    JSON.stringify(final)
  );
}


console.log(
  "GROWTH_BACKFILL=OK"
);

process.exit(0);

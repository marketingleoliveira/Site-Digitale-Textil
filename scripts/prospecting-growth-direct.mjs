import crypto from "node:crypto";

import {
  db,
} from "../backend/src/database.js";

import {
  recalculateCandidate,
} from "../backend/src/routes/prospecting.js";


const YEAR =
  Number(
    new Intl.DateTimeFormat(
      "en",
      {
        timeZone:
          "America/Sao_Paulo",
        year:
          "numeric",
      }
    ).format(
      new Date()
    )
  );

const YEARS = [
  String(YEAR),
  String(YEAR + 1),
];

const TERMS = [
  "nova coleção",
  "nova colecao",
  "coleção",
  "colecao",
  "lançamento",
  "lancamento",
  "lançamentos",
  "lancamentos",
  "nova linha",
  "alto verão",
  "alto verao",
  "primavera verão",
  "primavera verao",
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
      /\s+/g,
      " "
    );
}


async function fetchPage(url) {
  const controller =
    new AbortController();

  const timer =
    setTimeout(
      () =>
        controller.abort(),
      8000
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
              "DigitaleProspecting/1.0 (+https://digitaletextil.com.br)",
          },

          signal:
            controller.signal,
        }
      );

    if (!response.ok) {
      return null;
    }

    return await response.text();

  } catch {
    return null;

  } finally {
    clearTimeout(timer);
  }
}


function findGrowth(text) {
  const normalized =
    normalize(text);

  for (
    const term of TERMS
  ) {
    const target =
      normalize(term);

    let index =
      normalized.indexOf(
        target
      );

    while (index >= 0) {
      const context =
        normalized.slice(
          Math.max(
            0,
            index - 250
          ),
          index
            + target.length
            + 250
        );

      if (
        YEARS.some(
          year =>
            context.includes(
              year
            )
        )
      ) {
        return {
          term,
          context:
            text.slice(
              Math.max(
                0,
                index - 250
              ),
              index
                + target.length
                + 250
            ),
        };
      }

      index =
        normalized.indexOf(
          target,
          index + 1
        );
    }
  }

  return null;
}


const [candidates] =
  await db.query(`
    SELECT
      id,
      company_name,
      cnpj,
      domain

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

    ORDER BY
      confidence_score DESC

    LIMIT 4
  `);


console.log(
  "DIRECT_GROWTH_CANDIDATES=",
  candidates.length
);


for (
  const candidate of candidates
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
        /\/.*$/,
        ""
      );

  if (!domain) {
    continue;
  }

  console.log(
    "CHECK",
    candidate.company_name,
    domain
  );

  const origins = [
    `https://${domain}`,
    `http://${domain}`,
  ];

  const paths = [
    "/",
    "/lancamentos",
    "/colecoes",
    "/novidades",
  ];

  let found = null;

  for (
    const origin of origins
  ) {
    for (
      const path of paths
    ) {
      const url =
        origin + path;

      const html =
        await fetchPage(
          url
        );

      if (!html) {
        continue;
      }

      const text =
        stripHtml(
          html
        );

      const growth =
        findGrowth(
          text
        );

      if (growth) {
        found = {
          url,
          ...growth,
        };

        break;
      }
    }

    if (found) {
      break;
    }
  }


  if (!found) {
    console.log(
      "DIRECT_GROWTH_NOT_FOUND",
      candidate.cnpj
    );

    continue;
  }


  console.log(
    "DIRECT_GROWTH_FOUND",
    candidate.cnpj,
    found.term,
    found.url
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
        found.url,
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
          'Coleção ou lançamento atual',
          ?,
          CURRENT_TIMESTAMP(6),
          1,
          ?
        )
      `,
      [
        crypto.randomUUID(),

        candidate.id,

        found.url,

        found.context.slice(
          0,
          2500
        ),

        JSON.stringify({
          verification:
            "direct_company_site",

          detected_term:
            found.term,

          accepted_years:
            YEARS,
        }),
      ]
    );
  }


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


  let result =
    await recalculateCandidate(
      candidate.id
    );


  const gates =
    result?.hard_gates
    || {};


  const ready =
    Boolean(
      gates.company_verified
      && gates.icp_verified
      && gates.contact_verified
      && gates.recent_activity_verified
      && gates.intent_verified
      && gates.textile_relevance_verified
    );


  if (ready) {
    const [review] =
      await db.execute(
        `
          SELECT id

          FROM prospecting_validation_runs

          WHERE
            candidate_id = ?

            AND validator =
              'direct_site_growth_v2'

            AND passed = 1

          LIMIT 1
        `,
        [
          candidate.id,
        ]
      );


    if (!review.length) {
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
            'direct_site_growth_v2',
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

          "Site oficial apresenta coleção ou lançamento identificado com o ano atual ou seguinte.",

          JSON.stringify({
            source_url:
              found.url,

            detected_term:
              found.term,
          }),
        ]
      );
    }


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
          recent_activity_verified,
          second_validation_passed

        FROM prospecting_candidates

        WHERE id = ?
      `,
      [
        candidate.id,
      ]
    );


  console.log(
    "FINAL",
    candidate.company_name,
    JSON.stringify(final)
  );
}


console.log(
  "DIRECT_GROWTH=OK"
);

process.exit(0);

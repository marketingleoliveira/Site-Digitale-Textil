import crypto from "node:crypto";

import {
  db,
} from "../backend/src/database.js";


const LIMIT =
  Math.max(
    1,
    Math.min(
      10,
      Number(
        process.env.CONTACT_ENRICH_LIMIT
        || 4
      )
    )
  );


const TIMEOUT =
  4500;


function digits(value) {
  return String(
    value || ""
  ).replace(
    /\D+/g,
    ""
  );
}


function normalizePhone(value) {
  let valueDigits =
    digits(value);

  if (
    valueDigits.startsWith("55")
    &&
    (
      valueDigits.length === 12
      ||
      valueDigits.length === 13
    )
  ) {
    valueDigits =
      valueDigits.slice(2);
  }

  if (
    !/^[1-9][0-9]{9,10}$/
      .test(
        valueDigits
      )
  ) {
    return "";
  }

  return valueDigits;
}


function host(value) {
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


function sameOfficialDomain(
  url,
  officialDomain
) {
  const current =
    host(url);

  const official =
    String(
      officialDomain || ""
    )
      .toLowerCase()
      .replace(
        /^www\./,
        ""
      );

  if (
    !current
    ||
    !official
  ) {
    return false;
  }

  return (
    current === official
    ||
    current.endsWith(
      "." + official
    )
    ||
    official.endsWith(
      "." + current
    )
  );
}


async function fetchPage(url) {
  const controller =
    new AbortController();

  const timer =
    setTimeout(
      () =>
        controller.abort(),
      TIMEOUT
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
              "DigitaleProspecting/1.1 (+https://digitaletextil.com.br)",

            Accept:
              "text/html,text/plain;q=0.9,*/*;q=0.2",
          },

          signal:
            controller.signal,
        }
      );

    if (!response.ok) {
      return null;
    }

    const contentType =
      String(
        response.headers
          .get(
            "content-type"
          )
        || ""
      );

    if (
      !contentType.includes(
        "text/"
      )
      &&
      !contentType.includes(
        "html"
      )
    ) {
      return null;
    }

    const text =
      (
        await response.text()
      ).slice(
        0,
        1200000
      );

    return {
      url:
        response.url || url,

      html:
        text,
    };

  } catch {
    return null;

  } finally {
    clearTimeout(timer);
  }
}


function extractLinks(
  html,
  pageUrl,
  officialDomain
) {
  const links =
    new Set();

  const hrefRe =
    /href\s*=\s*["']([^"'#]+)["']/gi;

  let match;

  while (
    (
      match =
        hrefRe.exec(html)
    )
  ) {
    const href =
      String(
        match[1]
        || ""
      ).trim();

    if (
      !href
      ||
      href.startsWith(
        "javascript:"
      )
      ||
      href.startsWith(
        "mailto:"
      )
      ||
      href.startsWith(
        "tel:"
      )
    ) {
      continue;
    }

    const normalized =
      href
        .toLowerCase();

    if (
      ![
        "contato",
        "contact",
        "fale",
        "atendimento",
        "whatsapp",
        "vendas",
        "comercial",
        "sac",
      ].some(
        term =>
          normalized.includes(
            term
          )
      )
    ) {
      continue;
    }

    try {
      const absolute =
        new URL(
          href,
          pageUrl
        ).toString();

      if (
        sameOfficialDomain(
          absolute,
          officialDomain
        )
      ) {
        links.add(
          absolute
        );
      }
    } catch {}
  }

  return [
    ...links
  ].slice(
    0,
    4
  );
}


function extractPhones(
  html
) {
  const found =
    new Map();


  function add(
    value,
    method
  ) {
    const phone =
      normalizePhone(
        value
      );

    if (!phone) {
      return;
    }

    const current =
      found.get(phone);

    if (
      !current
      ||
      method === "whatsapp"
      ||
      method === "tel"
    ) {
      found.set(
        phone,
        method
      );
    }
  }


  /*
   * WhatsApp explícito.
   */
  const whatsappPatterns = [
    /wa\.me\/(?:55)?([0-9]{10,11})/gi,
    /phone=(?:55)?([0-9]{10,11})/gi,
    /whatsapp[^0-9+]{0,80}(\+?55[\s().-]*)?(\(?[0-9]{2}\)?[\s.-]*9?[0-9]{4}[\s.-]*[0-9]{4})/gi,
  ];

  for (
    const regex
    of whatsappPatterns
  ) {
    let match;

    while (
      (
        match =
          regex.exec(html)
      )
    ) {
      add(
        match[2]
        || match[1],
        "whatsapp"
      );
    }
  }


  /*
   * Link tel:
   */
  const telRe =
    /tel:\s*([+0-9().\s-]{10,28})/gi;

  let match;

  while (
    (
      match =
        telRe.exec(html)
    )
  ) {
    add(
      match[1],
      "tel"
    );
  }


  /*
   * Número acompanhado de contexto comercial.
   * Evita aceitar sequências numéricas soltas.
   */
  const labelRe =
    /(?:telefone|fone|whatsapp|contato|atendimento|vendas|comercial)[^0-9+]{0,40}((?:\+?55[\s().-]*)?\(?[0-9]{2}\)?[\s.-]*9?[0-9]{4}[\s.-]*[0-9]{4})/gi;

  while (
    (
      match =
        labelRe.exec(html)
    )
  ) {
    add(
      match[1],
      "labeled_text"
    );
  }


  return [
    ...found.entries()
  ].map(
    ([phone, method]) => ({
      phone,
      method,
    })
  );
}


async function evidenceExists(
  candidateId,
  phone
) {
  const [rows] =
    await db.execute(
      `
        SELECT id

        FROM prospecting_evidence

        WHERE
          candidate_id = ?

          AND evidence_type =
            'contact_channel'

          AND verified = 1

          AND REGEXP_REPLACE(
            COALESCE(
              evidence_text,
              ''
            ),
            '[^0-9]',
            ''
          ) LIKE CONCAT(
            '%',
            ?,
            '%'
          )

        LIMIT 1
      `,
      [
        candidateId,
        phone,
      ]
    );

  return (
    rows.length > 0
  );
}


async function saveEvidence(
  candidate,
  phone,
  method,
  pageUrl
) {
  if (
    await evidenceExists(
      candidate.id,
      phone
    )
  ) {
    return false;
  }

  const evidenceText =
    `Telefone público validado: ${phone} | método: ${method}`;

  await db.execute(
    `
      INSERT INTO prospecting_evidence
      (
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

      VALUES
      (
        ?,
        ?,
        'contact_channel',
        'direct',
        ?,
        'Telefone público no site oficial',
        ?,
        CURRENT_TIMESTAMP(6),
        CURRENT_TIMESTAMP(6),
        1,
        ?
      )
    `,
    [
      crypto.randomUUID(),
      candidate.id,
      pageUrl,
      evidenceText,
      JSON.stringify({
        verification:
          "official_website_phone",

        engine:
          "digitale_contact_enricher_v1",

        method,

        domain:
          candidate.domain,
      }),
    ]
  );


  await db.execute(
    `
      UPDATE prospecting_candidates

      SET
        contact_phone = ?,
        contact_verified = 1,

        status =
          CASE
            WHEN status = 'rejected'
            THEN 'validating'
            ELSE status
          END,

        rejection_reason = NULL,

        last_verified_at =
          CURRENT_TIMESTAMP(6),

        updated_at =
          CURRENT_TIMESTAMP(6)

      WHERE id = ?
    `,
    [
      phone,
      candidate.id,
    ]
  );


  /*
   * Se o recálculo estiver disponível,
   * reaplica todos os hard gates.
   */
  try {
    const prospecting =
      await import(
        "../backend/src/routes/prospecting.js"
      );

    if (
      typeof prospecting
        .recalculateCandidate
      === "function"
    ) {
      await prospecting
        .recalculateCandidate(
          candidate.id
        );

      console.log(
        "CONTACT_RECALCULATED",
        candidate.company_name
      );
    }
  } catch (error) {
    console.log(
      "CONTACT_RECALC_DEFERRED",
      candidate.company_name,
      String(
        error?.message
        || error
      ).slice(
        0,
        150
      )
    );
  }


  console.log(
    "CONTACT_VALIDATED",
    candidate.company_name,
    phone,
    method,
    pageUrl
  );

  return true;
}


const [candidates] =
  await db.query(
    `
      SELECT
        c.id,
        c.company_name,
        c.cnpj,
        c.website,
        c.domain,
        c.contact_phone,
        c.contact_verified,
        c.status,
        c.confidence_score

      FROM prospecting_candidates c

      LEFT JOIN prospecting_sync_queue q
        ON q.candidate_id =
          c.id

      WHERE
        c.source_origin =
          'IA_PROSPECCAO'

        AND c.company_verified = 1
        AND c.icp_verified = 1

        AND c.website IS NOT NULL
        AND c.website <> ''

        AND (
          q.status IS NULL
          OR q.status <> 'synced'
        )

        AND NOT EXISTS (
          SELECT 1

          FROM prospecting_evidence e

          WHERE
            e.candidate_id =
              c.id

            AND e.evidence_type =
              'contact_channel'

            AND e.verified = 1

            AND e.strength IN (
              'strong',
              'direct'
            )

            AND c.contact_phone IS NOT NULL

            AND REGEXP_REPLACE(
              COALESCE(
                e.evidence_text,
                ''
              ),
              '[^0-9]',
              ''
            ) LIKE CONCAT(
              '%',
              REGEXP_REPLACE(
                c.contact_phone,
                '[^0-9]',
                ''
              ),
              '%'
            )
        )

      ORDER BY
        c.confidence_score DESC,
        c.updated_at DESC

      LIMIT ${LIMIT}
    `
  );


console.log(
  "CONTACT_ENRICH_CANDIDATES=",
  candidates.length
);


let checked = 0;
let validated = 0;


for (
  const candidate
  of candidates
) {
  checked += 1;

  const officialDomain =
    candidate.domain
    || host(
      candidate.website
    );

  if (
    !officialDomain
  ) {
    continue;
  }


  let baseUrl;

  try {
    baseUrl =
      new URL(
        candidate.website
      );

  } catch {
    continue;
  }


  const origin =
    baseUrl.origin;


  const urls =
    new Set([
      candidate.website,
      `${origin}/contato`,
      `${origin}/fale-conosco`,
      `${origin}/atendimento`,
      `${origin}/contact`,
    ]);


  /*
   * Primeiro acessa homepage para
   * descobrir links reais de contato.
   */
  const home =
    await fetchPage(
      candidate.website
    );

  if (home) {
    for (
      const link
      of extractLinks(
        home.html,
        home.url,
        officialDomain
      )
    ) {
      urls.add(link);
    }
  }


  let found = false;


  for (
    const url
    of [
      ...urls
    ].slice(
      0,
      7
    )
  ) {
    if (
      !sameOfficialDomain(
        url,
        officialDomain
      )
    ) {
      continue;
    }


    const page =
      (
        home
        &&
        url === candidate.website
      )
        ? home
        : await fetchPage(url);


    if (!page) {
      continue;
    }


    const phones =
      extractPhones(
        page.html
      );


    if (
      phones.length === 0
    ) {
      continue;
    }


    /*
     * Prioridade:
     * WhatsApp > tel: > texto identificado.
     */
    phones.sort(
      (a, b) => {
        const rank = {
          whatsapp: 3,
          tel: 2,
          labeled_text: 1,
        };

        return (
          rank[b.method]
          -
          rank[a.method]
        );
      }
    );


    const best =
      phones[0];


    const saved =
      await saveEvidence(
        candidate,
        best.phone,
        best.method,
        page.url
      );


    if (saved) {
      validated += 1;
    }


    found = true;
    break;
  }


  if (!found) {
    console.log(
      "CONTACT_NOT_FOUND",
      candidate.company_name,
      officialDomain
    );
  }
}


console.log(
  JSON.stringify({
    worker:
      "digitale_contact_enricher_v1",

    checked,
    validated,
  })
);


process.exit(0);

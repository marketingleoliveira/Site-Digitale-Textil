import express from "express";
import crypto from "node:crypto";

import { db } from "../database.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

const FREE_EMAIL_DOMAINS = new Set([
  "gmail.com",
  "hotmail.com",
  "outlook.com",
  "yahoo.com",
  "icloud.com",
  "live.com",
  "bol.com.br",
  "uol.com.br",
]);

const ALLOWED_EVIDENCE_TYPES = new Set([
  "search_result",
  "growth_signal",
  "commercial_capacity",
  "non_mei",
  "company_registration",
  "official_website",
  "icp_fit",
  "contact_channel",
  "recent_activity",
  "buying_intent",
  "textile_relevance",
  "negative_signal",
]);

const STRENGTHS = new Set([
  "weak",
  "medium",
  "strong",
  "direct",
]);

const STRENGTH_VALUE = {
  weak: 1,
  medium: 2,
  strong: 3,
  direct: 4,
};

function clean(value, max = 1000) {
  if (value === undefined || value === null) return null;
  return String(value).trim().slice(0, max) || null;
}

function normalize(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function digits(value) {
  return String(value || "").replace(/\D/g, "");
}

function normalizeCnpj(value) {
  const normalized =
    String(value || "")
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "");

  return normalized || null;
}

function validCnpj(value) {
  const cnpj =
    normalizeCnpj(value);

  if (
    !cnpj
    || cnpj.length !== 14
    || !/^[A-Z0-9]{12}[0-9]{2}$/.test(cnpj)
  ) {
    return false;
  }

  if (
    /^[0-9]{14}$/.test(cnpj)
    && /^([0-9])\1{13}$/.test(cnpj)
  ) {
    return false;
  }

  const valueForDv =
    character =>
      character.charCodeAt(0) - 48;

  const calculate = (
    source,
    weights
  ) => {
    const sum =
      [...source].reduce(
        (total, character, index) =>
          total
          + valueForDv(character)
          * weights[index],
        0
      );

    const remainder =
      sum % 11;

    return remainder < 2
      ? 0
      : 11 - remainder;
  };

  const base =
    cnpj.slice(0, 12);

  const d1 =
    calculate(
      base,
      [5,4,3,2,9,8,7,6,5,4,3,2]
    );

  const d2 =
    calculate(
      base + d1,
      [6,5,4,3,2,9,8,7,6,5,4,3,2]
    );

  return (
    cnpj.slice(-2)
    === `${d1}${d2}`
  );
}

function validBrPhone(value) {
  let phone = digits(value);

  if (phone.startsWith("55") && phone.length >= 12) {
    phone = phone.slice(2);
  }

  if (![10, 11].includes(phone.length)) return false;

  const ddd = Number(phone.slice(0, 2));

  if (ddd < 11 || ddd > 99) return false;

  if (phone.length === 11) {
    return phone[2] === "9";
  }

  return /^[2-5]/.test(phone[2]);
}

function validEmail(value) {
  const email = clean(value, 320);

  return Boolean(
    email
    && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  );
}

function corporateEmail(value) {
  if (!validEmail(value)) return false;

  const domain =
    String(value)
      .split("@")[1]
      ?.toLowerCase();

  return Boolean(
    domain
    && !FREE_EMAIL_DOMAINS.has(domain)
  );
}

function normalizeDomain(value) {
  let input = clean(value, 1000);

  if (!input) return null;

  try {
    if (!/^https?:\/\//i.test(input)) {
      input = `https://${input}`;
    }

    const url = new URL(input);

    return url.hostname
      .toLowerCase()
      .replace(/^www\./, "");
  } catch {
    return null;
  }
}

function validSourceUrl(value) {
  const source = clean(value, 1500);

  if (!source) return false;

  try {
    const url = new URL(source);

    return (
      url.protocol === "http:"
      || url.protocol === "https:"
    );
  } catch {
    return false;
  }
}

function fingerprint({
  companyName,
  cnpj,
  domain,
}) {
  const normalizedCnpj =
    normalizeCnpj(cnpj);

  const source =
    normalizedCnpj
    && normalizedCnpj.length === 14
      ? `cnpj:${normalizedCnpj}`
      : domain
        ? `domain:${domain}`
        : `name:${normalize(companyName)}`;

  return crypto
    .createHash("sha256")
    .update(source)
    .digest("hex");
}


const DISCOVERY_BLOCKED_DOMAINS = new Set([
  "facebook.com",
  "instagram.com",
  "linkedin.com",
  "youtube.com",
  "tiktok.com",
  "pinterest.com",
  "x.com",
  "twitter.com",
  "mercadolivre.com.br",
  "amazon.com.br",
  "shopee.com.br",
  "magazineluiza.com.br",
  "reclameaqui.com.br",
  "jusbrasil.com.br",
  "wikipedia.org",
]);

function blockedDiscoveryDomain(domain) {
  if (!domain) return true;

  return Array.from(
    DISCOVERY_BLOCKED_DOMAINS
  ).some(blocked =>
    domain === blocked
    || domain.endsWith(`.${blocked}`)
  );
}

function discoveryCompanyName(
  title,
  domain
) {
  const cleanTitle =
    clean(title, 255);

  if (cleanTitle) {
    const first =
      cleanTitle
        .split(/\s+[|–—]\s+/)[0]
        ?.trim();

    if (first && first.length >= 2) {
      return first.slice(0, 255);
    }
  }

  const root =
    String(domain || "")
      .replace(/^www\./, "")
      .split(".")[0]
      .replace(/[-_]+/g, " ")
      .trim();

  if (!root) {
    return "Empresa encontrada";
  }

  return root
    .replace(
      /\b\w/g,
      char => char.toUpperCase()
    )
    .slice(0, 255);
}

function campaignDiscoveryQueries(
  campaign
) {
  const niche =
    clean(campaign?.niche, 255)
    || "moda";

  const region =
    clean(campaign?.region, 255)
    || "Brasil";

  const products =
    String(
      campaign?.products || ""
    )
      .split(/[,;\n|]+/)
      .map(item => item.trim())
      .filter(Boolean)
      .slice(0, 3);

  const queries =
    new Set();

  queries.add(
    `${niche} marca própria confecção ${region}`
  );

  for (const product of products) {
    queries.add(
      `${niche} ${product} marca fabricante ${region}`
    );
  }

  return Array
    .from(queries)
    .slice(0, 4);
}

async function braveWebSearch(
  query,
  count = 20
) {
  const apiKey =
    clean(
      process.env.BRAVE_SEARCH_API_KEY,
      1000
    );

  if (!apiKey) {
    const error =
      new Error(
        "search_provider_not_configured"
      );

    error.statusCode = 503;

    throw error;
  }

  const url =
    new URL(
      "https://api.search.brave.com/res/v1/web/search"
    );

  url.searchParams.set(
    "q",
    String(query)
      .slice(0, 600)
  );

  url.searchParams.set(
    "count",
    String(
      Math.min(
        Math.max(
          Number(count || 20),
          1
        ),
        20
      )
    )
  );

  url.searchParams.set(
    "country",
    "BR"
  );

  url.searchParams.set(
    "search_lang",
    "pt"
  );

  url.searchParams.set(
    "ui_lang",
    "pt-BR"
  );

  const controller =
    new AbortController();

  const timer =
    setTimeout(
      () => controller.abort(),
      15000
    );

  try {
    const response =
      await fetch(
        url,
        {
          headers: {
            Accept:
              "application/json",
            "X-Subscription-Token":
              apiKey,
          },
          signal:
            controller.signal,
        }
      );

    const bodyText =
      await response.text();

    let body = {};

    try {
      body =
        bodyText
          ? JSON.parse(bodyText)
          : {};
    } catch {
      body = {};
    }

    if (!response.ok) {
      const error =
        new Error(
          `search_provider_http_${response.status}`
        );

      error.statusCode =
        response.status >= 500
          ? 502
          : response.status;

      throw error;
    }

    return Array.isArray(
      body?.web?.results
    )
      ? body.web.results
      : [];

  } finally {
    clearTimeout(timer);
  }
}

function evidenceMatches(
  evidence,
  type,
  minimumStrength = "strong"
) {
  const minimum =
    STRENGTH_VALUE[minimumStrength] || 3;

  return evidence.some(item =>
    item.verified === 1
    && item.evidence_type === type
    && (
      STRENGTH_VALUE[item.strength] || 0
    ) >= minimum
  );
}


function phoneEvidenceMatches(
  evidence,
  phone,
  minimumStrength = "strong"
) {
  const minimum =
    STRENGTH_VALUE[minimumStrength]
    || 3;

  const target =
    String(phone || "")
      .replace(/\D+/g, "");

  if (
    !/^[1-9][0-9]{9,10}$/
      .test(target)
  ) {
    return false;
  }

  return evidence.some(item => {
    if (
      item.verified !== 1
      || item.evidence_type !==
        "contact_channel"
      || (
        STRENGTH_VALUE[
          item.strength
        ] || 0
      ) < minimum
    ) {
      return false;
    }

    const evidenceDigits =
      String(
        item.evidence_text || ""
      ).replace(
        /\D+/g,
        ""
      );

    return evidenceDigits.includes(
      target
    );
  });
}


function recentEvidenceMatches(
  evidence,
  type,
  minimumStrength,
  maxAgeDays
) {
  const minimum =
    STRENGTH_VALUE[minimumStrength] || 3;

  const cutoff =
    Date.now()
    - maxAgeDays * 24 * 60 * 60 * 1000;

  return evidence.some(item => {
    if (
      item.verified !== 1
      || item.evidence_type !== type
      || (
        STRENGTH_VALUE[item.strength] || 0
      ) < minimum
      || !item.observed_at
    ) {
      return false;
    }

    const observed =
      new Date(item.observed_at).getTime();

    return (
      Number.isFinite(observed)
      && observed >= cutoff
      && observed <= Date.now() + 86400000
    );
  });
}

export async function recalculateCandidate(candidateId) {
  const [candidateRows] =
    await db.execute(
      `
        SELECT *
        FROM prospecting_candidates
        WHERE id = ?
        LIMIT 1
      `,
      [candidateId]
    );

  const candidate =
    candidateRows[0];

  if (!candidate) {
    return null;
  }

  const [evidence] =
    await db.execute(
      `
        SELECT
          id,
          evidence_type,
          strength,
          source_url,
          source_title,
          evidence_text,
          observed_at,
          captured_at,
          verified
        FROM prospecting_evidence
        WHERE candidate_id = ?
        ORDER BY captured_at DESC
      `,
      [candidateId]
    );

  const [validationRuns] =
    await db.execute(
      `
        SELECT
          validator,
          validation_stage,
          passed,
          score,
          decision,
          created_at
        FROM prospecting_validation_runs
        WHERE candidate_id = ?
        ORDER BY created_at DESC
      `,
      [candidateId]
    );

  /*
   * Gate 1:
   * Para prospecção externa brasileira,
   * empresa só é considerada verificada
   * com CNPJ válido + evidência cadastral forte.
   */
  const companyVerified =
    validCnpj(candidate.cnpj)
    && evidenceMatches(
      evidence,
      "company_registration",
      "strong"
    )
    && evidenceMatches(
      evidence,
      "non_mei",
      "strong"
    )
    && evidenceMatches(
      evidence,
      "commercial_capacity",
      "strong"
    );

  /*
   * Gate 2:
   * ICP precisa ter evidência específica,
   * não apenas opinião do modelo.
   */
  const icpVerified =
    evidenceMatches(
      evidence,
      "icp_fit",
      "strong"
    );

  /*
   * Gate 3:
   * Canal utilizável + evidência pública/verificada.
   * E-mail gratuito não conta como contato corporativo.
   */
  const contactVerified =
    validBrPhone(
      candidate.contact_phone
    )
    && phoneEvidenceMatches(
      evidence,
      candidate.contact_phone,
      "strong"
    );

  /*
   * Gate 4:
   * atividade recente: no máximo 120 dias.
   */
  const recentActivityVerified =
    recentEvidenceMatches(
      evidence,
      "growth_signal",
      "strong",
      180
    )
    || recentEvidenceMatches(
      evidence,
      "commercial_activity",
      "strong",
      180
    );

  /*
   * Gate 5:
   * intenção forte e recente.
   * Não basta "vende fitness".
   */
  const intentVerified =
    recentEvidenceMatches(
      evidence,
      "buying_intent",
      "strong",
      90
    );

  /*
   * Gate 6:
   * evidência específica de relevância
   * para tecido / matéria-prima / produção.
   */
  const textileRelevanceVerified =
    evidenceMatches(
      evidence,
      "textile_relevance",
      "strong"
    );

  /*
   * Gate 7:
   * duas validações aprovadas por validadores
   * diferentes.
   */
  const passedValidators =
    new Set(
      validationRuns
        .filter(run =>
          run.passed === 1
          && [
            "full_review",
            "independent_review",
          ].includes(run.validation_stage)
        )
        .map(run => run.validator)
        .filter(Boolean)
    );

  const secondValidationPassed =
    passedValidators.size >= 2;

  const score =
    (companyVerified ? 15 : 0)
    + (icpVerified ? 20 : 0)
    + (contactVerified ? 15 : 0)
    + (recentActivityVerified ? 10 : 0)
    + (intentVerified ? 20 : 0)
    + (textileRelevanceVerified ? 15 : 0)
    + (secondValidationPassed ? 5 : 0);

  const allHardGates =
    companyVerified
    && icpVerified
    && contactVerified
    && recentActivityVerified
    && intentVerified
    && textileRelevanceVerified
    && secondValidationPassed;

  const missingGates = [];

  if (!companyVerified) {
    missingGates.push(
      "company_verified"
    );
  }

  if (!icpVerified) {
    missingGates.push(
      "icp_verified"
    );
  }

  if (!contactVerified) {
    missingGates.push(
      "validated_phone_required"
    );
  }

  if (!recentActivityVerified) {
    missingGates.push(
      "recent_activity_verified"
    );
  }

  if (!intentVerified) {
    missingGates.push(
      "intent_verified"
    );
  }

  if (!textileRelevanceVerified) {
    missingGates.push(
      "textile_relevance_verified"
    );
  }

  if (!secondValidationPassed) {
    missingGates.push(
      "second_validation_passed"
    );
  }

  const rejectionReason =
    allHardGates
      ? null
      : missingGates.join(",");


  // Recuperacao segura: somente rejeicoes por evidencias.
  const recoverableReasons = new Set([
    "company_verified",
    "icp_verified",
    "contact_verified",
    "validated_phone_required",
    "recent_activity_verified",
    "intent_verified",
    "textile_relevance_verified",
    "second_validation_passed",
    "insufficient_evidence",
  ]);

  const reasons = String(
    candidate.rejection_reason || ""
  )
    .split(",")
    .map(value => value.trim())
    .filter(Boolean);

  const recoverable =
    candidate.source_origin === "IA_PROSPECCAO"
    && reasons.length > 0
    && reasons.every(reason =>
      recoverableReasons.has(reason)
    );

  const nextStatus =
    candidate.status === "rejected"
    && !(recoverable && allHardGates)
      ? "rejected"
      : allHardGates
        ? "qualified"
        : "validating";

  await db.execute(
    `
      UPDATE prospecting_candidates
      SET
        company_verified = ?,
        icp_verified = ?,
        contact_verified = ?,
        recent_activity_verified = ?,
        intent_verified = ?,
        textile_relevance_verified = ?,
        second_validation_passed = ?,
        confidence_score = ?,
        status = ?,
        rejection_reason = ?,
        last_verified_at = CURRENT_TIMESTAMP(6),
        qualified_at =
          CASE
            WHEN ? = 'qualified'
            THEN COALESCE(
              qualified_at,
              CURRENT_TIMESTAMP(6)
            )
            ELSE NULL
          END
      WHERE id = ?
    `,
    [
      companyVerified ? 1 : 0,
      icpVerified ? 1 : 0,
      contactVerified ? 1 : 0,
      recentActivityVerified ? 1 : 0,
      intentVerified ? 1 : 0,
      textileRelevanceVerified ? 1 : 0,
      secondValidationPassed ? 1 : 0,
      score,
      nextStatus,
      rejectionReason,
      nextStatus,
      candidateId,
    ]
  );

  return {
    candidate_id: candidateId,
    status: nextStatus,
    score,
    hard_gates: {
      company_verified: companyVerified,
      icp_verified: icpVerified,
      contact_verified: contactVerified,
      recent_activity_verified:
        recentActivityVerified,
      intent_verified: intentVerified,
      textile_relevance_verified:
        textileRelevanceVerified,
      second_validation_passed:
        secondValidationPassed,
    },
    eligible_for_crm: allHardGates,
  };
}

router.use(requireAuth);

router.use((req, res, next) => {
  const role =
    normalize(req.user?.role);

  if (
    role !== "admin"
    && role !== "dev"
    && role !== "developer"
  ) {
    return res
      .status(403)
      .json({
        data: null,
        error: "admin_required",
      });
  }

  next();
});


router.get("/summary", async (_req, res) => {
  try {
    const [[stats]] =
      await db.query(`
        SELECT
          COUNT(*) AS total,
          SUM(status = 'discovered') AS discovered,
          SUM(status = 'validating') AS validating,
          SUM(status = 'qualified') AS qualified,
          SUM(status = 'rejected') AS rejected,
          SUM(intent_verified = 1) AS intent_verified,
          SUM(
            textile_relevance_verified = 1
          ) AS textile_relevance_verified
        FROM prospecting_candidates
      `);

    const [[queue]] =
      await db.query(`
        SELECT
          COUNT(*) AS queued,
          SUM(status = 'pending') AS pending,
          SUM(status = 'synced') AS synced
        FROM prospecting_sync_queue
      `);

    return res.json({
      data: {
        ...stats,
        queue,
        crm_delivery_enabled: false,
      },
      error: null,
    });
  } catch (error) {
    console.error(
      "PROSPECTING SUMMARY:",
      error
    );

    return res
      .status(500)
      .json({
        data: null,
        error:
          "prospecting_summary_failed",
      });
  }
});


router.get("/campaigns", async (_req, res) => {
  try {
    const [rows] =
      await db.execute(`
        SELECT *
        FROM prospecting_campaigns
        ORDER BY created_at DESC
        LIMIT 200
      `);

    return res.json({
      data: rows,
      error: null,
    });
  } catch (error) {
    console.error(
      "PROSPECTING CAMPAIGNS:",
      error
    );

    return res.status(500).json({
      data: null,
      error:
        "prospecting_campaigns_failed",
    });
  }
});


router.post("/campaigns", async (req, res) => {
  try {
    const name =
      clean(req.body?.name, 255);

    const niche =
      clean(req.body?.niche, 255);

    if (!name || !niche) {
      return res.status(400).json({
        data: null,
        error: "name_and_niche_required",
      });
    }

    const id =
      crypto.randomUUID();

    const maxCandidates =
      Math.min(
        Math.max(
          Number(
            req.body?.max_candidates || 50
          ),
          1
        ),
        500
      );

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
          ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?
        )
      `,
      [
        id,
        name,
        niche,
        clean(req.body?.region, 255),
        clean(req.body?.products, 5000),
        clean(
          req.body?.target_profile,
          5000
        ),
        clean(
          req.body?.exclusions,
          5000
        ),
        clean(
          req.body?.minimum_intent,
          40
        ) || "strong",
        maxCandidates,
        JSON.stringify(
          req.body?.criteria || {}
        ),
      ]
    );

    const [rows] =
      await db.execute(
        `
          SELECT *
          FROM prospecting_campaigns
          WHERE id = ?
        `,
        [id]
      );

    return res
      .status(201)
      .json({
        data: rows[0],
        error: null,
      });
  } catch (error) {
    console.error(
      "PROSPECTING CREATE CAMPAIGN:",
      error
    );

    return res.status(500).json({
      data: null,
      error:
        "prospecting_campaign_create_failed",
    });
  }
});



router.post(
  "/campaigns/:id/discover",
  async (req, res) => {
    try {
      const campaignId =
        clean(
          req.params.id,
          191
        );

      const [campaignRows] =
        await db.execute(
          `
            SELECT *
            FROM prospecting_campaigns
            WHERE id = ?
            LIMIT 1
          `,
          [campaignId]
        );

      const campaign =
        campaignRows[0];

      if (!campaign) {
        return res
          .status(404)
          .json({
            data: null,
            error:
              "campaign_not_found",
          });
      }

      const [[existing]] =
        await db.execute(
          `
            SELECT
              COUNT(*) AS total
            FROM prospecting_candidates
            WHERE campaign_id = ?
          `,
          [campaignId]
        );

      const remaining =
        Math.max(
          0,
          Number(
            campaign.max_candidates
            || 50
          )
          - Number(
            existing?.total || 0
          )
        );

      if (remaining <= 0) {
        return res.json({
          data: {
            campaign_id:
              campaignId,
            inserted: 0,
            duplicates: 0,
            excluded: 0,
            queries: [],
            limit_reached: true,
            crm_delivery_enabled:
              false,
          },
          error: null,
        });
      }

      const queries =
        campaignDiscoveryQueries(
          campaign
        );

      const discovered =
        new Map();

      let excluded = 0;

      for (
        const query of queries
      ) {
        const results =
          await braveWebSearch(
            query,
            20
          );

        for (
          const result of results
        ) {
          const sourceUrl =
            clean(
              result?.url,
              1500
            );

          const domain =
            normalizeDomain(
              sourceUrl
            );

          if (
            !sourceUrl
            || !domain
            || blockedDiscoveryDomain(
              domain
            )
          ) {
            excluded += 1;
            continue;
          }

          if (
            discovered.has(domain)
          ) {
            continue;
          }

          discovered.set(
            domain,
            {
              query,
              source_url:
                sourceUrl,
              domain,
              title:
                clean(
                  result?.title,
                  500
                ),
              description:
                clean(
                  result?.description,
                  10000
                ),
            }
          );

          if (
            discovered.size
            >= remaining
          ) {
            break;
          }
        }

        if (
          discovered.size
          >= remaining
        ) {
          break;
        }
      }

      let inserted = 0;
      let duplicates = 0;

      const created = [];

      for (
        const item of
        discovered.values()
      ) {
        const id =
          crypto.randomUUID();

        const companyName =
          discoveryCompanyName(
            item.title,
            item.domain
          );

        const companyFingerprint =
          fingerprint({
            companyName,
            cnpj: null,
            domain:
              item.domain,
          });

        let createdCandidate =
          false;

        try {
          const [result] =
            await db.execute(
              `
                INSERT INTO prospecting_candidates (
                  id,
                  campaign_id,
                  company_name,
                  company_fingerprint,
                  website,
                  domain,
                  segment,
                  status,
                  data
                )
                VALUES (
                  ?, ?, ?, ?, ?, ?, ?,
                  'discovered', ?
                )
              `,
              [
                id,
                campaignId,
                companyName,
                companyFingerprint,
                item.source_url,
                item.domain,
                campaign.niche,
                JSON.stringify({
                  discovery_provider:
                    "brave",
                  discovery_query:
                    item.query,
                  discovery_status:
                    "unverified",
                }),
              ]
            );

          createdCandidate =
            result.affectedRows === 1;

        } catch (error) {
          if (
            error?.code ===
            "ER_DUP_ENTRY"
          ) {
            duplicates += 1;
            continue;
          }

          throw error;
        }

        if (!createdCandidate) {
          continue;
        }

        inserted += 1;

        const evidenceId =
          crypto.randomUUID();

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
              ?, ?, 'search_result',
              'weak', ?, ?, ?, NULL,
              0, ?
            )
          `,
          [
            evidenceId,
            id,
            item.source_url,
            item.title,
            item.description
              || (
                "Resultado encontrado "
                + "na pesquisa externa."
              ),
            JSON.stringify({
              provider: "brave",
              query:
                item.query,
              verification:
                "pending",
            }),
          ]
        );

        created.push({
          id,
          company_name:
            companyName,
          domain:
            item.domain,
          source_url:
            item.source_url,
        });
      }

      await db.execute(
        `
          UPDATE prospecting_campaigns
          SET status = 'active'
          WHERE id = ?
        `,
        [campaignId]
      );

      return res.json({
        data: {
          campaign_id:
            campaignId,
          provider:
            "brave",
          queries,
          inserted,
          duplicates,
          excluded,
          candidates:
            created,
          evidence_verified:
            false,
          crm_delivery_enabled:
            false,
        },
        error: null,
      });

    } catch (error) {
      console.error(
        "PROSPECTING DISCOVER:",
        error
      );

      const status =
        Number(
          error?.statusCode
          || 500
        );

      return res
        .status(status)
        .json({
          data: null,
          error:
            error?.message
            || "prospecting_discovery_failed",
        });
    }
  }
);


router.get("/candidates", async (req, res) => {
  try {
    const campaignId =
      clean(req.query.campaign_id, 191);

    const status =
      clean(req.query.status, 40);

    const limit =
      Math.min(
        Math.max(
          Number(req.query.limit || 200),
          1
        ),
        500
      );

    const where = [];
    const params = [];

    if (campaignId) {
      where.push("campaign_id = ?");
      params.push(campaignId);
    }

    if (status) {
      where.push("status = ?");
      params.push(status);
    }

    const [rows] =
      await db.execute(
        `
          SELECT *
          FROM prospecting_candidates
          ${
            where.length
              ? `WHERE ${where.join(" AND ")}`
              : ""
          }
          ORDER BY created_at DESC
          LIMIT ${limit}
        `,
        params
      );

    return res.json({
      data: rows,
      error: null,
    });
  } catch (error) {
    console.error(
      "PROSPECTING CANDIDATES:",
      error
    );

    return res.status(500).json({
      data: null,
      error:
        "prospecting_candidates_failed",
    });
  }
});


router.post("/candidates", async (req, res) => {
  try {
    const campaignId =
      clean(req.body?.campaign_id, 191);

    const companyName =
      clean(req.body?.company_name, 255);

    if (!campaignId || !companyName) {
      return res.status(400).json({
        data: null,
        error:
          "campaign_and_company_required",
      });
    }

    const [campaignRows] =
      await db.execute(
        `
          SELECT id
          FROM prospecting_campaigns
          WHERE id = ?
          LIMIT 1
        `,
        [campaignId]
      );

    if (!campaignRows.length) {
      return res.status(404).json({
        data: null,
        error:
          "campaign_not_found",
      });
    }

    const cnpj =
      normalizeCnpj(
        req.body?.cnpj
      );

    const website =
      clean(req.body?.website, 1000);

    const domain =
      normalizeDomain(
        req.body?.domain || website
      );

    if (!cnpj && !domain) {
      return res.status(400).json({
        data: null,
        error:
          "company_identity_required",
      });
    }

    const companyFingerprint =
      fingerprint({
        companyName,
        cnpj,
        domain,
      });

    const id =
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
            contact_name,
            contact_role,
            contact_email,
            contact_phone,
            status,
            data
          )
          VALUES (
            ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?, 'discovered', ?
          )
        `,
        [
          id,
          campaignId,
          companyName,
          companyFingerprint,
          cnpj,
          website,
          domain,
          clean(req.body?.city, 180),
          clean(req.body?.state, 80),
          clean(
            req.body?.segment,
            255
          ),
          clean(
            req.body?.contact_name,
            255
          ),
          clean(
            req.body?.contact_role,
            255
          ),
          clean(
            req.body?.contact_email,
            320
          )?.toLowerCase() || null,
          clean(
            req.body?.contact_phone,
            80
          ),
          JSON.stringify(
            req.body?.data || {}
          ),
        ]
      );
    } catch (error) {
      if (
        error?.code ===
        "ER_DUP_ENTRY"
      ) {
        return res.status(409).json({
          data: null,
          error:
            "company_already_exists",
        });
      }

      throw error;
    }

    const [rows] =
      await db.execute(
        `
          SELECT *
          FROM prospecting_candidates
          WHERE id = ?
        `,
        [id]
      );

    return res
      .status(201)
      .json({
        data: rows[0],
        error: null,
      });
  } catch (error) {
    console.error(
      "PROSPECTING CREATE CANDIDATE:",
      error
    );

    return res.status(500).json({
      data: null,
      error:
        "prospecting_candidate_create_failed",
    });
  }
});


router.get("/candidates/:id", async (req, res) => {
  try {
    const id =
      clean(req.params.id, 191);

    const [candidateRows] =
      await db.execute(
        `
          SELECT *
          FROM prospecting_candidates
          WHERE id = ?
          LIMIT 1
        `,
        [id]
      );

    if (!candidateRows.length) {
      return res.status(404).json({
        data: null,
        error: "candidate_not_found",
      });
    }

    const [evidence] =
      await db.execute(
        `
          SELECT *
          FROM prospecting_evidence
          WHERE candidate_id = ?
          ORDER BY captured_at DESC
        `,
        [id]
      );

    const [validationRuns] =
      await db.execute(
        `
          SELECT *
          FROM prospecting_validation_runs
          WHERE candidate_id = ?
          ORDER BY created_at DESC
        `,
        [id]
      );

    return res.json({
      data: {
        candidate:
          candidateRows[0],
        evidence,
        validation_runs:
          validationRuns,
      },
      error: null,
    });
  } catch (error) {
    console.error(
      "PROSPECTING CANDIDATE:",
      error
    );

    return res.status(500).json({
      data: null,
      error:
        "prospecting_candidate_failed",
    });
  }
});


router.post(
  "/candidates/:id/evidence",
  async (req, res) => {
    try {
      const candidateId =
        clean(req.params.id, 191);

      const evidenceType =
        clean(
          req.body?.evidence_type,
          80
        );

      const strength =
        clean(
          req.body?.strength,
          20
        ) || "weak";

      const sourceUrl =
        clean(
          req.body?.source_url,
          1500
        );

      const evidenceText =
        clean(
          req.body?.evidence_text,
          10000
        );

      if (
        !ALLOWED_EVIDENCE_TYPES.has(
          evidenceType
        )
      ) {
        return res.status(400).json({
          data: null,
          error:
            "invalid_evidence_type",
        });
      }

      if (!STRENGTHS.has(strength)) {
        return res.status(400).json({
          data: null,
          error:
            "invalid_evidence_strength",
        });
      }

      if (
        !validSourceUrl(sourceUrl)
        || !evidenceText
      ) {
        return res.status(400).json({
          data: null,
          error:
            "source_and_evidence_required",
        });
      }

      const [candidateRows] =
        await db.execute(
          `
            SELECT id
            FROM prospecting_candidates
            WHERE id = ?
            LIMIT 1
          `,
          [candidateId]
        );

      if (!candidateRows.length) {
        return res.status(404).json({
          data: null,
          error:
            "candidate_not_found",
        });
      }

      let observedAt = null;

      if (req.body?.observed_at) {
        const parsed =
          new Date(
            req.body.observed_at
          );

        if (
          Number.isNaN(
            parsed.getTime()
          )
        ) {
          return res
            .status(400)
            .json({
              data: null,
              error:
                "invalid_observed_at",
            });
        }

        observedAt = parsed;
      }

      const id =
        crypto.randomUUID();

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
            ?, ?, ?, ?, ?, ?, ?, ?, 0, ?
          )
        `,
        [
          id,
          candidateId,
          evidenceType,
          strength,
          sourceUrl,
          clean(
            req.body?.source_title,
            500
          ),
          evidenceText,
          observedAt,
          JSON.stringify({
            created_by:
              req.user?.id || null,
            verification:
              "pending",
          }),
        ]
      );

      return res
        .status(201)
        .json({
          data: {
            id,
            candidate_id:
              candidateId,
            verified: false,
          },
          error: null,
        });
    } catch (error) {
      console.error(
        "PROSPECTING EVIDENCE:",
        error
      );

      return res.status(500).json({
        data: null,
        error:
          "prospecting_evidence_failed",
      });
    }
  }
);


router.post(
  "/evidence/:id/verify",
  async (req, res) => {
    try {
      const id =
        clean(req.params.id, 191);

      const [rows] =
        await db.execute(
          `
            SELECT
              id,
              candidate_id,
              data
            FROM prospecting_evidence
            WHERE id = ?
            LIMIT 1
          `,
          [id]
        );

      if (!rows.length) {
        return res.status(404).json({
          data: null,
          error:
            "evidence_not_found",
        });
      }

      let existingData = {};

      try {
        existingData =
          rows[0].data
            ? JSON.parse(
                rows[0].data
              )
            : {};
      } catch {
        existingData = {};
      }

      const verificationData = {
        ...existingData,
        verification:
          req.body?.verified === false
            ? "rejected"
            : "verified",
        verified_by:
          req.user?.id || null,
        verified_at:
          new Date().toISOString(),
        verification_note:
          clean(
            req.body
              ?.verification_note,
            2000
          ),
      };

      await db.execute(
        `
          UPDATE prospecting_evidence
          SET
            verified = ?,
            data = ?
          WHERE id = ?
        `,
        [
          req.body?.verified === false
            ? 0
            : 1,
          JSON.stringify(
            verificationData
          ),
          id,
        ]
      );

      const evaluation =
        await recalculateCandidate(
          rows[0].candidate_id
        );

      return res.json({
        data: {
          evidence_id: id,
          evaluation,
        },
        error: null,
      });
    } catch (error) {
      console.error(
        "PROSPECTING VERIFY EVIDENCE:",
        error
      );

      return res.status(500).json({
        data: null,
        error:
          "prospecting_evidence_verify_failed",
      });
    }
  }
);


router.post(
  "/candidates/:id/validation-runs",
  async (req, res) => {
    try {
      const candidateId =
        clean(req.params.id, 191);

      const stage =
        clean(
          req.body?.validation_stage,
          80
        );

      if (
        ![
          "full_review",
          "independent_review",
        ].includes(stage)
      ) {
        return res.status(400).json({
          data: null,
          error:
            "invalid_validation_stage",
        });
      }

      const [candidateRows] =
        await db.execute(
          `
            SELECT id
            FROM prospecting_candidates
            WHERE id = ?
            LIMIT 1
          `,
          [candidateId]
        );

      if (!candidateRows.length) {
        return res.status(404).json({
          data: null,
          error:
            "candidate_not_found",
        });
      }

      const id =
        crypto.randomUUID();

      /*
       * Validator NÃO vem do body.
       * Impede o mesmo usuário de
       * inventar dois validadores.
       */
      const validator =
        `user:${
          req.user?.id
          || req.user?.systemId
          || "unknown"
        }`;

      const passed =
        req.body?.passed === true;

      const score =
        Math.min(
          Math.max(
            Number(req.body?.score || 0),
            0
          ),
          100
        );

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
          id,
          candidateId,
          stage,
          validator,
          passed ? 1 : 0,
          score,
          clean(
            req.body?.decision,
            40
          ) || (
            passed
              ? "pass"
              : "review"
          ),
          clean(
            req.body?.explanation,
            10000
          ),
          JSON.stringify(
            Array.isArray(
              req.body?.evidence_ids
            )
              ? req.body.evidence_ids
              : []
          ),
          JSON.stringify({
            performed_by:
              req.user?.id || null,
          }),
        ]
      );

      const evaluation =
        await recalculateCandidate(
          candidateId
        );

      return res
        .status(201)
        .json({
          data: {
            validation_run_id: id,
            evaluation,
          },
          error: null,
        });
    } catch (error) {
      console.error(
        "PROSPECTING VALIDATION RUN:",
        error
      );

      return res.status(500).json({
        data: null,
        error:
          "prospecting_validation_failed",
      });
    }
  }
);


router.post(
  "/candidates/:id/recalculate",
  async (req, res) => {
    try {
      const id =
        clean(req.params.id, 191);

      const evaluation =
        await recalculateCandidate(id);

      if (!evaluation) {
        return res.status(404).json({
          data: null,
          error:
            "candidate_not_found",
        });
      }

      return res.json({
        data: evaluation,
        error: null,
      });
    } catch (error) {
      console.error(
        "PROSPECTING RECALCULATE:",
        error
      );

      return res.status(500).json({
        data: null,
        error:
          "prospecting_recalculate_failed",
      });
    }
  }
);


/*
 * DELIBERADAMENTE NÃO EXISTE:
 *
 * POST /sync
 * POST /send-to-crm
 * POST /agendor
 *
 * A integração CRM será adicionada
 * somente depois dos testes dos gates.
 */

export default router;

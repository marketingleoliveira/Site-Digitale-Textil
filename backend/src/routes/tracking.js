
// STRICT_IDENTITY_VALIDATION_V1
function validateCommercialIdentity(value) {
  const errors = [];
  const name = String(value?.name || "").trim();
  const company = String(value?.company || "").trim();
  const email = String(value?.email || "").trim();
  let phone = String(value?.phone || value?.whatsapp || "").replace(/\D/g, "");
  const cnpj = String(value?.cnpj || "").replace(/[.\-/\s]/g, "");

  if (name.length < 2 || name.length > 180 || !/\p{L}/u.test(name))
    errors.push("Informe seu nome.");
  if (company.length < 2 || company.length > 180 || !/\p{L}/u.test(company))
    errors.push("Informe sua empresa.");
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email))
    errors.push("Informe um e-mail válido.");

  if ((phone.length === 12 || phone.length === 13) && phone.startsWith("55"))
    phone = phone.slice(2);

  const ddds = new Set(
    "11 12 13 14 15 16 17 18 19 21 22 24 27 28 31 32 33 34 35 37 38 41 42 43 44 45 46 47 48 49 51 53 54 55 61 62 63 64 65 66 67 68 69 71 73 74 75 77 79 81 82 83 84 85 86 87 88 89 91 92 93 94 95 96 97 98 99".split(" ")
  );
  const phoneValid = ddds.has(phone.slice(0, 2))
    && (/^\d{2}[2-5]\d{7}$/.test(phone)
      || /^\d{2}9\d{8}$/.test(phone))
    && !/^(\d)\1+$/.test(phone.slice(2));

  if (!phoneValid)
    errors.push("Informe um telefone válido com DDD.");

  let cnpjValid = /^\d{14}$/.test(cnpj) && !/^(\d)\1+$/.test(cnpj);
  if (cnpjValid) {
    for (const size of [12, 13]) {
      let sum = 0;
      let weight = size - 7;
      for (let i = 0; i < size; i++) {
        sum += Number(cnpj[i]) * weight;
        weight--;
        if (weight < 2) weight = 9;
      }
      const remainder = sum % 11;
      const check = remainder < 2 ? 0 : 11 - remainder;
      if (Number(cnpj[size]) !== check) cnpjValid = false;
    }
  }
  if (!cnpjValid)
    errors.push("Informe um CNPJ válido, incluindo os dígitos verificadores.");

  return errors;
}

import express from "express";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { db } from "../database.js";
import { config } from "../config.js";

const router = express.Router();

const ALLOWED_EVENTS = new Set([
  "session_start",
  "page_view",
  "engaged_60s",
  "whatsapp_click",
  "fabric_lead_submit",
  "contact_submit",
  "newsletter_submit",
  "identity_gate_submit",
  "chat_open",
  "chat_message",
  "technology_interest",
  "segment_interest",
  "cta_click",
  "wholesale_landing_view",
  "wholesale_catalog_click",
  "wholesale_whatsapp_click",
  "wholesale_sample_click",
  "wholesale_quote_click"
]);

function clean(value, max = 500) {
  if (value === undefined || value === null) return null;
  return String(value).trim().slice(0, max) || null;
}
function validKey(value) {
  return /^[A-Za-z0-9_-]{10,80}$/.test(String(value || ""));
}

/* TRACKING_IDENTITY_IP_START */

let identityIpTablePromise = null;


function ensureIdentityIpTable() {

  if (!identityIpTablePromise) {

    identityIpTablePromise =
      db.execute(`
        CREATE TABLE IF NOT EXISTS
          tracking_identity_ips
        (
          ip_hash CHAR(64) NOT NULL,

          visitor_key VARCHAR(80) NULL,

          lead_name VARCHAR(180) NULL,
          lead_email VARCHAR(254) NULL,
          lead_phone VARCHAR(60) NULL,
          lead_company VARCHAR(180) NULL,
          lead_cnpj VARCHAR(30) NULL,

          first_identified_at DATETIME(6)
            NOT NULL
            DEFAULT CURRENT_TIMESTAMP(6),

          last_seen_at DATETIME(6)
            NOT NULL
            DEFAULT CURRENT_TIMESTAMP(6),

          PRIMARY KEY (ip_hash),

          KEY idx_tracking_identity_ips_visitor (
            visitor_key
          ),

          KEY idx_tracking_identity_ips_seen (
            last_seen_at
          )
        )
        ENGINE=InnoDB
        DEFAULT CHARSET=utf8mb4
        COLLATE=utf8mb4_unicode_ci
      `)
      .catch(
        error => {

          identityIpTablePromise =
            null;

          throw error;
        }
      );
  }

  return identityIpTablePromise;
}


function normalizeClientIp(
  value
) {

  const ip =
    String(
      value || ""
    )
    .trim()
    .replace(
      /^::ffff:/i,
      ""
    );

  if (
    !ip
    ||
    ip.toLowerCase() ===
      "unknown"
  ) {
    return null;
  }

  return ip;
}


function isLoopbackIp(
  ip
) {

  return (
    ip === "127.0.0.1"
    ||
    ip === "::1"
    ||
    ip === "localhost"
  );
}


function clientIp(
  req
) {

  /*
   * Nginx deve sobrescrever
   * X-Real-IP com $remote_addr.
   */
  const real =
    normalizeClientIp(
      req.headers[
        "x-real-ip"
      ]
    );

  if (
    real
    &&
    !isLoopbackIp(real)
  ) {
    return real;
  }


  /*
   * Com proxy_add_x_forwarded_for,
   * o último IP é o peer recebido
   * diretamente pelo Nginx.
   */
  const forwarded =
    String(
      req.headers[
        "x-forwarded-for"
      ]
      || ""
    )
    .split(",")
    .map(
      item =>
        normalizeClientIp(
          item
        )
    )
    .filter(Boolean);


  if (forwarded.length) {

    const candidate =
      forwarded[
        forwarded.length - 1
      ];

    if (
      candidate
      &&
      !isLoopbackIp(
        candidate
      )
    ) {
      return candidate;
    }
  }


  /*
   * Só usa o socket diretamente
   * quando não estiver vindo do
   * proxy local.
   */
  const socketIp =
    normalizeClientIp(
      req.socket
        ?.remoteAddress
    );

  if (
    socketIp
    &&
    !isLoopbackIp(
      socketIp
    )
  ) {
    return socketIp;
  }


  return null;
}


function identityIpHash(
  req
) {

  const ip =
    clientIp(req);

  if (!ip) {
    return null;
  }

  return crypto
    .createHmac(
      "sha256",
      config.trackingIpSalt
    )
    .update(ip)
    .digest("hex");
}


/*
 * Verificação autoritativa.
 *
 * LocalStorage não decide mais
 * se o formulário deve aparecer.
 */
// STRICT_IDENTITY_STATUS_V1
router.get(
  "/identity-status",
  async (req, res) => {

    res.set(
      "Cache-Control",
      "no-store, no-cache, must-revalidate"
    );

    try {

      await ensureIdentityIpTable();


      const hash =
        identityIpHash(req);


      if (!hash) {

        return res.json({
          ok: true,
          identified: false,
          persistence:
            "ip_unavailable"
        });
      }


      const [rows] =
        await db.execute(
          `
            SELECT
              visitor_key, lead_name, lead_company,
              lead_email, lead_phone, lead_cnpj
            FROM tracking_identity_ips

            WHERE
              ip_hash = ?

            LIMIT 1
          `,
          [
            hash
          ]
        );


      if (rows.length && validateCommercialIdentity({
          name: rows[0].lead_name,
          company: rows[0].lead_company,
          email: rows[0].lead_email,
          phone: rows[0].lead_phone,
          cnpj: rows[0].lead_cnpj
        }).length === 0) {

        await db.execute(
          `
            UPDATE
              tracking_identity_ips

            SET
              last_seen_at =
                NOW(6)

            WHERE
              ip_hash = ?
          `,
          [
            hash
          ]
        );


        return res.json({
          ok: true,
          identified: true,
          persistence:
            "ip"
        });
      }


      /*
       * Migração de pessoas que já
       * preencheram antes da nova
       * regra por IP.
       */
      const visitorKey =
        clean(
          req.query.visitor_key,
          80
        );


      if (
        visitorKey
        &&
        validKey(
          visitorKey
        )
      ) {

        const [visitors] =
          await db.execute(
            `
              SELECT
                visitor_key,
                lead_name,
                lead_email,
                lead_phone,
                lead_company,
                lead_cnpj

              FROM
                tracking_visitors

              WHERE
                visitor_key = ?

                AND
                identified_at
                  IS NOT NULL

              LIMIT 1
            `,
            [
              visitorKey
            ]
          );


        const visitor =
          visitors[0];


        if (visitor && validateCommercialIdentity({
          name: visitor.lead_name,
          company: visitor.lead_company,
          email: visitor.lead_email,
          phone: visitor.lead_phone,
          cnpj: visitor.lead_cnpj
        }).length === 0) {

          await db.execute(
            `
              INSERT INTO
                tracking_identity_ips
              (
                ip_hash,
                visitor_key,
                lead_name,
                lead_email,
                lead_phone,
                lead_company,
                lead_cnpj,
                first_identified_at,
                last_seen_at
              )

              VALUES (
                ?, ?, ?, ?, ?, ?, ?,
                NOW(6),
                NOW(6)
              )

              ON DUPLICATE KEY
              UPDATE

                last_seen_at =
                  NOW(6),

                visitor_key =
                  VALUES(visitor_key),

                lead_name =
                  COALESCE(
                    VALUES(lead_name),
                    lead_name
                  ),

                lead_email =
                  COALESCE(
                    VALUES(lead_email),
                    lead_email
                  ),

                lead_phone =
                  COALESCE(
                    VALUES(lead_phone),
                    lead_phone
                  ),

                lead_company =
                  COALESCE(
                    VALUES(lead_company),
                    lead_company
                  ),

                lead_cnpj =
                  COALESCE(
                    VALUES(lead_cnpj),
                    lead_cnpj
                  )
            `,
            [
              hash,
              visitor.visitor_key,
              visitor.lead_name,
              visitor.lead_email,
              visitor.lead_phone,
              visitor.lead_company,
              visitor.lead_cnpj
            ]
          );


          return res.json({
            ok: true,
            identified: true,
            persistence:
              "ip_migrated"
          });
        }
      }


      return res.json({
        ok: true,
        identified: false,
        persistence:
          "ip"
      });


    } catch (error) {

      console.error(
        "TRACKING IDENTITY STATUS:",
        error
      );

      return res
        .status(500)
        .json({
          ok: false,
          identified: false,
          error:
            "identity_status_failed"
        });
    }
  }
);

/* TRACKING_IDENTITY_IP_END */


function adminFrom(req) {
  const header = String(req.headers.authorization || "");
  if (!header.startsWith("Bearer ")) return null;
  try {
    const user = jwt.verify(header.slice(7), config.jwtSecret);
    const role = String(user.role || "").toLowerCase();
    return ["admin", "desenvolvedor"].includes(role) ? user : null;
  } catch {
    return null;
  }
}

function scoreFor(eventType, path) {
  if (eventType === "page_view") {
    if (/^\/tecidos\/[^/]+/.test(path || "")) return 5;
    if (path === "/tecidos") return 3;
    if ((path || "").startsWith("/tecnologias")) return 3;
    if ((path || "").startsWith("/segmentos")) return 2;
    if ((path || "").startsWith("/contato")) return 5;

    if (
      path === "/atacado"
      ||
      (path || "").startsWith(
        "/tecido-fitness-atacado"
      )
      ||
      (path || "").startsWith(
        "/tecido-poliamida-atacado"
      )
      ||
      (path || "").startsWith(
        "/tecido-moda-praia-atacado"
      )
    ) return 6;
    return 1;
  }
  const scores = {
    engaged_60s: 4,
    whatsapp_click: 15,
    fabric_lead_submit: 30,
    contact_submit: 25,
    newsletter_submit: 8,
    identity_gate_submit: 20,
    chat_open: 8,
    chat_message: 4,
    technology_interest: 8,
    segment_interest: 5,
    cta_click: 4,
    wholesale_landing_view: 4,
    wholesale_catalog_click: 8,
    wholesale_whatsapp_click: 20,
    wholesale_sample_click: 22,
    wholesale_quote_click: 30,

    session_start: 0
  };
  return scores[eventType] || 0;
}

function safeMetadata(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const json = JSON.stringify(value);
  if (json.length > 10000) return {};
  return value;
}

/* SITE_AGENDOR_SYNC_START */

let portalLeadSyncTablePromise =
  null;

let portalLeadSyncWorkerRunning =
  false;


function ensurePortalLeadSyncTable() {

  if (
    !portalLeadSyncTablePromise
  ) {

    portalLeadSyncTablePromise =
      db.execute(`
        CREATE TABLE IF NOT EXISTS
          tracking_portal_lead_sync
        (
          visitor_key
            VARCHAR(80)
            NOT NULL,

          payload
            LONGTEXT
            NOT NULL,

          status
            VARCHAR(20)
            NOT NULL
            DEFAULT 'pending',

          attempts
            INT
            NOT NULL
            DEFAULT 0,

          last_error
            VARCHAR(1000)
            NULL,

          last_attempt_at
            DATETIME(6)
            NULL,

          synced_at
            DATETIME(6)
            NULL,

          created_at
            DATETIME(6)
            NOT NULL
            DEFAULT CURRENT_TIMESTAMP(6),

          updated_at
            DATETIME(6)
            NOT NULL
            DEFAULT CURRENT_TIMESTAMP(6),

          PRIMARY KEY (
            visitor_key
          ),

          KEY idx_tracking_portal_sync_status (
            status,
            updated_at
          )
        )
        ENGINE=InnoDB
        DEFAULT CHARSET=utf8mb4
        COLLATE=utf8mb4_unicode_ci
      `)
      .catch(
        error => {

          portalLeadSyncTablePromise =
            null;

          throw error;
        }
      );
  }

  return portalLeadSyncTablePromise;
}


async function syncPortalLead(
  visitorKey
) {

  await ensurePortalLeadSyncTable();


  if (
    !config.portalLeadSecret
    ||
    !config.portalLeadUrl
  ) {
    throw new Error(
      "portal_lead_integration_not_configured"
    );
  }


  const [claim] =
    await db.execute(
      `
        UPDATE tracking_portal_lead_sync
        SET
          status = 'syncing',
          attempts = attempts + 1,
          last_attempt_at =
            CURRENT_TIMESTAMP(6),
          updated_at =
            CURRENT_TIMESTAMP(6)
        WHERE
          visitor_key = ?
          AND (
            status = 'pending'
            OR (
              status = 'syncing'
              AND (
                last_attempt_at IS NULL
                OR last_attempt_at
                  < DATE_SUB(
                      CURRENT_TIMESTAMP(6),
                      INTERVAL 2 MINUTE
                    )
              )
            )
          )
      `,
      [
        visitorKey
      ]
    );


  if (
    !claim.affectedRows
  ) {
    return false;
  }


  const [rows] =
    await db.execute(
      `
        SELECT payload
        FROM tracking_portal_lead_sync
        WHERE visitor_key = ?
        LIMIT 1
      `,
      [
        visitorKey
      ]
    );


  const row =
    rows[0];

  if (!row) {
    return false;
  }


  let payload;

  try {
    payload =
      JSON.parse(
        row.payload
      );
  } catch {
    payload = {};
  }


  const controller =
    new AbortController();

  const timeout =
    setTimeout(
      () =>
        controller.abort(),
      8000
    );


  try {

    const response =
      await fetch(
        config.portalLeadUrl,
        {
          method:
            "POST",

          headers: {
            "Content-Type":
              "application/json",

            "x-site-lead-secret":
              config.portalLeadSecret
          },

          body:
            JSON.stringify(
              payload
            ),

          signal:
            controller.signal
        }
      );


    if (!response.ok) {

      const body =
        await response.text();

      throw new Error(
        `portal_http_${response.status}:`
        +
        body.slice(
          0,
          300
        )
      );
    }


    await db.execute(
      `
        UPDATE tracking_portal_lead_sync
        SET
          status = 'synced',
          last_error = NULL,
          synced_at =
            CURRENT_TIMESTAMP(6),
          updated_at =
            CURRENT_TIMESTAMP(6)
        WHERE visitor_key = ?
      `,
      [
        visitorKey
      ]
    );


    return true;

  } catch (error) {

    await db.execute(
      `
        UPDATE tracking_portal_lead_sync
        SET
          status = 'pending',
          last_error = ?,
          updated_at =
            CURRENT_TIMESTAMP(6)
        WHERE visitor_key = ?
      `,
      [
        clean(
          error?.message
          || String(error),
          1000
        ),
        visitorKey
      ]
    );

    throw error;

  } finally {

    clearTimeout(
      timeout
    );
  }
}


async function syncPendingPortalLeads() {

  if (
    portalLeadSyncWorkerRunning
  ) {
    return;
  }

  portalLeadSyncWorkerRunning =
    true;

  try {

    await ensurePortalLeadSyncTable();

    const [rows] =
      await db.execute(`
        SELECT visitor_key
        FROM tracking_portal_lead_sync
        WHERE
          status = 'pending'
          OR (
            status = 'syncing'
            AND (
              last_attempt_at IS NULL
              OR last_attempt_at
                < DATE_SUB(
                    CURRENT_TIMESTAMP(6),
                    INTERVAL 2 MINUTE
                  )
            )
          )
        ORDER BY
          updated_at ASC
        LIMIT 20
      `);


    for (
      const row
      of rows
    ) {

      try {

        await syncPortalLead(
          row.visitor_key
        );

      } catch (error) {

        console.error(
          "PORTAL LEAD SYNC:",
          error?.message
          || error
        );
      }
    }

  } finally {

    portalLeadSyncWorkerRunning =
      false;
  }
}


setTimeout(
  () => {
    void syncPendingPortalLeads();
  },
  15000
).unref();


setInterval(
  () => {
    void syncPendingPortalLeads();
  },
  60000
).unref();

/* SITE_AGENDOR_SYNC_END */


router.post("/event", async (req, res) => {
  const body = req.body || {};
  const visitorKey = clean(body.visitor_key, 80);
  const sessionId = clean(body.session_id, 80);
  const eventType = clean(body.event_type, 80);
  const path = clean(body.path, 500);

  if (!validKey(visitorKey) || !ALLOWED_EVENTS.has(eventType)) {
    return res.status(400).json({ ok: false, error: "invalid_tracking_event" });
  }

  const identitySubmissionIpHash =
    eventType === "identity_gate_submit"
      ? identityIpHash(req)
      : null;

  if (
    eventType === "identity_gate_submit"
    &&
    !identitySubmissionIpHash
  ) {
    return res.status(503).json({
      ok: false,
      error: "client_ip_unavailable"
    });
  }

  await ensurePortalLeadSyncTable();

  const connection = await db.getConnection();

  try {

    if (
      eventType ===
        "identity_gate_submit"
    ) {
      await ensureIdentityIpTable();
      await ensurePortalLeadSyncTable();
    }

    await connection.beginTransaction();
    const [existingRows] = await connection.execute(
      "SELECT * FROM tracking_visitors WHERE visitor_key = ? LIMIT 1",
      [visitorKey]
    );
    const existing = existingRows[0] || null;
    const isNewSession = Boolean(
      sessionId && (!existing || existing.last_session_id !== sessionId)
    );
    const lastSeenAt = existing?.last_seen
      ? new Date(existing.last_seen).getTime()
      : 0;
    const isRealReturn = Boolean(
      existing &&
      isNewSession &&
      Date.now() - lastSeenAt >= 30 * 60 * 1000
    );
    const returningBonus = isRealReturn ? 8 : 0;
    const delta = scoreFor(eventType, path) + returningBonus;

    const identity = body.identity && typeof body.identity === "object"
      ? body.identity
      : {};
    const leadName = clean(identity.name, 180);
    const leadEmail = clean(identity.email, 254)?.toLowerCase() || null;
    const leadPhone = clean(identity.phone || identity.whatsapp, 60);
    const leadCompany = clean(identity.company, 180);
    const leadCnpj = clean(identity.cnpj, 30);

    if (eventType === "identity_gate_submit") {
      const validationErrors = validateCommercialIdentity(identity);
      if (validationErrors.length) {
        await connection.rollback();
        return res.status(400).json({
          ok: false,
          error: "invalid_identity",
          message: validationErrors[0],
          errors: validationErrors
        });
      }
    }

    const identified = validateCommercialIdentity({
      name: leadName || existing?.lead_name,
      company: leadCompany || existing?.lead_company,
      email: leadEmail || existing?.lead_email,
      phone: leadPhone || existing?.lead_phone,
      cnpj: leadCnpj || existing?.lead_cnpj
    }).length === 0;

    // ALL_IDENTIFIED_PORTAL_SYNC_V1
    let shouldSyncPortalLead = false;
    if (identified || existing?.identified_at) {
      const [syncRows] = await connection.execute(
        "SELECT visitor_key FROM tracking_portal_lead_sync WHERE visitor_key = ? LIMIT 1",
        [visitorKey]
      );
      shouldSyncPortalLead = identified || syncRows.length === 0;
    }


    const source = clean(body.source, 120);
    const medium = clean(body.medium, 120);
    const campaign = clean(body.campaign, 180);
    const referrer = clean(body.referrer, 1000);
    const deviceType = clean(body.device_type, 30);
    const browser = clean(body.browser, 50);
    const language = clean(body.language, 20);
    const pageTitle = clean(body.page_title, 300);
    const entityType = clean(body.entity_type, 80);
    const entitySlug = clean(body.entity_slug, 180);
    const metadata = safeMetadata(body.metadata);

    if (!existing) {
      await connection.execute(
        `INSERT INTO tracking_visitors (
          id, visitor_key, first_path, last_path, referrer,
          source, medium, campaign, device_type, browser, language,
          score, total_events, page_views, sessions, last_session_id,
          last_event_type, lead_name, lead_email, lead_phone,
          lead_company, lead_cnpj, identified_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          crypto.randomUUID(), visitorKey, path, path, referrer,
          source, medium, campaign, deviceType, browser, language,
          delta, eventType === "page_view" ? 1 : 0,
          isNewSession ? 1 : 0, sessionId, eventType,
          leadName, leadEmail, leadPhone, leadCompany, leadCnpj,
          identified ? new Date() : null
        ]
      );
    } else {
      await connection.execute(
        `UPDATE tracking_visitors SET
          last_seen = CURRENT_TIMESTAMP,
          last_path = COALESCE(?, last_path),
          source = COALESCE(source, ?),
          medium = COALESCE(medium, ?),
          campaign = COALESCE(campaign, ?),
          referrer = COALESCE(referrer, ?),
          device_type = COALESCE(?, device_type),
          browser = COALESCE(?, browser),
          language = COALESCE(?, language),
          score = score + ?,
          total_events = total_events + 1,
          page_views = page_views + ?,
          sessions = sessions + ?,
          last_session_id = COALESCE(?, last_session_id),
          last_event_type = ?,
          lead_name = COALESCE(?, lead_name),
          lead_email = COALESCE(?, lead_email),
          lead_phone = COALESCE(?, lead_phone),
          lead_company = COALESCE(?, lead_company),
          lead_cnpj = COALESCE(?, lead_cnpj),
          identified_at = CASE
            WHEN identified_at IS NULL AND ? = 1 THEN CURRENT_TIMESTAMP
            ELSE identified_at
          END
        WHERE visitor_key = ?`,
        [
          path, source, medium, campaign, referrer,
          deviceType, browser, language, delta,
          eventType === "page_view" ? 1 : 0,
          isNewSession ? 1 : 0,
          sessionId, eventType,
          leadName, leadEmail, leadPhone, leadCompany, leadCnpj,
          identified ? 1 : 0, visitorKey
        ]
      );
    }

    await connection.execute(
      `INSERT INTO tracking_events (
        id, visitor_key, session_id, event_type, path, page_title,
        entity_type, entity_slug, score_delta, metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        crypto.randomUUID(), visitorKey, sessionId, eventType,
        path, pageTitle, entityType, entitySlug, delta,
        JSON.stringify(metadata)
      ]
    );

    /*
     * Para identity_gate_submit,
     * o IP precisa ser gravado
     * na mesma transação.
     *
     * O IP bruto nunca é salvo.
     */
    if (
      eventType ===
        "identity_gate_submit"
      &&
      identified
    ) {

      await connection.execute(
        `
          INSERT INTO
            tracking_identity_ips
          (
            ip_hash,
            visitor_key,
            lead_name,
            lead_email,
            lead_phone,
            lead_company,
            lead_cnpj,
            first_identified_at,
            last_seen_at
          )

          VALUES (
            ?, ?, ?, ?, ?, ?, ?,
            NOW(6),
            NOW(6)
          )

          ON DUPLICATE KEY
          UPDATE

            last_seen_at =
              NOW(6),

            visitor_key =
              VALUES(visitor_key),

            lead_name =
              COALESCE(
                VALUES(lead_name),
                lead_name
              ),

            lead_email =
              COALESCE(
                VALUES(lead_email),
                lead_email
              ),

            lead_phone =
              COALESCE(
                VALUES(lead_phone),
                lead_phone
              ),

            lead_company =
              COALESCE(
                VALUES(lead_company),
                lead_company
              ),

            lead_cnpj =
              COALESCE(
                VALUES(lead_cnpj),
                lead_cnpj
              )
        `,
        [
          identitySubmissionIpHash,
          visitorKey,
          leadName,
          leadEmail,
          leadPhone,
          leadCompany,
          leadCnpj
        ]
      );
    }


    /*
     * O lead entra primeiro em uma fila local.
     * Assim, uma indisponibilidade temporária
     * do Portal nunca impede a identificação
     * do visitante no site.
     */
    if (shouldSyncPortalLead) {

      const portalPayload = {
        visitor_key:
          visitorKey,

        name:
          leadName
          || existing?.lead_name
          || null,

        email:
          leadEmail
          || existing?.lead_email
          || null,

        phone:
          leadPhone
          || existing?.lead_phone
          || null,

        company:
          leadCompany
          || existing?.lead_company
          || null,

        cnpj:
          leadCnpj
          || existing?.lead_cnpj
          || null,

        source:
          source
          || existing?.source
          || null,

        medium:
          medium
          || existing?.medium
          || null,

        campaign:
          campaign
          || existing?.campaign
          || null,

        path:
          path
          || existing?.last_path
          || null,

        score:
          Number(
            existing?.score
            || 0
          )
          +
          Number(
            delta || 0
          ),

        identified_at:
          existing?.identified_at
          || new Date()
            .toISOString()
      };


      await connection.execute(
        `
          INSERT INTO
            tracking_portal_lead_sync
          (
            visitor_key,
            payload,
            status,
            attempts,
            last_error,
            last_attempt_at,
            synced_at,
            created_at,
            updated_at
          )
          VALUES (
            ?, ?, 'pending',
            0, NULL, NULL, NULL,
            CURRENT_TIMESTAMP(6),
            CURRENT_TIMESTAMP(6)
          )

          ON DUPLICATE KEY
          UPDATE
            payload =
              VALUES(payload),

            status =
              'pending',

            last_error =
              NULL,

            synced_at =
              NULL,

            updated_at =
              CURRENT_TIMESTAMP(6)
        `,
        [
          visitorKey,
          JSON.stringify(
            portalPayload
          )
        ]
      );
    }


    await connection.commit();


    if (shouldSyncPortalLead) {

      void syncPortalLead(
        visitorKey
      ).catch(
        error => {

          console.error(
            "PORTAL LEAD SYNC IMEDIATO:",
            error?.message
            || error
          );
        }
      );
    }


    return res
      .status(201)
      .json({
        ok: true,

        score_delta:
          delta,

        identity_persisted:
          eventType ===
            "identity_gate_submit"
            ? true
            : undefined
      });
  } catch (error) {
    try { await connection.rollback(); } catch {}
    console.error("TRACKING EVENT:", error);
    return res.status(500).json({ ok: false, error: "tracking_failed" });
  } finally {
    connection.release();
  }
});
router.use("/admin", (req, res, next) => {
  const user = adminFrom(req);
  if (!user) {
    return res.status(403).json({ error: "admin_required" });
  }
  req.trackingAdmin = user;
  next();
});

router.get("/admin/summary", async (_req, res) => {
  try {
    const [[visitors]] = await db.query(`
      SELECT
        COUNT(*) AS total_visitors,
        SUM(last_seen >= NOW() - INTERVAL 7 DAY) AS active_7d,
        SUM(identified_at IS NOT NULL) AS identified,
        SUM(score >= 40) AS hot
      FROM tracking_visitors
    `);
    const [[events]] = await db.query(`
      SELECT
        SUM(created_at >= CURDATE()) AS events_today,
        SUM(event_type = 'whatsapp_click' AND created_at >= NOW() - INTERVAL 7 DAY) AS whatsapp_7d,
        SUM(event_type = 'fabric_lead_submit' AND created_at >= NOW() - INTERVAL 7 DAY) AS fabric_leads_7d
      FROM tracking_events
    `);
    const [topPages] = await db.query(`
      SELECT path, COUNT(*) AS views
      FROM tracking_events
      WHERE event_type = 'page_view' AND path IS NOT NULL
        AND created_at >= NOW() - INTERVAL 30 DAY
      GROUP BY path ORDER BY views DESC LIMIT 8
    `);
    const [topFabrics] = await db.query(`
      SELECT
        COALESCE(entity_slug, SUBSTRING_INDEX(path, '/tecidos/', -1)) AS slug,
        COUNT(*) AS views
      FROM tracking_events
      WHERE event_type = 'page_view'
        AND path LIKE '/tecidos/%'
        AND created_at >= NOW() - INTERVAL 30 DAY
      GROUP BY slug ORDER BY views DESC LIMIT 8
    `);
    return res.json({
      data: {
        ...visitors,
        ...events,
        top_pages: topPages,
        top_fabrics: topFabrics
      },
      error: null
    });
  } catch (error) {
    console.error("TRACKING SUMMARY:", error);
    return res.status(500).json({ data: null, error: "tracking_summary_failed" });
  }
});

router.get("/admin/visitors", async (req, res) => {
  try {
    const search = clean(req.query.search, 150);
    const heat = clean(req.query.heat, 20);
    const identified = clean(req.query.identified, 10);
    const limit = Math.min(Math.max(Number(req.query.limit || 200), 1), 500);
    const where = [];
    const params = [];

    if (search) {
      where.push(`(
        lead_name LIKE ? OR lead_email LIKE ? OR lead_phone LIKE ?
        OR lead_company LIKE ? OR lead_cnpj LIKE ? OR last_path LIKE ?
      )`);
      const like = `%${search}%`;
      params.push(like, like, like, like, like, like);
    }
    if (heat === "hot") where.push("score >= 40");
    if (heat === "warm") where.push("score >= 20 AND score < 40");
    if (heat === "interested") where.push("score >= 10 AND score < 20");
    if (identified === "yes") where.push("identified_at IS NOT NULL");
    if (identified === "no") where.push("identified_at IS NULL");

    const [rows] = await db.execute(
      `SELECT * FROM tracking_visitors
       ${where.length ? "WHERE " + where.join(" AND ") : ""}
       ORDER BY score DESC, last_seen DESC
       LIMIT ${limit}`,
      params
    );
    return res.json({ data: rows, error: null });
  } catch (error) {
    console.error("TRACKING VISITORS:", error);
    return res.status(500).json({ data: null, error: "tracking_visitors_failed" });
  }
});

/* TRACKING_DELETE_VISITOR_START */

router.delete(
  "/admin/visitors/:visitorKey",
  async (req, res) => {

    const visitorKey =
      clean(
        req.params.visitorKey,
        80
      );


    if (
      !validKey(
        visitorKey
      )
    ) {

      return res
        .status(400)
        .json({
          data: null,
          error:
            "invalid_visitor"
        });
    }


    const connection =
      await db.getConnection();


    try {

      await connection
        .beginTransaction();


      const [visitorRows] =
        await connection.execute(
          `
            SELECT
              visitor_key,
              lead_name,
              lead_email

            FROM
              tracking_visitors

            WHERE
              visitor_key = ?

            LIMIT 1
          `,
          [
            visitorKey
          ]
        );


      if (
        !visitorRows.length
      ) {

        await connection.rollback();

        return res
          .status(404)
          .json({
            data: null,
            error:
              "visitor_not_found"
          });
      }


      /*
       * Remove também a persistência
       * por IP vinculada ao lead.
       *
       * Assim, se o mesmo IP voltar,
       * poderá preencher o formulário
       * novamente.
       */
      try {

        await connection.execute(
          `
            DELETE FROM
              tracking_identity_ips

            WHERE
              visitor_key = ?
          `,
          [
            visitorKey
          ]
        );

      } catch (error) {

        /*
         * Compatibilidade com bancos
         * anteriores à persistência
         * por IP.
         */
        if (
          error?.code
          !==
          "ER_NO_SUCH_TABLE"
        ) {
          throw error;
        }
      }


      /*
       * Histórico primeiro para evitar
       * qualquer possível restrição FK.
       */
      const [eventsResult] =
        await connection.execute(
          `
            DELETE FROM
              tracking_events

            WHERE
              visitor_key = ?
          `,
          [
            visitorKey
          ]
        );


      const [visitorResult] =
        await connection.execute(
          `
            DELETE FROM
              tracking_visitors

            WHERE
              visitor_key = ?
          `,
          [
            visitorKey
          ]
        );


      await connection.commit();


      return res.json({
        data: {
          deleted: true,

          visitor_key:
            visitorKey,

          events_deleted:
            Number(
              eventsResult
                ?.affectedRows
              || 0
            ),

          visitor_deleted:
            Number(
              visitorResult
                ?.affectedRows
              || 0
            )
        },

        error: null
      });


    } catch (error) {

      try {
        await connection.rollback();
      } catch {}


      console.error(
        "TRACKING DELETE VISITOR:",
        error
      );


      return res
        .status(500)
        .json({
          data: null,
          error:
            "tracking_delete_failed"
        });


    } finally {

      connection.release();
    }
  }
);

/* TRACKING_DELETE_VISITOR_END */


router.get("/admin/visitors/:visitorKey/events", async (req, res) => {
  try {
    const visitorKey = clean(req.params.visitorKey, 80);
    if (!validKey(visitorKey)) {
      return res.status(400).json({ data: null, error: "invalid_visitor" });
    }
    const [rows] = await db.execute(
      `SELECT id, session_id, event_type, path, page_title,
              entity_type, entity_slug, score_delta, metadata, created_at
       FROM tracking_events
       WHERE visitor_key = ?
       ORDER BY created_at DESC
       LIMIT 300`,
      [visitorKey]
    );
    return res.json({ data: rows, error: null });
  } catch (error) {
    console.error("TRACKING EVENTS:", error);
    return res.status(500).json({ data: null, error: "tracking_events_failed" });
  }
});

export default router;

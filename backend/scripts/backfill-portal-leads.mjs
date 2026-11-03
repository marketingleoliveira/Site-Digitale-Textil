import { db } from "../src/database.js";
import { config } from "../src/config.js";


async function ensureTable() {

  await db.execute(`
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
  `);
}


async function main() {

  if (
    !config.portalLeadSecret
    ||
    !config.portalLeadUrl
  ) {
    throw new Error(
      "portal_integration_not_configured"
    );
  }


  await ensureTable();


  const [leads] =
    await db.query(`
      SELECT
        visitor_key,
        lead_name,
        lead_email,
        lead_phone,
        lead_company,
        lead_cnpj,
        source,
        medium,
        campaign,
        last_path,
        score,
        identified_at
      FROM tracking_visitors
      WHERE identified_at IS NOT NULL
      ORDER BY identified_at ASC
    `);


  let queued =
    0;

  let synced =
    0;

  let failed =
    0;


  for (
    const lead
    of leads
  ) {

    const payload = {
      visitor_key:
        lead.visitor_key,

      name:
        lead.lead_name,

      email:
        lead.lead_email,

      phone:
        lead.lead_phone,

      company:
        lead.lead_company,

      cnpj:
        lead.lead_cnpj,

      source:
        lead.source,

      medium:
        lead.medium,

      campaign:
        lead.campaign,

      path:
        lead.last_path,

      score:
        Number(
          lead.score || 0
        ),

      identified_at:
        lead.identified_at
    };


    await db.execute(
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
            CASE
              WHEN status = 'synced'
              THEN 'synced'
              ELSE 'pending'
            END,

          updated_at =
            CURRENT_TIMESTAMP(6)
      `,
      [
        lead.visitor_key,
        JSON.stringify(
          payload
        )
      ]
    );

    queued++;


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
              )
          }
        );


      if (!response.ok) {

        const body =
          await response.text();

        throw new Error(
          `HTTP ${response.status}: `
          +
          body.slice(
            0,
            250
          )
        );
      }


      await db.execute(
        `
          UPDATE tracking_portal_lead_sync
          SET
            status = 'synced',
            attempts =
              attempts + 1,
            last_error = NULL,
            last_attempt_at =
              CURRENT_TIMESTAMP(6),
            synced_at =
              CURRENT_TIMESTAMP(6),
            updated_at =
              CURRENT_TIMESTAMP(6)
          WHERE visitor_key = ?
        `,
        [
          lead.visitor_key
        ]
      );

      synced++;

    } catch (error) {

      failed++;

      await db.execute(
        `
          UPDATE tracking_portal_lead_sync
          SET
            status = 'pending',
            attempts =
              attempts + 1,
            last_error = ?,
            last_attempt_at =
              CURRENT_TIMESTAMP(6),
            updated_at =
              CURRENT_TIMESTAMP(6)
          WHERE visitor_key = ?
        `,
        [
          String(
            error?.message
            || error
          ).slice(
            0,
            1000
          ),

          lead.visitor_key
        ]
      );
    }
  }


  console.log(
    "IDENTIFICADOS="
    +
    leads.length
  );

  console.log(
    "ENFILEIRADOS="
    +
    queued
  );

  console.log(
    "SINCRONIZADOS="
    +
    synced
  );

  console.log(
    "FALHAS="
    +
    failed
  );
}


try {

  await main();

} finally {

  await db.end();
}

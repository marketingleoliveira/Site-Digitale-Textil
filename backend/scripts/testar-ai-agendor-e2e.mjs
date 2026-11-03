import fs from "node:fs";
import crypto from "node:crypto";
import dotenv from "dotenv";
import mysql from "mysql2/promise";

const siteEnv = dotenv.parse(
  fs.readFileSync(
    "/etc/site-digitale-textil/backend.env"
  )
);

const portalEnv = dotenv.parse(
  fs.readFileSync(
    "/etc/portal-digitale/backend.env"
  )
);

const site = await mysql.createConnection({
  host: siteEnv.DB_HOST || "127.0.0.1",
  port: Number(siteEnv.DB_PORT || 3306),
  user: siteEnv.DB_USER,
  password: siteEnv.DB_PASSWORD,
  database: siteEnv.DB_NAME
});

const portal = await mysql.createConnection({
  host: portalEnv.DB_HOST || "127.0.0.1",
  port: Number(portalEnv.DB_PORT || 3306),
  user: portalEnv.DB_USER,
  password: portalEnv.DB_PASSWORD,
  database: portalEnv.DB_NAME
});

const token =
  Date.now().toString()
  + "_"
  + crypto.randomBytes(3).toString("hex");

const visitorKey =
  "ai_test_" + token;

const sessionId =
  "s_ai_test_" + token;

const email =
  "ai-e2e-"
  + token
  + "@example.invalid";

const phone =
  "55119"
  + Date.now()
      .toString()
      .slice(-8);

const name =
  "TESTE INTEGRACAO IA";

const expectedOwner =
  "fba75bd9-8f92-4e2b-83f9-3bc48d7fa4bd";

let conversationId = null;
let testPassed = false;

function assert(
  condition,
  message
) {
  if (!condition) {
    throw new Error(
      "ASSERT_FAIL: " + message
    );
  }
}

async function postJson(
  url,
  body,
  secret = null
) {
  const headers = {
    "content-type":
      "application/json"
  };

  if (secret) {
    headers[
      "x-site-lead-secret"
    ] = secret;
  }

  const response =
    await fetch(
      url,
      {
        method: "POST",
        headers,
        body:
          JSON.stringify(body)
      }
    );

  const text =
    await response.text();

  let json = null;

  try {
    json =
      JSON.parse(text);
  } catch {}

  return {
    status:
      response.status,
    text,
    json
  };
}

async function dealRows() {
  const [rows] =
    await portal.execute(
      `
        SELECT
          d.id,
          d.source,
          d.status,
          d.owner_user_id,
          d.person_id,
          d.organization_id,
          s.name AS stage
        FROM crm_people p
        INNER JOIN crm_deals d
          ON d.person_id = p.id
        LEFT JOIN crm_stages s
          ON s.id = d.stage_id
        WHERE
          LOWER(
            TRIM(
              COALESCE(
                p.email,
                ''
              )
            )
          ) =
          LOWER(?)
        ORDER BY
          d.created_at DESC
      `,
      [
        email
      ]
    );

  return rows;
}

async function cleanup() {

  console.log(
    "\n===== LIMPEZA DO TESTE ====="
  );

  try {

    await portal.beginTransaction();

    const [people] =
      await portal.execute(
        `
          SELECT
            id,
            organization_id
          FROM crm_people
          WHERE
            LOWER(
              TRIM(
                COALESCE(
                  email,
                  ''
                )
              )
            ) =
            LOWER(?)
          FOR UPDATE
        `,
        [
          email
        ]
      );

    for (
      const person
      of people
    ) {

      const [deals] =
        await portal.execute(
          `
            SELECT id
            FROM crm_deals
            WHERE person_id = ?
            FOR UPDATE
          `,
          [
            person.id
          ]
        );

      for (
        const deal
        of deals
      ) {

        await portal.execute(
          `
            DELETE FROM
              crm_external_lead_imports
            WHERE deal_id = ?
          `,
          [
            deal.id
          ]
        );

        await portal.execute(
          `
            DELETE FROM
              crm_deal_products
            WHERE deal_id = ?
          `,
          [
            deal.id
          ]
        );

        await portal.execute(
          `
            DELETE FROM
              crm_deals
            WHERE id = ?
          `,
          [
            deal.id
          ]
        );
      }

      await portal.execute(
        `
          DELETE FROM
            crm_external_lead_imports
          WHERE person_id = ?
        `,
        [
          person.id
        ]
      );

      await portal.execute(
        `
          DELETE FROM crm_people
          WHERE id = ?
        `,
        [
          person.id
        ]
      );
    }

    await portal.commit();

    console.log(
      "PORTAL_TEST_DATA=REMOVIDO"
    );

  } catch (error) {

    await portal.rollback();

    console.error(
      "ERRO_LIMPEZA_PORTAL="
      + error.message
    );
  }


  try {

    await site.beginTransaction();

    const [conversations] =
      await site.execute(
        `
          SELECT id
          FROM agent_conversations
          WHERE session_id = ?
          FOR UPDATE
        `,
        [
          sessionId
        ]
      );

    for (
      const conversation
      of conversations
    ) {

      await site.execute(
        `
          DELETE FROM agent_messages
          WHERE conversation_id = ?
        `,
        [
          conversation.id
        ]
      );

      await site.execute(
        `
          DELETE FROM agent_leads
          WHERE conversation_id = ?
        `,
        [
          conversation.id
        ]
      );

      await site.execute(
        `
          DELETE FROM agent_conversations
          WHERE id = ?
        `,
        [
          conversation.id
        ]
      );
    }

    await site.execute(
      `
        DELETE FROM tracking_visitors
        WHERE visitor_key = ?
      `,
      [
        visitorKey
      ]
    );

    await site.commit();

    console.log(
      "SITE_TEST_DATA=REMOVIDO"
    );

  } catch (error) {

    await site.rollback();

    console.error(
      "ERRO_LIMPEZA_SITE="
      + error.message
    );
  }
}


try {

  console.log(
    "=============================================="
  );

  console.log(
    " TESTE E2E - SITE -> IA -> AGENDOR"
  );

  console.log(
    "=============================================="
  );

  console.log(
    "VISITOR_KEY="
    + visitorKey
  );

  console.log(
    "EMAIL_TESTE="
    + email
  );


  console.log(
    "\n===== 1. BANCOS ====="
  );

  const [[siteDb]] =
    await site.query(
      "SELECT DATABASE() AS db"
    );

  const [[portalDb]] =
    await portal.query(
      "SELECT DATABASE() AS db"
    );

  console.log(
    "SITE_DB="
    + siteDb.db
  );

  console.log(
    "PORTAL_DB="
    + portalDb.db
  );

  assert(
    siteDb.db ===
      "site_digitale",
    "site_database"
  );

  assert(
    portalDb.db ===
      "portal_digitale",
    "portal_database"
  );


  console.log(
    "\n===== 2. CRIANDO VISITANTE TEMPORARIO ====="
  );

  await site.execute(
    `
      INSERT INTO
        tracking_visitors
      (
        id,
        visitor_key,
        first_path,
        last_path,
        source,
        medium,
        campaign,
        lead_name,
        lead_email,
        lead_phone,
        identified_at,
        score
      )
      VALUES (
        ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        NOW(),
        50
      )
    `,
    [
      crypto.randomUUID(),
      visitorKey,
      "/tecidos",
      "/tecidos",
      "teste-e2e",
      "integration-test",
      "ai-agendor",
      name,
      email,
      phone
    ]
  );

  console.log(
    "TRACKING_VISITOR=CRIADO"
  );


  console.log(
    "\n===== 3. CRIANDO CARD INICIAL SITE ====="
  );

  const siteLead =
    await postJson(
      "http://127.0.0.1:8114"
      + "/api/integrations/site-leads",
      {
        visitor_key:
          visitorKey,
        name,
        email,
        phone,
        source:
          "teste-e2e",
        medium:
          "integration-test",
        campaign:
          "ai-agendor",
        path:
          "/tecidos",
        identified_at:
          new Date()
            .toISOString(),
        score:
          50
      },
      siteEnv.PORTAL_LEAD_SECRET
    );

  console.log(
    "SITE_LEAD_HTTP="
    + siteLead.status
  );

  console.log(
    "SITE_LEAD_RESPONSE="
    + siteLead.text
      .slice(0, 800)
  );

  assert(
    siteLead.status >= 200
    &&
    siteLead.status < 300,
    "site_lead_http"
  );

  const before =
    await dealRows();

  console.log(
    "DEALS_APOS_SITE="
    + before.length
  );

  console.table(before);

  assert(
    before.length === 1,
    "site_deal_count"
  );

  assert(
    String(
      before[0].source
    ).toUpperCase()
      === "SITE",
    "initial_source_site"
  );


  console.log(
    "\n===== 4. CONVERSANDO COM O AGENTE ====="
  );

  const chat =
    await postJson(
      "http://127.0.0.1:8116"
      + "/api/functions/chat-agent",
      {
        conversation_id:
          null,
        session_id:
          sessionId,
        visitor_key:
          visitorKey,
        message:
          "Olá! Estou procurando "
          + "tecido para moda fitness. "
          + "Meu WhatsApp é "
          + phone
          + " e meu e-mail é "
          + email
          + ". Quero falar com "
          + "um representante.",
        page_url:
          "https://digitaletextil.com.br/tecidos",
        user_agent:
          "Digitale-E2E-Test",
        page_context:
          "tecidos"
      }
    );

  console.log(
    "CHAT_HTTP="
    + chat.status
  );

  console.log(
    "CHAT_RESPONSE="
    + chat.text
      .slice(0, 1200)
  );

  assert(
    chat.status >= 200
    &&
    chat.status < 300,
    "chat_http"
  );

  conversationId =
    chat.json
      ?.data
      ?.conversation_id
    ||
    chat.json
      ?.conversation_id
    ||
    null;

  await new Promise(
    resolve =>
      setTimeout(
        resolve,
        1000
      )
  );

  if (!conversationId) {

    const [rows] =
      await site.execute(
        `
          SELECT id
          FROM agent_conversations
          WHERE session_id = ?
          ORDER BY
            created_at DESC
          LIMIT 1
        `,
        [
          sessionId
        ]
      );

    conversationId =
      rows[0]?.id
      || null;
  }

  console.log(
    "CONVERSATION_ID="
    + String(
      conversationId
    )
  );

  assert(
    conversationId,
    "conversation_created"
  );


  console.log(
    "\n===== 5. VALIDANDO AGENT_LEADS ====="
  );

  const [conversations] =
    await site.execute(
      `
        SELECT
          id,
          status,
          interest_level,
          needs_followup,
          visitor_name,
          visitor_whatsapp
        FROM agent_conversations
        WHERE id = ?
      `,
      [
        conversationId
      ]
    );

  const [leads] =
    await site.execute(
      `
        SELECT
          id,
          conversation_id,
          visitor_name,
          whatsapp,
          email,
          interest_level,
          source,
          status
        FROM agent_leads
        WHERE conversation_id = ?
      `,
      [
        conversationId
      ]
    );

  console.table(
    conversations
  );

  console.table(
    leads
  );

  assert(
    conversations.length === 1,
    "conversation_row"
  );

  assert(
    leads.length === 1,
    "agent_lead_row"
  );


  console.log(
    "\n===== 6. VALIDANDO PROMOCAO SITE -> IA ====="
  );

  const afterAI =
    await dealRows();

  console.table(
    afterAI
  );

  assert(
    afterAI.length === 1,
    "no_duplicate_deal"
  );

  assert(
    String(
      afterAI[0].source
    ).toUpperCase()
      === "IA",
    "deal_promoted_to_ia"
  );

  assert(
    String(
      afterAI[0].stage || ""
    ).toLowerCase()
      === "prospecção",
    "stage_prospeccao"
  );

  assert(
    String(
      afterAI[0]
        .owner_user_id
    ) ===
      expectedOwner,
    "owner_nicolle"
  );


  console.log(
    "\n===== 7. IMPORTACOES DO MESMO CARD ====="
  );

  const [imports] =
    await portal.execute(
      `
        SELECT
          source_system,
          qualification_status,
          deal_id,
          person_id
        FROM
          crm_external_lead_imports
        WHERE deal_id = ?
        ORDER BY
          source_system
      `,
      [
        afterAI[0].id
      ]
    );

  console.table(
    imports
  );

  assert(
    imports.some(
      row =>
        row.source_system ===
        "site-digitale"
    ),
    "import_site_exists"
  );

  assert(
    imports.some(
      row =>
        row.source_system ===
        "site-digitale-agent-ai"
    ),
    "import_ai_exists"
  );


  console.log(
    "\n===== 8. TESTANDO PROTECAO CONTRA REBAIXAMENTO ====="
  );

  const siteAgain =
    await postJson(
      "http://127.0.0.1:8114"
      + "/api/integrations/site-leads",
      {
        visitor_key:
          visitorKey,
        name,
        email,
        phone,
        source:
          "teste-e2e",
        path:
          "/tecidos",
        identified_at:
          new Date()
            .toISOString(),
        score:
          60
      },
      siteEnv.PORTAL_LEAD_SECRET
    );

  console.log(
    "SITE_RESYNC_HTTP="
    + siteAgain.status
  );

  assert(
    siteAgain.status >= 200
    &&
    siteAgain.status < 300,
    "site_resync_http"
  );

  const afterSiteAgain =
    await dealRows();

  console.table(
    afterSiteAgain
  );

  assert(
    afterSiteAgain.length === 1,
    "resync_no_duplicate"
  );

  assert(
    String(
      afterSiteAgain[0].source
    ).toUpperCase()
      === "IA",
    "ia_not_downgraded"
  );


  console.log(
    "\n=============================================="
  );

  console.log(
    " E2E_RESULTADO=OK"
  );

  console.log(
    "=============================================="
  );

  console.log(
    "SITE_PARA_IA=OK"
  );

  console.log(
    "NEGOCIO_DUPLICADO=NAO"
  );

  console.log(
    "ORIGEM_FINAL=IA"
  );

  console.log(
    "ETAPA_FINAL=Prospecção"
  );

  console.log(
    "RESPONSAVEL=Nicolle"
  );

  console.log(
    "IMPORT_SITE=OK"
  );

  console.log(
    "IMPORT_IA=OK"
  );

  console.log(
    "SITE_NAO_REBAIXA_IA=OK"
  );

  testPassed = true;

} catch (error) {

  console.error(
    "\nE2E_RESULTADO=ERRO"
  );

  console.error(
    error?.stack
    || error?.message
    || error
  );

} finally {

  await cleanup();

  await site.end();
  await portal.end();

  console.log(
    "\nTEST_DATA_PERMANENTE=NAO"
  );
}

if (!testPassed) {
  process.exit(1);
}

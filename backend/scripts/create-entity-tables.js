import fs from "fs";
import mysql from "mysql2/promise";

import { config } from "../src/config.js";

const map = JSON.parse(
  fs.readFileSync(
    "/tmp/digitale-backend-map.json",
    "utf8"
  )
);

const db = await mysql.createConnection({
  host: config.db.host,
  port: config.db.port,
  user: config.db.user,
  password: config.db.password,
  database: config.db.name,
  charset: "utf8mb4"
});

await db.query(`
CREATE TABLE IF NOT EXISTS system_entity_registry (
    entity_name VARCHAR(128) NOT NULL,
    entity_type ENUM(
        'table',
        'rpc',
        'function'
    ) NOT NULL,
    created_at TIMESTAMP
        NOT NULL
        DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (
        entity_name,
        entity_type
    )
)
ENGINE=InnoDB
DEFAULT CHARSET=utf8mb4
COLLATE=utf8mb4_unicode_ci
`);

function validTable(name) {
  return /^[A-Za-z_][A-Za-z0-9_]{0,63}$/.test(name);
}

for (const table of map.tables) {

  if (!validTable(table)) {
    console.log(
      `IGNORADA=${table}`
    );
    continue;
  }

  await db.query(`
    CREATE TABLE IF NOT EXISTS \`${table}\` (
        id VARCHAR(191) NOT NULL,

        data JSON NOT NULL,

        created_at TIMESTAMP
            NOT NULL
            DEFAULT CURRENT_TIMESTAMP,

        updated_at TIMESTAMP
            NOT NULL
            DEFAULT CURRENT_TIMESTAMP
            ON UPDATE CURRENT_TIMESTAMP,

        PRIMARY KEY (id),

        KEY idx_${table}_created (
            created_at
        ),

        KEY idx_${table}_updated (
            updated_at
        )
    )
    ENGINE=InnoDB
    DEFAULT CHARSET=utf8mb4
    COLLATE=utf8mb4_unicode_ci
  `);

  await db.execute(
    `
      INSERT IGNORE
      INTO system_entity_registry (
        entity_name,
        entity_type
      )
      VALUES (?, 'table')
    `,
    [table]
  );

  console.log(
    `MYSQL_TABLE=${table}`
  );
}

for (const rpc of map.rpcs) {

  await db.execute(
    `
      INSERT IGNORE
      INTO system_entity_registry (
        entity_name,
        entity_type
      )
      VALUES (?, 'rpc')
    `,
    [rpc]
  );
}

for (const fn of map.functions) {

  await db.execute(
    `
      INSERT IGNORE
      INTO system_entity_registry (
        entity_name,
        entity_type
      )
      VALUES (?, 'function')
    `,
    [fn]
  );
}

/*
 * Move registros que eventualmente já tenham sido
 * gravados pela camada anterior app_records.
 *
 * app_records NÃO é mais utilizado pela nova API.
 */
const [appRecordsExists] = await db.query(`
  SELECT COUNT(*) AS total
  FROM information_schema.tables
  WHERE table_schema = DATABASE()
    AND table_name = 'app_records'
`);

if (
  Number(
    appRecordsExists[0]?.total || 0
  ) > 0
) {

  const [records] =
    await db.query(`
      SELECT
        table_name,
        record_id,
        data
      FROM app_records
    `);

  for (const row of records) {

    const table =
      String(row.table_name);

    if (
      !map.tables.includes(table) ||
      !validTable(table)
    ) {
      continue;
    }

    let data = row.data;

    if (
      typeof data !== "string"
    ) {
      data =
        JSON.stringify(data);
    }

    await db.execute(
      `
        INSERT INTO \`${table}\`
          (id, data)
        VALUES (?, ?)

        ON DUPLICATE KEY UPDATE
          data = VALUES(data),
          updated_at = CURRENT_TIMESTAMP
      `,
      [
        String(row.record_id),
        data
      ]
    );
  }
}

console.log(
  "MYSQL_ENTITY_STRUCTURE=OK"
);

await db.end();

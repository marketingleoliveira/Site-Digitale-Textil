import fs from "fs";
import mysql from "mysql2/promise";

import { config } from "../src/config.js";

const schema = JSON.parse(
  fs.readFileSync(
    "/tmp/digitale-native-schema.json",
    "utf8"
  )
);

const db =
  await mysql.createConnection({
    host: config.db.host,
    port: config.db.port,
    user: config.db.user,
    password: config.db.password,
    database: config.db.name,
    charset: "utf8mb4"
  });

function identifier(value) {

  const name =
    String(value || "");

  if (
    !/^[A-Za-z_][A-Za-z0-9_]{0,63}$/
      .test(name)
  ) {
    throw new Error(
      `Identificador invalido: ${name}`
    );
  }

  return `\`${name}\``;
}

async function getColumns(table) {

  const [rows] =
    await db.execute(
      `
        SELECT
          COLUMN_NAME AS name,
          DATA_TYPE AS type
        FROM information_schema.columns
        WHERE table_schema = DATABASE()
          AND table_name = ?
      `,
      [table]
    );

  return new Map(
    rows.map(
      row => [
        row.name,
        row.type
      ]
    )
  );
}

function normalizeValue(
  value,
  mysqlType
) {

  if (
    value === undefined
    || value === null
  ) {
    return null;
  }

  if (
    mysqlType === "json"
  ) {
    return JSON.stringify(value);
  }

  if (
    mysqlType === "tinyint"
  ) {
    return value ? 1 : 0;
  }

  if (
    [
      "double",
      "float",
      "decimal",
      "int",
      "bigint",
      "smallint"
    ].includes(mysqlType)
  ) {
    const n =
      Number(value);

    return Number.isFinite(n)
      ? n
      : null;
  }

  if (
    [
      "timestamp",
      "datetime"
    ].includes(mysqlType)
    && typeof value === "string"
  ) {

    return value
      .replace("T", " ")
      .replace(
        /\.\d{3}Z$/,
        ""
      )
      .replace(
        /Z$/,
        ""
      );
  }

  if (
    typeof value === "object"
  ) {
    return JSON.stringify(value);
  }

  return String(value);
}


for (
  const [table, fields]
  of Object.entries(schema)
) {

  identifier(table);

  const [exists] =
    await db.execute(
      `
        SELECT COUNT(*) AS total
        FROM information_schema.tables
        WHERE table_schema = DATABASE()
          AND table_name = ?
      `,
      [table]
    );

  if (
    Number(
      exists[0]?.total || 0
    ) === 0
  ) {

    const idType =
      fields.id?.mysql === "BIGINT"
        ? "BIGINT"
        : "VARCHAR(191)";

    await db.query(
      `
        CREATE TABLE ${identifier(table)} (
          id ${idType} NOT NULL,
          data JSON NULL,

          created_at TIMESTAMP
            NOT NULL
            DEFAULT CURRENT_TIMESTAMP,

          updated_at TIMESTAMP
            NOT NULL
            DEFAULT CURRENT_TIMESTAMP
            ON UPDATE CURRENT_TIMESTAMP,

          PRIMARY KEY (id)
        )
        ENGINE=InnoDB
        DEFAULT CHARSET=utf8mb4
        COLLATE=utf8mb4_unicode_ci
      `
    );
  }

  let existing =
    await getColumns(table);

  for (
    const [column, definition]
    of Object.entries(fields)
  ) {

    identifier(column);

    if (
      existing.has(column)
    ) {
      continue;
    }

    await db.query(
      `
        ALTER TABLE ${identifier(table)}
        ADD COLUMN ${identifier(column)}
        ${definition.mysql} NULL
      `
    );

    console.log(
      `CAMPO_CRIADO=${table}.${column}`
    );
  }

  existing =
    await getColumns(table);

  /*
   * Materializa registros que tenham sido
   * gravados anteriormente no JSON.
   */
  if (
    existing.has("data")
  ) {

    const [rows] =
      await db.query(
        `
          SELECT
            id,
            data
          FROM ${identifier(table)}
          WHERE data IS NOT NULL
        `
      );

    for (const row of rows) {

      let payload =
        row.data;

      if (
        typeof payload === "string"
      ) {
        try {
          payload =
            JSON.parse(payload);
        } catch {
          payload = {};
        }
      }

      if (
        !payload
        || typeof payload !== "object"
      ) {
        continue;
      }

      const sets = [];
      const values = [];

      for (
        const [column, value]
        of Object.entries(payload)
      ) {

        if (
          column === "id"
          || column === "data"
          || !existing.has(column)
        ) {
          continue;
        }

        const mysqlType =
          existing.get(column);

        sets.push(
          `${identifier(column)} = ?`
        );

        values.push(
          normalizeValue(
            value,
            mysqlType
          )
        );
      }

      if (!sets.length)
        continue;

      values.push(
        String(row.id)
      );

      await db.execute(
        `
          UPDATE ${identifier(table)}
          SET ${sets.join(", ")}
          WHERE id = ?
        `,
        values
      );
    }
  }

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
    `MYSQL_SCHEMA=${table}`
  );
}

await db.end();

console.log(
  "NATIVE_SCHEMA=OK"
);

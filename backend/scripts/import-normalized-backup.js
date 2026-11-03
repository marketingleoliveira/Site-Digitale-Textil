import fs from "fs";
import path from "path";
import crypto from "crypto";

import { db } from "../src/database.js";

const DIR =
  "/tmp/digitale-backup-v2/normalized";

const protectedTables =
  new Set([
    "system_users",
    "system_permissions",
    "system_entity_registry",
    "system_files",
    "system_settings",
    "storage_buckets"
  ]);

function q(name) {

  if (
    !/^[A-Za-z_][A-Za-z0-9_]{0,63}$/
      .test(name)
  ) {
    throw new Error(
      "Identificador invalido: " +
      name
    );
  }

  return "`" + name + "`";
}

function supabaseToLocal(value) {

  if (
    Array.isArray(value)
  ) {
    return value.map(
      supabaseToLocal
    );
  }

  if (
    value &&
    typeof value === "object"
  ) {
    const output = {};

    for (
      const [key, item]
      of Object.entries(value)
    ) {
      output[key] =
        supabaseToLocal(item);
    }

    return output;
  }

  if (
    typeof value !== "string"
  ) {
    return value;
  }

  return value.replace(
    /https?:\/\/[^/]+\/storage\/v1\/object\/public\/([^/?#]+)\/([^?#]+)/gi,
    "/uploads/$1/$2"
  );
}

function valueFor(
  value,
  type
) {

  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return (
      value === ""
      ? ""
      : null
    );
  }

  type =
    String(type || "")
    .toLowerCase();

  if (
    type === "json"
  ) {
    if (
      typeof value === "string"
    ) {
      try {
        JSON.parse(value);
        return value;
      } catch {
        return JSON.stringify(
          value
        );
      }
    }

    return JSON.stringify(
      value
    );
  }

  if (
    type === "tinyint"
  ) {

    if (
      value === true ||
      value === "true"
    ) return 1;

    if (
      value === false ||
      value === "false"
    ) return 0;
  }

  if (
    [
      "int",
      "bigint",
      "smallint",
      "mediumint",
      "double",
      "float",
      "decimal"
    ].includes(type)
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
    ].includes(type) &&
    typeof value === "string"
  ) {

    const match =
      value.match(
        /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}:\d{2})/
      );

    if (match) {
      return (
        match[1] +
        " " +
        match[2]
      );
    }
  }

  if (
    typeof value === "object"
  ) {
    return JSON.stringify(
      value
    );
  }

  return value;
}

const [mysqlTables] =
  await db.query(`
    SELECT TABLE_NAME AS name
    FROM information_schema.tables
    WHERE table_schema = DATABASE()
  `);

const existingTables =
  new Set(
    mysqlTables.map(
      row => row.name
    )
  );

const files =
  fs.readdirSync(DIR)
  .filter(
    file =>
      file.endsWith(
        ".json"
      )
  );

let imported = 0;
let errors = 0;

for (const file of files) {

  const table =
    path.basename(
      file,
      ".json"
    );

  if (
    !existingTables.has(
      table
    ) ||
    protectedTables.has(
      table
    )
  ) {
    continue;
  }

  const [columnRows] =
    await db.execute(
      `
        SELECT
          COLUMN_NAME AS name,
          DATA_TYPE AS type,
          IS_NULLABLE AS nullable,
          COLUMN_DEFAULT AS default_value,
          EXTRA AS extra_value
        FROM information_schema.columns
        WHERE table_schema = DATABASE()
          AND table_name = ?
        ORDER BY ORDINAL_POSITION
      `,
      [table]
    );

  const schema =
    new Map(
      columnRows.map(
        row => [
          row.name,
          row
        ]
      )
    );

  /*
   * O JSON legado jamais deve
   * bloquear registros nativos.
   */
  const dataColumn =
    schema.get("data");

  if (
    dataColumn &&
    dataColumn.nullable === "NO"
  ) {

    await db.query(
      `
        ALTER TABLE ${q(table)}
        MODIFY COLUMN data JSON NULL
      `
    );

    dataColumn.nullable =
      "YES";
  }

  const rows =
    JSON.parse(
      fs.readFileSync(
        path.join(
          DIR,
          file
        ),
        "utf8"
      )
    );

  let tableImported = 0;

  for (
    const original
    of rows
  ) {

    const record =
      supabaseToLocal({
        ...original
      });

    const idSchema =
      schema.get("id");

    if (
      idSchema &&
      !record.id &&
      !String(
        idSchema.extra_value ||
        ""
      ).includes(
        "auto_increment"
      ) &&
      ![
        "int",
        "bigint",
        "smallint",
        "mediumint"
      ].includes(
        String(
          idSchema.type
        ).toLowerCase()
      )
    ) {
      record.id =
        crypto.randomUUID();
    }

    const fields = [];
    const placeholders = [];
    const params = [];

    for (
      const [key, value]
      of Object.entries(
        record
      )
    ) {

      if (
        key === "data" ||
        !schema.has(key)
      ) {
        continue;
      }

      fields.push(
        q(key)
      );

      placeholders.push(
        "?"
      );

      params.push(
        valueFor(
          value,
          schema.get(key).type
        )
      );
    }

    if (
      schema.has("data")
    ) {
      fields.push(
        "`data`"
      );

      placeholders.push(
        "?"
      );

      params.push(
        JSON.stringify(
          record
        )
      );
    }

    if (!fields.length) {
      continue;
    }

    const updates =
      fields
      .filter(
        field =>
          field !== "`id`"
      )
      .map(
        field =>
          `${field}=VALUES(${field})`
      );

    try {

      await db.execute(
        `
          INSERT INTO ${q(table)}
            (${fields.join(", ")})
          VALUES
            (${placeholders.join(", ")})

          ON DUPLICATE KEY UPDATE
            ${
              updates.length
              ? updates.join(", ")
              : "`id`=`id`"
            }
        `,
        params
      );

      tableImported++;
      imported++;

    } catch (error) {

      errors++;

      console.log(
        `REGISTRO_ERRO=${table}:${error.code || error.message}`
      );
    }
  }

  console.log(
    `MYSQL_IMPORT=${table}:${tableImported}/${rows.length}`
  );
}

console.log(
  "TOTAL_IMPORTADO=" +
  imported
);

console.log(
  "TOTAL_ERROS=" +
  errors
);

await db.end();

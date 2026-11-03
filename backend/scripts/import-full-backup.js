import fs from "fs";
import path from "path";
import crypto from "crypto";

import { db } from "../src/database.js";

const work =
  process.env.BACKUP_WORK;

if (!work) {
  throw new Error(
    "BACKUP_WORK nao definido"
  );
}

const protectedTables =
  new Set([
    "system_users",
    "system_permissions",
    "system_entity_registry",
    "system_files",
    "system_settings",
    "storage_buckets"
  ]);

const [tableRows] =
  await db.query(`
    SELECT TABLE_NAME AS name
    FROM information_schema.tables
    WHERE table_schema = DATABASE()
  `);

const databaseTables =
  new Set(
    tableRows.map(
      row =>
        String(row.name)
    )
  );

const tableData =
  new Map();

function addRows(
  table,
  rows
) {
  table =
    String(table || "")
      .trim();

  if (
    !databaseTables.has(table)
    || protectedTables.has(table)
    || !Array.isArray(rows)
  ) {
    return;
  }

  const valid =
    rows.filter(
      row =>
        row &&
        typeof row === "object" &&
        !Array.isArray(row)
    );

  if (!valid.length)
    return;

  if (
    !tableData.has(table)
  ) {
    tableData.set(
      table,
      []
    );
  }

  tableData.get(table)
    .push(...valid);
}

function discover(
  node,
  hint = null,
  depth = 0
) {
  if (
    depth > 12 ||
    node === null ||
    node === undefined
  ) {
    return;
  }

  if (
    Array.isArray(node)
  ) {
    if (
      hint &&
      databaseTables.has(hint)
    ) {
      addRows(
        hint,
        node
      );
    }

    for (
      const item
      of node
    ) {
      if (
        item &&
        typeof item === "object" &&
        !Array.isArray(item)
      ) {
        const table =
          item.table ??
          item.table_name ??
          item.name;

        const rows =
          item.rows ??
          (
            Array.isArray(
              item.data
            )
              ? item.data
              : null
          ) ??
          item.records;

        if (
          table &&
          Array.isArray(rows)
        ) {
          addRows(
            table,
            rows
          );
        }
      }
    }

    return;
  }

  if (
    typeof node !== "object"
  ) {
    return;
  }

  for (
    const [key, value]
    of Object.entries(node)
  ) {
    if (
      databaseTables.has(key) &&
      Array.isArray(value)
    ) {
      addRows(
        key,
        value
      );
    }

    discover(
      value,
      databaseTables.has(key)
        ? key
        : null,
      depth + 1
    );
  }
}

function filesRecursively(
  dir
) {
  const output = [];

  for (
    const entry
    of fs.readdirSync(
      dir,
      {
        withFileTypes: true
      }
    )
  ) {
    const full =
      path.join(
        dir,
        entry.name
      );

    if (
      entry.isDirectory()
    ) {
      output.push(
        ...filesRecursively(
          full
        )
      );
    } else {
      output.push(full);
    }
  }

  return output;
}

for (
  const file
  of filesRecursively(work)
) {
  if (
    !file.toLowerCase()
      .endsWith(".json")
  ) {
    continue;
  }

  try {
    const data =
      JSON.parse(
        fs.readFileSync(
          file,
          "utf8"
        )
      );

    const stem =
      path.basename(
        file,
        path.extname(file)
      );

    if (
      Array.isArray(data) &&
      databaseTables.has(stem)
    ) {
      addRows(
        stem,
        data
      );
    }

    discover(data);

  } catch (error) {
    console.log(
      `JSON_IGNORADO=${file}`
    );
  }
}

let totalRecords = 0;

for (
  const rows
  of tableData.values()
) {
  totalRecords +=
    rows.length;
}

console.log(
  "TABELAS_ENCONTRADAS=" +
  tableData.size
);

console.log(
  "REGISTROS_ENCONTRADOS=" +
  totalRecords
);

for (
  const [table, rows]
  of tableData
) {
  console.log(
    `BACKUP_TABLE=${table}:${rows.length}`
  );
}

if (
  tableData.size === 0
) {
  throw new Error(
    "Nenhuma tabela reconhecida foi encontrada no backup"
  );
}

function rewriteUrls(value) {
  if (
    Array.isArray(value)
  ) {
    return value.map(
      rewriteUrls
    );
  }

  if (
    value &&
    typeof value === "object"
  ) {
    const result = {};

    for (
      const [key, item]
      of Object.entries(value)
    ) {
      result[key] =
        rewriteUrls(item);
    }

    return result;
  }

  if (
    typeof value !== "string"
  ) {
    return value;
  }

  return value.replace(
    /https?:\/\/[^/]+\/storage\/v1\/object\/public\/([^/?#]+)\/([^?#]+)/gi,
    (
      full,
      bucket,
      objectPath
    ) => {
      return (
        "/uploads/" +
        bucket +
        "/" +
        objectPath
      );
    }
  );
}

function q(identifier) {
  if (
    !/^[A-Za-z_][A-Za-z0-9_]{0,63}$/
      .test(identifier)
  ) {
    throw new Error(
      "Identificador invalido: " +
      identifier
    );
  }

  return (
    "`" +
    identifier +
    "`"
  );
}

function normalizeValue(
  value,
  column
) {
  if (
    value === undefined ||
    value === null
  ) {
    return null;
  }

  const type =
    String(
      column.DATA_TYPE || ""
    ).toLowerCase();

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
    ) {
      return 1;
    }

    if (
      value === false ||
      value === "false"
    ) {
      return 0;
    }
  }

  if (
    [
      "int",
      "bigint",
      "smallint",
      "mediumint",
      "decimal",
      "double",
      "float"
    ].includes(type)
  ) {
    if (
      value === ""
    ) {
      return null;
    }

    const n =
      Number(value);

    if (
      Number.isFinite(n)
    ) {
      return n;
    }
  }

  if (
    [
      "datetime",
      "timestamp"
    ].includes(type)
  ) {
    if (
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
  }

  if (
    type === "date" &&
    typeof value === "string"
  ) {
    const match =
      value.match(
        /^\d{4}-\d{2}-\d{2}/
      );

    if (match) {
      return match[0];
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

async function schemaFor(
  connection,
  table
) {
  const [rows] =
    await connection.execute(
      `
        SELECT
          COLUMN_NAME,
          DATA_TYPE,
          IS_NULLABLE,
          COLUMN_DEFAULT,
          EXTRA
        FROM information_schema.columns
        WHERE table_schema = DATABASE()
          AND table_name = ?
        ORDER BY ORDINAL_POSITION
      `,
      [table]
    );

  return new Map(
    rows.map(
      row => [
        row.COLUMN_NAME,
        row
      ]
    )
  );
}

const connection =
  await db.getConnection();

let inserted = 0;

try {
  await connection
    .beginTransaction();

  await connection.query(
    "SET FOREIGN_KEY_CHECKS=0"
  );

  for (
    const [table, originalRows]
    of tableData
  ) {
    const schema =
      await schemaFor(
        connection,
        table
      );

    let tableCount = 0;

    for (
      const original
      of originalRows
    ) {
      const record =
        rewriteUrls({
          ...original
        });

      const idColumn =
        schema.get("id");

      if (
        idColumn &&
        (
          record.id === undefined ||
          record.id === null ||
          record.id === ""
        ) &&
        !String(
          idColumn.EXTRA || ""
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
            idColumn.DATA_TYPE
          ).toLowerCase()
        )
      ) {
        record.id =
          crypto.randomUUID();
      }

      const fields = [];
      const placeholders = [];
      const values = [];

      for (
        const [key, value]
        of Object.entries(record)
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

        values.push(
          normalizeValue(
            value,
            schema.get(key)
          )
        );
      }

      /*
       * Mantem copia integral do registro
       * no campo legado JSON quando existe.
       */
      if (
        schema.has("data")
      ) {
        fields.push(
          "`data`"
        );

        placeholders.push(
          "?"
        );

        values.push(
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

      const updateSql =
        updates.length
          ? updates.join(", ")
          : "`id`=`id`";

      await connection.execute(
        `
          INSERT INTO ${q(table)}
            (${fields.join(", ")})
          VALUES
            (${placeholders.join(", ")})

          ON DUPLICATE KEY UPDATE
            ${updateSql}
        `,
        values
      );

      inserted++;
      tableCount++;
    }

    console.log(
      `IMPORTADO=${table}:${tableCount}`
    );
  }

  await connection.query(
    "SET FOREIGN_KEY_CHECKS=1"
  );

  await connection.commit();

} catch (error) {

  try {
    await connection.rollback();
  } catch {}

  throw error;

} finally {

  connection.release();
}

console.log(
  "REGISTROS_IMPORTADOS=" +
  inserted
);

/*
 * Garante que o administrador local
 * criado apos a migracao continue
 * com acesso total.
 */
const [admins] =
  await db.query(`
    SELECT
      id,
      public_id,
      email,
      name
    FROM system_users
    WHERE role = 'admin'
      AND active = 1
  `);

for (
  const admin
  of admins
) {
  await db.execute(
    `
      INSERT IGNORE
      INTO system_permissions (
        user_id,
        permission
      )
      VALUES (?, '*')
    `,
    [admin.id]
  );

  if (
    databaseTables.has(
      "user_roles"
    )
  ) {
    const [role] =
      await db.execute(
        `
          SELECT id
          FROM user_roles
          WHERE user_id = ?
            AND role = 'admin'
          LIMIT 1
        `,
        [admin.public_id]
      );

    if (!role.length) {
      const [columns] =
        await db.execute(
          `
            SELECT COLUMN_NAME AS name
            FROM information_schema.columns
            WHERE table_schema = DATABASE()
              AND table_name = 'user_roles'
          `
        );

      const names =
        new Set(
          columns.map(
            c => c.name
          )
        );

      if (
        names.has("data")
      ) {
        await db.execute(
          `
            INSERT INTO user_roles (
              id,
              user_id,
              role,
              data
            )
            VALUES (?, ?, 'admin', ?)
          `,
          [
            crypto.randomUUID(),
            admin.public_id,
            JSON.stringify({
              user_id:
                admin.public_id,
              role:
                "admin"
            })
          ]
        );
      } else {
        await db.execute(
          `
            INSERT INTO user_roles (
              id,
              user_id,
              role
            )
            VALUES (?, ?, 'admin')
          `,
          [
            crypto.randomUUID(),
            admin.public_id
          ]
        );
      }
    }
  }
}

await db.end();

console.log(
  "ADMIN_LOCAL=PRESERVADO"
);

console.log(
  "MYSQL_IMPORT=OK"
);

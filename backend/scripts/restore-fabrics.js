import fs from "fs";
import path from "path";
import crypto from "crypto";

import { db } from "../src/database.js";

const DIR =
  "/tmp/digitale-restaurar-tecidos/normalized";

const ORDER = [
  "fabric_categories",
  "fabrics",
  "fabric_category_assignments",
  "segments"
];

function q(name) {

  if (
    !/^[A-Za-z_][A-Za-z0-9_]*$/
      .test(name)
  ) {
    throw new Error(
      "Identificador invalido: " +
      name
    );
  }

  return "`" + name + "`";
}


function rewriteMedia(
  value
) {

  if (
    Array.isArray(value)
  ) {

    return value.map(
      rewriteMedia
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
        rewriteMedia(item);
    }

    return output;
  }

  if (
    typeof value !== "string"
  ) {
    return value;
  }

  let result = value;

  result =
    result.replace(
      /https?:\/\/[^/]+\/storage\/v1\/object\/public\/([^/?#]+)\/([^?#]+)/gi,
      "/uploads/$1/$2"
    );

  result =
    result.replace(
      /https?:\/\/[^/]+\/storage\/v1\/object\/(?:sign|authenticated)\/([^/?#]+)\/([^?#]+)/gi,
      "/uploads/$1/$2"
    );

  return result;
}


function normalizeValue(
  value,
  type
) {

  if (
    value === undefined ||
    value === null
  ) {
    return null;
  }

  type =
    String(type || "")
      .toLowerCase();

  value =
    rewriteMedia(value);

  if (
    type === "json"
  ) {

    if (
      typeof value === "string"
    ) {

      try {

        const parsed =
          JSON.parse(value);

        return JSON.stringify(
          rewriteMedia(
            parsed
          )
        );

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
      value === "true" ||
      value === "t"
    ) {
      return 1;
    }

    if (
      value === false ||
      value === "false" ||
      value === "f"
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
      "float",
      "double",
      "decimal"
    ].includes(type)
  ) {

    if (value === "")
      return null;

    const number =
      Number(value);

    return Number.isFinite(
      number
    )
      ? number
      : null;
  }

  if (
    [
      "datetime",
      "timestamp"
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


async function getSchema(
  table
) {

  const [rows] =
    await db.execute(
      `
        SELECT
          COLUMN_NAME AS name,
          DATA_TYPE AS type,
          IS_NULLABLE AS nullable,
          COLUMN_DEFAULT AS default_value,
          EXTRA AS extra_value

        FROM information_schema.columns

        WHERE table_schema =
          DATABASE()

          AND table_name = ?

        ORDER BY
          ORDINAL_POSITION
      `,
      [table]
    );

  return new Map(
    rows.map(
      row => [
        row.name,
        row
      ]
    )
  );
}


async function makeDataNullable(
  table,
  schema
) {

  const column =
    schema.get("data");

  if (
    column &&
    column.nullable === "NO"
  ) {

    await db.query(
      `
        ALTER TABLE ${q(table)}
        MODIFY COLUMN data JSON NULL
      `
    );

    column.nullable =
      "YES";

    console.log(
      "DATA_NULLABLE=" +
      table
    );
  }
}


async function upsertTable(
  table,
  rows
) {

  const schema =
    await getSchema(
      table
    );

  if (!schema.size) {

    console.log(
      "TABELA_NAO_EXISTE=" +
      table
    );

    return 0;
  }

  await makeDataNullable(
    table,
    schema
  );

  let imported = 0;

  for (
    const original
    of rows
  ) {

    const record =
      rewriteMedia({
        ...original
      });

    const idColumn =
      schema.get("id");

    if (
      idColumn &&
      (
        record.id === null ||
        record.id === undefined ||
        record.id === ""
      ) &&
      !String(
        idColumn.extra_value || ""
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
          idColumn.type
        ).toLowerCase()
      )
    ) {

      record.id =
        crypto.randomUUID();
    }

    const fields = [];
    const values = [];
    const placeholders = [];

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

      values.push(
        normalizeValue(
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

      values.push(
        JSON.stringify(
          record
        )
      );
    }

    if (!fields.length)
      continue;

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
          (
            ${fields.join(", ")}
          )
          VALUES
          (
            ${placeholders.join(", ")}
          )

          ON DUPLICATE KEY UPDATE
          ${
            updates.length
              ? updates.join(", ")
              : "`id`=`id`"
          }
        `,
        values
      );

      imported++;

    } catch (error) {

      console.log(
        `ERRO_REGISTRO=${table}:${error.code || error.message}`
      );
    }
  }

  console.log(
    `IMPORTADO_${table}=${imported}/${rows.length}`
  );

  return imported;
}


for (
  const table
  of ORDER
) {

  const file =
    path.join(
      DIR,
      table + ".json"
    );

  if (
    !fs.existsSync(file)
  ) {

    console.log(
      "SEM_BACKUP=" +
      table
    );

    continue;
  }

  const rows =
    JSON.parse(
      fs.readFileSync(
        file,
        "utf8"
      )
    );

  if (
    table ===
    "fabric_category_assignments"
  ) {

    const schema =
      await getSchema(
        table
      );

    await makeDataNullable(
      table,
      schema
    );

    let imported = 0;

    for (const row of rows) {

      if (
        !row.fabric_id ||
        !row.category_id
      ) {
        continue;
      }

      const [existing] =
        await db.execute(
          `
            SELECT
              fabric_id

            FROM fabric_category_assignments

            WHERE fabric_id = ?
              AND category_id = ?

            LIMIT 1
          `,
          [
            row.fabric_id,
            row.category_id
          ]
        );

      if (
        existing.length
      ) {
        continue;
      }

      const fields = [
        "`fabric_id`",
        "`category_id`"
      ];

      const placeholders = [
        "?",
        "?"
      ];

      const values = [
        row.fabric_id,
        row.category_id
      ];

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
            row
          )
        );
      }

      await db.execute(
        `
          INSERT INTO
            fabric_category_assignments
          (
            ${fields.join(", ")}
          )
          VALUES
          (
            ${placeholders.join(", ")}
          )
        `,
        values
      );

      imported++;
    }

    console.log(
      "IMPORTADO_fabric_category_assignments=" +
      imported
    );

    continue;
  }

  await upsertTable(
    table,
    rows
  );
}


/*
 * Se o backup nao tiver a tabela de relacionamento,
 * utiliza fabrics.category_id quando disponivel.
 */

const fabricSchema =
  await getSchema(
    "fabrics"
  );

if (
  fabricSchema.has(
    "category_id"
  )
) {

  const [fabrics] =
    await db.query(
      `
        SELECT
          id,
          category_id

        FROM fabrics

        WHERE category_id IS NOT NULL
      `
    );

  let generated = 0;

  for (
    const fabric
    of fabrics
  ) {

    const [existing] =
      await db.execute(
        `
          SELECT
            fabric_id

          FROM fabric_category_assignments

          WHERE fabric_id = ?
            AND category_id = ?

          LIMIT 1
        `,
        [
          fabric.id,
          fabric.category_id
        ]
      );

    if (
      existing.length
    ) {
      continue;
    }

    const relationSchema =
      await getSchema(
        "fabric_category_assignments"
      );

    const fields = [
      "`fabric_id`",
      "`category_id`"
    ];

    const placeholders = [
      "?",
      "?"
    ];

    const values = [
      fabric.id,
      fabric.category_id
    ];

    if (
      relationSchema.has(
        "data"
      )
    ) {

      fields.push(
        "`data`"
      );

      placeholders.push(
        "?"
      );

      values.push(
        JSON.stringify({
          fabric_id:
            fabric.id,

          category_id:
            fabric.category_id
        })
      );
    }

    await db.execute(
      `
        INSERT INTO
          fabric_category_assignments
        (
          ${fields.join(", ")}
        )
        VALUES
        (
          ${placeholders.join(", ")}
        )
      `,
      values
    );

    generated++;
  }

  console.log(
    "RELACOES_GERADAS=" +
    generated
  );
}


/*
 * RESUMO
 */

const [[fabricCount]] =
  await db.query(
    `
      SELECT
        COUNT(*) AS total
      FROM fabrics
    `
  );

const [[activeCount]] =
  await db.query(
    `
      SELECT
        COUNT(*) AS total
      FROM fabrics
      WHERE
        is_active = 1
        OR is_active IS NULL
    `
  );

const [[categoryCount]] =
  await db.query(
    `
      SELECT
        COUNT(*) AS total
      FROM fabric_categories
    `
  );

const [[assignmentCount]] =
  await db.query(
    `
      SELECT
        COUNT(*) AS total
      FROM fabric_category_assignments
    `
  );

console.log("");
console.log(
  "TOTAL_TECIDOS=" +
  fabricCount.total
);

console.log(
  "TECIDOS_ATIVOS=" +
  activeCount.total
);

console.log(
  "TOTAL_CATEGORIAS=" +
  categoryCount.total
);

console.log(
  "TOTAL_VINCULOS=" +
  assignmentCount.total
);


/*
 * Segmentos Fitness / Praia.
 */

const [segments] =
  await db.query(
    `
      SELECT
        id,
        name,
        slug,
        fabrics

      FROM segments

      ORDER BY display_order, name
    `
  );

for (
  const segment
  of segments
) {

  let count = 0;

  if (
    segment.fabrics
  ) {

    let value =
      segment.fabrics;

    if (
      typeof value ===
      "string"
    ) {

      try {
        value =
          JSON.parse(value);
      } catch {}
    }

    if (
      Array.isArray(value)
    ) {

      count =
        value.length;
    }
  }

  console.log(
    `SEGMENTO=${segment.name}:TECIDOS=${count}`
  );
}

await db.end();

console.log("");
console.log(
  "RESTAURACAO_TECIDOS=OK"
);

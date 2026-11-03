import fs from "fs";
import path from "path";
import mysql from "mysql2/promise";

const recovery =
  process.argv[2];

if (!recovery) {
  throw new Error(
    "Diretorio de recuperacao ausente"
  );
}

const localized =
  path.join(
    recovery,
    "localized"
  );

const connection =
  await mysql.createConnection({
    host:
      process.env.DB_HOST,
    port:
      Number(
        process.env.DB_PORT || 3306
      ),
    user:
      process.env.DB_USER,
    password:
      process.env.DB_PASSWORD,
    database:
      process.env.DB_NAME,
    charset:
      "utf8mb4",
  });


const configs = {
  carousel_slides: {
    keys: ["id"],
    deactivate: true,
  },

  fabrics: {
    keys: [
      "id",
      "slug",
      "name",
    ],
    deactivate: true,
  },

  technologies: {
    keys: [
      "id",
      "slug",
      "name",
    ],
    deactivate: true,
  },

  testimonials: {
    keys: [
      "id",
      "name",
    ],
    deactivate: true,
  },

  prints: {
    keys: [
      "id",
      "code",
    ],
    deactivate: true,
  },

  blog_posts: {
    keys: [
      "id",
      "slug",
    ],
    deactivate: false,
  },
};


function normalizeDate(
  value,
  type
) {

  if (
    value === null
    ||
    value === undefined
  ) {
    return null;
  }

  if (
    type === "date"
    &&
    typeof value === "string"
  ) {
    return value.slice(
      0,
      10
    );
  }

  if (
    [
      "datetime",
      "timestamp"
    ].includes(type)
    &&
    typeof value === "string"
    &&
    value.includes("T")
  ) {

    const date =
      new Date(value);

    if (
      !Number.isNaN(
        date.getTime()
      )
    ) {

      return date
        .toISOString()
        .replace("T", " ")
        .replace("Z", "")
        .slice(0, 23);
    }
  }

  return value;
}


function normalizeValue(
  value,
  column
) {

  if (
    value === null
    ||
    value === undefined
  ) {
    return null;
  }

  if (
    typeof value ===
      "boolean"
  ) {
    return value ? 1 : 0;
  }

  if (
    typeof value ===
      "object"
  ) {
    return JSON.stringify(
      value
    );
  }

  return normalizeDate(
    value,
    column.data_type
  );
}


async function getColumns(
  table
) {

  const [rows] =
    await connection.execute(
      `
        SELECT
          COLUMN_NAME AS column_name,
          DATA_TYPE AS data_type

        FROM information_schema.COLUMNS

        WHERE
          TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = ?

        ORDER BY ORDINAL_POSITION
      `,
      [
        table
      ]
    );

  return new Map(
    rows.map(
      row => [
        row.column_name,
        row
      ]
    )
  );
}


async function findExisting(
  table,
  row,
  keys,
  columns
) {

  for (
    const key
    of keys
  ) {

    if (
      !columns.has(key)
      ||
      row[key] === null
      ||
      row[key] === undefined
      ||
      row[key] === ""
    ) {
      continue;
    }

    const [found] =
      await connection.execute(
        `
          SELECT *
          FROM \`${table}\`
          WHERE \`${key}\` = ?
          LIMIT 1
        `,
        [
          row[key]
        ]
      );

    if (
      found.length
    ) {
      return found[0];
    }
  }

  return null;
}


async function syncTable(
  table,
  config
) {

  const file =
    path.join(
      localized,
      `${table}.json`
    );

  if (
    !fs.existsSync(file)
  ) {

    console.log(
      `${table}=SEM_ARQUIVO`
    );

    return;
  }

  const rows =
    JSON.parse(
      fs.readFileSync(
        file,
        "utf8"
      )
    );

  if (
    !Array.isArray(rows)
  ) {
    throw new Error(
      `${table}: formato inválido`
    );
  }

  const columns =
    await getColumns(
      table
    );

  if (
    columns.size === 0
  ) {

    console.log(
      `${table}=TABELA_NAO_EXISTE`
    );

    return;
  }


  /*
   * Registros que não existem mais
   * na fonte original deixam de
   * aparecer no site, mas não são
   * apagados fisicamente.
   */
  if (
    config.deactivate
    &&
    columns.has(
      "is_active"
    )
  ) {

    await connection.execute(
      `
        UPDATE \`${table}\`
        SET is_active = 0
      `
    );
  }


  let updated = 0;
  let inserted = 0;


  for (
    const sourceRow
    of rows
  ) {

    const existing =
      await findExisting(
        table,
        sourceRow,
        config.keys,
        columns
      );


    const allowed =
      Object.keys(
        sourceRow
      )
      .filter(
        key =>
          columns.has(key)
      );


    if (
      existing
    ) {

      const idColumn =
        columns.has("id")
          ? "id"
          : null;

      const updateColumns =
        allowed.filter(
          key =>
            key !== idColumn
        );

      if (
        updateColumns.length
      ) {

        const setters =
          updateColumns
            .map(
              key =>
                `\`${key}\` = ?`
            )
            .join(", ");

        const values =
          updateColumns.map(
            key =>
              normalizeValue(
                sourceRow[key],
                columns.get(key)
              )
          );

        let whereColumn = null;
        let whereValue = null;


        if (
          idColumn
          &&
          existing.id !==
            undefined
        ) {

          whereColumn =
            "id";

          whereValue =
            existing.id;

        } else {

          for (
            const key
            of config.keys
          ) {

            if (
              existing[key] !==
                undefined
            ) {

              whereColumn =
                key;

              whereValue =
                existing[key];

              break;
            }
          }
        }


        await connection.execute(
          `
            UPDATE \`${table}\`
            SET ${setters}
            WHERE \`${whereColumn}\` = ?
          `,
          [
            ...values,
            whereValue
          ]
        );
      }

      updated++;

    } else {

      const insertColumns =
        allowed;

      const names =
        insertColumns
          .map(
            key =>
              `\`${key}\``
          )
          .join(", ");

      const placeholders =
        insertColumns
          .map(
            () => "?"
          )
          .join(", ");

      const values =
        insertColumns.map(
          key =>
            normalizeValue(
              sourceRow[key],
              columns.get(key)
            )
        );


      await connection.execute(
        `
          INSERT INTO \`${table}\`
          (${names})
          VALUES (${placeholders})
        `,
        values
      );

      inserted++;
    }
  }


  console.log(
    `${table}=`
    +
    `${rows.length}`
    +
    ` | ATUALIZADOS=${updated}`
    +
    ` | INSERIDOS=${inserted}`
  );
}


try {

  await connection.beginTransaction();


  for (
    const [
      table,
      config
    ]
    of Object.entries(
      configs
    )
  ) {

    await syncTable(
      table,
      config
    );
  }


  await connection.commit();

  console.log(
    "MYSQL_VISUAL=ATUALIZADO"
  );

} catch (error) {

  await connection.rollback();

  console.error(
    "MYSQL_VISUAL=ROLLBACK"
  );

  throw error;

} finally {

  await connection.end();
}

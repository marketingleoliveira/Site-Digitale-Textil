import { db } from "../src/database.js";

const [columns] = await db.query(`
  SELECT
    COLUMN_NAME AS name,
    IS_NULLABLE AS nullable,
    DATA_TYPE AS type
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'site_settings'
`);

const schema = new Map(
  columns.map(row => [
    row.name,
    row
  ])
);

if (!schema.has("key")) {
  throw new Error(
    "site_settings.key nao existe"
  );
}

if (!schema.has("value")) {
  throw new Error(
    "site_settings.value nao existe"
  );
}

/*
 * Campo legado da primeira conversao.
 * Nao deve impedir gravacoes nativas.
 */
if (
  schema.has("data") &&
  schema.get("data").nullable === "NO"
) {
  await db.query(`
    ALTER TABLE site_settings
    MODIFY COLUMN data JSON NULL
  `);

  console.log(
    "DATA_LEGADO=NULLABLE"
  );
}

/*
 * Remove duplicidades pela key antes
 * de criar indice unico.
 */
const [duplicates] = await db.query(`
  SELECT
    \`key\`,
    COUNT(*) AS total
  FROM site_settings
  WHERE \`key\` IS NOT NULL
  GROUP BY \`key\`
  HAVING COUNT(*) > 1
`);

for (const duplicate of duplicates) {
  const [rows] = await db.execute(
    `
      SELECT id
      FROM site_settings
      WHERE \`key\` = ?
      ORDER BY updated_at DESC, created_at DESC
    `,
    [duplicate.key]
  );

  const keep =
    rows.shift();

  for (const row of rows) {
    await db.execute(
      `
        DELETE FROM site_settings
        WHERE id = ?
      `,
      [row.id]
    );
  }

  console.log(
    `DUPLICIDADE_REMOVIDA=${duplicate.key}`
  );
}

const [indexes] = await db.query(`
  SELECT INDEX_NAME AS name
  FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'site_settings'
    AND COLUMN_NAME = 'key'
`);

if (
  !indexes.some(
    row =>
      row.name ===
      "uq_site_settings_key"
  )
) {
  await db.query(`
    ALTER TABLE site_settings
    ADD UNIQUE KEY uq_site_settings_key (\`key\`)
  `);

  console.log(
    "UNIQUE_KEY=OK"
  );
}

console.log(
  "SITE_SETTINGS_SCHEMA=OK"
);

await db.end();

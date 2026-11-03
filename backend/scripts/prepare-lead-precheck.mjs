import {
  db
} from "../src/database.js";

const additions = [
  [
    "lead_quality",
    "VARCHAR(32) NULL"
  ],
  [
    "lead_fake_score",
    "INT NOT NULL DEFAULT 0"
  ],
  [
    "lead_fake_reasons",
    "TEXT NULL"
  ],
  [
    "lead_precheck_at",
    "DATETIME(6) NULL"
  ]
];

const [columns] =
  await db.execute(`
    SELECT COLUMN_NAME
    FROM information_schema.COLUMNS
    WHERE
      TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'tracking_visitors'
  `);

const current =
  new Set(
    columns.map(
      row => row.COLUMN_NAME
    )
  );

for (
  const [
    column,
    definition
  ] of additions
) {

  if (
    !current.has(
      column
    )
  ) {

    await db.execute(
      `
        ALTER TABLE tracking_visitors
        ADD COLUMN \`${column}\`
        ${definition}
      `
    );

    console.log(
      `COLUNA_ADICIONADA=${column}`
    );
  }
}

console.log(
  "BANCO_PRECHECK=OK"
);

process.exit(0);

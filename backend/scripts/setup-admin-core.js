import fs from "fs";
import crypto from "crypto";
import mysql from "mysql2/promise";

import { config } from "../src/config.js";

const db =
  await mysql.createConnection({
    host: config.db.host,
    port: config.db.port,
    user: config.db.user,
    password: config.db.password,
    database: config.db.name,
    charset: "utf8mb4"
  });

function q(name) {
  if (
    !/^[A-Za-z_][A-Za-z0-9_]{0,63}$/
      .test(name)
  ) {
    throw new Error(
      "invalid_identifier"
    );
  }

  return `\`${name}\``;
}

async function tableExists(table) {

  const [rows] =
    await db.execute(
      `
        SELECT COUNT(*) AS total
        FROM information_schema.tables
        WHERE table_schema = DATABASE()
          AND table_name = ?
      `,
      [table]
    );

  return Number(
    rows[0]?.total || 0
  ) > 0;
}

async function columnExists(
  table,
  column
) {

  const [rows] =
    await db.execute(
      `
        SELECT COUNT(*) AS total
        FROM information_schema.columns
        WHERE table_schema = DATABASE()
          AND table_name = ?
          AND column_name = ?
      `,
      [
        table,
        column
      ]
    );

  return Number(
    rows[0]?.total || 0
  ) > 0;
}

async function ensureColumn(
  table,
  column,
  definition
) {

  if (
    !await columnExists(
      table,
      column
    )
  ) {

    await db.query(
      `
        ALTER TABLE ${q(table)}
        ADD COLUMN ${q(column)}
        ${definition}
      `
    );

    console.log(
      `COLUNA=${table}.${column}`
    );
  }
}

/* =========================
   PROFILES
   ========================= */

if (
  !await tableExists(
    "profiles"
  )
) {

  await db.query(`
    CREATE TABLE profiles (
      id VARCHAR(191) NOT NULL,
      email VARCHAR(320) NULL,
      name VARCHAR(255) NULL,
      full_name VARCHAR(255) NULL,
      avatar_url TEXT NULL,
      role VARCHAR(100) NULL,
      active TINYINT(1)
        NOT NULL DEFAULT 1,
      data JSON NULL,

      created_at TIMESTAMP
        NOT NULL DEFAULT CURRENT_TIMESTAMP,

      updated_at TIMESTAMP
        NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

      PRIMARY KEY (id)
    )
    ENGINE=InnoDB
    DEFAULT CHARSET=utf8mb4
    COLLATE=utf8mb4_unicode_ci
  `);
}

await ensureColumn(
  "profiles",
  "email",
  "VARCHAR(320) NULL"
);

await ensureColumn(
  "profiles",
  "name",
  "VARCHAR(255) NULL"
);

await ensureColumn(
  "profiles",
  "full_name",
  "VARCHAR(255) NULL"
);

await ensureColumn(
  "profiles",
  "avatar_url",
  "TEXT NULL"
);

await ensureColumn(
  "profiles",
  "role",
  "VARCHAR(100) NULL"
);

await ensureColumn(
  "profiles",
  "active",
  "TINYINT(1) NOT NULL DEFAULT 1"
);

await ensureColumn(
  "profiles",
  "data",
  "JSON NULL"
);

/* =========================
   USER ROLES
   ========================= */

if (
  !await tableExists(
    "user_roles"
  )
) {

  await db.query(`
    CREATE TABLE user_roles (
      id VARCHAR(191) NOT NULL,
      user_id VARCHAR(191) NOT NULL,
      role VARCHAR(100) NOT NULL,

      created_at TIMESTAMP
        NOT NULL DEFAULT CURRENT_TIMESTAMP,

      PRIMARY KEY (id),

      KEY idx_user_roles_user (
        user_id
      )
    )
    ENGINE=InnoDB
    DEFAULT CHARSET=utf8mb4
    COLLATE=utf8mb4_unicode_ci
  `);
}

await ensureColumn(
  "user_roles",
  "user_id",
  "VARCHAR(191) NULL"
);

await ensureColumn(
  "user_roles",
  "role",
  "VARCHAR(100) NULL"
);

/* =========================
   STORAGE BUCKETS
   ========================= */

await db.query(`
  CREATE TABLE IF NOT EXISTS storage_buckets (
    id BIGINT UNSIGNED
      NOT NULL AUTO_INCREMENT,

    name VARCHAR(191)
      NOT NULL,

    public_access TINYINT(1)
      NOT NULL DEFAULT 1,

    created_at TIMESTAMP
      NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    UNIQUE KEY uq_storage_bucket_name (
      name
    )
  )
  ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci
`);

/* =========================
   REGISTRO DAS ENTIDADES
   ========================= */

for (
  const table of [
    "profiles",
    "user_roles",
    "storage_buckets"
  ]
) {

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
}

/* =========================
   ADMINISTRADORES
   ========================= */

const [admins] =
  await db.query(`
    SELECT
      id,
      public_id,
      email,
      name,
      role,
      active
    FROM system_users
    WHERE role = 'admin'
      AND active = 1
  `);

for (const admin of admins) {

  const profileData = {
    id:
      admin.public_id,

    user_id:
      admin.public_id,

    email:
      admin.email,

    name:
      admin.name,

    full_name:
      admin.name,

    role:
      "admin",

    active:
      true
  };

  await db.execute(
    `
      INSERT INTO profiles (
        id,
        email,
        name,
        full_name,
        role,
        active,
        data
      )
      VALUES (?, ?, ?, ?, 'admin', 1, ?)

      ON DUPLICATE KEY UPDATE
        email =
          VALUES(email),

        name =
          VALUES(name),

        full_name =
          VALUES(full_name),

        role =
          'admin',

        active =
          1,

        data =
          VALUES(data),

        updated_at =
          CURRENT_TIMESTAMP
    `,
    [
      admin.public_id,
      admin.email,
      admin.name,
      admin.name,
      JSON.stringify(
        profileData
      )
    ]
  );

  const [existingRoles] =
    await db.execute(
      `
        SELECT id
        FROM user_roles
        WHERE user_id = ?
          AND role = 'admin'
        LIMIT 1
      `,
      [
        admin.public_id
      ]
    );

  if (
    !existingRoles.length
  ) {

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

  console.log(
    "ADMIN_MYSQL=" +
    admin.email
  );
}

/* =========================
   BUCKETS
   ========================= */

const bucketFile =
  "/tmp/digitale-buckets.txt";

let buckets = [
  "public"
];

if (
  fs.existsSync(
    bucketFile
  )
) {

  buckets =
    fs.readFileSync(
      bucketFile,
      "utf8"
    )
    .split(/\r?\n/)
    .map(
      value =>
        value.trim()
    )
    .filter(Boolean);
}

for (
  const bucket
  of buckets
) {

  await db.execute(
    `
      INSERT IGNORE
      INTO storage_buckets (
        name,
        public_access
      )
      VALUES (?, 1)
    `,
    [bucket]
  );

  console.log(
    "STORAGE_BUCKET=" +
    bucket
  );
}

await db.end();

console.log(
  "ADMIN_CORE_MYSQL=OK"
);

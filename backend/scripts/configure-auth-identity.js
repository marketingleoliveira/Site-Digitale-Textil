import crypto from "crypto";
import mysql from "mysql2/promise";
import { config } from "../src/config.js";

const db = await mysql.createConnection({
  host: config.db.host,
  port: config.db.port,
  user: config.db.user,
  password: config.db.password,
  database: config.db.name,
  charset: "utf8mb4"
});

const [publicIdColumn] = await db.query(`
  SELECT COUNT(*) AS total
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'system_users'
    AND column_name = 'public_id'
`);

if (!Number(publicIdColumn[0].total)) {
  await db.query(`
    ALTER TABLE system_users
    ADD COLUMN public_id VARCHAR(191) NULL AFTER id
  `);
}

const [uniqueIndex] = await db.query(`
  SELECT COUNT(*) AS total
  FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'system_users'
    AND index_name = 'uq_system_users_public_id'
`);

if (!Number(uniqueIndex[0].total)) {
  await db.query(`
    ALTER TABLE system_users
    ADD UNIQUE KEY uq_system_users_public_id (public_id)
  `);
}

const [users] = await db.query(`
  SELECT id, public_id
  FROM system_users
`);

for (const user of users) {
  if (!user.public_id) {
    await db.execute(
      `
        UPDATE system_users
        SET public_id = ?
        WHERE id = ?
      `,
      [
        crypto.randomUUID(),
        user.id
      ]
    );
  }
}

await db.query(`
  CREATE TABLE IF NOT EXISTS system_permissions (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id BIGINT UNSIGNED NOT NULL,
    permission VARCHAR(191) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    UNIQUE KEY uq_system_permission (
      user_id,
      permission
    ),

    CONSTRAINT fk_system_permissions_user
      FOREIGN KEY (user_id)
      REFERENCES system_users(id)
      ON DELETE CASCADE
  )
  ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci
`);

const [admins] = await db.query(`
  SELECT id
  FROM system_users
  WHERE role = 'admin'
    AND active = 1
`);

for (const admin of admins) {
  await db.execute(
    `
      INSERT IGNORE INTO system_permissions (
        user_id,
        permission
      )
      VALUES (?, '*')
    `,
    [admin.id]
  );
}

console.log("IDENTIDADE_MYSQL=OK");

await db.end();

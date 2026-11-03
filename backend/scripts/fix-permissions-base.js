import crypto from "crypto";
import { db } from "../src/database.js";

const [admins] =
  await db.query(`
    SELECT
      id,
      public_id,
      role
    FROM system_users
    WHERE role = 'admin'
      AND active = 1
  `);

for (const admin of admins) {
  const [role] =
    await db.execute(
      `
        SELECT id
        FROM user_roles
        WHERE user_id = ?
        LIMIT 1
      `,
      [
        admin.public_id
      ]
    );

  if (!role.length) {
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

  await db.execute(
    `
      INSERT IGNORE INTO system_permissions (
        user_id,
        permission
      )
      VALUES (?, '*')
    `,
    [
      admin.id
    ]
  );
}

console.log(
  "ADMIN_PERMISSIONS=OK"
);

await db.end();

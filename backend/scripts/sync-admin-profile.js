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

const [admins] =
  await db.query(`
    SELECT
      id,
      public_id,
      email,
      name,
      role
    FROM system_users
    WHERE role = 'admin'
      AND active = 1
  `);

const [tables] =
  await db.query(`
    SELECT TABLE_NAME AS name
    FROM information_schema.tables
    WHERE table_schema = DATABASE()
  `);

const existingTables =
  new Set(
    tables.map(
      item => item.name
    )
  );

const candidates = [
  "profiles",
  "user_profiles",
  "usuarios",
  "users",
  "admins",
  "admin_users",
  "user_roles"
];

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

for (const table of candidates) {

  if (
    !existingTables.has(table)
  ) {
    continue;
  }

  const [columns] =
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

  const schema =
    new Map(
      columns.map(
        column => [
          column.name,
          column.type
        ]
      )
    );

  for (const admin of admins) {

    const values = {};

    if (schema.has("id"))
      values.id =
        admin.public_id;

    if (schema.has("user_id"))
      values.user_id =
        admin.public_id;

    if (schema.has("email"))
      values.email =
        admin.email;

    if (schema.has("name"))
      values.name =
        admin.name;

    if (schema.has("full_name"))
      values.full_name =
        admin.name;

    if (schema.has("nome"))
      values.nome =
        admin.name;

    if (schema.has("role"))
      values.role =
        admin.role;

    if (schema.has("ativo"))
      values.ativo =
        1;

    if (schema.has("active"))
      values.active =
        1;

    if (schema.has("is_admin"))
      values.is_admin =
        1;

    if (schema.has("data")) {
      values.data =
        JSON.stringify({
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
            admin.role,

          active:
            true,

          is_admin:
            true
        });
    }

    const entries =
      Object.entries(values);

    if (!entries.length)
      continue;

    const key =
      schema.has("id")
        ? "id"
        : (
            schema.has("user_id")
              ? "user_id"
              : null
          );

    if (!key)
      continue;

    const [found] =
      await db.execute(
        `
          SELECT 1
          FROM ${q(table)}
          WHERE ${q(key)} = ?
          LIMIT 1
        `,
        [values[key]]
      );

    if (!found.length) {

      const fields =
        entries.map(
          ([name]) => q(name)
        );

      const placeholders =
        entries.map(() => "?");

      await db.execute(
        `
          INSERT INTO ${q(table)}
            (${fields.join(",")})
          VALUES
            (${placeholders.join(",")})
        `,
        entries.map(
          ([, value]) => value
        )
      );

    } else {

      const updates =
        entries
          .filter(
            ([name]) =>
              name !== key
          )
          .map(
            ([name]) =>
              `${q(name)} = ?`
          );

      const params =
        entries
          .filter(
            ([name]) =>
              name !== key
          )
          .map(
            ([, value]) =>
              value
          );

      if (
        updates.length
      ) {

        params.push(
          values[key]
        );

        await db.execute(
          `
            UPDATE ${q(table)}
            SET ${updates.join(",")}
            WHERE ${q(key)} = ?
          `,
          params
        );
      }
    }

    console.log(
      `ADMIN_SYNC=${table}`
    );
  }
}

await db.end();

console.log(
  "ADMIN_PROFILE_SYNC=OK"
);

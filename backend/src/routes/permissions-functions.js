import express from "express";
import crypto from "crypto";
import jwt from "jsonwebtoken";

import { db } from "../database.js";
import { config } from "../config.js";

const router =
  express.Router();

function userFrom(req) {
  const header =
    String(
      req.headers.authorization || ""
    );

  if (
    !header.startsWith(
      "Bearer "
    )
  ) {
    return null;
  }

  try {
    return jwt.verify(
      header.slice(7),
      config.jwtSecret
    );
  } catch {
    return null;
  }
}

function normalizeName(value) {
  return String(
    value || ""
  )
    .trim()
    .toLowerCase();
}

async function users() {
  const [rows] =
    await db.query(`
      SELECT
        id AS system_id,
        public_id AS id,
        public_id AS user_id,
        email,
        name,
        name AS full_name,
        role,
        active,
        created_at
      FROM system_users
      ORDER BY name, email
    `);

  const [roles] =
    await db.query(`
      SELECT
        id,
        user_id,
        role
      FROM user_roles
    `);

  return rows.map(
    row => ({
      ...row,

      active:
        Boolean(row.active),

      user_roles:
        roles.filter(
          role =>
            role.user_id ===
            row.id
        )
    })
  );
}

async function permissions() {
  const [rows] =
    await db.query(`
      SELECT
        id,
        name,
        category,
        description
      FROM permissions
      ORDER BY
        category,
        name
    `);

  return rows;
}

async function rolePermissions(
  role
) {
  const [rows] =
    await db.execute(
      `
        SELECT
          rp.id,
          rp.permission_id,
          rp.role,
          p.name,
          p.category,
          p.description
        FROM role_permissions rp

        LEFT JOIN permissions p
          ON p.id =
             rp.permission_id

        WHERE rp.role = ?

        ORDER BY
          p.category,
          p.name
      `,
      [role]
    );

  return rows;
}

async function setRole(
  userId,
  role
) {
  role =
    normalizeName(role) ||
    "user";

  await db.execute(
    `
      UPDATE system_users
      SET role = ?
      WHERE public_id = ?
    `,
    [
      role,
      userId
    ]
  );

  await db.execute(
    `
      DELETE FROM user_roles
      WHERE user_id = ?
    `,
    [userId]
  );

  await db.execute(
    `
      INSERT INTO user_roles (
        id,
        user_id,
        role
      )
      VALUES (?, ?, ?)
    `,
    [
      crypto.randomUUID(),
      userId,
      role
    ]
  );

  await db.execute(
    `
      UPDATE profiles
      SET role = ?
      WHERE id = ?
         OR user_id = ?
    `,
    [
      role,
      userId,
      userId
    ]
  );

  return role;
}

router.post(
  "/:name",
  async (
    req,
    res,
    next
  ) => {
    const name =
      normalizeName(
        req.params.name
      );

    const related =
      (
        name.includes("permission") ||
        name.includes("role") ||
        name === "list-users" ||
        name === "get-users" ||
        name === "get-users-with-roles"
      );

    /*
     * create-user continua sendo tratado
     * pela rota propria.
     */
    if (
      !related ||
      name === "create-user"
    ) {
      return next();
    }

    const logged =
      userFrom(req);

    if (!logged) {
      return res
        .status(401)
        .json({
          data: null,
          error: {
            message:
              "Sessao invalida ou expirada"
          }
        });
    }

    if (
      !["admin", "desenvolvedor"].includes(
        normalizeName(logged.role)
      )
    ) {
      return res
        .status(403)
        .json({
          data: null,
          error: {
            message:
              "Acesso administrativo necessario"
          }
        });
    }

    try {
      /*
       * USUARIOS
       */
      if (
        name === "list-users" ||
        name === "get-users" ||
        name ===
          "get-users-with-roles" ||
        (
          name.includes("user") &&
          (
            name.startsWith("get") ||
            name.startsWith("list")
          ) &&
          !name.includes(
            "permission"
          )
        )
      ) {
        return res.json({
          data:
            await users(),

          error: null
        });
      }

      /*
       * CATALOGO DE PERMISSOES
       */
      if (
        (
          name.startsWith("get") ||
          name.startsWith("list")
        ) &&
        name.includes("permission") &&
        !name.includes("user") &&
        !name.includes("role")
      ) {
        return res.json({
          data:
            await permissions(),

          error: null
        });
      }

      /*
       * PERMISSOES DE UMA ROLE
       */
      if (
        (
          name.startsWith("get") ||
          name.startsWith("list")
        ) &&
        name.includes("role") &&
        name.includes("permission")
      ) {
        const role =
          normalizeName(
            req.body?.role ??
            req.body?.p_role ??
            req.body?._role
          );

        return res.json({
          data:
            await rolePermissions(
              role
            ),

          error: null
        });
      }

      /*
       * PERMISSOES DE USUARIO
       */
      if (
        (
          name.startsWith("get") ||
          name.startsWith("list")
        ) &&
        name.includes("user") &&
        name.includes("permission")
      ) {
        const userId =
          req.body?.user_id ??
          req.body?.userId ??
          req.body?.id;

        const [userRows] =
          await db.execute(
            `
              SELECT
                id,
                public_id,
                role
              FROM system_users
              WHERE public_id = ?
              LIMIT 1
            `,
            [userId]
          );

        if (
          !userRows.length
        ) {
          return res.json({
            data: [],
            error: null
          });
        }

        const target =
          userRows[0];

        const rolePerms =
          await rolePermissions(
            target.role
          );

        const [direct] =
          await db.execute(
            `
              SELECT
                permission AS name
              FROM system_permissions
              WHERE user_id = ?
            `,
            [
              target.id
            ]
          );

        return res.json({
          data: {
            role:
              target.role,

            role_permissions:
              rolePerms,

            direct_permissions:
              direct
          },

          error: null
        });
      }

      /*
       * ALTERAR ROLE DO USUARIO
       */
      if (
        name.includes("role") &&
        name.includes("user") &&
        (
          name.includes("update") ||
          name.includes("set") ||
          name.includes("change")
        )
      ) {
        const userId =
          req.body?.user_id ??
          req.body?.userId ??
          req.body?.id;

        const role =
          req.body?.role ??
          req.body?.new_role ??
          req.body?.newRole;

        if (
          !userId ||
          !role
        ) {
          return res
            .status(400)
            .json({
              data: null,
              error: {
                message:
                  "user_id e role sao obrigatorios"
              }
            });
        }

        const savedRole =
          await setRole(
            userId,
            role
          );

        return res.json({
          data: {
            success: true,
            user_id:
              userId,

            role:
              savedRole
          },

          error: null
        });
      }

      /*
       * ALTERAR PERMISSOES DE ROLE
       */
      if (
        name.includes("role") &&
        name.includes("permission") &&
        (
          name.includes("update") ||
          name.includes("set") ||
          name.includes("save")
        )
      ) {
        const role =
          normalizeName(
            req.body?.role
          );

        let ids =
          req.body
            ?.permission_ids ??
          req.body
            ?.permissionIds ??
          req.body
            ?.permissions ??
          [];

        if (
          !Array.isArray(ids)
        ) {
          ids = [];
        }

        if (!role) {
          return res
            .status(400)
            .json({
              data: null,
              error: {
                message:
                  "role obrigatoria"
              }
            });
        }

        await db.execute(
          `
            DELETE FROM role_permissions
            WHERE role = ?
          `,
          [role]
        );

        for (
          const item
          of ids
        ) {
          let permissionId =
            typeof item ===
            "object"
              ? (
                  item.id ??
                  item.permission_id
                )
              : item;

          /*
           * Se o frontend mandar o nome,
           * convertemos para ID.
           */
          if (
            permissionId &&
            !String(
              permissionId
            ).includes("-")
          ) {
            const [byName] =
              await db.execute(
                `
                  SELECT id
                  FROM permissions
                  WHERE name = ?
                  LIMIT 1
                `,
                [
                  permissionId
                ]
              );

            if (
              byName.length
            ) {
              permissionId =
                byName[0].id;
            }
          }

          if (!permissionId)
            continue;

          await db.execute(
            `
              INSERT INTO role_permissions (
                id,
                role,
                permission_id
              )
              VALUES (?, ?, ?)
            `,
            [
              crypto.randomUUID(),
              role,
              permissionId
            ]
          );
        }

        return res.json({
          data: {
            success: true,
            role,
            permissions:
              await rolePermissions(
                role
              )
          },

          error: null
        });
      }

      /*
       * Se for uma function relacionada a
       * permissoes ainda nao identificada,
       * retornamos o estado completo em vez
       * do antigo 501 do Supabase.
       */
      return res.json({
        data: {
          users:
            await users(),

          permissions:
            await permissions()
        },

        error: null
      });

    } catch (error) {
      console.error(
        "PERMISSIONS FUNCTION:",
        error
      );

      return res
        .status(500)
        .json({
          data: null,
          error: {
            message:
              error?.message ||
              "Erro no modulo de permissoes"
          }
        });
    }
  }
);

export default router;

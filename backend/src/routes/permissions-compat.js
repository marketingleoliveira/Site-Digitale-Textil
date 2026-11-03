import express from "express";
import crypto from "crypto";
import jwt from "jsonwebtoken";

import { db } from "../database.js";
import { config } from "../config.js";

const router = express.Router();

function auth(req) {
  const header =
    String(req.headers.authorization || "");

  if (!header.startsWith("Bearer ")) {
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

function requireAdmin(req, res) {
  const user = auth(req);

  if (!user) {
    res.status(401).json({
      data: null,
      error: {
        message: "Sessao invalida ou expirada"
      }
    });

    return null;
  }

  const role = String(user.role || "").toLowerCase();

  if (!["admin", "desenvolvedor"].includes(role)) {
    res.status(403).json({
      data: null,
      error: {
        message: "Acesso administrativo necessario"
      }
    });

    return null;
  }

  return user;
}

function matchValue(
  value,
  operator,
  expected
) {
  switch (operator) {
    case "eq":
      return value == expected;

    case "neq":
      return value != expected;

    case "is":
      if (
        expected === null ||
        expected === "null"
      ) {
        return value == null;
      }

      return value == expected;

    case "in":
      return (
        Array.isArray(expected) &&
        expected.some(
          item => item == value
        )
      );

    case "ilike": {
      const search =
        String(expected ?? "")
          .replaceAll("%", "")
          .toLowerCase();

      return String(value ?? "")
        .toLowerCase()
        .includes(search);
    }

    default:
      return true;
  }
}

function applyFilters(
  rows,
  filters = []
) {
  return rows.filter(row => {
    for (const filter of filters) {
      if (
        filter.type === "match"
      ) {
        for (
          const [key, value]
          of Object.entries(
            filter.value || {}
          )
        ) {
          if (row[key] != value) {
            return false;
          }
        }

        continue;
      }

      if (
        !matchValue(
          row[filter.column],
          filter.type,
          filter.value
        )
      ) {
        return false;
      }
    }

    return true;
  });
}

async function loadPermissions() {
  const [rows] = await db.query(`
    SELECT
      id,
      name,
      category,
      description,
      created_at,
      updated_at
    FROM permissions
    ORDER BY
      category,
      name
  `);

  return rows;
}

async function loadRolePermissions() {
  const [rows] = await db.query(`
    SELECT
      rp.id,
      rp.role,
      rp.permission_id,
      rp.created_at,
      rp.updated_at,

      p.name AS permission_name,
      p.category AS permission_category,
      p.description AS permission_description

    FROM role_permissions rp

    LEFT JOIN permissions p
      ON p.id = rp.permission_id

    ORDER BY
      rp.role,
      p.category,
      p.name
  `);

  return rows.map(row => ({
    id: row.id,
    role: row.role,
    permission_id:
      row.permission_id,

    created_at:
      row.created_at,

    updated_at:
      row.updated_at,

    permissions:
      row.permission_id
        ? {
            id:
              row.permission_id,

            name:
              row.permission_name,

            category:
              row.permission_category,

            description:
              row.permission_description
          }
        : null
  }));
}

async function loadUserRoles() {
  const [rows] = await db.query(`
    SELECT
      ur.id,
      ur.user_id,
      ur.role,
      ur.created_at,
      ur.updated_at,

      su.email,
      su.name,
      su.active

    FROM user_roles ur

    LEFT JOIN system_users su
      ON su.public_id =
         ur.user_id

    ORDER BY su.name, su.email
  `);

  return rows.map(row => ({
    id:
      row.id,

    user_id:
      row.user_id,

    role:
      row.role,

    created_at:
      row.created_at,

    updated_at:
      row.updated_at,

    profiles: {
      id:
        row.user_id,

      user_id:
        row.user_id,

      email:
        row.email,

      name:
        row.name,

      full_name:
        row.name,

      active:
        Boolean(row.active),

      role:
        row.role
    }
  }));
}

async function loadProfiles() {
  const [users] = await db.query(`
    SELECT
      id AS system_id,
      public_id,
      email,
      name,
      role,
      active,
      created_at,
      updated_at
    FROM system_users
    ORDER BY name, email
  `);

  const [roles] = await db.query(`
    SELECT
      id,
      user_id,
      role
    FROM user_roles
  `);

  const [directPermissions] =
    await db.query(`
      SELECT
        sp.user_id,
        sp.permission,
        p.id AS permission_id,
        p.category,
        p.description
      FROM system_permissions sp

      LEFT JOIN permissions p
        ON p.name =
           sp.permission
    `);

  return users.map(user => {
    const userRoles =
      roles.filter(
        role =>
          role.user_id ===
          user.public_id
      );

    const permissions =
      directPermissions
        .filter(
          permission =>
            Number(
              permission.user_id
            ) === Number(
              user.system_id
            )
        )
        .map(permission => ({
          id:
            permission.permission_id,

          name:
            permission.permission,

          category:
            permission.category,

          description:
            permission.description
        }));

    return {
      id:
        user.public_id,

      user_id:
        user.public_id,

      email:
        user.email,

      name:
        user.name,

      full_name:
        user.name,

      role:
        user.role,

      active:
        Boolean(user.active),

      created_at:
        user.created_at,

      updated_at:
        user.updated_at,

      user_roles:
        userRoles,

      permissions
    };
  });
}

async function syncUserRole(
  userId,
  role
) {
  const cleanRole =
    String(role || "user")
      .trim()
      .toLowerCase();

  await db.execute(
    `
      UPDATE system_users
      SET role = ?
      WHERE public_id = ?
    `,
    [
      cleanRole,
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
      cleanRole
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
      cleanRole,
      userId,
      userId
    ]
  );

  return cleanRole;
}

/*
 * Intercepta somente as quatro tabelas
 * usadas pela tela /admin/permissions.
 *
 * Para qualquer outra tabela, passa para
 * a API genérica já existente.
 */
router.post(
  "/query",
  async (req, res, next) => {
    const table =
      String(
        req.body?.table || ""
      );

    const managed =
      new Set([
        "permissions",
        "role_permissions",
        "user_roles",
        "profiles"
      ]);

    if (!managed.has(table)) {
      return next();
    }

    const loggedUser = auth(req);

    if (!loggedUser) {
      return res.status(401).json({
        data: null,
        error: {
          message: "Sessao invalida ou expirada"
        }
      });
    }

    try {
      const operation =
        req.body?.operation ||
        "select";

      const loggedRole =
        String(loggedUser.role || "")
          .toLowerCase();

      if (
        operation !== "select" &&
        !["admin", "desenvolvedor"].includes(loggedRole)
      ) {
        return res.status(403).json({
          data: null,
          error: {
            message: "Acesso administrativo necessario"
          }
        });
      }

      const filters =
        req.body?.filters ||
        [];

      const orders =
        req.body?.orders ||
        [];

      const limit =
        req.body?.limit;

      const range =
        req.body?.range;

      const single =
        req.body?.single;

      const payload =
        req.body?.payload;

      /*
       * SELECT
       */
      if (
        operation === "select"
      ) {
        let rows;

        if (
          table === "permissions"
        ) {
          rows =
            await loadPermissions();

        } else if (
          table ===
          "role_permissions"
        ) {
          rows =
            await loadRolePermissions();

        } else if (
          table === "user_roles"
        ) {
          rows =
            await loadUserRoles();

        } else {
          rows =
            await loadProfiles();
        }

        if (
          !["admin", "desenvolvedor"].includes(loggedRole)
        ) {
          if (table === "user_roles" || table === "profiles") {
            rows = rows.filter(
              row => row.user_id === loggedUser.id || row.id === loggedUser.id
            );
          } else if (table === "role_permissions") {
            rows = rows.filter(
              row => String(row.role || "").toLowerCase() === loggedRole
            );
          }
        }

        rows =
          applyFilters(
            rows,
            filters
          );

        for (
          const order
          of orders
        ) {
          rows.sort(
            (a, b) => {
              const av =
                a[order.column];

              const bv =
                b[order.column];

              if (av == bv)
                return 0;

              const direction =
                order.ascending ===
                false
                  ? -1
                  : 1;

              return av > bv
                ? direction
                : -direction;
            }
          );
        }

        const count =
          rows.length;

        if (
          Array.isArray(range) &&
          range.length === 2
        ) {
          rows =
            rows.slice(
              Number(range[0]),
              Number(range[1]) + 1
            );
        }

        if (
          limit !== undefined &&
          limit !== null
        ) {
          rows =
            rows.slice(
              0,
              Number(limit)
            );
        }

        if (
          single === "single"
        ) {
          if (
            rows.length !== 1
          ) {
            return res
              .status(406)
              .json({
                data: null,
                error: {
                  message:
                    "single_row_expected"
                },
                count
              });
          }

          return res.json({
            data: rows[0],
            error: null,
            count
          });
        }

        if (
          single === "maybeSingle"
        ) {
          return res.json({
            data:
              rows[0] || null,

            error: null,
            count
          });
        }

        return res.json({
          data: rows,
          error: null,
          count
        });
      }

      /*
       * PERMISSIONS
       */
      if (
        table === "permissions"
      ) {
        if (
          operation === "insert" ||
          operation === "upsert"
        ) {
          const records =
            Array.isArray(payload)
              ? payload
              : [payload];

          const output = [];

          for (
            const item
            of records
          ) {
            const id =
              item?.id ||
              crypto.randomUUID();

            const name =
              String(
                item?.name || ""
              ).trim();

            if (!name) {
              continue;
            }

            await db.execute(
              `
                INSERT INTO permissions (
                  id,
                  name,
                  category,
                  description
                )
                VALUES (?, ?, ?, ?)

                ON DUPLICATE KEY UPDATE
                  name =
                    VALUES(name),

                  category =
                    VALUES(category),

                  description =
                    VALUES(description),

                  updated_at =
                    CURRENT_TIMESTAMP
              `,
              [
                id,
                name,
                item?.category || null,
                item?.description || null
              ]
            );

            output.push({
              ...item,
              id,
              name
            });
          }

          return res.json({
            data:
              Array.isArray(payload)
                ? output
                : output[0] || null,

            error: null
          });
        }

        if (
          operation === "delete"
        ) {
          const rows =
            applyFilters(
              await loadPermissions(),
              filters
            );

          for (
            const permission
            of rows
          ) {
            await db.execute(
              `
                DELETE FROM role_permissions
                WHERE permission_id = ?
              `,
              [permission.id]
            );

            await db.execute(
              `
                DELETE FROM permissions
                WHERE id = ?
              `,
              [permission.id]
            );
          }

          return res.json({
            data: rows,
            error: null
          });
        }
      }

      /*
       * USER_ROLES
       */
      if (
        table === "user_roles"
      ) {
        if (
          operation === "insert" ||
          operation === "upsert"
        ) {
          const records =
            Array.isArray(payload)
              ? payload
              : [payload];

          const output = [];

          for (
            const item
            of records
          ) {
            if (
              !item?.user_id
            ) continue;

            const role =
              await syncUserRole(
                item.user_id,
                item.role
              );

            output.push({
              user_id:
                item.user_id,

              role
            });
          }

          return res.json({
            data:
              Array.isArray(payload)
                ? output
                : output[0] || null,

            error: null
          });
        }

        if (
          operation === "update"
        ) {
          const rows =
            applyFilters(
              await loadUserRoles(),
              filters
            );

          for (
            const row
            of rows
          ) {
            await syncUserRole(
              row.user_id,
              payload?.role ??
              row.role
            );
          }

          return res.json({
            data: rows,
            error: null
          });
        }

        if (
          operation === "delete"
        ) {
          const rows =
            applyFilters(
              await loadUserRoles(),
              filters
            );

          for (
            const row
            of rows
          ) {
            await db.execute(
              `
                DELETE FROM user_roles
                WHERE user_id = ?
              `,
              [row.user_id]
            );
          }

          return res.json({
            data: rows,
            error: null
          });
        }
      }

      /*
       * ROLE_PERMISSIONS
       */
      if (
        table ===
        "role_permissions"
      ) {
        if (
          operation === "insert" ||
          operation === "upsert"
        ) {
          const records =
            Array.isArray(payload)
              ? payload
              : [payload];

          const output = [];

          for (
            const item
            of records
          ) {
            if (
              !item?.role ||
              !item?.permission_id
            ) {
              continue;
            }

            const [existing] =
              await db.execute(
                `
                  SELECT id
                  FROM role_permissions
                  WHERE role = ?
                    AND permission_id = ?
                  LIMIT 1
                `,
                [
                  item.role,
                  item.permission_id
                ]
              );

            if (
              !existing.length
            ) {
              const id =
                item.id ||
                crypto.randomUUID();

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
                  id,
                  item.role,
                  item.permission_id
                ]
              );

              output.push({
                id,
                role:
                  item.role,

                permission_id:
                  item.permission_id
              });

            } else {
              output.push({
                id:
                  existing[0].id,

                role:
                  item.role,

                permission_id:
                  item.permission_id
              });
            }
          }

          return res.json({
            data:
              Array.isArray(payload)
                ? output
                : output[0] || null,

            error: null
          });
        }

        if (
          operation === "delete"
        ) {
          const rows =
            applyFilters(
              await loadRolePermissions(),
              filters
            );

          for (
            const row
            of rows
          ) {
            await db.execute(
              `
                DELETE FROM role_permissions
                WHERE id = ?
              `,
              [row.id]
            );
          }

          return res.json({
            data: rows,
            error: null
          });
        }
      }

      /*
       * PROFILES
       */
      if (
        table === "profiles" &&
        operation === "update"
      ) {
        const profiles =
          applyFilters(
            await loadProfiles(),
            filters
          );

        for (
          const profile
          of profiles
        ) {
          if (
            payload?.name !==
            undefined ||
            payload?.full_name !==
            undefined
          ) {
            const name =
              payload?.name ??
              payload?.full_name;

            await db.execute(
              `
                UPDATE system_users
                SET name = ?
                WHERE public_id = ?
              `,
              [
                name,
                profile.id
              ]
            );

            await db.execute(
              `
                UPDATE profiles
                SET
                  name = ?,
                  full_name = ?
                WHERE id = ?
                   OR user_id = ?
              `,
              [
                name,
                name,
                profile.id,
                profile.id
              ]
            );
          }

          if (
            payload?.active !==
            undefined
          ) {
            const active =
              payload.active
                ? 1
                : 0;

            await db.execute(
              `
                UPDATE system_users
                SET active = ?
                WHERE public_id = ?
              `,
              [
                active,
                profile.id
              ]
            );

            await db.execute(
              `
                UPDATE profiles
                SET active = ?
                WHERE id = ?
                   OR user_id = ?
              `,
              [
                active,
                profile.id,
                profile.id
              ]
            );
          }

          if (
            payload?.role
          ) {
            await syncUserRole(
              profile.id,
              payload.role
            );
          }
        }

        return res.json({
          data: profiles,
          error: null
        });
      }

      return res
        .status(400)
        .json({
          data: null,
          error: {
            message:
              "Operacao nao suportada no modulo de permissoes"
          }
        });

    } catch (error) {
      console.error(
        "PERMISSIONS COMPAT:",
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

/*
 * Estado completo da tela.
 */
router.get(
  "/admin-state",
  async (req, res) => {
    const user =
      requireAdmin(req, res);

    if (!user) return;

    try {
      const [
        profiles,
        permissions,
        rolePermissions,
        userRoles
      ] =
        await Promise.all([
          loadProfiles(),
          loadPermissions(),
          loadRolePermissions(),
          loadUserRoles()
        ]);

      return res.json({
        data: {
          users:
            profiles,

          permissions,

          role_permissions:
            rolePermissions,

          user_roles:
            userRoles
        },

        error: null
      });

    } catch (error) {
      return res
        .status(500)
        .json({
          data: null,
          error: {
            message:
              error?.message ||
              "Erro ao carregar permissoes"
          }
        });
    }
  }
);

export default router;

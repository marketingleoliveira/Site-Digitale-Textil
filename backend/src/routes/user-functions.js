import express from "express";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

import { db } from "../database.js";
import { config } from "../config.js";

const router = express.Router();

function authenticated(req) {
  const header = String(
    req.headers.authorization || ""
  );

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

function firstValue(...values) {
  for (const value of values) {
    if (
      value !== undefined &&
      value !== null &&
      value !== ""
    ) {
      return value;
    }
  }

  return null;
}

router.post(
  "/create-user",
  async (req, res) => {

    const loggedUser =
      authenticated(req);

    if (!loggedUser) {
      return res.status(401).json({
        data: null,
        error: {
          message: "Sessao invalida ou expirada"
        }
      });
    }

    const loggedRole = String(loggedUser.role || "").toLowerCase();

    if (!["admin", "desenvolvedor"].includes(loggedRole)) {
      return res.status(403).json({
        data: null,
        error: {
          message:
            "Apenas administradores ou desenvolvedores podem criar usuarios"
        }
      });
    }

    /*
     * Aceita tanto payload direto quanto:
     * { user: {...} }
     * { userData: {...} }
     * { data: {...} }
     */
    const source =
      req.body?.userData ??
      req.body?.user ??
      req.body?.data ??
      req.body ??
      {};

    const email =
      String(
        firstValue(
          source.email,
          req.body?.email
        ) || ""
      )
      .trim()
      .toLowerCase();

    const password =
      String(
        firstValue(
          source.password,
          source.senha,
          source.password_value,
          req.body?.password,
          req.body?.senha
        ) || ""
      );

    const name =
      String(
        firstValue(
          source.name,
          source.full_name,
          source.fullName,
          source.nome,
          req.body?.name,
          req.body?.full_name,
          req.body?.nome,
          email.split("@")[0]
        ) || ""
      ).trim();

    const role =
      String(
        firstValue(
          source.role,
          source.user_role,
          source.userRole,
          source.tipo,
          req.body?.role,
          "user"
        ) || "user"
      )
      .trim()
      .toLowerCase();

    const activeValue =
      firstValue(
        source.active,
        source.ativo,
        source.is_active,
        true
      );

    const active =
      activeValue === false ||
      activeValue === 0 ||
      activeValue === "0" ||
      activeValue === "false"
        ? 0
        : 1;

    let permissions =
      firstValue(
        source.permissions,
        source.permissoes,
        req.body?.permissions,
        []
      );

    if (
      typeof permissions === "string"
    ) {
      try {
        permissions =
          JSON.parse(permissions);
      } catch {
        permissions =
          permissions
            .split(",")
            .map(v => v.trim())
            .filter(Boolean);
      }
    }

    if (!Array.isArray(permissions)) {
      permissions = [];
    }

    if (!email || !email.includes("@")) {
      return res.status(400).json({
        data: null,
        error: {
          message: "Informe um e-mail valido"
        }
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        data: null,
        error: {
          message:
            "A senha deve possuir pelo menos 6 caracteres"
        }
      });
    }

    const connection =
      await db.getConnection();

    try {

      await connection.beginTransaction();

      const [existing] =
        await connection.execute(
          `
            SELECT id
            FROM system_users
            WHERE email = ?
            LIMIT 1
          `,
          [email]
        );

      if (existing.length) {
        await connection.rollback();

        return res.status(409).json({
          data: null,
          error: {
            message:
              "Ja existe um usuario com este e-mail"
          }
        });
      }

      const publicId =
        crypto.randomUUID();

      const passwordHash =
        await bcrypt.hash(
          password,
          12
        );

      const [insertResult] =
        await connection.execute(
          `
            INSERT INTO system_users (
              public_id,
              email,
              password_hash,
              name,
              role,
              active
            )
            VALUES (?, ?, ?, ?, ?, ?)
          `,
          [
            publicId,
            email,
            passwordHash,
            name,
            role,
            active
          ]
        );

      const systemId =
        insertResult.insertId;

      /*
       * PROFILE
       */
      const [profileTable] =
        await connection.execute(
          `
            SELECT COUNT(*) AS total
            FROM information_schema.tables
            WHERE table_schema = DATABASE()
              AND table_name = 'profiles'
          `
        );

      if (
        Number(
          profileTable[0]?.total || 0
        ) > 0
      ) {

        const [profileColumns] =
          await connection.execute(
            `
              SELECT COLUMN_NAME AS name
              FROM information_schema.columns
              WHERE table_schema = DATABASE()
                AND table_name = 'profiles'
            `
          );

        const cols =
          new Set(
            profileColumns.map(
              c => c.name
            )
          );

        const profileData = {
          id: publicId,
          user_id: publicId,
          email,
          name,
          full_name: name,
          role,
          active: Boolean(active)
        };

        const fields = [];
        const values = [];
        const params = [];

        const add = (
          column,
          value
        ) => {
          if (!cols.has(column))
            return;

          fields.push(
            "`" + column + "`"
          );

          values.push("?");

          params.push(value);
        };

        add("id", publicId);
        add("user_id", publicId);
        add("email", email);
        add("name", name);
        add("full_name", name);
        add("role", role);
        add("active", active);
        add(
          "data",
          JSON.stringify(profileData)
        );

        if (fields.length) {
          await connection.execute(
            `
              INSERT INTO profiles
                (${fields.join(", ")})
              VALUES
                (${values.join(", ")})
            `,
            params
          );
        }
      }

      /*
       * USER_ROLES
       */
      const [rolesTable] =
        await connection.execute(
          `
            SELECT COUNT(*) AS total
            FROM information_schema.tables
            WHERE table_schema = DATABASE()
              AND table_name = 'user_roles'
          `
        );

      if (
        Number(
          rolesTable[0]?.total || 0
        ) > 0
      ) {

        const [roleColumns] =
          await connection.execute(
            `
              SELECT COLUMN_NAME AS name
              FROM information_schema.columns
              WHERE table_schema = DATABASE()
                AND table_name = 'user_roles'
            `
          );

        const cols =
          new Set(
            roleColumns.map(
              c => c.name
            )
          );

        const fields = [];
        const values = [];
        const params = [];

        if (cols.has("id")) {
          fields.push("`id`");
          values.push("?");
          params.push(
            crypto.randomUUID()
          );
        }

        if (cols.has("user_id")) {
          fields.push("`user_id`");
          values.push("?");
          params.push(publicId);
        }

        if (cols.has("role")) {
          fields.push("`role`");
          values.push("?");
          params.push(role);
        }

        if (cols.has("data")) {
          fields.push("`data`");
          values.push("?");
          params.push(
            JSON.stringify({
              user_id: publicId,
              role
            })
          );
        }

        if (fields.length) {
          await connection.execute(
            `
              INSERT INTO user_roles
                (${fields.join(", ")})
              VALUES
                (${values.join(", ")})
            `,
            params
          );
        }
      }

      /*
       * PERMISSOES INTERNAS
       */
      if (role === "admin") {
        await connection.execute(
          `
            INSERT IGNORE INTO system_permissions (
              user_id,
              permission
            )
            VALUES (?, '*')
          `,
          [systemId]
        );

      } else {

        for (const permission of permissions) {

          const clean =
            String(permission || "")
              .trim();

          if (!clean)
            continue;

          await connection.execute(
            `
              INSERT IGNORE INTO system_permissions (
                user_id,
                permission
              )
              VALUES (?, ?)
            `,
            [
              systemId,
              clean
            ]
          );
        }
      }

      await connection.commit();

      return res.status(201).json({
        data: {
          success: true,

          user: {
            id: publicId,
            email,
            name,
            full_name: name,
            role,
            active:
              Boolean(active),

            permissions:
              role === "admin"
                ? ["*"]
                : permissions
          }
        },

        error: null
      });

    } catch (error) {

      try {
        await connection.rollback();
      } catch {}

      console.error(
        "CREATE USER:",
        error
      );

      return res.status(500).json({
        data: null,

        error: {
          message:
            error?.message ||
            "Erro ao criar usuario"
        }
      });

    } finally {

      connection.release();
    }
  }
);

export default router;

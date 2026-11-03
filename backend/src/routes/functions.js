import express from "express";
import fs from "fs";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

import { config } from "../config.js";
import { db } from "../database.js";

const router = express.Router();

const mapFile =
  "/var/www/Site-Digitale-Textil/backend/functions-map.json";

let functionsMap = {};

try {
  functionsMap = JSON.parse(
    fs.readFileSync(
      mapFile,
      "utf8"
    )
  );
} catch {
  functionsMap = {};
}

function getUser(req) {
  const header =
    String(
      req.headers.authorization || ""
    );

  if (
    !header.startsWith("Bearer ")
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

function validName(value) {
  return /^[A-Za-z0-9_-]{1,100}$/
    .test(
      String(value || "")
    );
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
  "/:name",
  async (req, res) => {

    const functionName =
      String(
        req.params.name || ""
      );

    try {

      if (!validName(functionName)) {
        return res
          .status(400)
          .json({
            data: null,
            error: {
              message:
                "Funcao invalida"
            }
          });
      }

      /*
       * ==========================================
       * CREATE USER
       * ==========================================
       *
       * Esta funcao substitui definitivamente
       * a antiga Edge Function do Supabase.
       */
      if (
        functionName === "create-user"
      ) {

        const loggedUser =
          getUser(req);

        if (!loggedUser) {
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
          String(
            loggedUser.role || ""
          ).toLowerCase() !==
          "admin"
        ) {
          return res
            .status(403)
            .json({
              data: null,
              error: {
                message:
                  "Apenas administradores podem criar usuarios"
              }
            });
        }

        /*
         * Aceitamos os formatos normalmente
         * utilizados pelo frontend Lovable:
         *
         * { email, password, ... }
         * { user: {...} }
         * { userData: {...} }
         * { data: {...} }
         * { body: {...} }
         */
        const source =
          req.body?.userData ??
          req.body?.user ??
          req.body?.data ??
          req.body?.body ??
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
              source.passwordValue,
              req.body?.password,
              req.body?.senha
            ) || ""
          );

        const name =
          String(
            firstValue(
              source.name,
              source.nome,
              source.full_name,
              source.fullName,
              source.display_name,
              req.body?.name,
              req.body?.nome,
              req.body?.full_name,
              req.body?.fullName,
              email
                ? email.split("@")[0]
                : ""
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

        let permissions =
          firstValue(
            source.permissions,
            source.permissoes,
            req.body?.permissions,
            []
          );

        if (
          typeof permissions ===
          "string"
        ) {
          try {
            permissions =
              JSON.parse(
                permissions
              );
          } catch {
            permissions =
              permissions
                .split(",")
                .map(
                  value =>
                    value.trim()
                )
                .filter(Boolean);
          }
        }

        if (
          !Array.isArray(
            permissions
          )
        ) {
          permissions = [];
        }

        const rawActive =
          firstValue(
            source.active,
            source.ativo,
            source.is_active,
            true
          );

        const active =
          (
            rawActive === false ||
            rawActive === 0 ||
            rawActive === "0" ||
            rawActive === "false"
          )
            ? 0
            : 1;

        if (
          !email ||
          !email.includes("@")
        ) {
          return res
            .status(400)
            .json({
              data: null,
              error: {
                message:
                  "Informe um e-mail valido"
              }
            });
        }

        if (
          password.length < 6
        ) {
          return res
            .status(400)
            .json({
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

          await connection
            .beginTransaction();

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

          if (
            existing.length
          ) {

            await connection
              .rollback();

            return res
              .status(409)
              .json({
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
          const [profileColumns] =
            await connection.execute(
              `
                SELECT COLUMN_NAME AS name
                FROM information_schema.columns
                WHERE table_schema = DATABASE()
                  AND table_name = 'profiles'
              `
            );

          if (
            profileColumns.length
          ) {

            const columns =
              new Set(
                profileColumns.map(
                  item =>
                    item.name
                )
              );

            const fields = [];
            const placeholders = [];
            const params = [];

            const add = (
              column,
              value
            ) => {

              if (
                !columns.has(
                  column
                )
              ) {
                return;
              }

              fields.push(
                "`" +
                column +
                "`"
              );

              placeholders.push(
                "?"
              );

              params.push(
                value
              );
            };

            const profileData = {
              id:
                publicId,

              user_id:
                publicId,

              email,
              name,

              full_name:
                name,

              role,

              active:
                Boolean(active)
            };

            add(
              "id",
              publicId
            );

            add(
              "user_id",
              publicId
            );

            add(
              "email",
              email
            );

            add(
              "name",
              name
            );

            add(
              "full_name",
              name
            );

            add(
              "role",
              role
            );

            add(
              "active",
              active
            );

            add(
              "data",
              JSON.stringify(
                profileData
              )
            );

            if (
              fields.length
            ) {

              await connection.execute(
                `
                  INSERT INTO profiles
                    (${fields.join(",")})
                  VALUES
                    (${placeholders.join(",")})
                `,
                params
              );
            }
          }

          /*
           * USER ROLES
           */
          const [roleColumns] =
            await connection.execute(
              `
                SELECT COLUMN_NAME AS name
                FROM information_schema.columns
                WHERE table_schema = DATABASE()
                  AND table_name = 'user_roles'
              `
            );

          if (
            roleColumns.length
          ) {

            const columns =
              new Set(
                roleColumns.map(
                  item =>
                    item.name
                )
              );

            const fields = [];
            const placeholders = [];
            const params = [];

            if (
              columns.has("id")
            ) {
              fields.push(
                "`id`"
              );

              placeholders.push(
                "?"
              );

              params.push(
                crypto.randomUUID()
              );
            }

            if (
              columns.has(
                "user_id"
              )
            ) {
              fields.push(
                "`user_id`"
              );

              placeholders.push(
                "?"
              );

              params.push(
                publicId
              );
            }

            if (
              columns.has(
                "role"
              )
            ) {
              fields.push(
                "`role`"
              );

              placeholders.push(
                "?"
              );

              params.push(
                role
              );
            }

            if (
              columns.has(
                "data"
              )
            ) {
              fields.push(
                "`data`"
              );

              placeholders.push(
                "?"
              );

              params.push(
                JSON.stringify({
                  user_id:
                    publicId,

                  role
                })
              );
            }

            if (
              fields.length
            ) {
              await connection.execute(
                `
                  INSERT INTO user_roles
                    (${fields.join(",")})
                  VALUES
                    (${placeholders.join(",")})
                `,
                params
              );
            }
          }

          /*
           * PERMISSOES
           */
          if (
            role === "admin"
          ) {

            await connection.execute(
              `
                INSERT IGNORE
                INTO system_permissions (
                  user_id,
                  permission
                )
                VALUES (?, '*')
              `,
              [systemId]
            );

          } else {

            for (
              const permission
              of permissions
            ) {

              const clean =
                String(
                  permission || ""
                ).trim();

              if (!clean)
                continue;

              await connection.execute(
                `
                  INSERT IGNORE
                  INTO system_permissions (
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

          return res
            .status(201)
            .json({
              data: {
                success: true,

                user: {
                  id:
                    publicId,

                  email,
                  name,

                  full_name:
                    name,

                  role,

                  active:
                    Boolean(
                      active
                    ),

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
            await connection
              .rollback();
          } catch {}

          console.error(
            "CREATE-USER:",
            error
          );

          return res
            .status(500)
            .json({
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

      /*
       * ==========================================
       * HEALTH
       * ==========================================
       */
      if (
        functionName === "health" ||
        functionName === "health-check"
      ) {

        await db.query(
          "SELECT 1"
        );

        return res.json({
          data: {
            ok: true,
            backend: "mysql"
          },
          error: null
        });
      }

      /*
       * ==========================================
       * CONTATO
       * ==========================================
       */
      if (
        [
          "contact",
          "contato",
          "send-contact"
        ].includes(
          functionName
        )
      ) {

        const id =
          crypto.randomUUID();

        const payload = {
          id,
          ...(req.body || {}),
          created_at:
            new Date()
              .toISOString()
        };

        await db.query(`
          CREATE TABLE IF NOT EXISTS contatos (
            id VARCHAR(191)
              NOT NULL,

            data JSON
              NOT NULL,

            created_at TIMESTAMP
              NOT NULL
              DEFAULT CURRENT_TIMESTAMP,

            updated_at TIMESTAMP
              NOT NULL
              DEFAULT CURRENT_TIMESTAMP
              ON UPDATE CURRENT_TIMESTAMP,

            PRIMARY KEY (id)
          )
          ENGINE=InnoDB
          DEFAULT CHARSET=utf8mb4
          COLLATE=utf8mb4_unicode_ci
        `);

        await db.execute(
          `
            INSERT INTO contatos (
              id,
              data
            )
            VALUES (?, ?)
          `,
          [
            id,
            JSON.stringify(
              payload
            )
          ]
        );

        return res.json({
          data: {
            success: true,
            id
          },

          error: null
        });
      }

      /*
       * ==========================================
       * NEWSLETTER
       * ==========================================
       */
      if (
        functionName ===
        "newsletter"
      ) {

        const email =
          String(
            req.body?.email || ""
          )
          .trim()
          .toLowerCase();

        if (
          !email.includes("@")
        ) {

          return res
            .status(400)
            .json({
              data: null,
              error: {
                message:
                  "invalid_email"
              }
            });
        }

        await db.query(`
          CREATE TABLE IF NOT EXISTS newsletter (
            id BIGINT UNSIGNED
              NOT NULL
              AUTO_INCREMENT,

            email VARCHAR(320)
              NOT NULL,

            created_at TIMESTAMP
              NOT NULL
              DEFAULT CURRENT_TIMESTAMP,

            PRIMARY KEY (id),

            UNIQUE KEY
              uq_newsletter_email (
                email
              )
          )
          ENGINE=InnoDB
          DEFAULT CHARSET=utf8mb4
          COLLATE=utf8mb4_unicode_ci
        `);

        await db.execute(
          `
            INSERT IGNORE
            INTO newsletter (
              email
            )
            VALUES (?)
          `,
          [email]
        );

        return res.json({
          data: {
            success: true
          },
          error: null
        });
      }

      /*
       * ==========================================
       * DEMAIS FUNCTIONS
       * ==========================================
       */
      if (
        !functionsMap[
          functionName
        ]
      ) {

        return res
          .status(404)
          .json({
            data: null,
            error: {
              message:
                "function_not_registered"
            }
          });
      }

      const user =
        getUser(req);

      if (!user) {

        return res
          .status(401)
          .json({
            data: null,
            error: {
              message:
                "unauthorized"
            }
          });
      }

      return res
        .status(501)
        .json({
          data: null,
          error: {
            message:
              `Function ${functionName} precisa de conversao especifica para Node/MySQL`
          }
        });

    } catch (error) {

      console.error(
        "FUNCTION:",
        error
      );

      return res
        .status(500)
        .json({
          data: null,
          error: {
            message:
              error?.message ||
              "function_failed"
          }
        });
    }
  }
);

export default router;

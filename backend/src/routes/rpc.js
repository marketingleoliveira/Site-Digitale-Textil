import express from "express";
import jwt from "jsonwebtoken";

import { db } from "../database.js";
import { config } from "../config.js";

const router =
  express.Router();

function auth(req) {

  const header =
    String(
      req.headers.authorization ||
      ""
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

function normalized(value) {

  return String(
    value || ""
  )
    .trim()
    .toLowerCase();
}

router.post(
  "/:name",
  async (req, res) => {

    try {

      const name =
        normalized(
          req.params.name
        );

      const user =
        auth(req);

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

      if (
        [
          "is_admin",
          "isadmin",
          "check_admin",
          "check_is_admin"
        ].includes(name)
      ) {

        return res.json({
          data:
            user.role ===
            "admin",

          error: null
        });
      }

      if (
        name.includes(
          "has_role"
        ) ||
        name.includes(
          "user_has_role"
        )
      ) {

        const requested =
          normalized(
            req.body?.role ??
            req.body?._role ??
            req.body?.p_role
          );

        return res.json({
          data:
            requested
              ? user.role ===
                requested
              : Boolean(
                  user.role
                ),

          error: null
        });
      }

      if (
        name.includes(
          "get_user_role"
        ) ||
        name.includes(
          "get_my_role"
        ) ||
        name.includes(
          "current_user_role"
        )
      ) {

        return res.json({
          data:
            user.role,

          error: null
        });
      }

      if (
        name.includes(
          "get_profile"
        )
      ) {

        const [rows] =
          await db.execute(
            `
              SELECT
                public_id AS id,
                email,
                name,
                role,
                active
              FROM system_users
              WHERE id = ?
              LIMIT 1
            `,
            [
              user.systemId
            ]
          );

        return res.json({
          data:
            rows[0] ||
            null,

          error: null
        });
      }

      const [registered] =
        await db.execute(
          `
            SELECT 1
            FROM system_entity_registry
            WHERE entity_name = ?
              AND entity_type = 'rpc'
            LIMIT 1
          `,
          [
            req.params.name
          ]
        );

      if (
        !registered.length
      ) {

        return res
          .status(404)
          .json({
            data: null,
            error: {
              message:
                "rpc_not_registered"
            }
          });
      }

      return res
        .status(501)
        .json({
          data: null,
          error: {
            message:
              `RPC ${req.params.name} necessita conversao especifica`
          }
        });

    } catch (error) {

      console.error(
        "RPC ERROR:",
        error
      );

      return res
        .status(500)
        .json({
          data: null,
          error: {
            message:
              error?.message ||
              "rpc_failed"
          }
        });
    }
  }
);

export default router;

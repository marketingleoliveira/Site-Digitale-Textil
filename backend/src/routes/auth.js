import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

import { db } from "../database.js";
import { config } from "../config.js";
import { requireAuth } from "../middleware/auth.js";

const router =
  express.Router();

async function completeUser(
  systemUser
) {

  const [permissions] =
    await db.execute(
      `
        SELECT permission
        FROM system_permissions
        WHERE user_id = ?
      `,
      [
        systemUser.id
      ]
    );

  const [profiles] =
    await db.execute(
      `
        SELECT
          id,
          email,
          name,
          full_name,
          avatar_url,
          role,
          active
        FROM profiles
        WHERE id = ?
        LIMIT 1
      `,
      [
        systemUser.public_id
      ]
    );

  const [roles] =
    await db.execute(
      `
        SELECT role
        FROM user_roles
        WHERE user_id = ?
      `,
      [
        systemUser.public_id
      ]
    );

  return {
    id:
      systemUser.public_id,

    email:
      systemUser.email,

    role:
      systemUser.role,

    name:
      systemUser.name,

    profile:
      profiles[0] || null,

    roles:
      roles.map(
        item =>
          item.role
      ),

    permissions:
      permissions.map(
        item =>
          item.permission
      ),

    user_metadata: {
      name:
        systemUser.name,

      full_name:
        systemUser.name,

      role:
        systemUser.role
    },

    app_metadata: {
      role:
        systemUser.role,

      roles:
        roles.map(
          item =>
            item.role
        )
    }
  };
}

router.post(
  "/login",
  async (req, res) => {

    const email =
      String(
        req.body?.email || ""
      )
      .trim()
      .toLowerCase();

    const password =
      String(
        req.body?.password || ""
      );

    if (
      !email ||
      !password
    ) {

      return res
        .status(400)
        .json({
          error:
            "email_and_password_required"
        });
    }

    const [rows] =
      await db.execute(
        `
          SELECT
            id,
            public_id,
            email,
            password_hash,
            name,
            role,
            active
          FROM system_users
          WHERE email = ?
          LIMIT 1
        `,
        [email]
      );

    const systemUser =
      rows[0];

    if (
      !systemUser ||
      !systemUser.active
    ) {

      return res
        .status(401)
        .json({
          error:
            "invalid_credentials"
        });
    }

    const valid =
      await bcrypt.compare(
        password,
        systemUser.password_hash
      );

    if (!valid) {

      return res
        .status(401)
        .json({
          error:
            "invalid_credentials"
        });
    }

    const identity = {
      id:
        systemUser.public_id,

      systemId:
        systemUser.id,

      email:
        systemUser.email,

      role:
        systemUser.role,

      name:
        systemUser.name
    };

    const token =
      jwt.sign(
        identity,
        config.jwtSecret,
        {
          expiresIn:
            "12h"
        }
      );

    const user =
      await completeUser(
        systemUser
      );

    return res.json({
      token,
      user
    });
  }
);

router.get(
  "/me",
  requireAuth,
  async (req, res) => {

    const [rows] =
      await db.execute(
        `
          SELECT
            id,
            public_id,
            email,
            name,
            role,
            active
          FROM system_users
          WHERE id = ?
          LIMIT 1
        `,
        [
          req.user.systemId
        ]
      );

    if (!rows.length) {

      return res
        .status(404)
        .json({
          error:
            "user_not_found"
        });
    }

    const user =
      await completeUser(
        rows[0]
      );

    return res.json({
      user
    });
  }
);

router.get(
  "/permissions",
  requireAuth,
  async (req, res) => {

    const [permissions] =
      await db.execute(
        `
          SELECT permission
          FROM system_permissions
          WHERE user_id = ?
        `,
        [
          req.user.systemId
        ]
      );

    return res.json({
      role:
        req.user.role,

      permissions:
        permissions.map(
          item =>
            item.permission
        )
    });
  }
);

router.post(
  "/logout",
  (req, res) => {

    return res.json({
      ok: true
    });
  }
);

export default router;

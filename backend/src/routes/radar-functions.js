import express from "express";
import crypto from "crypto";

import { db } from "../database.js";

const router = express.Router();

function visitorId(req) {
  const bodyId = String(
    req.body?.visitor_id || ""
  ).trim();

  if (bodyId) {
    return bodyId.slice(0, 190);
  }

  const forwarded = String(
    req.headers["x-forwarded-for"] || ""
  )
    .split(",")[0]
    .trim();

  return (
    forwarded ||
    String(req.ip || "unknown")
  ).slice(0, 190);
}

async function columnsFor(table) {
  const [rows] = await db.execute(
    `
      SELECT
        COLUMN_NAME,
        IS_NULLABLE,
        COLUMN_DEFAULT
      FROM information_schema.columns
      WHERE table_schema = DATABASE()
        AND table_name = ?
    `,
    [table]
  );

  return new Map(
    rows.map((row) => [
      row.COLUMN_NAME,
      row
    ])
  );
}

async function insertLike(
  editionId,
  visitor
) {
  const columns =
    await columnsFor("radar_likes");

  const names = [
    "id",
    "edition_id",
    "ip_address"
  ];

  const values = [
    crypto.randomUUID(),
    editionId,
    visitor
  ];

  if (columns.has("data")) {
    names.push("data");

    values.push(
      JSON.stringify({
        edition_id: editionId,
        ip_address: visitor
      })
    );
  }

  const sql = `
    INSERT INTO radar_likes
      (
        ${names
          .map((name) => `\`${name}\``)
          .join(", ")}
      )
    VALUES (
      ${names.map(() => "?").join(", ")}
    )
  `;

  await db.execute(sql, values);
}

async function insertReaction(
  editionId,
  visitor,
  reaction
) {
  const columns =
    await columnsFor("radar_reactions");

  const names = [
    "id",
    "edition_id",
    "ip_address",
    "reaction"
  ];

  const values = [
    crypto.randomUUID(),
    editionId,
    visitor,
    reaction
  ];

  if (columns.has("data")) {
    names.push("data");

    values.push(
      JSON.stringify({
        edition_id: editionId,
        ip_address: visitor,
        reaction
      })
    );
  }

  const sql = `
    INSERT INTO radar_reactions
      (
        ${names
          .map((name) => `\`${name}\``)
          .join(", ")}
      )
    VALUES (
      ${names.map(() => "?").join(", ")}
    )
  `;

  await db.execute(sql, values);
}

router.post(
  "/radar-like",
  async (req, res) => {
    const editionId = String(
      req.body?.edition_id || ""
    ).trim();

    if (!editionId) {
      return res.status(400).json({
        error: "edition_id required"
      });
    }

    const visitor = visitorId(req);

    try {
      const [editionRows] =
        await db.execute(
          `
            SELECT id
            FROM radar_editions
            WHERE id = ?
            LIMIT 1
          `,
          [editionId]
        );

      if (!editionRows.length) {
        return res.status(404).json({
          error: "edition not found"
        });
      }

      const [existing] =
        await db.execute(
          `
            SELECT id
            FROM radar_likes
            WHERE edition_id = ?
              AND ip_address = ?
            LIMIT 1
          `,
          [
            editionId,
            visitor
          ]
        );

      let liked = false;

      if (existing.length) {
        await db.execute(
          `
            DELETE FROM radar_likes
            WHERE id = ?
          `,
          [existing[0].id]
        );

        await db.execute(
          `
            UPDATE radar_editions
            SET likes =
              GREATEST(
                COALESCE(likes, 0) - 1,
                0
              )
            WHERE id = ?
          `,
          [editionId]
        );
      } else {
        await insertLike(
          editionId,
          visitor
        );

        await db.execute(
          `
            UPDATE radar_editions
            SET likes =
              COALESCE(likes, 0) + 1
            WHERE id = ?
          `,
          [editionId]
        );

        liked = true;
      }

      const [rows] =
        await db.execute(
          `
            SELECT likes
            FROM radar_editions
            WHERE id = ?
            LIMIT 1
          `,
          [editionId]
        );

      return res.json({
        liked,
        likes: Number(
          rows[0]?.likes || 0
        )
      });
    } catch (error) {
      console.error(
        "RADAR_LIKE_ERROR",
        error
      );

      return res.status(500).json({
        error:
          error?.message ||
          "Erro ao processar curtida"
      });
    }
  }
);

router.post(
  "/radar-reaction",
  async (req, res) => {
    const editionId = String(
      req.body?.edition_id || ""
    ).trim();

    const reaction = String(
      req.body?.reaction || ""
    ).trim();

    if (
      !editionId ||
      !["happy", "sad"].includes(reaction)
    ) {
      return res.status(400).json({
        error:
          "invalid reaction"
      });
    }

    const visitor = visitorId(req);

    try {
      const [editionRows] =
        await db.execute(
          `
            SELECT id
            FROM radar_editions
            WHERE id = ?
            LIMIT 1
          `,
          [editionId]
        );

      if (!editionRows.length) {
        return res.status(404).json({
          error: "edition not found"
        });
      }

      const [existing] =
        await db.execute(
          `
            SELECT
              id,
              reaction
            FROM radar_reactions
            WHERE edition_id = ?
              AND ip_address = ?
            LIMIT 1
          `,
          [
            editionId,
            visitor
          ]
        );

      let selected = null;

      if (
        existing.length &&
        existing[0].reaction === reaction
      ) {
        await db.execute(
          `
            DELETE FROM radar_reactions
            WHERE id = ?
          `,
          [existing[0].id]
        );

        const field =
          reaction === "happy"
            ? "happy_count"
            : "sad_count";

        await db.execute(
          `
            UPDATE radar_editions
            SET \`${field}\` =
              GREATEST(
                COALESCE(
                  \`${field}\`,
                  0
                ) - 1,
                0
              )
            WHERE id = ?
          `,
          [editionId]
        );
      } else if (existing.length) {
        const previous =
          existing[0].reaction;

        const oldField =
          previous === "happy"
            ? "happy_count"
            : "sad_count";

        const newField =
          reaction === "happy"
            ? "happy_count"
            : "sad_count";

        await db.execute(
          `
            UPDATE radar_reactions
            SET reaction = ?
            WHERE id = ?
          `,
          [
            reaction,
            existing[0].id
          ]
        );

        await db.execute(
          `
            UPDATE radar_editions
            SET
              \`${oldField}\` =
                GREATEST(
                  COALESCE(
                    \`${oldField}\`,
                    0
                  ) - 1,
                  0
                ),
              \`${newField}\` =
                COALESCE(
                  \`${newField}\`,
                  0
                ) + 1
            WHERE id = ?
          `,
          [editionId]
        );

        selected = reaction;
      } else {
        await insertReaction(
          editionId,
          visitor,
          reaction
        );

        const field =
          reaction === "happy"
            ? "happy_count"
            : "sad_count";

        await db.execute(
          `
            UPDATE radar_editions
            SET \`${field}\` =
              COALESCE(
                \`${field}\`,
                0
              ) + 1
            WHERE id = ?
          `,
          [editionId]
        );

        selected = reaction;
      }

      const [rows] =
        await db.execute(
          `
            SELECT
              happy_count,
              sad_count
            FROM radar_editions
            WHERE id = ?
            LIMIT 1
          `,
          [editionId]
        );

      return res.json({
        reaction: selected,
        happy_count: Number(
          rows[0]?.happy_count || 0
        ),
        sad_count: Number(
          rows[0]?.sad_count || 0
        )
      });
    } catch (error) {
      console.error(
        "RADAR_REACTION_ERROR",
        error
      );

      return res.status(500).json({
        error:
          error?.message ||
          "Erro ao registrar reação"
      });
    }
  }
);

export default router;

import express from "express";
import crypto from "crypto";
import jwt from "jsonwebtoken";

import { db } from "../database.js";
import { config } from "../config.js";

const router =
  express.Router();

function auth(req) {
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

function parseJson(value) {
  if (
    value === null ||
    value === undefined
  ) {
    return null;
  }

  if (
    typeof value === "object"
  ) {
    return value;
  }

  try {
    return JSON.parse(
      value
    );
  } catch {
    return value;
  }
}

function normalize(row) {
  return {
    ...row,

    value:
      parseJson(
        row.value
      )
  };
}

function matches(
  row,
  filters = []
) {
  for (const filter of filters) {
    const column =
      filter.column;

    if (!column)
      continue;

    const value =
      row[column];

    switch (filter.type) {
      case "eq":
        if (
          value !=
          filter.value
        ) {
          return false;
        }
        break;

      case "neq":
        if (
          value ==
          filter.value
        ) {
          return false;
        }
        break;

      case "in":
        if (
          !Array.isArray(
            filter.value
          ) ||
          !filter.value.some(
            item =>
              item == value
          )
        ) {
          return false;
        }
        break;

      case "match":
        for (
          const [key, expected]
          of Object.entries(
            filter.value || {}
          )
        ) {
          if (
            row[key] !=
            expected
          ) {
            return false;
          }
        }
        break;
    }
  }

  return true;
}

async function tableColumns() {
  const [rows] =
    await db.query(`
      SELECT COLUMN_NAME AS name
      FROM information_schema.columns
      WHERE table_schema = DATABASE()
        AND table_name = 'site_settings'
    `);

  return new Set(
    rows.map(
      row => row.name
    )
  );
}

async function loadAll() {
  const [rows] =
    await db.query(`
      SELECT *
      FROM site_settings
      ORDER BY \`key\`
    `);

  return rows.map(
    normalize
  );
}

async function saveSetting(
  item
) {
  const key =
    String(
      item?.key || ""
    ).trim();

  if (!key) {
    throw new Error(
      "Chave da configuracao obrigatoria"
    );
  }

  const columns =
    await tableColumns();

  const value =
    item?.value === undefined
      ? null
      : item.value;

  const id =
    item?.id ||
    crypto.randomUUID();

  const legacyData = {
    id,
    key,
    value
  };

  /*
   * Primeiro tenta localizar pela key,
   * pois ela e o identificador natural
   * das configuracoes.
   */
  const [existing] =
    await db.execute(
      `
        SELECT id
        FROM site_settings
        WHERE \`key\` = ?
        LIMIT 1
      `,
      [key]
    );

  if (existing.length) {
    const fields = [
      "`value` = ?"
    ];

    const params = [
      JSON.stringify(value)
    ];

    if (
      columns.has("data")
    ) {
      fields.push(
        "`data` = ?"
      );

      params.push(
        JSON.stringify({
          ...legacyData,
          id:
            existing[0].id
        })
      );
    }

    if (
      columns.has(
        "updated_at"
      )
    ) {
      fields.push(
        "`updated_at` = CURRENT_TIMESTAMP"
      );
    }

    params.push(key);

    await db.execute(
      `
        UPDATE site_settings
        SET ${fields.join(", ")}
        WHERE \`key\` = ?
      `,
      params
    );

    return {
      id:
        existing[0].id,

      key,
      value
    };
  }

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

    params.push(id);
  }

  fields.push(
    "`key`",
    "`value`"
  );

  placeholders.push(
    "?",
    "?"
  );

  params.push(
    key,
    JSON.stringify(value)
  );

  if (
    columns.has("data")
  ) {
    fields.push(
      "`data`"
    );

    placeholders.push(
      "?"
    );

    params.push(
      JSON.stringify(
        legacyData
      )
    );
  }

  await db.execute(
    `
      INSERT INTO site_settings (
        ${fields.join(", ")}
      )
      VALUES (
        ${placeholders.join(", ")}
      )
    `,
    params
  );

  return {
    id,
    key,
    value
  };
}

/*
 * Intercepta somente site_settings.
 * Qualquer outra tabela continua na
 * API generica atual.
 */
router.post(
  "/query",
  async (
    req,
    res,
    next
  ) => {
    if (
      req.body?.table !==
      "site_settings"
    ) {
      return next();
    }

    try {
      const operation =
        req.body?.operation ||
        "select";

      const filters =
        req.body?.filters ||
        [];

      const payload =
        req.body?.payload;

      const single =
        req.body?.single;

      const limit =
        req.body?.limit;

      const range =
        req.body?.range;

      /*
       * SELECT pode ser usado pelo site
       * publico e pelo painel.
       */
      if (
        operation === "select"
      ) {
        let rows =
          await loadAll();

        rows =
          rows.filter(
            row =>
              matches(
                row,
                filters
              )
          );

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
          limit !== null &&
          limit !== undefined
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
            data:
              rows[0],

            error: null,
            count
          });
        }

        if (
          single ===
          "maybeSingle"
        ) {
          return res.json({
            data:
              rows[0] ||
              null,

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
       * Todas as alteracoes exigem login.
       */
      const user =
        auth(req);

      if (!user) {
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
        operation === "insert" ||
        operation === "upsert"
      ) {
        const records =
          Array.isArray(payload)
            ? payload
            : [payload];

        const saved = [];

        for (
          const item
          of records
        ) {
          saved.push(
            await saveSetting(
              item || {}
            )
          );
        }

        return res.json({
          data:
            Array.isArray(payload)
              ? saved
              : saved[0] || null,

          error: null,

          count:
            saved.length
        });
      }

      if (
        operation === "update"
      ) {
        let current =
          await loadAll();

        current =
          current.filter(
            row =>
              matches(
                row,
                filters
              )
          );

        const saved = [];

        /*
         * Caso o frontend envie update
         * por .eq("key", "...").
         */
        if (
          current.length
        ) {
          for (
            const row
            of current
          ) {
            saved.push(
              await saveSetting({
                ...row,
                ...(payload || {}),
                key:
                  payload?.key ||
                  row.key
              })
            );
          }

        } else {
          /*
           * Se nao existe ainda, mas temos
           * filtro por key, criamos.
           */
          const keyFilter =
            filters.find(
              item =>
                item.column ===
                  "key" &&
                item.type ===
                  "eq"
            );

          if (
            keyFilter
          ) {
            saved.push(
              await saveSetting({
                ...(payload || {}),
                key:
                  keyFilter.value
              })
            );
          }
        }

        return res.json({
          data: saved,
          error: null,
          count:
            saved.length
        });
      }

      if (
        operation === "delete"
      ) {
        let rows =
          await loadAll();

        rows =
          rows.filter(
            row =>
              matches(
                row,
                filters
              )
          );

        for (
          const row
          of rows
        ) {
          await db.execute(
            `
              DELETE FROM site_settings
              WHERE id = ?
            `,
            [row.id]
          );
        }

        return res.json({
          data: rows,
          error: null,
          count:
            rows.length
        });
      }

      return res
        .status(400)
        .json({
          data: null,
          error: {
            message:
              "Operacao de configuracao nao suportada"
          }
        });

    } catch (error) {
      console.error(
        "SITE SETTINGS:",
        error
      );

      return res
        .status(500)
        .json({
          data: null,
          error: {
            message:
              error?.message ||
              "Erro ao salvar configuracoes"
          }
        });
    }
  }
);

export default router;

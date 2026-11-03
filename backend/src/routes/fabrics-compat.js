import express from "express";

import { db } from "../database.js";

const router = express.Router();

const TARGETS = new Set([
  "fabric_categories",
  "fabrics",
  "fabric_category_assignments",
]);

const WRITE_OPERATIONS = new Set([
  "insert",
  "upsert",
  "update",
  "delete",
]);

function parseJson(value) {

  if (
    typeof value !== "string"
  ) {
    return value;
  }

  const trimmed =
    value.trim();

  if (
    !trimmed.startsWith("{") &&
    !trimmed.startsWith("[")
  ) {
    return value;
  }

  try {
    return JSON.parse(
      trimmed
    );
  } catch {
    return value;
  }
}


function normalizeRow(row) {

  const output = {
    ...row,
  };

  const legacy =
    parseJson(
      output.data
    );

  if (
    legacy &&
    typeof legacy === "object" &&
    !Array.isArray(legacy)
  ) {

    for (
      const [key, value]
      of Object.entries(legacy)
    ) {

      if (
        output[key] === null ||
        output[key] === undefined
      ) {
        output[key] =
          value;
      }
    }

    output.data =
      legacy;
  }

  const jsonFields = [
    "technologies",
    "gallery_images",
    "features",
    "colors",
    "applications",
    "fabrics",
  ];

  for (
    const field
    of jsonFields
  ) {

    if (
      Object.prototype
        .hasOwnProperty
        .call(
          output,
          field
        )
    ) {
      output[field] =
        parseJson(
          output[field]
        );
    }
  }

  const booleanFields = [
    "is_active",
    "featured",
    "is_featured",
  ];

  for (
    const field
    of booleanFields
  ) {

    if (
      output[field] === 1 ||
      output[field] === "1"
    ) {
      output[field] = true;
    }

    if (
      output[field] === 0 ||
      output[field] === "0"
    ) {
      output[field] = false;
    }
  }

  return output;
}


function getValue(
  object,
  path
) {

  if (!path) {
    return undefined;
  }

  return String(path)
    .split(".")
    .reduce(
      (current, key) =>
        current == null
          ? undefined
          : current[key],
      object
    );
}


function normalizeExpected(
  value
) {

  if (
    value === "true"
  ) return true;

  if (
    value === "false"
  ) return false;

  if (
    value === "null"
  ) return null;

  return value;
}


function compare(
  actual,
  operator,
  expected
) {

  expected =
    normalizeExpected(
      expected
    );

  switch (
    String(operator || "eq")
      .toLowerCase()
  ) {

    case "eq":

      return (
        actual == expected
      );

    case "neq":

      return (
        actual != expected
      );

    case "is":

      if (
        expected === null
      ) {
        return actual == null;
      }

      return (
        actual == expected
      );

    case "gt":

      return (
        Number(actual) >
        Number(expected)
      );

    case "gte":

      return (
        Number(actual) >=
        Number(expected)
      );

    case "lt":

      return (
        Number(actual) <
        Number(expected)
      );

    case "lte":

      return (
        Number(actual) <=
        Number(expected)
      );

    case "in": {

      let values =
        expected;

      if (
        typeof values === "string"
      ) {

        values =
          values
            .replace(
              /^\(/,
              ""
            )
            .replace(
              /\)$/,
              ""
            )
            .split(",")
            .map(
              value =>
                value.trim()
            );
      }

      if (
        !Array.isArray(values)
      ) {
        return false;
      }

      return values.some(
        value =>
          actual == value
      );
    }

    case "like":
    case "ilike": {

      const escaped =
        String(
          expected ?? ""
        )
          .replace(
            /[.+?^${}()|[\]\\]/g,
            "\\$&"
          )
          .replaceAll(
            "%",
            ".*"
          )
          .replaceAll(
            "_",
            "."
          );

      return new RegExp(
        "^" +
        escaped +
        "$",
        operator === "ilike"
          ? "i"
          : undefined
      ).test(
        String(
          actual ?? ""
        )
      );
    }

    case "contains":

      if (
        Array.isArray(actual) &&
        Array.isArray(expected)
      ) {

        return expected.every(
          wanted =>
            actual.some(
              current =>
                current == wanted
            )
        );
      }

      return String(
        actual ?? ""
      ).includes(
        String(
          expected ?? ""
        )
      );

    default:

      return true;
  }
}


function applyFilters(
  rows,
  filters
) {

  if (
    !Array.isArray(filters) ||
    !filters.length
  ) {
    return rows;
  }

  return rows.filter(
    row => {

      for (
        const filter
        of filters
      ) {

        if (
          !filter ||
          typeof filter !== "object"
        ) {
          continue;
        }

        if (
          filter.type === "match"
        ) {

          for (
            const [key, value]
            of Object.entries(
              filter.value || {}
            )
          ) {

            if (
              getValue(
                row,
                key
              ) != value
            ) {
              return false;
            }
          }

          continue;
        }

        if (
          filter.type === "or"
        ) {

          const clauses =
            String(
              filter.expression || ""
            )
              .split(",");

          const ok =
            clauses.some(
              clause => {

                const parts =
                  clause.split(".");

                if (
                  parts.length < 3
                ) {
                  return false;
                }

                const column =
                  parts.shift();

                const operator =
                  parts.shift();

                const value =
                  parts.join(".");

                return compare(
                  getValue(
                    row,
                    column
                  ),
                  operator,
                  value
                );
              }
            );

          if (!ok) {
            return false;
          }

          continue;
        }

        if (
          filter.type === "not"
        ) {

          if (
            compare(
              getValue(
                row,
                filter.column
              ),
              filter.operator,
              filter.value
            )
          ) {
            return false;
          }

          continue;
        }

        if (
          !compare(
            getValue(
              row,
              filter.column
            ),
            filter.type,
            filter.value
          )
        ) {
          return false;
        }
      }

      return true;
    }
  );
}


function applyOrders(
  rows,
  body
) {

  let orders = [];

  if (
    Array.isArray(
      body.orders
    )
  ) {
    orders =
      body.orders;
  }

  if (
    !orders.length &&
    body.order &&
    typeof body.order === "object"
  ) {
    orders = [
      body.order,
    ];
  }

  if (
    !orders.length
  ) {
    return rows;
  }

  return [
    ...rows,
  ].sort(
    (a, b) => {

      for (
        const order
        of orders
      ) {

        const column =
          order.column ||
          order.field;

        if (!column) {
          continue;
        }

        const av =
          getValue(
            a,
            column
          );

        const bv =
          getValue(
            b,
            column
          );

        if (av == bv) {
          continue;
        }

        const direction =
          order.ascending === false
            ? -1
            : 1;

        if (
          av === null ||
          av === undefined
        ) {
          return 1 * direction;
        }

        if (
          bv === null ||
          bv === undefined
        ) {
          return -1 * direction;
        }

        const an =
          Number(av);

        const bn =
          Number(bv);

        if (
          Number.isFinite(an) &&
          Number.isFinite(bn)
        ) {
          return (
            an < bn
              ? -1
              : 1
          ) * direction;
        }

        return (
          String(av)
            .localeCompare(
              String(bv),
              "pt-BR"
            )
          * direction
        );
      }

      return 0;
    }
  );
}


function applyRange(
  rows,
  body
) {

  let result =
    rows;

  if (
    body.range &&
    typeof body.range === "object"
  ) {

    const from =
      Number(
        body.range.from ?? 0
      );

    const to =
      Number(
        body.range.to
      );

    if (
      Number.isFinite(from) &&
      Number.isFinite(to)
    ) {

      result =
        result.slice(
          from,
          to + 1
        );
    }
  }

  if (
    Number.isFinite(
      Number(
        body.limit
      )
    ) &&
    Number(body.limit) >= 0
  ) {

    result =
      result.slice(
        0,
        Number(
          body.limit
        )
      );
  }

  return result;
}


async function loadCatalog(
  publicRequest
) {

  const [
    categoryResult,
    fabricResult,
    assignmentResult,
  ] =
    await Promise.all([
      db.query(`
        SELECT *
        FROM fabric_categories
        ORDER BY
          display_order,
          name
      `),

      db.query(`
        SELECT *
        FROM fabrics

        WHERE
          name IS NOT NULL
          AND slug IS NOT NULL

          AND (
            category_id IS NOT NULL
            OR is_active IS NOT NULL
            OR display_order IS NOT NULL
            OR image_url IS NOT NULL
          )

        ORDER BY
          display_order,
          name
      `),

      db.query(`
        SELECT *
        FROM fabric_category_assignments
      `),
    ]);

  const categories =
    categoryResult[0]
      .map(
        normalizeRow
      );

  let fabrics =
    fabricResult[0]
      .map(
        normalizeRow
      );

  /*
   * Os registros sem categoria, status,
   * ordem e imagem são cópias incompletas
   * deixadas pela primeira importação.
   *
   * Eles permanecem no MySQL, mas não
   * entram no catálogo público.
   */

  fabrics =
    fabrics.filter(
      fabric =>
        (
          fabric.category_id != null
          || fabric.is_active != null
          || fabric.display_order != null
          || fabric.image_url != null
        )
    );



  /* DIGITALE_PUBLIC_ACTIVE_FABRICS_START */

  /*
   * No site publico entram somente
   * tecidos explicitamente ativos.
   *
   * Isso remove Córsega e Velocity,
   * que estao cadastrados com
   * is_active = false.
   */
  if (
    publicRequest
  ) {

    fabrics =
      fabrics.filter(
        fabric =>
          fabric.is_active === true
      );
  }

  /* DIGITALE_PUBLIC_ACTIVE_FABRICS_END */

  const categoryById =
    new Map(
      categories.map(
        category => [
          String(category.id),
          category,
        ]
      )
    );

  const baseFabricById =
    new Map(
      fabrics.map(
        fabric => [
          String(fabric.id),
          fabric,
        ]
      )
    );

  /*
   * Fonte de verdade para múltiplas categorias:
   * fabric_category_assignments.
   *
   * Relações órfãs e duplicadas da importação
   * antiga são descartadas. category_id fica
   * apenas como fallback para tecidos que ainda
   * não possuem nenhuma associação explícita.
   */
  const assignments = [];
  const seenAssignments =
    new Set();

  for (
    const raw
    of assignmentResult[0]
      .map(normalizeRow)
  ) {

    const fabric =
      baseFabricById.get(
        String(raw.fabric_id)
      );

    const category =
      categoryById.get(
        String(raw.category_id)
      );

    if (
      !fabric ||
      !category
    ) {
      continue;
    }

    const key =
      String(raw.fabric_id) +
      ":" +
      String(raw.category_id);

    if (
      seenAssignments.has(key)
    ) {
      continue;
    }

    seenAssignments.add(key);

    assignments.push({
      ...raw,
      fabric_id:
        fabric.id,
      category_id:
        category.id,
    });
  }

  const assignedFabricIds =
    new Set(
      assignments.map(
        assignment =>
          String(
            assignment.fabric_id
          )
      )
    );

  for (
    const fabric
    of fabrics
  ) {

    if (
      assignedFabricIds.has(
        String(fabric.id)
      )
    ) {
      continue;
    }

    if (
      !fabric.category_id ||
      !categoryById.has(
        String(
          fabric.category_id
        )
      )
    ) {
      continue;
    }

    const key =
      String(fabric.id) +
      ":" +
      String(fabric.category_id);

    if (
      seenAssignments.has(key)
    ) {
      continue;
    }

    seenAssignments.add(key);

    assignments.push({
      id: key,
      fabric_id:
        fabric.id,
      category_id:
        fabric.category_id,
    });
  }

  const assignmentsByFabric =
    new Map();

  for (
    const assignment
    of assignments
  ) {

    const key =
      String(
        assignment.fabric_id
      );

    if (
      !assignmentsByFabric.has(key)
    ) {
      assignmentsByFabric.set(
        key,
        []
      );
    }

    assignmentsByFabric
      .get(key)
      .push({
        id:
          assignment.id,
        fabric_id:
          assignment.fabric_id,
        category_id:
          assignment.category_id,
      });
  }

  const hydratedFabrics =
    fabrics.map(
      fabric => {

        const category =
          categoryById.get(
            String(
              fabric.category_id
            )
          ) || null;

        return {
          ...fabric,

          fabric_category_assignments:
            assignmentsByFabric.get(
              String(fabric.id)
            ) || [],

          fabric_categories:
            category,

          category:
            category,
        };
      }
    );

  const fabricById =
    new Map(
      hydratedFabrics.map(
        fabric => [
          String(fabric.id),
          fabric,
        ]
      )
    );

  for (
    const assignment
    of assignments
  ) {

    const fabric =
      fabricById.get(
        String(
          assignment.fabric_id
        )
      ) || null;

    const category =
      categoryById.get(
        String(
          assignment.category_id
        )
      ) || null;

    assignment.fabrics =
      fabric;

    assignment.fabric =
      fabric;

    assignment.fabric_categories =
      category;

    assignment.category =
      category;
  }

  const assignmentsByCategory =
    new Map();

  for (
    const assignment
    of assignments
  ) {

    const key =
      String(
        assignment.category_id
      );

    if (
      !assignmentsByCategory.has(
        key
      )
    ) {

      assignmentsByCategory.set(
        key,
        []
      );
    }

    assignmentsByCategory
      .get(key)
      .push(
        assignment
      );
  }

  const hydratedCategories =
    categories.map(
      category => {

        const categoryAssignments =
          assignmentsByCategory.get(
            String(
              category.id
            )
          ) || [];

        const categoryFabrics =
          categoryAssignments
            .map(
              assignment =>
                assignment.fabrics
            );

        return {
          ...category,

          fabrics:
            categoryFabrics,

          fabric_category_assignments:
            categoryAssignments,

          fabric_count:
            categoryFabrics.length,

          fabrics_count:
            categoryFabrics.length,
        };
      }
    );

  return {
    categories:
      hydratedCategories,

    fabrics:
      hydratedFabrics,

    assignments,

    fabricById,
  };
}


router.post(
  "/query",
  async (
    req,
    res,
    next
  ) => {

    const body =
      req.body || {};

    const table =
      String(
        body.table || ""
      );

    if (
      !TARGETS.has(
        table
      )
    ) {
      return next();
    }

    const operation =
      String(
        body.operation
        || body.action
        || body.query_type
        || body.queryType
        || ""
      )
        .toLowerCase();

    if (
      WRITE_OPERATIONS.has(
        operation
      )
    ) {
      return next();
    }

    try {

      const authorization =
        String(
          req.headers.authorization || ""
        );

      const publicRequest =
        !authorization.startsWith(
          "Bearer "
        );

      const catalog =
        await loadCatalog(
          publicRequest
        );

      let rows;

      switch (table) {

        case "fabric_categories":

          rows =
            catalog.categories;

          break;

        case "fabrics":

          rows =
            catalog.fabrics;

          break;

        case "fabric_category_assignments":

          rows =
            catalog.assignments;

          break;

        default:

          return next();
      }

      rows =
        applyFilters(
          rows,
          body.filters
        );

      rows =
        applyOrders(
          rows,
          body
        );

      const count =
        rows.length;

      rows =
        applyRange(
          rows,
          body
        );

      const wantsSingle =
        body.single === true
        || body.mode === "single"
        || body.return === "single";

      const wantsMaybeSingle =
        body.maybeSingle === true
        || body.mode === "maybeSingle";

      let data =
        rows;

      if (
        wantsSingle ||
        wantsMaybeSingle
      ) {

        data =
          rows[0] || null;
      }

      if (
        body.head === true
      ) {
        data = null;
      }

      return res.json({
        data,
        error: null,
        count,
      });

    } catch (error) {

      console.error(
        "FABRICS_COMPAT_ERROR",
        error
      );

      return res
        .status(500)
        .json({
          data: null,

          error: {
            message:
              error.message
              || "Erro ao carregar tecidos",
          },
        });
    }
  }
);


export default router;

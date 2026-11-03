import fs from "fs";
import path from "path";
import crypto from "crypto";

import { db } from "../src/database.js";

const PROJECT =
  "/var/www/Site-Digitale-Textil";

const UPLOADS =
  "/var/lib/site-digitale-textil/uploads";

const ROOTS = [
  UPLOADS,
  "/tmp/digitale-media-recovery",
  "/var/www",
  "/root",
  "/home"
];

const extensions =
  new Set([
    ".jpg",
    ".jpeg",
    ".png",
    ".webp",
    ".gif",
    ".svg",
    ".avif",
    ".bmp",
    ".tif",
    ".tiff",

    ".mp4",
    ".webm",
    ".mov",

    ".pdf"
  ]);

const ignoredDirs =
  new Set([
    "node_modules",
    ".git",
    "dist",
    ".cache",
    ".npm",
    "proc",
    "sys",
    "dev"
  ]);

const byBasename =
  new Map();

let indexedFiles = 0;

function indexFile(file) {

  const ext =
    path.extname(file)
      .toLowerCase();

  if (
    !extensions.has(ext)
  ) {
    return;
  }

  const basename =
    path.basename(file)
      .toLowerCase();

  if (
    !byBasename.has(
      basename
    )
  ) {
    byBasename.set(
      basename,
      []
    );
  }

  byBasename.get(
    basename
  ).push(file);

  indexedFiles++;
}


function walk(dir) {

  if (
    !fs.existsSync(dir)
  ) {
    return;
  }

  let entries;

  try {

    entries =
      fs.readdirSync(
        dir,
        {
          withFileTypes: true
        }
      );

  } catch {

    return;
  }

  for (
    const entry
    of entries
  ) {

    if (
      entry.isDirectory() &&
      ignoredDirs.has(
        entry.name
      )
    ) {
      continue;
    }

    const full =
      path.join(
        dir,
        entry.name
      );

    if (
      entry.isDirectory()
    ) {

      walk(full);

    } else if (
      entry.isFile()
    ) {

      indexFile(full);
    }
  }
}


console.log(
  "INDEXANDO_ARQUIVOS=SIM"
);

for (
  const root
  of ROOTS
) {

  walk(root);
}

console.log(
  "ARQUIVOS_INDEXADOS=" +
  indexedFiles
);


/*
 * --------------------------------------------------
 * URL / PATH
 * --------------------------------------------------
 */

function decode(value) {

  try {
    return decodeURIComponent(
      value
    );
  } catch {
    return value;
  }
}


function cleanRelative(value) {

  value =
    value
      .replace(
        /^\/+/,
        ""
      )
      .replace(
        /\\/g,
        "/"
      );

  const parts =
    value
      .split("/")
      .filter(
        part =>
          part &&
          part !== "." &&
          part !== ".."
      );

  return parts.join("/");
}


function mediaPathFromUrl(value) {

  if (
    typeof value !==
    "string"
  ) {
    return null;
  }

  const original =
    value.trim();

  if (!original)
    return null;

  let decoded =
    decode(original);

  /*
   * Supabase:
   *
   * /storage/v1/object/public/Bucket/path/file.jpg
   */
  let match =
    decoded.match(
      /\/storage\/v1\/object\/public\/([^?#]+)/i
    );

  if (match) {

    return cleanRelative(
      match[1]
    );
  }

  /*
   * Supabase signed/object URL.
   */
  match =
    decoded.match(
      /\/storage\/v1\/object\/(?:sign|authenticated)\/([^?#]+)/i
    );

  if (match) {

    return cleanRelative(
      match[1]
    );
  }

  /*
   * Nova URL local.
   */
  match =
    decoded.match(
      /\/uploads\/([^?#]+)/i
    );

  if (match) {

    return cleanRelative(
      match[1]
    );
  }

  /*
   * Caminho simples salvo no banco.
   */
  try {

    const parsed =
      new URL(decoded);

    decoded =
      parsed.pathname;

  } catch {}

  const ext =
    path.extname(
      decoded
        .split("?")[0]
        .split("#")[0]
    )
    .toLowerCase();

  if (
    extensions.has(ext)
  ) {

    return cleanRelative(
      decoded
        .split("?")[0]
        .split("#")[0]
    );
  }

  return null;
}


function commonTailScore(
  candidate,
  desired
) {

  const a =
    candidate
      .replace(
        /\\/g,
        "/"
      )
      .toLowerCase()
      .split("/")
      .filter(Boolean);

  const b =
    desired
      .replace(
        /\\/g,
        "/"
      )
      .toLowerCase()
      .split("/")
      .filter(Boolean);

  let score = 0;

  for (
    let i = 1;
    i <= Math.min(
      a.length,
      b.length
    );
    i++
  ) {

    if (
      a[a.length - i] ===
      b[b.length - i]
    ) {

      score +=
        10 * i;

    } else {

      break;
    }
  }

  return score;
}


function findCandidate(
  desired
) {

  const target =
    path.join(
      UPLOADS,
      desired
    );

  if (
    fs.existsSync(
      target
    ) &&
    fs.statSync(target)
      .isFile()
  ) {

    return {
      source:
        target,

      target,

      already:
        true
    };
  }

  const basename =
    path.basename(
      desired
    )
    .toLowerCase();

  const candidates =
    byBasename.get(
      basename
    ) || [];

  if (!candidates.length) {
    return null;
  }

  const scored =
    candidates
      .map(
        file => ({
          file,

          score:
            commonTailScore(
              file,
              desired
            )
        })
      )
      .sort(
        (a, b) =>
          b.score -
          a.score
      );

  const source =
    scored[0].file;

  return {
    source,
    target,
    already:
      false
  };
}


let copied = 0;
let repaired = 0;
let unresolved = 0;

const unresolvedValues =
  new Set();


function ensureMedia(value) {

  const desired =
    mediaPathFromUrl(
      value
    );

  if (!desired) {
    return value;
  }

  const located =
    findCandidate(
      desired
    );

  if (!located) {

    /*
     * Segunda tentativa:
     * somente pelo nome.
     */
    const base =
      path.basename(
        desired
      );

    const fallback =
      byBasename.get(
        base.toLowerCase()
      );

    if (
      !fallback ||
      !fallback.length
    ) {

      unresolved++;

      unresolvedValues.add(
        value
      );

      return value;
    }

    const safe =
      cleanRelative(
        "recovered/" +
        base
      );

    const target =
      path.join(
        UPLOADS,
        safe
      );

    fs.mkdirSync(
      path.dirname(
        target
      ),
      {
        recursive: true
      }
    );

    if (
      !fs.existsSync(
        target
      )
    ) {

      fs.copyFileSync(
        fallback[0],
        target
      );

      copied++;
    }

    repaired++;

    return (
      "/uploads/" +
      safe
    );
  }

  fs.mkdirSync(
    path.dirname(
      located.target
    ),
    {
      recursive: true
    }
  );

  if (
    !located.already &&
    path.resolve(
      located.source
    ) !==
    path.resolve(
      located.target
    )
  ) {

    fs.copyFileSync(
      located.source,
      located.target
    );

    copied++;
  }

  repaired++;

  return (
    "/uploads/" +
    desired
  );
}


function rewriteDeep(value) {

  if (
    Array.isArray(value)
  ) {

    return value.map(
      rewriteDeep
    );
  }

  if (
    value &&
    typeof value ===
      "object"
  ) {

    const output = {};

    for (
      const [key, item]
      of Object.entries(
        value
      )
    ) {

      output[key] =
        rewriteDeep(
          item
        );
    }

    return output;
  }

  if (
    typeof value !==
      "string"
  ) {

    return value;
  }

  const trimmed =
    value.trim();

  /*
   * JSON armazenado como TEXT.
   */
  if (
    (
      trimmed.startsWith(
        "{"
      ) &&
      trimmed.endsWith(
        "}"
      )
    ) ||
    (
      trimmed.startsWith(
        "["
      ) &&
      trimmed.endsWith(
        "]"
      )
    )
  ) {

    try {

      const parsed =
        JSON.parse(
          trimmed
        );

      return JSON.stringify(
        rewriteDeep(
          parsed
        )
      );

    } catch {}
  }

  /*
   * Nao mexer em URLs externas normais.
   */
  if (
    /^https?:\/\//i.test(
      value
    ) &&
    !/supabase|storage\/v1\/object/i
      .test(value)
  ) {

    return value;
  }

  return ensureMedia(
    value
  );
}


/*
 * --------------------------------------------------
 * MYSQL
 * --------------------------------------------------
 */

const [mediaColumns] =
  await db.query(`
    SELECT
      TABLE_NAME AS table_name,
      COLUMN_NAME AS column_name,
      DATA_TYPE AS data_type

    FROM information_schema.columns

    WHERE table_schema =
      DATABASE()

      AND TABLE_NAME NOT LIKE
        'system_%'

      AND (
        DATA_TYPE = 'json'

        OR COLUMN_NAME REGEXP
          '(url|image|photo|gallery|file|resume|avatar|icon)'

        OR (
          TABLE_NAME =
            'site_settings'
          AND COLUMN_NAME =
            'value'
        )
      )

    ORDER BY
      TABLE_NAME,
      ORDINAL_POSITION
  `);

const grouped =
  new Map();

for (
  const column
  of mediaColumns
) {

  if (
    !grouped.has(
      column.table_name
    )
  ) {

    grouped.set(
      column.table_name,
      []
    );
  }

  grouped.get(
    column.table_name
  ).push(
    column
  );
}


let mysqlUpdates = 0;


for (
  const [
    table,
    columns
  ]
  of grouped
) {

  const [pkRows] =
    await db.execute(
      `
        SELECT
          COLUMN_NAME AS name

        FROM information_schema.key_column_usage

        WHERE table_schema =
          DATABASE()

          AND table_name = ?

          AND constraint_name =
            'PRIMARY'

        ORDER BY
          ORDINAL_POSITION
      `,
      [table]
    );

  let pk =
    pkRows[0]?.name;

  if (!pk) {

    const [idExists] =
      await db.execute(
        `
          SELECT COLUMN_NAME
          FROM information_schema.columns
          WHERE table_schema =
            DATABASE()
            AND table_name = ?
            AND COLUMN_NAME =
              'id'
          LIMIT 1
        `,
        [table]
      );

    if (
      idExists.length
    ) {

      pk = "id";
    }
  }

  if (!pk) {

    console.log(
      "SEM_PRIMARY_KEY=" +
      table
    );

    continue;
  }

  const selected =
    [
      "`" +
      pk +
      "`"
    ];

  for (
    const column
    of columns
  ) {

    if (
      column.column_name ===
      pk
    ) {
      continue;
    }

    selected.push(
      "`" +
      column.column_name +
      "`"
    );
  }

  const [rows] =
    await db.query(
      `
        SELECT
          ${selected.join(", ")}

        FROM \`${table}\`
      `
    );

  let tableUpdates = 0;

  for (
    const row
    of rows
  ) {

    const sets = [];
    const params = [];

    for (
      const column
      of columns
    ) {

      const name =
        column.column_name;

      if (
        name === pk
      ) {
        continue;
      }

      const before =
        row[name];

      if (
        before === null ||
        before === undefined
      ) {
        continue;
      }

      let after;

      if (
        column.data_type ===
          "json"
      ) {

        let parsed =
          before;

        if (
          typeof parsed ===
            "string"
        ) {

          try {

            parsed =
              JSON.parse(
                parsed
              );

          } catch {

            continue;
          }
        }

        after =
          JSON.stringify(
            rewriteDeep(
              parsed
            )
          );

        const beforeString =
          typeof before ===
            "string"
            ? before
            : JSON.stringify(
                before
              );

        if (
          after ===
          beforeString
        ) {

          continue;
        }

      } else {

        after =
          rewriteDeep(
            before
          );

        if (
          after === before
        ) {

          continue;
        }
      }

      sets.push(
        "`" +
        name +
        "` = ?"
      );

      params.push(
        after
      );
    }

    if (!sets.length) {
      continue;
    }

    params.push(
      row[pk]
    );

    await db.execute(
      `
        UPDATE \`${table}\`

        SET
          ${sets.join(", ")}

        WHERE
          \`${pk}\` = ?
      `,
      params
    );

    mysqlUpdates++;
    tableUpdates++;
  }

  if (
    tableUpdates
  ) {

    console.log(
      `TABELA_CORRIGIDA=${table}:${tableUpdates}`
    );
  }
}


/*
 * --------------------------------------------------
 * URLs SUPABASE DIRETAMENTE NO FRONTEND
 * --------------------------------------------------
 */

const sourceExtensions =
  new Set([
    ".ts",
    ".tsx",
    ".js",
    ".jsx",
    ".css",
    ".html"
  ]);

let sourceUpdates = 0;

function repairSourceFile(
  file
) {

  let text;

  try {

    text =
      fs.readFileSync(
        file,
        "utf8"
      );

  } catch {

    return;
  }

  const original =
    text;

  text =
    text.replace(
      /https?:\/\/[^"'`\s)]+\/storage\/v1\/object\/public\/[^"'`\s)]+/gi,
      match =>
        ensureMedia(
          match
        )
    );

  if (
    text !== original
  ) {

    fs.writeFileSync(
      file,
      text
    );

    sourceUpdates++;

    console.log(
      "SOURCE_CORRIGIDO=" +
      file
    );
  }
}


function walkSource(
  dir
) {

  if (
    !fs.existsSync(
      dir
    )
  ) {
    return;
  }

  const entries =
    fs.readdirSync(
      dir,
      {
        withFileTypes: true
      }
    );

  for (
    const entry
    of entries
  ) {

    const full =
      path.join(
        dir,
        entry.name
      );

    if (
      entry.isDirectory()
    ) {

      if (
        entry.name ===
          "node_modules" ||
        entry.name ===
          ".git" ||
        entry.name ===
          "dist"
      ) {

        continue;
      }

      walkSource(full);

    } else if (
      sourceExtensions.has(
        path.extname(
          entry.name
        ).toLowerCase()
      )
    ) {

      repairSourceFile(
        full
      );
    }
  }
}


walkSource(
  path.join(
    PROJECT,
    "src"
  )
);


console.log("");
console.log(
  "ARQUIVOS_COPIADOS=" +
  copied
);

console.log(
  "REFERENCIAS_REPARADAS=" +
  repaired
);

console.log(
  "REGISTROS_MYSQL_ATUALIZADOS=" +
  mysqlUpdates
);

console.log(
  "ARQUIVOS_FRONTEND_ATUALIZADOS=" +
  sourceUpdates
);

console.log(
  "REFERENCIAS_NAO_ENCONTRADAS=" +
  unresolvedValues.size
);


if (
  unresolvedValues.size
) {

  console.log("");
  console.log(
    "=== MIDIAS AINDA NAO LOCALIZADAS ==="
  );

  let count = 0;

  for (
    const value
    of unresolvedValues
  ) {

    console.log(
      "NAO_ENCONTRADA=" +
      value
    );

    count++;

    if (
      count >= 30
    ) {
      break;
    }
  }
}


await db.end();

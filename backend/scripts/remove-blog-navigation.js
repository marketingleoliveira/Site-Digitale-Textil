import { db } from "../src/database.js";

function destination(item) {
  if (
    !item ||
    typeof item !== "object" ||
    Array.isArray(item)
  ) {
    return "";
  }

  return String(
    item.href ??
    item.to ??
    item.path ??
    item.url ??
    ""
  )
    .trim()
    .toLowerCase();
}

function label(item) {
  if (
    !item ||
    typeof item !== "object" ||
    Array.isArray(item)
  ) {
    return "";
  }

  return String(
    item.label ??
    item.name ??
    item.title ??
    item.text ??
    ""
  )
    .trim()
    .toLowerCase();
}

function isBlogMenuItem(item) {

  if (
    !item ||
    typeof item !== "object" ||
    Array.isArray(item)
  ) {
    return false;
  }

  const dest =
    destination(item);

  const name =
    label(item);

  return (
    name === "blog" &&
    (
      dest === "/blog" ||
      dest === "/blog/" ||
      dest.endsWith("/blog")
    )
  );
}

function clean(value) {

  if (Array.isArray(value)) {

    return value
      .filter(
        item =>
          !isBlogMenuItem(item)
      )
      .map(clean);
  }

  if (
    value &&
    typeof value === "object"
  ) {

    const output = {};

    for (
      const [key, item]
      of Object.entries(value)
    ) {

      output[key] =
        clean(item);
    }

    return output;
  }

  return value;
}

const [rows] =
  await db.query(`
    SELECT
      id,
      \`key\`,
      \`value\`
    FROM site_settings
  `);

let changed = 0;

for (const row of rows) {

  let value =
    row.value;

  let originalString;

  if (
    typeof value === "string"
  ) {

    originalString =
      value;

    try {
      value =
        JSON.parse(value);
    } catch {
      continue;
    }

  } else {

    originalString =
      JSON.stringify(value);
  }

  const cleaned =
    clean(value);

  const cleanedString =
    JSON.stringify(cleaned);

  if (
    cleanedString ===
    originalString
  ) {
    continue;
  }

  await db.execute(
    `
      UPDATE site_settings
      SET
        \`value\` = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `,
    [
      cleanedString,
      row.id
    ]
  );

  console.log(
    "SETTING_CORRIGIDO=" +
    row.key
  );

  changed++;
}

console.log(
  "SETTINGS_ALTERADOS=" +
  changed
);

await db.end();

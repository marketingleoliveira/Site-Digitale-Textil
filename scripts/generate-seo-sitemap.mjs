import fs from "node:fs/promises";
import path from "node:path";

import {
  fileURLToPath
} from "node:url";


const BASE =
  "https://digitaletextil.com.br";


const QUERY_URL =
  "http://127.0.0.1:8116/api/data/query";


const ROOT =
  path.resolve(
    path.dirname(
      fileURLToPath(
        import.meta.url
      )
    ),
    ".."
  );


const PUBLIC_SITEMAP =
  path.join(
    ROOT,
    "public",
    "sitemap.xml"
  );


const DIST_SITEMAP =
  path.join(
    ROOT,
    "dist",
    "sitemap.xml"
  );


function rowsFrom(
  payload
) {

  if (
    Array.isArray(payload)
  ) {
    return payload;
  }


  if (
    Array.isArray(payload?.data)
  ) {
    return payload.data;
  }


  return [];
}


async function query(
  table,
  columns,
  filters = [],
  orders = []
) {

  /*
   * IMPORTANTE:
   * Não enviar limit:null,
   * range:null,
   * single:null ou head:false.
   */

  const body = {
    table,
    operation:
      "select",
    columns,
    filters,
    orders
  };


  const response =
    await fetch(
      QUERY_URL,
      {
        method:
          "POST",

        headers: {
          "Content-Type":
            "application/json",

          Accept:
            "application/json"
        },

        body:
          JSON.stringify(body)
      }
    );


  if (!response.ok) {

    throw new Error(
      `${table}_HTTP_${response.status}`
    );
  }


  const payload =
    await response.json();


  if (payload?.error) {

    throw new Error(
      payload.error?.message
      ||
      String(payload.error)
    );
  }


  return rowsFrom(payload);
}


function escapeXml(
  value
) {

  return String(
    value ?? ""
  )
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}


function dateOnly(
  value
) {

  if (value) {

    const date =
      new Date(value);


    if (
      !Number.isNaN(
        date.getTime()
      )
    ) {

      return date
        .toISOString()
        .slice(0, 10);
    }
  }


  return new Date()
    .toISOString()
    .slice(0, 10);
}


function absoluteImage(
  value
) {

  if (!value) {
    return null;
  }


  const text =
    String(value).trim();


  if (
    /^https?:\/\//i.test(text)
  ) {
    return text;
  }


  return (
    BASE
    +
    (
      text.startsWith("/")
        ? text
        : `/${text}`
    )
  );
}


function entry({
  loc,
  priority,
  changefreq,
  lastmod,
  image,
  imageTitle
}) {

  const lines = [
    "  <url>",
    `    <loc>${escapeXml(loc)}</loc>`,
    `    <lastmod>${escapeXml(lastmod)}</lastmod>`,
    `    <changefreq>${escapeXml(changefreq)}</changefreq>`,
    `    <priority>${escapeXml(priority)}</priority>`
  ];


  if (image) {

    lines.push(
      "    <image:image>"
    );

    lines.push(
      `      <image:loc>${escapeXml(image)}</image:loc>`
    );


    if (imageTitle) {

      lines.push(
        `      <image:title>${escapeXml(imageTitle)}</image:title>`
      );
    }


    lines.push(
      "    </image:image>"
    );
  }


  lines.push(
    "  </url>"
  );


  return lines.join("\n");
}


async function atomicWrite(
  file,
  contents
) {

  await fs.mkdir(
    path.dirname(file),
    {
      recursive: true
    }
  );


  const temp =
    `${file}.tmp-${process.pid}`;


  await fs.writeFile(
    temp,
    contents,
    "utf8"
  );


  await fs.rename(
    temp,
    file
  );
}


const today =
  dateOnly();


const entries = [];


const fixedPages = [

  ["/", "1.0", "weekly"],

  ["/tecidos", "0.9", "daily"],

  ["/atacado", "0.9", "weekly"],

  [
    "/tecido-fitness-atacado",
    "0.9",
    "weekly"
  ],

  [
    "/tecido-poliamida-atacado",
    "0.9",
    "weekly"
  ],

  [
    "/tecido-moda-praia-atacado",
    "0.9",
    "weekly"
  ],

  ["/segmentos", "0.8", "weekly"],

  ["/tecnologias", "0.8", "weekly"],

  [
    "/sustentabilidade",
    "0.7",
    "monthly"
  ],

  ["/sobre", "0.7", "monthly"],

  ["/contato", "0.7", "monthly"],

  ["/estampas", "0.7", "weekly"],

  [
    "/estampas/catalogo",
    "0.6",
    "weekly"
  ],

  [
    "/radar-digitale",
    "0.6",
    "weekly"
  ],

  [
    "/depoimentos",
    "0.5",
    "monthly"
  ],

  [
    "/politica-de-privacidade",
    "0.3",
    "yearly"
  ]
];


for (
  const [
    route,
    priority,
    changefreq
  ]
  of fixedPages
) {

  entries.push(
    entry({
      loc:
        `${BASE}${route}`,

      priority,

      changefreq,

      lastmod:
        today
    })
  );
}


const fabrics =
  await query(
    "fabrics",

    "*, fabric_category_assignments(category_id)",

    [
      {
        type:
          "eq",

        column:
          "is_active",

        value:
          true
      }
    ],

    [
      {
        column:
          "display_order",

        ascending:
          true
      }
    ]
  );


if (
  fabrics.length < 1
) {

  throw new Error(
    "NENHUM_TECIDO_ATIVO"
  );
}


const seen =
  new Set();


let fabricCount = 0;


for (
  const fabric
  of fabrics
) {

  const slug =
    String(
      fabric?.slug
      || ""
    ).trim();


  if (
    !slug
    ||
    seen.has(slug)
  ) {

    continue;
  }


  seen.add(slug);


  entries.push(
    entry({

      loc:
        `${BASE}/tecidos/${encodeURIComponent(slug)}`,

      priority:
        "0.9",

      changefreq:
        "weekly",

      lastmod:
        dateOnly(
          fabric.updated_at
          ||
          fabric.created_at
        ),

      image:
        absoluteImage(
          fabric.image_url
        ),

      imageTitle:
        fabric.name
          ?
            `Tecido ${fabric.name} - Digitale Têxtil`
          :
            undefined
    })
  );


  fabricCount++;
}


if (
  fabricCount < 1
) {

  throw new Error(
    "TECIDOS_SEM_SLUG"
  );
}


const xml = [
  '<?xml version="1.0" encoding="UTF-8"?>',

  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">',

  ...entries,

  "</urlset>",

  ""
].join("\n");


await atomicWrite(
  PUBLIC_SITEMAP,
  xml
);


await atomicWrite(
  DIST_SITEMAP,
  xml
);


console.log(
  `SITEMAP_TOTAL=${entries.length}`
);

console.log(
  `TECIDOS_ATIVOS=${fabricCount}`
);

console.log(
  "SITEMAP_WRITE=OK"
);

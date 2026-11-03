import {
  db
} from "./database.js";


function normalize(
  value
) {
  return String(
    value ?? ""
  )
    .trim();
}


function digits(
  value
) {
  return normalize(value)
    .replace(
      /\D/g,
      ""
    );
}


function recursiveFind(
  object,
  names,
  depth = 0
) {

  if (
    !object
    ||
    typeof object !== "object"
    ||
    depth > 5
  ) {
    return "";
  }

  for (
    const [
      key,
      value
    ] of Object.entries(
      object
    )
  ) {

    if (
      names.includes(
        key.toLowerCase()
      )
      &&
      value !== null
      &&
      value !== undefined
      &&
      typeof value !== "object"
    ) {

      return normalize(
        value
      );
    }
  }


  for (
    const value
    of Object.values(
      object
    )
  ) {

    if (
      value
      &&
      typeof value ===
        "object"
    ) {

      const found =
        recursiveFind(
          value,
          names,
          depth + 1
        );

      if (found) {
        return found;
      }
    }
  }

  return "";
}


function validCnpj(
  input
) {

  const cnpj =
    digits(input);

  if (
    cnpj.length !== 14
  ) {
    return false;
  }

  if (
    /^(\d)\1{13}$/.test(
      cnpj
    )
  ) {
    return false;
  }


  const calc =
    base => {

      let factor =
        base.length - 7;

      let total = 0;

      for (
        const char of base
      ) {

        total +=
          Number(char)
          *
          factor--;

        if (
          factor < 2
        ) {
          factor = 9;
        }
      }

      const mod =
        total % 11;

      return (
        mod < 2
          ? 0
          : 11 - mod
      );
    };


  const d1 =
    calc(
      cnpj.slice(
        0,
        12
      )
    );

  const d2 =
    calc(
      cnpj.slice(
        0,
        12
      )
      +
      d1
    );

  return (
    Number(cnpj[12]) === d1
    &&
    Number(cnpj[13]) === d2
  );
}


function analyzeLead({
  name,
  company,
  email,
  phone,
  cnpj
}) {

  let score = 0;

  const reasons = [];


  const add = (
    points,
    reason
  ) => {

    score += points;

    reasons.push(
      reason
    );
  };


  const placeholder =
    /\b(?:teste|test|asdf|qwerty|fake|falso|nao sei|não sei|xxx+|aaaa+|bbbb+|empresa teste|sem empresa)\b/i;


  const allText = [
    name,
    company,
    email,
    phone,
    cnpj
  ].join(" ");


  /*
   * CNPJ
   */
  if (
    cnpj
    &&
    !validCnpj(
      cnpj
    )
  ) {

    add(
      3,
      "CNPJ inválido"
    );
  }


  /*
   * E-mail
   */
  if (
    email
    &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i
      .test(email)
  ) {

    add(
      3,
      "E-mail inválido"
    );
  }


  const domain =
    email.includes("@")
      ? email
          .split("@")
          .pop()
          .toLowerCase()
      : "";


  const disposableDomains =
    [
      "mailinator.com",
      "tempmail.com",
      "10minutemail.com",
      "guerrillamail.com",
      "yopmail.com",
      "trashmail.com",
      "fakeinbox.com"
    ];


  if (
    disposableDomains.includes(
      domain
    )
  ) {

    add(
      3,
      "E-mail temporário"
    );
  }


  /*
   * Telefone
   */
  const phoneDigits =
    digits(phone);


  if (
    phone
    &&
    (
      phoneDigits.length < 10
      ||
      phoneDigits.length > 13
    )
  ) {

    add(
      2,
      "Telefone incompatível"
    );
  }


  if (
    phoneDigits
    &&
    /^(\d)\1+$/.test(
      phoneDigits
    )
  ) {

    add(
      3,
      "Telefone repetitivo"
    );
  }


  /*
   * Nome
   */
  if (
    name
    &&
    (
      name.length < 3
      ||
      !/[a-záàâãéèêíïóôõöúç]/i
        .test(name)
    )
  ) {

    add(
      2,
      "Nome inconsistente"
    );
  }


  if (
    name
    &&
    /^[a-z]{9,}$/i.test(
      name.replace(
        /\s/g,
        ""
      )
    )
    &&
    !/\s/.test(name)
  ) {

    const vowels =
      (
        name.match(
          /[aeiouáéíóúãõ]/gi
        )
        ||
        []
      ).length;

    if (
      vowels /
      name.length
      <
      0.15
    ) {

      add(
        2,
        "Nome com padrão aleatório"
      );
    }
  }


  /*
   * Empresa
   */
  if (
    company
    &&
    company.length < 2
  ) {

    add(
      1,
      "Empresa inconsistente"
    );
  }


  /*
   * Valores típicos usados
   * apenas para pular formulário
   */
  if (
    placeholder.test(
      allText
    )
  ) {

    add(
      3,
      "Dados de teste ou preenchimento artificial"
    );
  }


  /*
   * Valores repetidos entre
   * campos distintos.
   */
  const comparable =
    [
      name,
      company,
      email
        .split("@")[0],
      phoneDigits,
      digits(cnpj)
    ]
      .map(
        value =>
          normalize(
            value
          )
            .toLowerCase()
      )
      .filter(
        value =>
          value.length >= 4
      );


  const unique =
    new Set(
      comparable
    );


  if (
    comparable.length >= 3
    &&
    unique.size <=
      comparable.length - 2
  ) {

    add(
      2,
      "Múltiplos campos repetidos"
    );
  }


  /*
   * Só classifica como falso
   * com vários sinais.
   */
  const fake =
    score >= 6;


  return {
    fake,
    score,
    reasons
  };
}


export async function
trackingPrecheckMiddleware(
  req,
  res,
  next
) {

  if (
    req.method !==
      "POST"
    ||
    !req.body
  ) {

    return next();
  }


  const visitorKey =
    recursiveFind(
      req.body,
      [
        "visitor_key",
        "visitorkey",
        "visitor_id",
        "visitorid"
      ]
    );


  const email =
    recursiveFind(
      req.body,
      [
        "lead_email",
        "email",
        "e-mail"
      ]
    );


  const phone =
    recursiveFind(
      req.body,
      [
        "lead_phone",
        "phone",
        "telefone",
        "whatsapp",
        "whats_app"
      ]
    );


  const cnpj =
    recursiveFind(
      req.body,
      [
        "lead_cnpj",
        "cnpj"
      ]
    );


  const company =
    recursiveFind(
      req.body,
      [
        "lead_company",
        "company",
        "empresa"
      ]
    );


  const name =
    recursiveFind(
      req.body,
      [
        "lead_name",
        "contact_name",
        "nome"
      ]
    );


  /*
   * Não analisa eventos comuns
   * de navegação.
   */
  const contactFields =
    [
      name,
      company,
      email,
      phone,
      cnpj
    ]
      .filter(Boolean)
      .length;


  if (
    !visitorKey
    ||
    contactFields < 3
  ) {

    return next();
  }


  const analysis =
    analyzeLead({
      name,
      company,
      email,
      phone,
      cnpj
    });


  /*
   * O tracking original continua
   * respondendo normalmente.
   */
  res.on(
    "finish",
    async () => {

      try {

        await db.execute(
          `
            UPDATE tracking_visitors

            SET
              lead_quality = ?,

              lead_fake_score = ?,

              lead_fake_reasons = ?,

              lead_precheck_at =
                NOW(6)

            WHERE
              visitor_key = ?
          `,
          [
            analysis.fake
              ? "falso"
              : "consistente",

            analysis.score,

            analysis.reasons.length
              ? JSON.stringify(
                  analysis.reasons
                )
              : null,

            visitorKey
          ]
        );


        if (
          analysis.fake
        ) {

          console.log(
            "LEAD_PRECHECK=FALSO",
            visitorKey,
            analysis.score,
            analysis.reasons
              .join(" | ")
          );

        } else {

          console.log(
            "LEAD_PRECHECK=CONSISTENTE",
            visitorKey,
            analysis.score
          );
        }

      } catch (error) {

        console.error(
          "LEAD PRECHECK:",
          error
        );
      }
    }
  );


  next();
}

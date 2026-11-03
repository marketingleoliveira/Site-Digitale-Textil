import crypto from "crypto";
import { db } from "../src/database.js";

async function columnExists(table, column) {
  const [rows] = await db.execute(
    `
      SELECT
        IS_NULLABLE AS nullable,
        DATA_TYPE AS type
      FROM information_schema.columns
      WHERE table_schema = DATABASE()
        AND table_name = ?
        AND column_name = ?
      LIMIT 1
    `,
    [table, column]
  );

  return rows[0] || null;
}

/*
 * O campo data veio da camada JSON temporaria
 * da primeira conversao.
 *
 * Agora as tabelas possuem colunas nativas,
 * portanto data nao pode impedir INSERTs.
 */
for (
  const table of [
    "permissions",
    "role_permissions",
    "user_roles",
    "profiles"
  ]
) {
  const dataColumn =
    await columnExists(
      table,
      "data"
    );

  if (
    dataColumn &&
    dataColumn.nullable === "NO"
  ) {
    await db.query(
      `
        ALTER TABLE \`${table}\`
        MODIFY COLUMN data JSON NULL
      `
    );

    console.log(
      `DATA_NULLABLE=${table}`
    );
  }
}

const permissions = [
  {
    name: "Gerenciar tecidos",
    category: "Conteúdo",
    description: "Criar, editar e remover tecidos."
  },
  {
    name: "Gerenciar categorias de tecidos",
    category: "Conteúdo",
    description: "Administrar categorias e organização dos tecidos."
  },
  {
    name: "Gerenciar estampas",
    category: "Conteúdo",
    description: "Criar, editar e remover estampas."
  },
  {
    name: "Gerenciar categorias de estampas",
    category: "Conteúdo",
    description: "Administrar categorias de estampas."
  },
  {
    name: "Gerenciar tecnologias",
    category: "Conteúdo",
    description: "Criar e editar tecnologias da Digitale."
  },
  {
    name: "Gerenciar segmentos",
    category: "Conteúdo",
    description: "Administrar segmentos do site."
  },
  {
    name: "Gerenciar banners e carrossel",
    category: "Conteúdo",
    description: "Administrar imagens e slides do carrossel."
  },
  {
    name: "Gerenciar depoimentos",
    category: "Conteúdo",
    description: "Criar, editar e publicar depoimentos."
  },

  {
    name: "Gerenciar blog",
    category: "Blog",
    description: "Criar, editar e publicar matérias do blog."
  },
  {
    name: "Gerenciar categorias do blog",
    category: "Blog",
    description: "Administrar categorias das publicações."
  },

  {
    name: "Gerenciar Radar Digitale",
    category: "Radar Digitale",
    description: "Criar, editar e publicar edições do Radar Digitale."
  },
  {
    name: "Gerenciar categorias do Radar",
    category: "Radar Digitale",
    description: "Administrar categorias do Radar Digitale."
  },
  {
    name: "Visualizar sugestões do Radar",
    category: "Radar Digitale",
    description: "Visualizar sugestões de temas enviadas pelo site."
  },

  {
    name: "Visualizar leads de tecidos",
    category: "Comercial",
    description: "Visualizar contatos interessados nos tecidos."
  },
  {
    name: "Gerenciar leads de tecidos",
    category: "Comercial",
    description: "Alterar status e administrar leads comerciais."
  },
  {
    name: "Visualizar contatos",
    category: "Comercial",
    description: "Visualizar formulários de contato enviados pelo site."
  },
  {
    name: "Gerenciar contatos",
    category: "Comercial",
    description: "Alterar status e administrar contatos recebidos."
  },

  {
    name: "Visualizar newsletter",
    category: "Newsletter",
    description: "Visualizar inscritos na newsletter."
  },
  {
    name: "Gerenciar newsletter",
    category: "Newsletter",
    description: "Administrar inscritos e status da newsletter."
  },

  {
    name: "Gerenciar vagas",
    category: "RH",
    description: "Criar, editar, ativar e remover vagas."
  },
  {
    name: "Visualizar candidaturas",
    category: "RH",
    description: "Visualizar candidatos e currículos enviados."
  },
  {
    name: "Gerenciar candidaturas",
    category: "RH",
    description: "Alterar status e administrar candidaturas."
  },

  {
    name: "Gerenciar configurações do site",
    category: "Sistema",
    description: "Alterar configurações gerais do site."
  },
  {
    name: "Gerenciar usuários",
    category: "Sistema",
    description: "Criar, editar e desativar usuários do painel."
  },
  {
    name: "Gerenciar permissões",
    category: "Sistema",
    description: "Definir permissões dos cargos Redator e Vendedor."
  }
];

const [columns] =
  await db.query(`
    SELECT COLUMN_NAME AS name
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'permissions'
  `);

const schema =
  new Set(
    columns.map(
      item => item.name
    )
  );

for (
  const permission
  of permissions
) {
  const [existing] =
    await db.execute(
      `
        SELECT id
        FROM permissions
        WHERE name = ?
        LIMIT 1
      `,
      [permission.name]
    );

  if (existing.length) {
    const id =
      existing[0].id;

    await db.execute(
      `
        UPDATE permissions
        SET
          category = ?,
          description = ?,
          data = ?
        WHERE id = ?
      `,
      [
        permission.category,
        permission.description,
        JSON.stringify({
          id,
          ...permission
        }),
        id
      ]
    );

    continue;
  }

  const id =
    crypto.randomUUID();

  const fields = [
    "`id`",
    "`name`",
    "`category`",
    "`description`"
  ];

  const placeholders = [
    "?",
    "?",
    "?",
    "?"
  ];

  const values = [
    id,
    permission.name,
    permission.category,
    permission.description
  ];

  if (
    schema.has("data")
  ) {
    fields.push(
      "`data`"
    );

    placeholders.push(
      "?"
    );

    values.push(
      JSON.stringify({
        id,
        ...permission
      })
    );
  }

  await db.execute(
    `
      INSERT INTO permissions (
        ${fields.join(", ")}
      )
      VALUES (
        ${placeholders.join(", ")}
      )
    `,
    values
  );
}

/*
 * Mantemos Desenvolvedor/Admin com acesso total.
 * Redator e Vendedor ficam configuraveis pela tela.
 */
const [admins] =
  await db.query(`
    SELECT
      id,
      public_id
    FROM system_users
    WHERE role = 'admin'
      AND active = 1
  `);

for (
  const admin
  of admins
) {
  await db.execute(
    `
      INSERT IGNORE
      INTO system_permissions (
        user_id,
        permission
      )
      VALUES (?, '*')
    `,
    [admin.id]
  );

  const [role] =
    await db.execute(
      `
        SELECT id
        FROM user_roles
        WHERE user_id = ?
          AND role = 'admin'
        LIMIT 1
      `,
      [admin.public_id]
    );

  if (!role.length) {
    await db.execute(
      `
        INSERT INTO user_roles (
          id,
          user_id,
          role,
          data
        )
        VALUES (?, ?, 'admin', ?)
      `,
      [
        crypto.randomUUID(),
        admin.public_id,
        JSON.stringify({
          user_id:
            admin.public_id,
          role:
            "admin"
        })
      ]
    );
  }
}

const [total] =
  await db.query(`
    SELECT COUNT(*) AS total
    FROM permissions
  `);

console.log(
  "PERMISSOES_CADASTRADAS=" +
  total[0].total
);

const [list] =
  await db.query(`
    SELECT
      category,
      name
    FROM permissions
    ORDER BY
      category,
      name
  `);

for (
  const permission
  of list
) {
  console.log(
    `PERMISSAO=${permission.category} > ${permission.name}`
  );
}

await db.end();

console.log(
  "SCHEMA_PERMISSOES=OK"
);

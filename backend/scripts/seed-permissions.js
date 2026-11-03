import crypto from "crypto";
import { db } from "../src/database.js";

const permissions = [
  // CONTEUDO
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

  // BLOG
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

  // RADAR
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

  // COMERCIAL
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

  // NEWSLETTER
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

  // RH
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

  // CONFIGURAÇÕES
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

const [columns] = await db.query(`
  SELECT COLUMN_NAME AS name
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'permissions'
`);

const available =
  new Set(
    columns.map(
      item => item.name
    )
  );

if (!available.has("name")) {
  throw new Error(
    "Tabela permissions nao possui coluna name."
  );
}

for (const permission of permissions) {

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

    const fields = [];
    const values = [];

    if (
      available.has(
        "category"
      )
    ) {
      fields.push(
        "`category` = ?"
      );

      values.push(
        permission.category
      );
    }

    if (
      available.has(
        "description"
      )
    ) {
      fields.push(
        "`description` = ?"
      );

      values.push(
        permission.description
      );
    }

    if (fields.length) {
      values.push(
        existing[0].id
      );

      await db.execute(
        `
          UPDATE permissions
          SET ${fields.join(", ")}
          WHERE id = ?
        `,
        values
      );
    }

    continue;
  }

  const fields = [];
  const placeholders = [];
  const values = [];

  if (
    available.has("id")
  ) {
    fields.push("`id`");
    placeholders.push("?");
    values.push(
      crypto.randomUUID()
    );
  }

  fields.push("`name`");
  placeholders.push("?");
  values.push(
    permission.name
  );

  if (
    available.has(
      "category"
    )
  ) {
    fields.push(
      "`category`"
    );

    placeholders.push(
      "?"
    );

    values.push(
      permission.category
    );
  }

  if (
    available.has(
      "description"
    )
  ) {
    fields.push(
      "`description`"
    );

    placeholders.push(
      "?"
    );

    values.push(
      permission.description
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
 * Não concedemos nada automaticamente
 * a redator/vendedor.
 *
 * As escolhas serão feitas pela tela
 * /admin/permissions.
 *
 * Desenvolvedor/admin continua com
 * acesso total pela lógica do sistema.
 */

const [total] =
  await db.query(`
    SELECT COUNT(*) AS total
    FROM permissions
  `);

console.log(
  "PERMISSOES_CADASTRADAS=" +
  total[0].total
);

await db.end();

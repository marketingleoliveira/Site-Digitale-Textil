
// Tipos da autenticação local do Site Digitale.
// Apenas declarações TypeScript: não alteram o login.
export type User = {
  id: string;
  email?: string;
  [key: string]: any;
};

export type Session = {
  access_token: string;
  user: User;
  [key: string]: any;
};

const API = "/api";

type Filter = {
  type: string;
  column?: string;
  value?: any;
  operator?: string;
  expression?: string;
};

type Order = {
  column: string;
  ascending: boolean;
};

function readStoredSession() {
  try {
    const raw =
      localStorage.getItem(
        "digitale-auth"
      );

    return raw
      ? JSON.parse(raw)
      : null;
  } catch {
    return null;
  }
}

function authHeaders() {
  const session =
    readStoredSession();

  const headers:
    Record<string, string> = {
      "Content-Type":
        "application/json"
    };

  if (session?.access_token) {
    headers.Authorization =
      `Bearer ${session.access_token}`;
  }

  return headers;
}

class QueryBuilder {

  private table: string;

  private operation =
    "select";

  private payload: any =
    null;

  private columns =
    "*";

  private filters:
    Filter[] = [];

  private orders:
    Order[] = [];

  private limitValue:
    number | null = null;

  private rangeValue:
    [number, number] | null =
      null;

  private singleValue:
    string | null = null;

  private headValue =
    false;

  constructor(table: string) {
    this.table = table;
  }

  select(
    columns = "*",
    options?: {
      count?: string;
      head?: boolean;
    }
  ) {
    this.columns =
      columns || "*";

    if (
      this.operation ===
      "select"
    ) {
      this.operation =
        "select";
    }

    this.headValue =
      Boolean(
        options?.head
      );

    return this;
  }

  insert(values: any) {
    this.operation =
      "insert";

    this.payload =
      values;

    return this;
  }

  upsert(
    values: any,
    _options?: any
  ) {
    this.operation =
      "upsert";

    this.payload =
      values;

    return this;
  }

  update(values: any) {
    this.operation =
      "update";

    this.payload =
      values;

    return this;
  }

  delete(_options?: any) {
    this.operation =
      "delete";

    return this;
  }

  eq(
    column: string,
    value: any
  ) {
    this.filters.push({
      type: "eq",
      column,
      value
    });

    return this;
  }

  neq(
    column: string,
    value: any
  ) {
    this.filters.push({
      type: "neq",
      column,
      value
    });

    return this;
  }

  gt(
    column: string,
    value: any
  ) {
    this.filters.push({
      type: "gt",
      column,
      value
    });

    return this;
  }

  gte(
    column: string,
    value: any
  ) {
    this.filters.push({
      type: "gte",
      column,
      value
    });

    return this;
  }

  lt(
    column: string,
    value: any
  ) {
    this.filters.push({
      type: "lt",
      column,
      value
    });

    return this;
  }

  lte(
    column: string,
    value: any
  ) {
    this.filters.push({
      type: "lte",
      column,
      value
    });

    return this;
  }

  is(
    column: string,
    value: any
  ) {
    this.filters.push({
      type: "is",
      column,
      value
    });

    return this;
  }

  in(
    column: string,
    value: any[]
  ) {
    this.filters.push({
      type: "in",
      column,
      value
    });

    return this;
  }

  like(
    column: string,
    value: any
  ) {
    this.filters.push({
      type: "like",
      column,
      value
    });

    return this;
  }

  ilike(
    column: string,
    value: any
  ) {
    this.filters.push({
      type: "ilike",
      column,
      value
    });

    return this;
  }

  contains(
    column: string,
    value: any
  ) {
    this.filters.push({
      type: "contains",
      column,
      value
    });

    return this;
  }

  match(value: any) {
    this.filters.push({
      type: "match",
      value
    });

    return this;
  }

  not(
    column: string,
    operator: string,
    value: any
  ) {
    this.filters.push({
      type: "not",
      column,
      operator,
      value
    });

    return this;
  }

  or(expression: string) {
    this.filters.push({
      type: "or",
      expression
    });

    return this;
  }

  filter(
    column: string,
    operator: string,
    value: any
  ) {
    this.filters.push({
      type: operator,
      column,
      value
    });

    return this;
  }

  order(
    column: string,
    options?: {
      ascending?: boolean;
    }
  ) {
    this.orders.push({
      column,
      ascending:
        options?.ascending !== false
    });

    return this;
  }

  limit(value: number) {
    this.limitValue =
      value;

    return this;
  }

  range(
    from: number,
    to: number
  ) {
    this.rangeValue =
      [from, to];

    return this;
  }

  single() {
    this.singleValue =
      "single";

    return this.execute();
  }

  maybeSingle() {
    this.singleValue =
      "maybeSingle";

    return this.execute();
  }

  returns<T>() {
    return this as any;
  }

  async execute() {

    try {

      const response =
        await fetch(
          `${API}/data/query`,
          {
            method: "POST",
            headers:
              authHeaders(),

            body:
              JSON.stringify({
                table:
                  this.table,

                operation:
                  this.operation,

                payload:
                  this.payload,

                columns:
                  this.columns,

                filters:
                  this.filters,

                orders:
                  this.orders,

                limit:
                  this.limitValue,

                range:
                  this.rangeValue,

                single:
                  this.singleValue,

                head:
                  this.headValue
              })
          }
        );

      const result =
        await response.json();

      return result;

    } catch (error: any) {

      return {
        data: null,
        error: {
          message:
            error?.message ||
            "api_unavailable"
        },
        count: null
      };
    }
  }

  then(
    resolve: any,
    reject: any
  ) {
    return this.execute()
      .then(
        resolve,
        reject
      );
  }
}

type AuthListener = (event: string, session: any) => void | Promise<void>;
const authListeners = new Set<AuthListener>();
let sessionValidation: Promise<any> | null = null;

function notifyAuth(event: string, session: any) {
  for (const listener of authListeners) {
    queueMicrotask(() => {
      if (!authListeners.has(listener)) return;
      try {
        Promise.resolve(listener(event, session)).catch(() => {
          console.error("Não foi possível atualizar o estado da autenticação.");
        });
      } catch {
        console.error("Não foi possível atualizar o estado da autenticação.");
      }
    });
  }
}

const auth = {

  async signInWithPassword({
    email,
    password
  }: {
    email: string;
    password: string;
  }) {

    try {

      const response =
        await fetch(
          `${API}/auth/login`,
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json"
            },
            body:
              JSON.stringify({
                email,
                password
              })
          }
        );

      const result =
        await response.json();

      if (!response.ok) {
        return {
          data: {
            user: null,
            session: null
          },
          error:
            result
        };
      }

      const session = {
        access_token:
          result.token,
        token_type:
          "bearer",
        user:
          result.user
      };

      localStorage.setItem(
        "digitale-auth",
        JSON.stringify(session)
      );

      notifyAuth("SIGNED_IN", session);

      return {
        data: {
          user:
            result.user,
          session
        },
        error: null
      };

    } catch (error) {

      return {
        data: {
          user: null,
          session: null
        },
        error
      };
    }
  },

  async signOut() {

    localStorage.removeItem(
      "digitale-auth"
    );

    notifyAuth("SIGNED_OUT", null);

    return {
      error: null
    };
  },

  async getSession() {

    const session =
      readStoredSession();

    if (!session?.access_token) {
      return { data: { session: null }, error: null };
    }

    // A stored token may have expired while the site was closed. Validate it
    // before restoring the user, sharing simultaneous startup requests.
    if (!sessionValidation) {
      sessionValidation = auth.refreshSession({ notify: false }).finally(() => {
        sessionValidation = null;
      });
    }
    return sessionValidation;
  },

  async refreshSession({ notify = true }: { notify?: boolean } = {}) {
    const session =
      readStoredSession();

    if (!session?.access_token) {
      return {
        data: {
          session: null
        },
        error: null
      };
    }

    try {
      const response =
        await fetch(
          `${API}/auth/me`,
          {
            headers:
              authHeaders()
          }
        );

      const result =
        await response.json();

      // A late response must not restore a logged-out user or replace a login
      // completed while this request was in flight.
      const current = readStoredSession();
      if (current?.access_token !== session.access_token) {
        return { data: { session: current }, error: null };
      }

      if (!response.ok) {
        if (response.status === 401) {
          localStorage.removeItem(
            "digitale-auth"
          );

          notifyAuth("SIGNED_OUT", null);
        }

        return {
          data: {
            session: null
          },
          error:
            result
        };
      }

      const refreshed = {
        ...session,
        user:
          result.user
      };

      localStorage.setItem(
        "digitale-auth",
        JSON.stringify(refreshed)
      );

      if (notify) notifyAuth("TOKEN_REFRESHED", refreshed);

      return {
        data: {
          session: refreshed
        },
        error: null
      };
    } catch (error) {
      return {
        data: {
          session
        },
        error
      };
    }
  },

  async getUser() {

    const session =
      readStoredSession();

    if (!session?.access_token) {
      return {
        data: {
          user: null
        },
        error: null
      };
    }

    try {

      const response =
        await fetch(
          `${API}/auth/me`,
          {
            headers:
              authHeaders()
          }
        );

      const result =
        await response.json();

      if (!response.ok) {
        return {
          data: {
            user: null
          },
          error:
            result
        };
      }

      return {
        data: {
          user:
            result.user
        },
        error: null
      };

    } catch (error) {

      return {
        data: {
          user: null
        },
        error
      };
    }
  },

  onAuthStateChange(
    callback: AuthListener
  ) {
    authListeners.add(callback);

    queueMicrotask(async () => {
      const { data: { session } } = await auth.getSession();
      if (authListeners.has(callback)) {
        callback("INITIAL_SESSION", session);
      }
    });

    return {
      data: {
        subscription: {
          unsubscribe() {
            authListeners.delete(callback);
          }
        }
      }
    };
  },

  async signUp(_params: any) {
    return {
      data: null,
      error: {
        message:
          "Cadastro publico ainda nao configurado."
      }
    };
  },

  async resetPasswordForEmail(
    _email: string,
    _options?: any
  ) {
    return {
      data: null,
      error: {
        message:
          "Recuperacao de senha ainda nao configurada."
      }
    };
  },

  async updateUser(
    _attributes: any
  ) {
    return {
      data: null,
      error: {
        message:
          "Atualizacao de usuario ainda nao configurada."
      }
    };
  }
};

const storage = {

  from(bucket: string) {

    return {

      async upload(
        filePath: string,
        file: File | Blob,
        _options?: any
      ) {

        const form =
          new FormData();

        form.append(
          "file",
          file
        );

        form.append(
          "path",
          filePath
        );

        const session =
          readStoredSession();

        const headers:
          Record<string, string> = {};

        if (
          session?.access_token
        ) {
          headers.Authorization =
            `Bearer ${session.access_token}`;
        }

        try {

          const response =
            await fetch(
              `${API}/storage/${encodeURIComponent(bucket)}/upload`,
              {
                method: "POST",
                headers,
                body: form
              }
            );

          return await response.json();

        } catch (error) {

          return {
            data: null,
            error
          };
        }
      },

      getPublicUrl(
        filePath: string
      ) {

        const clean =
          String(filePath)
            .replace(/^\/+/, "");

        return {
          data: {
            publicUrl:
              `${window.location.origin}/uploads/${bucket}/${clean}`
          }
        };
      },

      async remove(
        paths: string[]
      ) {

        try {

          const response =
            await fetch(
              `${API}/storage/${encodeURIComponent(bucket)}`,
              {
                method:
                  "DELETE",

                headers:
                  authHeaders(),

                body:
                  JSON.stringify({
                    paths
                  })
              }
            );

          return await response.json();

        } catch (error) {

          return {
            data: null,
            error
          };
        }
      },

      async list(
        folder = "",
        _options?: any
      ) {

        try {

          const response =
            await fetch(
              `${API}/storage/${encodeURIComponent(bucket)}/list?path=${encodeURIComponent(folder)}`
            );

          return await response.json();

        } catch (error) {

          return {
            data: null,
            error
          };
        }
      },

      async download(
        filePath: string
      ) {

        try {

          const clean =
            String(filePath)
              .replace(/^\/+/, "");

          const response =
            await fetch(
              `/uploads/${bucket}/${clean}`
            );

          if (!response.ok) {
            return {
              data: null,
              error: {
                message:
                  "download_failed"
              }
            };
          }

          return {
            data:
              await response.blob(),
            error: null
          };

        } catch (error) {

          return {
            data: null,
            error
          };
        }
      }
    };
  }
};

const functions = {

  async invoke(
    name: string,
    options?: {
      body?: any;
    }
  ) {

    try {

      const response =
        await fetch(
          `${API}/functions/${encodeURIComponent(name)}`,
          {
            method:
              "POST",

            headers:
              authHeaders(),

            body:
              JSON.stringify(
                options?.body ??
                {}
              )
          }
        );

      return await response.json();

    } catch (error) {

      return {
        data: null,
        error
      };
    }
  }
};

function channel(_name: string) {

  const object: any = {

    on() {
      return object;
    },

    subscribe(
      callback?: Function
    ) {

      if (callback) {
        queueMicrotask(() =>
          callback(
            "SUBSCRIBED"
          )
        );
      }

      return object;
    },

    unsubscribe() {
      return Promise.resolve(
        "ok"
      );
    }
  };

  return object;
}

export const supabase: any = {

  from(table: string) {
    return new QueryBuilder(
      table
    );
  },

  auth,

  storage,

  functions,

  async rpc(
    name: string,
    args?: any
  ) {

    try {

      const response =
        await fetch(
          `${API}/rpc/${encodeURIComponent(name)}`,
          {
            method:
              "POST",

            headers:
              authHeaders(),

            body:
              JSON.stringify(
                args ?? {}
              )
          }
        );

      return await response.json();

    } catch (error) {

      return {
        data: null,
        error
      };
    }
  },

  channel,

  async removeChannel(
    _channel: any
  ) {
    return "ok";
  }
};


/* DIGITALE_FABRICS_MYSQL_START */

/*
 * Compatibilidade local para o catalogo de tecidos.
 *
 * O projeto nao usa mais Supabase como banco.
 * Estas tres tabelas sao lidas diretamente
 * da API Node/MySQL da VPS.
 *
 * Operacoes de escrita continuam usando
 * a implementacao original para preservar
 * o painel administrativo.
 */

const __digitaleFabricTables =
  new Set([
    "fabric_categories",
    "fabrics",
    "fabric_category_assignments",
  ]);

const __digitaleOriginalFrom =
  typeof (supabase as any).from === "function"
    ? (supabase as any).from.bind(supabase)
    : null;


function __digitaleFabricQuery(
  table: string
) {

  const filters: any[] = [];
  const orders: any[] = [];

  let limitValue: number | undefined;
  let rangeValue:
    | {
        from: number;
        to: number;
      }
    | undefined;

  let singleValue = false;
  let maybeSingleValue = false;
  let headValue = false;
  let countValue: any = undefined;


  const execute =
    async () => {

      try {

        const response =
          await fetch(
            "/api/data/query",
            {
              method: "POST",

              headers: {
                "Content-Type":
                  "application/json",
              },

              body: JSON.stringify({
                table,
                operation: "select",

                filters,
                orders,

                limit:
                  limitValue,

                range:
                  rangeValue,

                single:
                  singleValue,

                maybeSingle:
                  maybeSingleValue,

                head:
                  headValue,

                count:
                  countValue,
              }),
            }
          );


        let payload: any = null;

        try {

          payload =
            await response.json();

        } catch {

          payload = {
            data: null,

            error: {
              message:
                "Resposta invalida da API local",
            },
          };
        }


        if (
          !response.ok &&
          !payload?.error
        ) {

          payload.error = {
            message:
              "Erro HTTP " +
              response.status,
          };
        }


        return {
          data:
            payload?.data ?? null,

          error:
            payload?.error ?? null,

          count:
            payload?.count ?? null,

          status:
            response.status,

          statusText:
            response.statusText,
        };

      } catch (error: any) {

        return {
          data: null,

          error: {
            message:
              error?.message
              || "Erro ao consultar API local",
          },

          count: null,
          status: 0,
          statusText: "",
        };
      }
    };


  const builder: any = {

    select(
      _columns: string = "*",
      options?: any
    ) {

      if (options?.head === true) {
        headValue = true;
      }

      if (
        options &&
        "count" in options
      ) {
        countValue =
          options.count;
      }

      return builder;
    },


    eq(
      column: string,
      value: any
    ) {

      filters.push({
        type: "eq",
        column,
        value,
      });

      return builder;
    },


    neq(
      column: string,
      value: any
    ) {

      filters.push({
        type: "neq",
        column,
        value,
      });

      return builder;
    },


    gt(
      column: string,
      value: any
    ) {

      filters.push({
        type: "gt",
        column,
        value,
      });

      return builder;
    },


    gte(
      column: string,
      value: any
    ) {

      filters.push({
        type: "gte",
        column,
        value,
      });

      return builder;
    },


    lt(
      column: string,
      value: any
    ) {

      filters.push({
        type: "lt",
        column,
        value,
      });

      return builder;
    },


    lte(
      column: string,
      value: any
    ) {

      filters.push({
        type: "lte",
        column,
        value,
      });

      return builder;
    },


    is(
      column: string,
      value: any
    ) {

      filters.push({
        type: "is",
        column,
        value,
      });

      return builder;
    },


    in(
      column: string,
      value: any[]
    ) {

      filters.push({
        type: "in",
        column,
        value,
      });

      return builder;
    },


    like(
      column: string,
      value: any
    ) {

      filters.push({
        type: "like",
        column,
        value,
      });

      return builder;
    },


    ilike(
      column: string,
      value: any
    ) {

      filters.push({
        type: "ilike",
        column,
        value,
      });

      return builder;
    },


    contains(
      column: string,
      value: any
    ) {

      filters.push({
        type: "contains",
        column,
        value,
      });

      return builder;
    },


    match(
      value: Record<
        string,
        any
      >
    ) {

      filters.push({
        type: "match",
        value,
      });

      return builder;
    },


    not(
      column: string,
      operator: string,
      value: any
    ) {

      filters.push({
        type: "not",
        column,
        operator,
        value,
      });

      return builder;
    },


    or(
      expression: string
    ) {

      filters.push({
        type: "or",
        expression,
      });

      return builder;
    },


    order(
      column: string,
      options?: any
    ) {

      orders.push({
        column,

        ascending:
          options?.ascending
          !== false,

        nullsFirst:
          options?.nullsFirst,
      });

      return builder;
    },


    limit(
      value: number
    ) {

      limitValue =
        Number(value);

      return builder;
    },


    range(
      from: number,
      to: number
    ) {

      rangeValue = {
        from:
          Number(from),

        to:
          Number(to),
      };

      return builder;
    },


    single() {

      singleValue = true;

      return execute();
    },


    maybeSingle() {

      maybeSingleValue = true;

      return execute();
    },


    then(
      resolve: any,
      reject?: any
    ) {

      return execute()
        .then(
          resolve,
          reject
        );
    },


    catch(
      reject: any
    ) {

      return execute()
        .catch(
          reject
        );
    },


    finally(
      callback: any
    ) {

      return execute()
        .finally(
          callback
        );
    },


    /*
     * Escritas continuam usando
     * a implementacao original.
     */

    insert(
      values: any,
      options?: any
    ) {

      return __digitaleOriginalFrom!(
        table
      ).insert(
        values,
        options
      );
    },


    upsert(
      values: any,
      options?: any
    ) {

      return __digitaleOriginalFrom!(
        table
      ).upsert(
        values,
        options
      );
    },


    update(
      values: any,
      options?: any
    ) {

      return __digitaleOriginalFrom!(
        table
      ).update(
        values,
        options
      );
    },


    delete(
      options?: any
    ) {

      return __digitaleOriginalFrom!(
        table
      ).delete(
        options
      );
    },
  };


  return builder;
}


if (
  __digitaleOriginalFrom
) {

  (supabase as any).from =
    (
      table: string
    ) => {

      if (
        __digitaleFabricTables.has(
          String(table)
        )
      ) {

        return __digitaleFabricQuery(
          String(table)
        );
      }

      return __digitaleOriginalFrom(
        table
      );
    };
}

/* DIGITALE_FABRICS_MYSQL_END */


import express from "express";
import helmet from "helmet";
import cors from "cors";

import { config } from "./config.js";
import { db } from "./database.js";

import authRoutes from "./routes/auth.js";
import dataRoutes from "./routes/data.js";
import storageRoutes from "./routes/storage.js";
import rpcRoutes from "./routes/rpc.js";
import functionRoutes from "./routes/functions.js";
import chatAgentRoutes from "./routes/chat-agent.js";

import userFunctionsRoutes from "./routes/user-functions.js";

import permissionsCompatRoutes from "./routes/permissions-compat.js";
import permissionsFunctionRoutes from "./routes/permissions-functions.js";

import settingsCompatRoutes from "./routes/settings-compat.js";

import fabricsCompatRoutes from "./routes/fabrics-compat.js";
import trackingRoutes from "./routes/tracking.js";
import prospectingRoutes from "./routes/prospecting.js";

import radarFunctionsRoutes from "./routes/radar-functions.js";
import { trackingPrecheckMiddleware } from "./tracking-precheck.js";
const app = express();

/*
 * Rotas PUBLICAS do Radar Digitale.
 * Devem ficar antes de qualquer middleware
 * de autenticação do painel administrativo.
 */
app.use(
  "/api/functions",
  express.json(),
  radarFunctionsRoutes
);


app.disable("x-powered-by");

app.use(
  helmet({
    crossOriginResourcePolicy: false
  })
);

app.use(
  cors({
    origin: true,
    credentials: true
  })
);

app.use(
  express.json({
    limit: "20mb"
  })
);

app.use(
  express.urlencoded({
    extended: true,
    limit: "20mb"
  })
);

app.get("/api", async (req, res) => {

  try {

    await db.query("SELECT 1");

    return res.json({
      ok: true,
      application:
        "Digitale Textil",
      backend:
        "Node.js",
      database:
        "MySQL"
    });

  } catch {

    return res.status(500).json({
      ok: false,
      error:
        "database_unavailable"
    });
  }
});

app.get(
  "/api/health",
  async (req, res) => {

    try {

      const [rows] =
        await db.query(`
          SELECT
            DATABASE() AS database_name,
            NOW() AS server_time
        `);

      return res.json({
        ok: true,
        database:
          rows[0].database_name,
        serverTime:
          rows[0].server_time
      });

    } catch {

      return res
        .status(500)
        .json({
          ok: false
        });
    }
  }
);

app.use(
  "/api/auth",
  authRoutes
);

app.use("/api/tracking", trackingPrecheckMiddleware);
app.use(
  "/api/tracking",
  trackingRoutes
);

app.use(
  "/api/prospecting",
  prospectingRoutes
);

app.use(
  "/api/data",
  permissionsCompatRoutes
);

app.use(
  "/api/data",
  settingsCompatRoutes
);

app.use("/api/data", fabricsCompatRoutes);
app.use(
  "/api/data",
  dataRoutes
);

app.use(
  "/api/storage",
  storageRoutes
);

app.use(
  "/api/rpc",
  rpcRoutes
);

app.use(
  "/api/functions",
  chatAgentRoutes
);

app.use(
  "/api/functions",
  userFunctionsRoutes
);

app.use(
  "/api/functions",
  permissionsFunctionRoutes
);

app.use(
  "/api/functions",
  functionRoutes
);

app.post(
  "/api/functions/:name",
  (req, res) => {

    return res.status(501).json({
      data: null,
      error: {
        message:
          `Function ${req.params.name} ainda precisa ser convertida para Node.js`
      }
    });
  }
);

app.post(
  "/api/rpc/:name",
  (req, res) => {

    return res.status(501).json({
      data: null,
      error: {
        message:
          `RPC ${req.params.name} ainda precisa ser convertida para MySQL`
      }
    });
  }
);

app.use(
  "/api",
  (req, res) => {

    return res.status(404).json({
      error:
        "route_not_found"
    });
  }
);

app.listen(
  config.apiPort,
  config.apiHost,
  () => {

    console.log(
      `Digitale Backend online em ${config.apiHost}:${config.apiPort}`
    );
  }
);

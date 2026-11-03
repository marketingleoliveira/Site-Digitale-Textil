import dotenv from "dotenv";

dotenv.config({
  path: "/etc/site-digitale-textil/backend.env"
});

export const config = {
  apiHost: process.env.API_HOST || "127.0.0.1",
  apiPort: Number(process.env.API_PORT || 8116),

  db: {
    host: process.env.DB_HOST || "127.0.0.1",
    port: Number(process.env.DB_PORT || 3306),
    name: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD
  },

  jwtSecret: process.env.JWT_SECRET,

  trackingIpSalt:
    process.env.TRACKING_IP_SALT
    || process.env.JWT_SECRET,

  portalLeadUrl:
    process.env.PORTAL_LEAD_URL
    || "http://127.0.0.1:8114/api/integrations/site-leads",

  portalLeadSecret:
    process.env.PORTAL_LEAD_SECRET || "",

  uploadsPath: "/var/lib/site-digitale-textil/uploads"
};

if (
  !config.db.name ||
  !config.db.user ||
  !config.db.password ||
  !config.jwtSecret
) {
  throw new Error("Configuracao obrigatoria do backend ausente.");
}

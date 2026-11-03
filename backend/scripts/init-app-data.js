import mysql from "mysql2/promise";
import { config } from "../src/config.js";

const db = await mysql.createConnection({
  host: config.db.host,
  port: config.db.port,
  user: config.db.user,
  password: config.db.password,
  database: config.db.name,
  charset: "utf8mb4"
});

await db.query(`
CREATE TABLE IF NOT EXISTS app_records (
    table_name VARCHAR(128) NOT NULL,
    record_id VARCHAR(191) NOT NULL,
    data JSON NOT NULL,

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (table_name, record_id),
    KEY idx_app_records_table (table_name),
    KEY idx_app_records_updated (updated_at)
)
ENGINE=InnoDB
DEFAULT CHARSET=utf8mb4
COLLATE=utf8mb4_unicode_ci;
`);

console.log("APP_RECORDS=OK");

await db.end();

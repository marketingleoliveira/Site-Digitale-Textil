import { db } from "../src/database.js";

await db.query(`
CREATE TABLE IF NOT EXISTS tracking_visitors (
  id CHAR(36) NOT NULL PRIMARY KEY,
  visitor_key VARCHAR(80) NOT NULL UNIQUE,
  first_seen DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  first_path VARCHAR(500) NULL,
  last_path VARCHAR(500) NULL,
  referrer VARCHAR(1000) NULL,
  source VARCHAR(120) NULL,
  medium VARCHAR(120) NULL,
  campaign VARCHAR(180) NULL,
  device_type VARCHAR(30) NULL,
  browser VARCHAR(50) NULL,
  language VARCHAR(20) NULL,
  score INT NOT NULL DEFAULT 0,
  total_events INT NOT NULL DEFAULT 0,
  page_views INT NOT NULL DEFAULT 0,
  sessions INT NOT NULL DEFAULT 0,
  last_session_id VARCHAR(80) NULL,
  last_event_type VARCHAR(80) NULL,
  lead_name VARCHAR(180) NULL,
  lead_email VARCHAR(254) NULL,
  lead_phone VARCHAR(60) NULL,
  lead_company VARCHAR(180) NULL,
  lead_cnpj VARCHAR(30) NULL,
  identified_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_tracking_score (score),
  INDEX idx_tracking_last_seen (last_seen),
  INDEX idx_tracking_email (lead_email),
  INDEX idx_tracking_phone (lead_phone)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`);

await db.query(`
CREATE TABLE IF NOT EXISTS tracking_events (
  id CHAR(36) NOT NULL PRIMARY KEY,
  visitor_key VARCHAR(80) NOT NULL,
  session_id VARCHAR(80) NULL,
  event_type VARCHAR(80) NOT NULL,
  path VARCHAR(500) NULL,
  page_title VARCHAR(300) NULL,
  entity_type VARCHAR(80) NULL,
  entity_slug VARCHAR(180) NULL,
  score_delta INT NOT NULL DEFAULT 0,
  metadata JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_tracking_event_visitor (visitor_key, created_at),
  INDEX idx_tracking_event_type (event_type, created_at),
  CONSTRAINT fk_tracking_event_visitor
    FOREIGN KEY (visitor_key) REFERENCES tracking_visitors(visitor_key)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`);

console.log("TRACKING_PIXEL_SCHEMA=OK");
await db.end();

CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  webdav_path TEXT,
  project_json TEXT NOT NULL,
  conf_json TEXT NOT NULL,
  last_updated TEXT
);

CREATE TABLE IF NOT EXISTS review_tracker (
  project_id TEXT PRIMARY KEY,
  data_json TEXT NOT NULL,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

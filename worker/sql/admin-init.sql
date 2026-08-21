CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  table_name TEXT NOT NULL,
  row_id TEXT,
  project_id TEXT,
  action TEXT NOT NULL,
  detail TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_audit_log_project_created ON audit_log(project_id, created_at);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log(created_at);

ALTER TABLE drawings ADD COLUMN _deleted INTEGER DEFAULT 0;
ALTER TABLE review_tracker ADD COLUMN _deleted INTEGER DEFAULT 0;

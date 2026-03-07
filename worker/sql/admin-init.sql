CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  table_name TEXT NOT NULL,
  row_id TEXT,
  action TEXT NOT NULL,
  detail TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

ALTER TABLE drawings ADD COLUMN _deleted INTEGER DEFAULT 0;
ALTER TABLE review_tracker ADD COLUMN _deleted INTEGER DEFAULT 0;

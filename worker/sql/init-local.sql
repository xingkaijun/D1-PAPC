-- init-local.sql
-- 完整的本地开发初始化脚本：建表 + 兼容视图
-- 用法: npx wrangler d1 execute papc-review-db-final --local --file=worker/sql/init-local.sql

-- ========== 基础表 ==========

CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  webdav_path TEXT,
  last_updated TEXT
);

CREATE TABLE IF NOT EXISTS reviewers (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS drawings (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  custom_id TEXT DEFAULT '',
  drawing_no TEXT DEFAULT '',
  discipline TEXT DEFAULT '',
  title TEXT DEFAULT '',
  status TEXT DEFAULT 'Pending',
  version TEXT DEFAULT '',
  current_round TEXT DEFAULT 'A',
  review_deadline TEXT,
  manual_comments_count INTEGER DEFAULT 0,
  manual_open_comments_count INTEGER DEFAULT 0,
  checked INTEGER DEFAULT 0,
  checked_synced INTEGER DEFAULT 0,
  received_date TEXT,
  category TEXT,
  deadline TEXT,
  _deleted INTEGER DEFAULT 0,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS drawing_assignees (
  drawing_id TEXT NOT NULL,
  reviewer_id TEXT NOT NULL,
  PRIMARY KEY (drawing_id, reviewer_id),
  FOREIGN KEY (drawing_id) REFERENCES drawings(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS drawing_status_history (
  id TEXT PRIMARY KEY,
  drawing_id TEXT NOT NULL,
  content TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (drawing_id) REFERENCES drawings(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS drawing_remarks (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  drawing_id TEXT NOT NULL,
  content TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now')),
  resolved INTEGER DEFAULT 0,
  FOREIGN KEY (drawing_id) REFERENCES drawings(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS project_settings (
  project_id TEXT NOT NULL,
  setting_key TEXT NOT NULL,
  setting_value TEXT,
  PRIMARY KEY (project_id, setting_key),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS discipline_defaults (
  project_id TEXT NOT NULL,
  discipline TEXT NOT NULL,
  reviewer_id TEXT NOT NULL,
  PRIMARY KEY (project_id, discipline)
);

CREATE TABLE IF NOT EXISTS discipline_default_assignees (
  project_id TEXT NOT NULL,
  discipline TEXT NOT NULL,
  reviewer_id TEXT NOT NULL,
  PRIMARY KEY (project_id, discipline, reviewer_id)
);

CREATE TABLE IF NOT EXISTS review_tracker (
  project_id TEXT NOT NULL,
  drawing_id TEXT NOT NULL,
  raw_drawing_ref TEXT,
  reviewer_id TEXT NOT NULL,
  done INTEGER DEFAULT 0,
  done_at TEXT,
  _deleted INTEGER DEFAULT 0,
  PRIMARY KEY (project_id, drawing_id, reviewer_id)
);

CREATE TABLE IF NOT EXISTS snapshots (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  note TEXT,
  data_json TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now', 'localtime')),
  FOREIGN KEY (project_id) REFERENCES projects(id)
);

CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  table_name TEXT NOT NULL,
  row_id TEXT,
  action TEXT NOT NULL,
  detail TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- ========== 兼容视图（Worker API 读取用） ==========

DROP VIEW IF EXISTS api_settings;
DROP VIEW IF EXISTS api_projects;
DROP VIEW IF EXISTS api_project_details;
DROP VIEW IF EXISTS api_review_trackers;

-- api_settings: 全局设置
CREATE VIEW api_settings AS
SELECT
  json_object(
    'reviewers', (
      SELECT json_group_array(json_object('id', id, 'name', display_name))
      FROM reviewers
    ),
    'disciplineDefaults', COALESCE((
      SELECT json_group_object(discipline, reviewer_id)
      FROM discipline_defaults
      WHERE project_id = (SELECT id FROM projects LIMIT 1)
    ), json('{}')),
    'holidays', COALESCE((
      SELECT json(setting_value) FROM project_settings
      WHERE setting_key = 'holidays' LIMIT 1
    ), json('[]')),
    'roundACycle', COALESCE((
      SELECT CAST(setting_value AS INTEGER) FROM project_settings
      WHERE setting_key = 'roundACycle' LIMIT 1
    ), 10),
    'otherRoundsCycle', COALESCE((
      SELECT CAST(setting_value AS INTEGER) FROM project_settings
      WHERE setting_key = 'otherRoundsCycle' LIMIT 1
    ), 5),
    'displayName', (
      SELECT setting_value FROM project_settings
      WHERE setting_key = 'displayName' LIMIT 1
    ),
    'autoSyncInterval', (
      SELECT CAST(setting_value AS INTEGER) FROM project_settings
      WHERE setting_key = 'autoSyncInterval' LIMIT 1
    )
  ) AS value,
  NULL AS updated_at;

-- api_projects: 项目列表
CREATE VIEW api_projects AS
SELECT id, name, webdav_path, last_updated
FROM projects;

-- api_project_details: 完整项目详情（含嵌套 drawings）
CREATE VIEW api_project_details AS
SELECT
  p.id,
  p.name,
  p.webdav_path,
  p.last_updated,
  json_object(
    'id', p.id,
    'name', p.name,
    'drawings', COALESCE((
      SELECT json_group_array(
        json_object(
          'id', d.id,
          'customId', COALESCE(d.custom_id, ''),
          'drawingNo', COALESCE(d.drawing_no, ''),
          'title', COALESCE(d.title, ''),
          'discipline', COALESCE(d.discipline, ''),
          'assignees', COALESCE((
            SELECT json_group_array(da.reviewer_id)
            FROM drawing_assignees da WHERE da.drawing_id = d.id
          ), json('[]')),
          'status', COALESCE(d.status, 'Pending'),
          'currentRound', COALESCE(d.current_round, 'A'),
          'version', COALESCE(d.version, ''),
          'manualCommentsCount', COALESCE(d.manual_comments_count, 0),
          'manualOpenCommentsCount', COALESCE(d.manual_open_comments_count, 0),
          'reviewDeadline', d.review_deadline,
          'receivedDate', d.received_date,
          'category', d.category,
          'deadline', d.deadline,
          'checked', d.checked,
          'checkedSynced', d.checked_synced,
          'logs', json('[]'),
          'remarks', COALESCE((
            SELECT json_group_array(
              json_object(
                'id', rm.id,
                'content', COALESCE(rm.content, ''),
                'createdAt', COALESCE(rm.created_at, ''),
                'resolved', rm.resolved
              )
            )
            FROM drawing_remarks rm
            WHERE rm.drawing_id = d.id
          ), json('[]')),
          'statusHistory', COALESCE((
            SELECT json_group_array(
              json_object(
                'id', sh.id,
                'content', COALESCE(sh.content, ''),
                'createdAt', COALESCE(sh.created_at, '')
              )
            )
            FROM drawing_status_history sh WHERE sh.drawing_id = d.id
          ), json('[]'))
        )
      )
      FROM drawings d WHERE d.project_id = p.id AND IFNULL(d._deleted, 0) != 1
    ), json('[]'))
  ) AS project_json,
  json_object(
    'reviewers', COALESCE((
      SELECT json_group_array(json_object('id', r.id, 'name', r.display_name))
      FROM reviewers r
    ), json('[]')),
    'disciplineDefaults', COALESCE((
      SELECT json_group_object(dd.discipline, dd.reviewer_id)
      FROM discipline_defaults dd WHERE dd.project_id = p.id
    ), json('{}')),
    'holidays', COALESCE((
      SELECT json(ps.setting_value) FROM project_settings ps
      WHERE ps.project_id = p.id AND ps.setting_key = 'holidays'
    ), json('[]')),
    'roundACycle', COALESCE((
      SELECT CAST(ps.setting_value AS INTEGER) FROM project_settings ps
      WHERE ps.project_id = p.id AND ps.setting_key = 'roundACycle'
    ), 10),
    'otherRoundsCycle', COALESCE((
      SELECT CAST(ps.setting_value AS INTEGER) FROM project_settings ps
      WHERE ps.project_id = p.id AND ps.setting_key = 'otherRoundsCycle'
    ), 5),
    'password', (
      SELECT ps.setting_value FROM project_settings ps
      WHERE ps.project_id = p.id AND ps.setting_key = 'password'
    ),
    'displayName', (
      SELECT ps.setting_value FROM project_settings ps
      WHERE ps.project_id = p.id AND ps.setting_key = 'displayName'
    ),
    'autoSyncInterval', (
      SELECT CAST(ps.setting_value AS INTEGER) FROM project_settings ps
      WHERE ps.project_id = p.id AND ps.setting_key = 'autoSyncInterval'
    ),
    'projectSummary', COALESCE((
      SELECT json(ps.setting_value) FROM project_settings ps
      WHERE ps.project_id = p.id AND ps.setting_key = 'projectSummary'
    ), json('null')),
    'defaultAssignees', COALESCE((
      SELECT json_group_object(
        sub.discipline,
        (SELECT json_group_array(dda2.reviewer_id)
         FROM discipline_default_assignees dda2
         WHERE dda2.project_id = p.id AND dda2.discipline = sub.discipline)
      )
      FROM (SELECT DISTINCT discipline FROM discipline_default_assignees WHERE project_id = p.id) sub
    ), json('{}'))
  ) AS conf_json
FROM projects p;

-- api_review_trackers: 审查追踪
CREATE VIEW api_review_trackers AS
SELECT
  project_id,
  json_group_object(
    COALESCE(drawing_id, raw_drawing_ref),
    json(assignee_payload)
  ) AS data_json,
  MAX(latest_done_at) AS updated_at
FROM (
  SELECT
    project_id,
    drawing_id,
    raw_drawing_ref,
    json_group_object(
      reviewer_id,
      json_object(
        'done', CASE WHEN done THEN 1 ELSE 0 END,
        'doneAt', done_at
      )
    ) AS assignee_payload,
    MAX(done_at) AS latest_done_at
  FROM review_tracker
  WHERE IFNULL(_deleted, 0) != 1
  GROUP BY project_id, COALESCE(drawing_id, raw_drawing_ref)
) grouped
GROUP BY project_id;

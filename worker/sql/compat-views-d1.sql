-- compat-views-d1.sql
-- 将 papc-d1-2 的 normalized 表映射为 Worker 期望的 api_* views
-- 适配 papc-review-db-final

DROP VIEW IF EXISTS api_settings;
DROP VIEW IF EXISTS api_projects;
DROP VIEW IF EXISTS api_project_details;
DROP VIEW IF EXISTS api_review_trackers;

-- 1. api_settings
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

-- 2. api_projects
CREATE VIEW api_projects AS
SELECT id, name, webdav_path, last_updated
FROM projects;

-- 3. api_project_details (核心：拼装完整 project JSON)
CREATE VIEW api_project_details AS
SELECT
  p.id,
  p.name,
  p.webdav_path,
  p.last_updated,
  -- project_json: 含 drawings[] 嵌套数组
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
  -- conf_json: 项目配置
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

-- 4. api_review_trackers
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

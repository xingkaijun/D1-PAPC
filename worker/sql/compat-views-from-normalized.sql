DROP VIEW IF EXISTS api_settings;
DROP VIEW IF EXISTS api_projects;
DROP VIEW IF EXISTS api_project_details;
DROP VIEW IF EXISTS api_review_trackers;

CREATE VIEW api_settings AS
SELECT
  json_object(
    'reviewers', COALESCE(json(reviewers), json('[]')),
    'disciplineDefaults', COALESCE(json(discipline_defaults), json('{}')),
    'holidays', COALESCE(json(holidays), json('[]')),
    'roundACycle', COALESCE(round_a_cycle, 10),
    'otherRoundsCycle', COALESCE(other_rounds_cycle, 5),
    'displayName', display_name,
    'autoSyncInterval', auto_sync_interval
  ) AS value,
  updated_at
FROM settings
LIMIT 1;

CREATE VIEW api_projects AS
SELECT
  id,
  COALESCE(display_name, name) AS name,
  webdav_path,
  COALESCE(last_updated, updated_at) AS last_updated
FROM projects;

CREATE VIEW api_project_details AS
SELECT
  p.id,
  COALESCE(p.display_name, p.name) AS name,
  p.webdav_path,
  COALESCE(p.last_updated, p.updated_at) AS last_updated,
  json_object(
    'id', p.id,
    'name', COALESCE(p.display_name, p.name),
    'drawings', COALESCE((
      SELECT json_group_array(
        json_object(
          'id', d.id,
          'customId', COALESCE(d.custom_id, ''),
          'drawingNo', COALESCE(d.drawing_no, ''),
          'title', COALESCE(d.title, ''),
          'discipline', COALESCE(d.discipline, ''),
          'assignees', COALESCE(json(d.assignees), json('[]')),
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
          'logs', COALESCE((
            SELECT json_group_array(
              json_object(
                'id', dl.id,
                'version', COALESCE(dl.version, ''),
                'receivedDate', COALESCE(dl.received_date, ''),
                'dueDate', COALESCE(dl.due_date, ''),
                'sentDate', dl.sent_date,
                'commentCount', COALESCE(dl.comment_count, 0)
              )
            )
            FROM drawing_logs dl
            WHERE dl.project_id = p.id
              AND dl.drawing_id = d.id
          ), json('[]')),
          'remarks', COALESCE((
            SELECT json_group_array(
              json_object(
                'id', r.id,
                'content', COALESCE(r.content, ''),
                'createdAt', COALESCE(r.created_at, ''),
                'resolved', r.resolved
              )
            )
            FROM remarks r
            WHERE r.project_id = p.id
              AND r.drawing_id = d.id
              AND COALESCE(r.type, r.kind, 'remark') <> 'status_history'
          ), json('[]')),
          'statusHistory', COALESCE((
            SELECT json_group_array(
              json_object(
                'id', r.id,
                'content', COALESCE(r.content, ''),
                'createdAt', COALESCE(r.created_at, ''),
                'resolved', r.resolved
              )
            )
            FROM remarks r
            WHERE r.project_id = p.id
              AND r.drawing_id = d.id
              AND COALESCE(r.type, r.kind, 'remark') = 'status_history'
          ), json('[]'))
        )
      )
      FROM drawings d
      WHERE d.project_id = p.id
    ), json('[]'))
  ) AS project_json,
  json_object(
    'reviewers', COALESCE(json(pc.reviewers), json('[]')),
    'disciplineDefaults', COALESCE(json(pc.discipline_defaults), json('{}')),
    'holidays', COALESCE(json(pc.holidays), json('[]')),
    'roundACycle', COALESCE(pc.round_a_cycle, 10),
    'otherRoundsCycle', COALESCE(pc.other_rounds_cycle, 5),
    'password', pc.password,
    'displayName', pc.display_name,
    'autoSyncInterval', pc.auto_sync_interval,
    'lastUpdated', pc.updated_at,
    'defaultAssignees', COALESCE(json(pc.default_assignees), json('{}'))
  ) AS conf_json
FROM projects p
LEFT JOIN project_configs pc
  ON pc.project_id = p.id;

CREATE VIEW api_review_trackers AS
SELECT
  project_id,
  json_group_object(
    drawing_id,
    json(assignee_payload)
  ) AS data_json,
  MAX(updated_at) AS updated_at
FROM (
  SELECT
    project_id,
    drawing_id,
    json_group_object(
      assignee,
      json_object(
        'done', CASE WHEN done THEN 1 ELSE 0 END,
        'doneAt', done_at
      )
    ) AS assignee_payload,
    MAX(updated_at) AS updated_at
  FROM review_tracker_entries
  GROUP BY project_id, drawing_id
) grouped
GROUP BY project_id;

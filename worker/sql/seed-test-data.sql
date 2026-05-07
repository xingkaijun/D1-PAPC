-- =============================================================================
-- 本地测试种子数据
-- =============================================================================

-- 项目
INSERT OR IGNORE INTO projects (id, name, webdav_path, last_updated)
VALUES ('proj-test-001', 'PG-VLEC-H2684', NULL, datetime('now'));

-- 审图人
INSERT OR IGNORE INTO reviewers (id, display_name)
VALUES ('engineer_a', 'Engineer A'),
       ('engineer_b', 'Engineer B'),
       ('senior_eng_c', 'Senior Eng C');

-- 项目设置
INSERT OR IGNORE INTO project_settings (project_id, setting_key, setting_value)
VALUES ('proj-test-001', 'roundACycle', '14'),
       ('proj-test-001', 'otherRoundsCycle', '7'),
       ('proj-test-001', 'holidays', '["2026-01-01","2026-05-01"]');

-- 图纸（多种状态）
INSERT OR IGNORE INTO drawings (id, project_id, custom_id, drawing_no, discipline, title, status, version, current_round, review_deadline, manual_comments_count, manual_open_comments_count, received_date, category)
VALUES
  ('dwg-001', 'proj-test-001', 'DW-A-001', 'DW-A-001', 'Structure', 'General Arrangement', 'Reviewing', 'A', 'A', datetime('now', '+7 days'), 3, 1, '2026-04-01', 'A'),
  ('dwg-002', 'proj-test-001', 'DW-B-002', 'DW-B-002', 'Piping', 'Piping Isometric', 'Reviewing', 'A', 'A', datetime('now', '+3 days'), 5, 2, '2026-04-05', 'B'),
  ('dwg-003', 'proj-test-001', 'DW-C-003', 'DW-C-003', 'Electrical', 'Cable Tray Layout', 'Approved', 'A', 'A', NULL, 0, 0, '2026-03-20', 'C'),
  ('dwg-004', 'proj-test-001', 'DW-D-004', 'DW-D-004', 'Structure', 'Foundation Plan', 'Pending', 'A', 'A', NULL, 0, 0, '2026-05-01', 'A'),
  ('dwg-005', 'proj-test-001', 'DW-E-005', 'DW-E-005', 'Piping', 'Valve Schedule', 'Reviewing', 'B', 'B', datetime('now', '-2 days'), 8, 3, '2026-03-28', 'A'),
  ('dwg-006', 'proj-test-001', 'DW-F-006', 'DW-F-006', 'Electrical', 'Lighting Layout', 'Waiting Reply', 'A', 'A', NULL, 2, 0, '2026-04-10', 'B');

-- 图纸责任人
INSERT OR IGNORE INTO drawing_assignees (drawing_id, reviewer_id)
VALUES
  ('dwg-001', 'engineer_a'),
  ('dwg-001', 'senior_eng_c'),
  ('dwg-002', 'engineer_b'),
  ('dwg-005', 'engineer_a'),
  ('dwg-005', 'engineer_b'),
  ('dwg-005', 'senior_eng_c');

-- 审核追踪：部分已审、部分未审
INSERT OR IGNORE INTO review_tracker (project_id, drawing_id, raw_drawing_ref, reviewer_id, done, done_at)
VALUES
  ('proj-test-001', 'dwg-001', 'dwg-001', 'engineer_a', 1, datetime('now', '-2 days')),
  ('proj-test-001', 'dwg-001', 'dwg-001', 'senior_eng_c', 0, NULL),
  -- dwg-002 全部未做
  ('proj-test-001', 'dwg-002', 'dwg-002', 'engineer_b', 0, NULL),
  -- dwg-005 超期：部分完成
  ('proj-test-001', 'dwg-005', 'dwg-005', 'engineer_a', 1, datetime('now', '-5 days')),
  ('proj-test-001', 'dwg-005', 'dwg-005', 'engineer_b', 0, NULL),
  ('proj-test-001', 'dwg-005', 'dwg-005', 'senior_eng_c', 1, datetime('now', '-1 days'));

-- 审图历史记录
INSERT OR IGNORE INTO drawing_status_history (id, drawing_id, content, created_at)
VALUES
  ('hist-001', 'dwg-001', 'Status: Pending -> Reviewing | Round: A -> A', datetime('now', '-10 days')),
  ('hist-002', 'dwg-001', 'Comments: 0/0 -> 3/1', datetime('now', '-3 days')),
  ('hist-003', 'dwg-002', 'Status: Pending -> Reviewing', datetime('now', '-7 days')),
  ('hist-004', 'dwg-005', 'Status: Pending -> Reviewing | Round: A -> B', datetime('now', '-14 days')),
  ('hist-005', 'dwg-005', 'Comments: 0/0 -> 8/3', datetime('now', '-2 days'));

-- 备注
INSERT OR IGNORE INTO drawing_remarks (id, project_id, drawing_id, content, created_at, resolved)
VALUES
  ('rmk-001', 'proj-test-001', 'dwg-001', 'Check stiffener spacing', datetime('now', '-5 days'), 0),
  ('rmk-002', 'proj-test-001', 'dwg-001', 'Update material spec', datetime('now', '-3 days'), 1);

-- 学科默认值
INSERT OR IGNORE INTO discipline_defaults (project_id, discipline, reviewer_id)
VALUES ('proj-test-001', 'Structure', 'engineer_a'),
       ('proj-test-001', 'Piping', 'engineer_b'),
       ('proj-test-001', 'Electrical', 'senior_eng_c');

-- 学科默认责任人
INSERT OR IGNORE INTO discipline_default_assignees (project_id, discipline, reviewer_id)
VALUES ('proj-test-001', 'Structure', 'engineer_a'),
       ('proj-test-001', 'Structure', 'senior_eng_c'),
       ('proj-test-001', 'Piping', 'engineer_b'),
       ('proj-test-001', 'Electrical', 'senior_eng_c');

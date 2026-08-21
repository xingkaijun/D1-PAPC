-- 写入日志（STATUS / COMMENTS）所需的 audit_log 扩展
-- 幂等：可重复执行。ALTER TABLE ADD COLUMN 在列已存在时会报错，属预期，忽略即可。

ALTER TABLE audit_log ADD COLUMN project_id TEXT;

CREATE INDEX IF NOT EXISTS idx_audit_log_project_created ON audit_log(project_id, created_at);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log(created_at);

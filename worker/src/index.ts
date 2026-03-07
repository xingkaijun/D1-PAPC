import adminHtml from './admin.html';

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

interface D1Result<T = Record<string, unknown>> {
  results?: T[];
  success: boolean;
  meta?: Record<string, unknown>;
}

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
  run<T = Record<string, unknown>>(): Promise<D1Result<T>>;
}

interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
}

interface Env {
  PAPC_DB?: D1Database;
  API_TOKEN?: string;
  ALLOW_CORS_ORIGIN?: string;
  ADMIN_PASSWORD?: string;
}

interface ProjectListRow extends Record<string, unknown> {
  id: string;
  name: string;
  webdav_path: string | null;
  last_updated: string | null;
}

interface ProjectDetailRow extends ProjectListRow {
  project_json: string | null;
  conf_json: string | null;
}

interface SettingsRow extends Record<string, unknown> {
  value: string | null;
  updated_at: string | null;
}

interface ReviewTrackerRow extends Record<string, unknown> {
  data_json: string | null;
  updated_at: string | null;
}

type SqlRow = Record<string, unknown>;

interface DrawingLogShape {
  id: string;
  version: string;
  receivedDate: string;
  dueDate: string;
  sentDate?: string;
  commentCount: number;
}

interface RemarkShape {
  id: string;
  content: string;
  createdAt: string;
  resolved?: boolean;
}

const jsonHeaders = {
  'Content-Type': 'application/json; charset=utf-8',
};

const readJson = <T>(raw: string | null | undefined, fallback: T): T => {
  if (!raw) {
    return fallback;
  }

  try {
    return JSON.parse(raw) as T;
  } catch (error) {
    console.warn('Failed to parse JSON from D1 row.', error);
    return fallback;
  }
};

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

const pick = <T = unknown>(row: SqlRow, ...keys: string[]): T | undefined => {
  for (const key of keys) {
    if (key in row && row[key] !== undefined && row[key] !== null) {
      return row[key] as T;
    }
  }
  return undefined;
};

const toStringValue = (value: unknown): string | undefined => {
  if (value === null || value === undefined) return undefined;
  return String(value);
};

const toNumberValue = (value: unknown, fallback = 0): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toBooleanValue = (value: unknown): boolean | undefined => {
  if (value === null || value === undefined) return undefined;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['1', 'true', 'yes', 'y'].includes(normalized)) return true;
    if (['0', 'false', 'no', 'n'].includes(normalized)) return false;
  }
  return undefined;
};

const hasColumn = (columns: string[], ...candidates: string[]) =>
  candidates.some(candidate => columns.includes(candidate));

const splitCsv = (value: string | undefined): string[] =>
  value
    ? value
      .split(',')
      .map(item => item.trim())
      .filter(Boolean)
    : [];

const withCors = (headers: Headers, env: Env): Headers => {
  headers.set('Access-Control-Allow-Origin', env.ALLOW_CORS_ORIGIN || '*');
  headers.set('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  return headers;
};

const json = (env: Env, status: number, body: JsonValue): Response => {
  const headers = withCors(new Headers(jsonHeaders), env);
  return new Response(JSON.stringify(body), { status, headers });
};

const text = (env: Env, status: number, body: string): Response => {
  const headers = withCors(new Headers({ 'Content-Type': 'text/plain; charset=utf-8' }), env);
  return new Response(body, { status, headers });
};

const requireDb = (env: Env): D1Database => {
  if (!env.PAPC_DB) {
    throw new Error('Missing D1 binding `PAPC_DB`.');
  }
  return env.PAPC_DB;
};

const isAuthorized = (request: Request, env: Env): boolean => {
  if (!env.API_TOKEN) {
    return true;
  }

  const auth = request.headers.get('Authorization');
  return auth === `Bearer ${env.API_TOKEN}`;
};

const getObjectColumns = async (db: D1Database, objectName: string): Promise<string[]> => {
  const pragmaName = objectName.replace(/'/g, "''");
  const result = await db.prepare(`PRAGMA table_info("${pragmaName}")`).all<{ name?: string }>();
  return (result.results || []).map(row => row.name).filter((value): value is string => Boolean(value));
};

const objectExists = async (db: D1Database, objectName: string): Promise<boolean> => {
  const row = await db
    .prepare(
      `SELECT name
       FROM sqlite_master
       WHERE name = ?
         AND type IN ('table', 'view')
       LIMIT 1`
    )
    .bind(objectName)
    .first<{ name?: string }>();

  return Boolean(row?.name);
};

const queryAll = async <T extends SqlRow = SqlRow>(db: D1Database, query: string, values: unknown[] = []) => {
  return (await db.prepare(query).bind(...values).all<T>()).results || [];
};

const queryFirst = async <T extends SqlRow = SqlRow>(db: D1Database, query: string, values: unknown[] = []) =>
  db.prepare(query).bind(...values).first<T>();

const buildSettingsFromRow = (row: SqlRow | null | undefined) => {
  if (!row) return {};

  const jsonSource =
    toStringValue(pick(row, 'value', 'settings_json', 'data_json', 'json', 'settings', 'data')) || null;

  if (jsonSource) {
    return readJson<Record<string, JsonValue>>(jsonSource, {});
  }

  return {
    reviewers: asArray(pick(row, 'reviewers')).map(item => asRecord(item)) as JsonValue[],
    disciplineDefaults: asRecord(pick(row, 'discipline_defaults', 'disciplineDefaults')) as JsonValue,
    holidays: asArray(pick(row, 'holidays')) as JsonValue[],
    roundACycle: toNumberValue(pick(row, 'round_a_cycle', 'roundACycle')),
    otherRoundsCycle: toNumberValue(pick(row, 'other_rounds_cycle', 'otherRoundsCycle')),
    displayName: toStringValue(pick(row, 'display_name', 'displayName')),
    autoSyncInterval: toNumberValue(pick(row, 'auto_sync_interval', 'autoSyncInterval')),
  };
};

const mapDrawingLog = (row: SqlRow): DrawingLogShape => ({
  id: toStringValue(pick(row, 'id', 'log_id')) || crypto.randomUUID(),
  version: toStringValue(pick(row, 'version')) || '',
  receivedDate: toStringValue(pick(row, 'received_date', 'receivedDate')) || '',
  dueDate: toStringValue(pick(row, 'due_date', 'dueDate', 'deadline')) || '',
  sentDate: toStringValue(pick(row, 'sent_date', 'sentDate')),
  commentCount: toNumberValue(pick(row, 'comment_count', 'commentCount'), 0),
});

const mapRemark = (row: SqlRow): RemarkShape => ({
  id: toStringValue(pick(row, 'id', 'remark_id')) || crypto.randomUUID(),
  content: toStringValue(pick(row, 'content', 'text', 'remark')) || '',
  createdAt: toStringValue(pick(row, 'created_at', 'createdAt', 'timestamp')) || new Date(0).toISOString(),
  resolved: toBooleanValue(pick(row, 'resolved', 'is_resolved')),
});

const mapDrawing = (
  row: SqlRow,
  logsByDrawingId: Map<string, DrawingLogShape[]>,
  remarksByDrawingId: Map<string, RemarkShape[]>,
  statusHistoryByDrawingId: Map<string, RemarkShape[]>
) => {
  const drawingId = toStringValue(pick(row, 'id', 'drawing_id')) || crypto.randomUUID();
  const receivedDate = toStringValue(pick(row, 'received_date', 'receivedDate'));
  const reviewDeadline = toStringValue(pick(row, 'review_deadline', 'reviewDeadline', 'due_date', 'deadline'));
  const assigneeCsv = splitCsv(toStringValue(pick(row, 'assignees_csv')));
  const assigneeList =
    assigneeCsv.length > 0 ? assigneeCsv : (asArray(pick(row, 'assignees')).map(item => String(item)) as string[]);

  return {
    id: drawingId,
    customId: toStringValue(pick(row, 'custom_id', 'customId')) || '',
    drawingNo: toStringValue(pick(row, 'drawing_no', 'drawingNo', 'number')) || '',
    title: toStringValue(pick(row, 'title', 'name')) || '',
    discipline: toStringValue(pick(row, 'discipline')) || '',
    assignees: assigneeList,
    status: toStringValue(pick(row, 'status')) || 'Pending',
    currentRound: toStringValue(pick(row, 'current_round', 'currentRound', 'round')) || 'A',
    version: toStringValue(pick(row, 'version')) || '',
    manualCommentsCount: toNumberValue(pick(row, 'manual_comments_count', 'manualCommentsCount', 'comment_count'), 0),
    manualOpenCommentsCount: toNumberValue(
      pick(row, 'manual_open_comments_count', 'manualOpenCommentsCount', 'open_comment_count'),
      0
    ),
    reviewDeadline,
    receivedDate,
    category: toStringValue(pick(row, 'category')) as 'A' | 'B' | 'C' | undefined,
    deadline: toStringValue(pick(row, 'deadline')),
    checked: toBooleanValue(pick(row, 'checked')),
    checkedSynced: toBooleanValue(pick(row, 'checked_synced', 'checkedSynced')),
    logs: logsByDrawingId.get(drawingId) || [],
    remarks: remarksByDrawingId.get(drawingId) || [],
    statusHistory: statusHistoryByDrawingId.get(drawingId) || [],
  };
};

const getProjectList = async (db: D1Database) => {
  const rows = await queryAll<ProjectListRow>(
    db,
    `SELECT id, name, webdav_path, last_updated
     FROM api_projects
     ORDER BY name COLLATE NOCASE ASC`
  );

  return rows.map(row => ({
    id: row.id,
    name: row.name,
    webdavPath: row.webdav_path || undefined,
    lastUpdated: row.last_updated || undefined,
  }));
};

const getSettings = async (db: D1Database) => {
  const row = await queryFirst<SettingsRow>(db, 'SELECT value, updated_at FROM api_settings LIMIT 1');
  return readJson<Record<string, JsonValue>>(row?.value, {});
};

const getProjectDetail = async (db: D1Database, projectId: string) => {
  const row = await queryFirst<ProjectDetailRow>(
    db,
    `SELECT id, name, webdav_path, last_updated, project_json, conf_json
     FROM api_project_details
     WHERE id = ?
     LIMIT 1`,
    [projectId]
  );

  if (!row) return null;

  const project = readJson<Record<string, JsonValue>>(row.project_json, {});
  const conf = readJson<Record<string, JsonValue>>(row.conf_json, {});

  return {
    ...project,
    id: row.id,
    name: row.name,
    webdavPath: row.webdav_path || undefined,
    conf,
    lastUpdated: row.last_updated || undefined,
  };
};

const getReviewTracker = async (db: D1Database, projectId: string) => {
  const row = await queryFirst<ReviewTrackerRow>(
    db,
    `SELECT data_json, updated_at
     FROM api_review_trackers
     WHERE project_id = ?
     LIMIT 1`,
    [projectId]
  );

  return readJson<Record<string, JsonValue>>(row?.data_json, {});
};

const saveProjectData = async (db: D1Database, projectId: string, project: any, reviewTracker: any) => {
  if (!project || !Array.isArray(project.drawings)) return;
  const stmts: D1PreparedStatement[] = [];

  // Update/Insert projects table
  const projectName = toStringValue(project.name) || projectId;
  const webdavPath = toStringValue(project.webdavPath) || '';
  stmts.push(db.prepare(
    `INSERT INTO projects (id, name, webdav_path, last_updated)
     VALUES (?, ?, ?, datetime('now'))
     ON CONFLICT(id) DO UPDATE SET 
       name=excluded.name, webdav_path=excluded.webdav_path, last_updated=excluded.last_updated`
  ).bind(projectId, projectName, webdavPath));

  // Extract valid drawing IDs to delete removed ones
  const validIds = project.drawings.map((d: any) => toStringValue(d.id)).filter(Boolean) as string[];
  const existingRows = await queryAll(db, `SELECT id FROM drawings WHERE project_id = ?`, [projectId]);
  const toDelete = existingRows.map(r => toStringValue(r.id)).filter(id => id && !validIds.includes(id)) as string[];

  for (const delId of toDelete) {
    stmts.push(db.prepare(`DELETE FROM drawings WHERE project_id = ? AND id = ?`).bind(projectId, delId));
  }

  // Upsert drawings and their relations
  for (const drawing of project.drawings) {
    const id = toStringValue(drawing.id) || crypto.randomUUID();
    stmts.push(db.prepare(
      `INSERT INTO drawings (id, project_id, custom_id, drawing_no, discipline, title, status, version, current_round, review_deadline, manual_comments_count, manual_open_comments_count, checked, checked_synced, received_date, category, deadline)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         custom_id=excluded.custom_id, drawing_no=excluded.drawing_no, discipline=excluded.discipline, title=excluded.title,
         status=excluded.status, version=excluded.version, current_round=excluded.current_round, review_deadline=excluded.review_deadline,
         manual_comments_count=excluded.manual_comments_count, manual_open_comments_count=excluded.manual_open_comments_count,
         checked=excluded.checked, checked_synced=excluded.checked_synced,
         received_date=excluded.received_date, category=excluded.category, deadline=excluded.deadline`
    ).bind(
      id, projectId, toStringValue(drawing.customId) || '', toStringValue(drawing.drawingNo) || '',
      toStringValue(drawing.discipline) || '', toStringValue(drawing.title) || '',
      toStringValue(drawing.status) || 'Pending', toStringValue(drawing.version) || '',
      toStringValue(drawing.currentRound) || 'A', toStringValue(drawing.reviewDeadline) || null,
      toNumberValue(drawing.manualCommentsCount, 0), toNumberValue(drawing.manualOpenCommentsCount, 0),
      toBooleanValue(drawing.checked) ? 1 : 0, toBooleanValue(drawing.checkedSynced) ? 1 : 0,
      toStringValue(drawing.receivedDate) || null, toStringValue(drawing.category) || null, toStringValue(drawing.deadline) || null
    ));

    // Assignees
    stmts.push(db.prepare(`DELETE FROM drawing_assignees WHERE drawing_id = ?`).bind(id));
    if (Array.isArray(drawing.assignees)) {
      for (const assignee of drawing.assignees) {
        stmts.push(db.prepare(`INSERT INTO drawing_assignees (drawing_id, reviewer_id) VALUES (?, ?)`).bind(id, String(assignee)));
      }
    }

    // Status History
    stmts.push(db.prepare(`DELETE FROM drawing_status_history WHERE drawing_id = ?`).bind(id));
    if (Array.isArray(drawing.statusHistory)) {
      for (const history of drawing.statusHistory) {
        stmts.push(db.prepare(`INSERT INTO drawing_status_history (id, drawing_id, content, created_at) VALUES (?, ?, ?, ?)`).bind(
          toStringValue(history.id) || crypto.randomUUID(), id,
          toStringValue(history.content) || '', toStringValue(history.createdAt) || new Date().toISOString()
        ));
      }
    }

    // Remarks (Internal Notes)
    stmts.push(db.prepare(`DELETE FROM drawing_remarks WHERE drawing_id = ?`).bind(id));
    if (Array.isArray(drawing.remarks)) {
      for (const remark of drawing.remarks) {
        stmts.push(db.prepare(
          `INSERT INTO drawing_remarks (id, project_id, drawing_id, content, created_at, resolved) VALUES (?, ?, ?, ?, ?, ?)`
        ).bind(
          toStringValue(remark.id) || crypto.randomUUID(), projectId, id,
          toStringValue(remark.content) || '', toStringValue(remark.createdAt) || new Date().toISOString(),
          toBooleanValue(remark.resolved) ? 1 : 0
        ));
      }
    }
  }

  // Persist Project Configuration (conf)
  if (project.conf) {
    const conf = project.conf;

    // 1. project_settings
    const settingsMap: Record<string, any> = {
      displayName: conf.displayName,
      password: conf.password,
      holidays: Array.isArray(conf.holidays) ? JSON.stringify(conf.holidays) : '[]',
      roundACycle: conf.roundACycle,
      otherRoundsCycle: conf.otherRoundsCycle,
      autoSyncInterval: conf.autoSyncInterval
    };

    for (const [key, val] of Object.entries(settingsMap)) {
      if (val !== undefined && val !== null) {
        stmts.push(db.prepare(
          `INSERT INTO project_settings (project_id, setting_key, setting_value)
           VALUES (?, ?, ?)
           ON CONFLICT(project_id, setting_key) DO UPDATE SET setting_value=excluded.setting_value`
        ).bind(projectId, key, String(val)));
      }
    }

    // 2. discipline_defaults
    if (conf.disciplineDefaults && typeof conf.disciplineDefaults === 'object') {
      stmts.push(db.prepare(`DELETE FROM discipline_defaults WHERE project_id = ?`).bind(projectId));
      for (const [discipline, reviewerId] of Object.entries(conf.disciplineDefaults)) {
        if (reviewerId) {
          stmts.push(db.prepare(
            `INSERT INTO discipline_defaults (project_id, discipline, reviewer_id)
             VALUES (?, ?, ?)`
          ).bind(projectId, discipline, String(reviewerId)));
        }
      }
    }

    // 3. discipline_default_assignees
    if (conf.defaultAssignees && typeof conf.defaultAssignees === 'object') {
      stmts.push(db.prepare(`DELETE FROM discipline_default_assignees WHERE project_id = ?`).bind(projectId));
      for (const [discipline, reviewerIds] of Object.entries(conf.defaultAssignees)) {
        if (Array.isArray(reviewerIds)) {
          for (const revId of reviewerIds) {
            stmts.push(db.prepare(
              `INSERT INTO discipline_default_assignees (project_id, discipline, reviewer_id)
               VALUES (?, ?, ?)`
            ).bind(projectId, discipline, String(revId)));
          }
        }
      }
    }

    // 4. Update global reviewers if provided (since they are shared)
    if (Array.isArray(conf.reviewers) && conf.reviewers.length > 0) {
      // Small optimization: only update if we have reviewers
      for (const rev of conf.reviewers) {
        if (rev.id) {
          stmts.push(db.prepare(
            `INSERT INTO reviewers (id, display_name)
             VALUES (?, ?)
             ON CONFLICT(id) DO UPDATE SET display_name=excluded.display_name`
          ).bind(rev.id, rev.name || rev.id));
        }
      }
    }
  }

  // Update Review Tracker if provided
  if (reviewTracker && typeof reviewTracker === 'object' && Object.keys(reviewTracker).length > 0) {
    stmts.push(...buildReviewTrackerStatements(db, projectId, reviewTracker));
  }

  // Execute in batch
  if (stmts.length > 0) {
    const chunkSize = 80;
    for (let i = 0; i < stmts.length; i += chunkSize) {
      const chunk = stmts.slice(i, i + chunkSize);
      await db.batch(chunk);
    }
  }
};

const buildReviewTrackerStatements = (db: D1Database, projectId: string, data: any): D1PreparedStatement[] => {
  const stmts: D1PreparedStatement[] = [];
  stmts.push(db.prepare(`DELETE FROM review_tracker WHERE project_id = ?`).bind(projectId));

  for (const [drawingId, assignees] of Object.entries(data)) {
    if (!assignees || typeof assignees !== 'object') continue;
    for (const [reviewerId, info] of Object.entries(assignees as Record<string, any>)) {
      stmts.push(db.prepare(
        `INSERT INTO review_tracker (project_id, drawing_id, raw_drawing_ref, reviewer_id, done, done_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).bind(
        projectId, drawingId, drawingId, reviewerId,
        toBooleanValue(info.done) ? 1 : 0, toStringValue(info.doneAt) || null
      ));
    }
  }
  return stmts;
};

const saveReviewTrackerData = async (db: D1Database, projectId: string, data: any) => {
  const stmts = buildReviewTrackerStatements(db, projectId, data);
  if (stmts.length > 0) {
    const chunkSize = 80;
    for (let i = 0; i < stmts.length; i += chunkSize) {
      const chunk = stmts.slice(i, i + chunkSize);
      await db.batch(chunk);
    }
  }
};

const handleHealth = async (env: Env) => {
  const db = requireDb(env);
  const settingsSource = 'api_settings';
  const settingsCountRow = await db.prepare(`SELECT COUNT(*) AS count FROM ${settingsSource}`).first<{ count: number | string }>();

  return json(env, 200, {
    ok: true,
    service: 'papc-d1-api',
    database: 'connected',
    settingsSource,
    appSettingsRows: Number(settingsCountRow?.count || 0),
  });
};

const notImplemented = (env: Env, method: string, path: string) =>
  json(env, 501, {
    error: 'Not implemented in phase 2 scaffold.',
    method,
    path,
    supportedToday: [
      'GET /health',
      'GET /settings',
      'GET /projects',
      'POST /projects/:projectId',
      'GET /projects/:projectId/review-tracker',
    ],
  });

const handleAdminRequest = async (request: Request, env: Env, url: URL): Promise<Response> => {
  if (url.pathname === '/admin') {
    return new Response(adminHtml, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  }

  const pwd = env.ADMIN_PASSWORD || 'papc-admin-2026';
  const adminToken = 'admin_token_' + btoa(pwd).substring(0, 10);

  if (url.pathname === '/admin/auth' && request.method === 'POST') {
    const body = await request.json() as any;
    if (body.password === pwd) return json(env, 200, { token: adminToken });
    return json(env, 401, { error: 'Unauthorized' });
  }

  const authHeader = request.headers.get('Authorization');
  if (authHeader !== `Bearer ${adminToken}`) return json(env, 401, { error: 'Unauthorized' });

  const db = requireDb(env);
  const segments = url.pathname.split('/').filter(Boolean);

  if (segments.length >= 3 && segments[1] === 'api' && segments[2] === 'tables') {
    if (segments.length === 3 && request.method === 'GET') {
      const tablesRaw = await queryAll(db, `SELECT name FROM sqlite_master WHERE type='table'`);
      const tables: any[] = [];
      for (const t of tablesRaw) {
        const name = toStringValue(t.name);
        if (!name || name.startsWith('sqlite_') || name.startsWith('d1_') || name.startsWith('_cf_') || name === 'sqlite_sequence') continue;
        const countRow = await db.prepare(`SELECT COUNT(*) AS c FROM ${name}`).first<{ c: number }>();
        tables.push({ name, count: countRow?.c || 0 });
      }
      return json(env, 200, { tables });
    }

    const table = segments[3];
    if (!table) return json(env, 400, { error: 'Table required' });

    const ALLOWED_TABLES = [
      'projects', 'reviewers', 'drawings', 'drawing_assignees',
      'drawing_status_history', 'review_tracker', 'discipline_defaults',
      'discipline_default_assignees', 'project_settings', 'snapshots', 'audit_log'
    ];
    if (!ALLOWED_TABLES.includes(table)) return json(env, 403, { error: 'Forbidden table' });

    if (segments.length === 5 && segments[4] === 'schema' && request.method === 'GET') {
      const schemaRows = await queryAll(db, `PRAGMA table_info(${table})`);
      return json(env, 200, { schema: schemaRows as any });
    }

    if (segments.length === 4 && request.method === 'GET') {
      const page = Math.max(1, Number(url.searchParams.get('page')) || 1);
      const search = url.searchParams.get('search') || '';
      const pageSize = 50;
      const offset = (page - 1) * pageSize;

      const projectId = url.searchParams.get('projectId');

      let whereStr = '';
      const params: any[] = [];
      const schemaRows = await queryAll(db, `PRAGMA table_info(${table})`);
      const colNames = schemaRows.map(r => toStringValue(r.name)).filter(Boolean) as string[];

      if (search && colNames.length > 0) {
        whereStr = 'WHERE (' + colNames.map(c => `CAST(${c} AS TEXT) LIKE ?`).join(' OR ') + ')';
        colNames.forEach(() => params.push(`%${search}%`));
      }

      if (colNames.includes('_deleted')) {
        whereStr = (whereStr ? whereStr + ' AND ' : 'WHERE ') + `IFNULL(_deleted, 0) != 1`;
      }

      if (projectId) {
        if (table === 'projects') {
          whereStr = (whereStr ? whereStr + ' AND ' : 'WHERE ') + `id = ?`;
          params.push(projectId);
        } else if (colNames.includes('project_id')) {
          whereStr = (whereStr ? whereStr + ' AND ' : 'WHERE ') + `project_id = ?`;
          params.push(projectId);
        } else if (table === 'drawing_status_history' || table === 'drawing_assignees') {
          whereStr = (whereStr ? whereStr + ' AND ' : 'WHERE ') + `drawing_id IN (SELECT id FROM drawings WHERE project_id = ?)`;
          params.push(projectId);
        }
      }

      let selectClause = '*';
      if (colNames.includes('drawing_id') && colNames.includes('raw_drawing_ref')) {
        selectClause = `*, (SELECT custom_id FROM drawings d WHERE d.id = COALESCE(${table}.drawing_id, ${table}.raw_drawing_ref)) AS _custom_id`;
      } else if (colNames.includes('drawing_id')) {
        selectClause = `*, (SELECT custom_id FROM drawings d WHERE d.id = ${table}.drawing_id) AS _custom_id`;
      }

      const totalRow = await queryFirst(db, `SELECT COUNT(*) AS c FROM ${table} ${whereStr}`, params);
      const rows = await queryAll(db, `SELECT ${selectClause} FROM ${table} ${whereStr} LIMIT ? OFFSET ?`, [...params, pageSize, offset]);
      return json(env, 200, { rows: rows as any, total: Number(totalRow?.c) || 0, page, pageSize });
    }

    if (segments.length === 4 && request.method === 'POST') {
      const body = await request.json() as any;
      const cols = Object.keys(body);
      const vals = Object.values(body);
      const placeholders = cols.map(() => '?').join(',');
      await db.prepare(`INSERT INTO ${table} (${cols.join(',')}) VALUES (${placeholders})`).bind(...vals).run();

      const auditDetails = JSON.stringify(body);
      await db.prepare(`INSERT INTO audit_log (table_name, action, detail) VALUES (?, ?, ?)`).bind(table, 'INSERT', auditDetails).run();
      return json(env, 200, { success: true });
    }

    if (segments.length === 5 && request.method === 'PUT') {
      const id = decodeURIComponent(segments[4]);
      const body = await request.json() as any;
      const cols = Object.keys(body);
      const vals = Object.values(body);

      const schemaRows = await queryAll(db, `PRAGMA table_info(${table})`);
      const colNames = schemaRows.map(r => toStringValue(r.name)).filter(Boolean) as string[];
      let pkCol = 'id';
      if (!colNames.includes('id') && colNames.includes('project_id')) pkCol = 'project_id';

      // Ensure pkCol is not updated
      const updateCols = cols.filter(c => c !== pkCol);
      const updateVals = updateCols.map(c => body[c]);
      const setStr = updateCols.map(c => `${c}=?`).join(',');

      await db.prepare(`UPDATE ${table} SET ${setStr} WHERE ${pkCol} = ?`).bind(...updateVals, id).run();

      const auditDetails = JSON.stringify({ id, updates: body });
      await db.prepare(`INSERT INTO audit_log (table_name, row_id, action, detail) VALUES (?, ?, ?, ?)`).bind(table, id, 'UPDATE', auditDetails).run();
      return json(env, 200, { success: true });
    }

    if (segments.length === 5 && request.method === 'DELETE') {
      const id = decodeURIComponent(segments[4]);
      const schemaRows = await queryAll(db, `PRAGMA table_info(${table})`);
      const colNames = schemaRows.map(r => toStringValue(r.name)).filter(Boolean) as string[];
      let pkCol = 'id';
      if (!colNames.includes('id') && colNames.includes('project_id')) pkCol = 'project_id';

      if (colNames.includes('_deleted')) {
        await db.prepare(`UPDATE ${table} SET _deleted = 1 WHERE ${pkCol} = ?`).bind(id).run();
      } else {
        await db.prepare(`DELETE FROM ${table} WHERE ${pkCol} = ?`).bind(id).run();
      }

      await db.prepare(`INSERT INTO audit_log (table_name, row_id, action) VALUES (?, ?, ?)`).bind(table, id, 'DELETE').run();
      return json(env, 200, { success: true });
    }
  }

  if (segments.length === 3 && segments[1] === 'api' && segments[2] === 'sql' && request.method === 'POST') {
    const body = await request.json() as { query: string };
    const sql = body.query.trim();
    if (sql.toUpperCase().startsWith('DROP') || sql.toUpperCase().startsWith('ALTER') || sql.toUpperCase().startsWith('CREATE') || sql.toUpperCase().startsWith('ATTACH')) {
      return json(env, 400, { error: 'DDL not allowed' });
    }
    const res = await db.prepare(sql).all();

    if (!sql.toUpperCase().startsWith('SELECT')) {
      await db.prepare(`INSERT INTO audit_log (table_name, action, detail) VALUES (?, ?, ?)`).bind('SQL', 'EXECUTE', sql).run();
    }

    return json(env, 200, { results: (res.results as any) || [] });
  }

  return json(env, 404, { error: 'Admin API not found' });
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: withCors(new Headers(), env) });
    }

    if (!isAuthorized(request, env)) {
      return json(env, 401, { error: 'Unauthorized' });
    }

    try {
      const url = new URL(request.url);
      const path = url.pathname;

      if (path.startsWith('/admin')) {
        return handleAdminRequest(request, env, url);
      }

      const expectedToken = env.API_TOKEN?.trim() || '';
      const segments = path.split('/').filter(Boolean);

      if (path === '/') {
        return json(env, 200, {
          service: 'papc-d1-api',
          phase: 'read-first',
          endpoints: [
            'GET /health',
            'GET /settings',
            'GET /projects',
            'POST /projects/:projectId',
            'GET /projects/:projectId/review-tracker',
          ],
        });
      }

      if (path === '/health' && request.method === 'GET') {
        return handleHealth(env);
      }

      const db = requireDb(env);

      if (path === '/settings' && request.method === 'GET') {
        return json(env, 200, await getSettings(db));
      }

      if (path === '/projects' && request.method === 'GET') {
        return json(env, 200, await getProjectList(db));
      }

      if (segments[0] === 'projects' && segments[1]) {
        const projectId = decodeURIComponent(segments[1]);

        if (segments.length === 2 && request.method === 'POST') {
          const body = await request.json() as any;
          const project = await getProjectDetail(db, projectId);
          if (!project) {
            return json(env, 404, { error: `Project not found: ${projectId}` });
          }

          // Password validation
          const projectPassword = (project.conf as any)?.password;
          if (projectPassword && projectPassword.trim() !== '') {
            if (!body.password) {
              return text(env, 401, 'PASSWORD_REQUIRED');
            }
            if (body.password !== projectPassword) {
              return text(env, 401, 'INVALID_PASSWORD');
            }
          }

          return json(env, 200, project as JsonValue);
        }

        if (segments.length === 2 && request.method === 'PUT') {
          const body = await request.json() as any;
          await saveProjectData(db, projectId, body.project, body.reviewTracker);
          return json(env, 200, { success: true });
        }

        if (segments.length === 2 && request.method === 'PATCH') {
          const body = await request.json() as any;
          const stmts: D1PreparedStatement[] = [];

          // 1. Upsert only the changed drawings
          if (Array.isArray(body.updatedDrawings)) {
            for (const drawing of body.updatedDrawings) {
              const id = toStringValue(drawing.id) || crypto.randomUUID();
              stmts.push(db.prepare(
                `INSERT INTO drawings (id, project_id, custom_id, drawing_no, discipline, title, status, version, current_round, review_deadline, manual_comments_count, manual_open_comments_count, checked, checked_synced, received_date, category, deadline)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                 ON CONFLICT(id) DO UPDATE SET
                   custom_id=excluded.custom_id, drawing_no=excluded.drawing_no, discipline=excluded.discipline, title=excluded.title,
                   status=excluded.status, version=excluded.version, current_round=excluded.current_round, review_deadline=excluded.review_deadline,
                   manual_comments_count=excluded.manual_comments_count, manual_open_comments_count=excluded.manual_open_comments_count,
                   checked=excluded.checked, checked_synced=excluded.checked_synced,
                   received_date=excluded.received_date, category=excluded.category, deadline=excluded.deadline`
              ).bind(
                id, projectId, toStringValue(drawing.customId) || '', toStringValue(drawing.drawingNo) || '',
                toStringValue(drawing.discipline) || '', toStringValue(drawing.title) || '',
                toStringValue(drawing.status) || 'Pending', toStringValue(drawing.version) || '',
                toStringValue(drawing.currentRound) || 'A', toStringValue(drawing.reviewDeadline) || null,
                toNumberValue(drawing.manualCommentsCount, 0), toNumberValue(drawing.manualOpenCommentsCount, 0),
                toBooleanValue(drawing.checked) ? 1 : 0, toBooleanValue(drawing.checkedSynced) ? 1 : 0,
                toStringValue(drawing.receivedDate) || null, toStringValue(drawing.category) || null, toStringValue(drawing.deadline) || null
              ));

              // Assignees
              stmts.push(db.prepare(`DELETE FROM drawing_assignees WHERE drawing_id = ?`).bind(id));
              if (Array.isArray(drawing.assignees)) {
                for (const assignee of drawing.assignees) {
                  stmts.push(db.prepare(`INSERT INTO drawing_assignees (drawing_id, reviewer_id) VALUES (?, ?)`).bind(id, String(assignee)));
                }
              }

              // Status History
              stmts.push(db.prepare(`DELETE FROM drawing_status_history WHERE drawing_id = ?`).bind(id));
              if (Array.isArray(drawing.statusHistory)) {
                for (const history of drawing.statusHistory) {
                  stmts.push(db.prepare(`INSERT INTO drawing_status_history (id, drawing_id, content, created_at) VALUES (?, ?, ?, ?)`).bind(
                    toStringValue(history.id) || crypto.randomUUID(), id,
                    toStringValue(history.content) || '', toStringValue(history.createdAt) || new Date().toISOString()
                  ));
                }
              }

              // Remarks (Internal Notes)
              stmts.push(db.prepare(`DELETE FROM drawing_remarks WHERE drawing_id = ?`).bind(id));
              if (Array.isArray(drawing.remarks)) {
                for (const remark of drawing.remarks) {
                  stmts.push(db.prepare(
                    `INSERT INTO drawing_remarks (id, project_id, drawing_id, content, created_at, resolved) VALUES (?, ?, ?, ?, ?, ?)`
                  ).bind(
                    toStringValue(remark.id) || crypto.randomUUID(), projectId, id,
                    toStringValue(remark.content) || '', toStringValue(remark.createdAt) || new Date().toISOString(),
                    toBooleanValue(remark.resolved) ? 1 : 0
                  ));
                }
              }
            }
          }

          // 2. Delete drawings
          if (Array.isArray(body.deletedDrawingIds)) {
            for (const delId of body.deletedDrawingIds) {
              stmts.push(db.prepare(`DELETE FROM drawing_assignees WHERE drawing_id = ?`).bind(delId));
              stmts.push(db.prepare(`DELETE FROM drawing_status_history WHERE drawing_id = ?`).bind(delId));
              stmts.push(db.prepare(`DELETE FROM drawing_remarks WHERE drawing_id = ?`).bind(delId));
              stmts.push(db.prepare(`DELETE FROM drawings WHERE project_id = ? AND id = ?`).bind(projectId, delId));
            }
          }

          // 3. Update conf (if provided)
          if (body.conf) {
            const conf = body.conf;
            const settingsMap: Record<string, any> = {
              displayName: conf.displayName,
              password: conf.password,
              holidays: Array.isArray(conf.holidays) ? JSON.stringify(conf.holidays) : undefined,
              roundACycle: conf.roundACycle,
              otherRoundsCycle: conf.otherRoundsCycle,
              autoSyncInterval: conf.autoSyncInterval
            };
            for (const [key, val] of Object.entries(settingsMap)) {
              if (val !== undefined && val !== null) {
                stmts.push(db.prepare(
                  `INSERT INTO project_settings (project_id, setting_key, setting_value)
                   VALUES (?, ?, ?)
                   ON CONFLICT(project_id, setting_key) DO UPDATE SET setting_value=excluded.setting_value`
                ).bind(projectId, key, String(val)));
              }
            }
            if (conf.disciplineDefaults && typeof conf.disciplineDefaults === 'object') {
              stmts.push(db.prepare(`DELETE FROM discipline_defaults WHERE project_id = ?`).bind(projectId));
              for (const [discipline, reviewerId] of Object.entries(conf.disciplineDefaults)) {
                if (reviewerId) {
                  stmts.push(db.prepare(
                    `INSERT INTO discipline_defaults (project_id, discipline, reviewer_id) VALUES (?, ?, ?)`
                  ).bind(projectId, discipline, String(reviewerId)));
                }
              }
            }
            if (conf.defaultAssignees && typeof conf.defaultAssignees === 'object') {
              stmts.push(db.prepare(`DELETE FROM discipline_default_assignees WHERE project_id = ?`).bind(projectId));
              for (const [discipline, reviewerIds] of Object.entries(conf.defaultAssignees as Record<string, any>)) {
                if (Array.isArray(reviewerIds)) {
                  for (const revId of reviewerIds) {
                    stmts.push(db.prepare(
                      `INSERT INTO discipline_default_assignees (project_id, discipline, reviewer_id) VALUES (?, ?, ?)`
                    ).bind(projectId, discipline, String(revId)));
                  }
                }
              }
            }
            if (Array.isArray(conf.reviewers)) {
              for (const rev of conf.reviewers) {
                if (rev.id) {
                  stmts.push(db.prepare(
                    `INSERT INTO reviewers (id, display_name) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET display_name=excluded.display_name`
                  ).bind(rev.id, rev.name || rev.id));
                }
              }
            }
          }

          // 4. Incremental review tracker update (merge, not full replace)
          if (body.reviewTracker && typeof body.reviewTracker === 'object') {
            for (const [drawingId, assignees] of Object.entries(body.reviewTracker)) {
              if (!assignees || typeof assignees !== 'object') continue;
              for (const [reviewerId, info] of Object.entries(assignees as Record<string, any>)) {
                stmts.push(db.prepare(
                  `INSERT INTO review_tracker (project_id, drawing_id, raw_drawing_ref, reviewer_id, done, done_at)
                   VALUES (?, ?, ?, ?, ?, ?)
                   ON CONFLICT(project_id, drawing_id, reviewer_id) DO UPDATE SET
                     done=excluded.done, done_at=excluded.done_at`
                ).bind(
                  projectId, drawingId, drawingId, reviewerId,
                  toBooleanValue(info.done) ? 1 : 0, toStringValue(info.doneAt) || null
                ));
              }
            }
          }

          // Update last_updated timestamp
          stmts.push(db.prepare(`UPDATE projects SET last_updated = datetime('now') WHERE id = ?`).bind(projectId));

          // Execute batch
          if (stmts.length > 0) {
            const chunkSize = 80;
            for (let i = 0; i < stmts.length; i += chunkSize) {
              await db.batch(stmts.slice(i, i + chunkSize));
            }
          }

          return json(env, 200, { success: true, mode: 'delta', statements: stmts.length });
        }

        if (segments.length === 3 && segments[2] === 'review-tracker') {
          if (request.method === 'GET') {
            return json(env, 200, await getReviewTracker(db, projectId));
          }
          if (request.method === 'PUT') {
            const data = await request.json() as any;
            await saveReviewTrackerData(db, projectId, data);
            return json(env, 200, { success: true });
          }
        }

        const isSnapshotEnd = segments.length >= 3 && segments[2] === 'snapshots';
        if (isSnapshotEnd) {
          if (segments.length === 3 && request.method === 'GET') {
            const all = url.searchParams.get('all') === '1';
            const limit = all ? '' : 'LIMIT 10';
            const rows = await queryAll(db, `SELECT id, note, created_at FROM snapshots WHERE project_id = ? ORDER BY created_at DESC ${limit}`, [projectId]);
            const snaps = rows.map(r => ({ id: toStringValue(r.id), note: toStringValue(r.note), timestamp: toStringValue(r.created_at) }));
            return json(env, 200, snaps);
          }
          if (segments.length === 3 && request.method === 'POST') {
            const body = await request.json() as any;
            const note = toStringValue(body?.note) || `Snapshot ${new Date().toLocaleString()}`;

            const projectData = await getProjectDetail(db, projectId);
            const dataJson = JSON.stringify(projectData);

            await db.prepare(`INSERT INTO snapshots (id, project_id, note, data_json) VALUES (?, ?, ?, ?)`).bind(
              crypto.randomUUID(), projectId, note, dataJson
            ).run();
            return json(env, 200, { success: true });
          }
          if (segments.length === 4 && request.method === 'DELETE') {
            const snapshotId = decodeURIComponent(segments[3]);
            await db.prepare(`DELETE FROM snapshots WHERE project_id = ? AND id = ?`).bind(projectId, snapshotId).run();
            return json(env, 200, { success: true });
          }
          if (segments.length === 5 && segments[4] === 'restore' && request.method === 'POST') {
            const snapshotId = decodeURIComponent(segments[3]);
            const snap = await queryFirst(db, `SELECT data_json FROM snapshots WHERE project_id = ? AND id = ?`, [projectId, snapshotId]);
            if (!snap) return json(env, 404, { error: 'Snapshot not found' });

            const projectData = readJson<Record<string, unknown>>(toStringValue(snap.data_json), {});
            if (projectData && Object.keys(projectData).length > 0) {
              await saveProjectData(db, projectId, projectData, {});
            }
            return json(env, 200, { success: true });
          }
        }
      }

      return notImplemented(env, request.method, path);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('Worker request failed.', error);
      const status = message.includes('Missing D1 binding') ? 503 : 500;
      return text(env, status, message);
    }
  },
};

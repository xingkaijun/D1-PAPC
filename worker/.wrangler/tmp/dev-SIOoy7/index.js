var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/index.ts
import adminHtml from "./a884cc1c181325d8f9d331d352de22a0503b01f2-admin.html";
var jsonHeaders = {
  "Content-Type": "application/json; charset=utf-8"
};
var readJson = /* @__PURE__ */ __name((raw, fallback) => {
  if (!raw) {
    return fallback;
  }
  try {
    return JSON.parse(raw);
  } catch (error) {
    console.warn("Failed to parse JSON from D1 row.", error);
    return fallback;
  }
}, "readJson");
var toStringValue = /* @__PURE__ */ __name((value) => {
  if (value === null || value === void 0) return void 0;
  return String(value);
}, "toStringValue");
var toNumberValue = /* @__PURE__ */ __name((value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}, "toNumberValue");
var toBooleanValue = /* @__PURE__ */ __name((value) => {
  if (value === null || value === void 0) return void 0;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["1", "true", "yes", "y"].includes(normalized)) return true;
    if (["0", "false", "no", "n"].includes(normalized)) return false;
  }
  return void 0;
}, "toBooleanValue");
var withCors = /* @__PURE__ */ __name((headers, env) => {
  headers.set("Access-Control-Allow-Origin", env.ALLOW_CORS_ORIGIN || "*");
  headers.set("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  return headers;
}, "withCors");
var json = /* @__PURE__ */ __name((env, status, body) => {
  const headers = withCors(new Headers(jsonHeaders), env);
  return new Response(JSON.stringify(body), { status, headers });
}, "json");
var text = /* @__PURE__ */ __name((env, status, body) => {
  const headers = withCors(new Headers({ "Content-Type": "text/plain; charset=utf-8" }), env);
  return new Response(body, { status, headers });
}, "text");
var requireDb = /* @__PURE__ */ __name((env) => {
  if (!env.PAPC_DB) {
    throw new Error("Missing D1 binding `PAPC_DB`.");
  }
  return env.PAPC_DB;
}, "requireDb");
var isAuthorized = /* @__PURE__ */ __name((request, env) => {
  if (!env.API_TOKEN) {
    return true;
  }
  const auth = request.headers.get("Authorization");
  return auth === `Bearer ${env.API_TOKEN}`;
}, "isAuthorized");
var queryAll = /* @__PURE__ */ __name(async (db, query, values = []) => {
  return (await db.prepare(query).bind(...values).all()).results || [];
}, "queryAll");
var queryFirst = /* @__PURE__ */ __name(async (db, query, values = []) => db.prepare(query).bind(...values).first(), "queryFirst");
var getProjectList = /* @__PURE__ */ __name(async (db) => {
  const rows = await queryAll(
    db,
    `SELECT id, name, webdav_path, last_updated
     FROM api_projects
     ORDER BY name COLLATE NOCASE ASC`
  );
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    webdavPath: row.webdav_path || void 0,
    lastUpdated: row.last_updated || void 0
  }));
}, "getProjectList");
var getSettings = /* @__PURE__ */ __name(async (db) => {
  const row = await queryFirst(db, "SELECT value, updated_at FROM api_settings LIMIT 1");
  return readJson(row?.value, {});
}, "getSettings");
var getProjectDetail = /* @__PURE__ */ __name(async (db, projectId) => {
  const row = await queryFirst(
    db,
    `SELECT id, name, webdav_path, last_updated, project_json, conf_json
     FROM api_project_details
     WHERE id = ?
     LIMIT 1`,
    [projectId]
  );
  if (!row) return null;
  const project = readJson(row.project_json, {});
  const conf = readJson(row.conf_json, {});
  return {
    ...project,
    id: row.id,
    name: row.name,
    webdavPath: row.webdav_path || void 0,
    conf,
    lastUpdated: row.last_updated || void 0
  };
}, "getProjectDetail");
var getReviewTracker = /* @__PURE__ */ __name(async (db, projectId) => {
  const row = await queryFirst(
    db,
    `SELECT data_json, updated_at
     FROM api_review_trackers
     WHERE project_id = ?
     LIMIT 1`,
    [projectId]
  );
  return readJson(row?.data_json, {});
}, "getReviewTracker");
var saveProjectData = /* @__PURE__ */ __name(async (db, projectId, project, reviewTracker) => {
  if (!project || !Array.isArray(project.drawings)) return;
  const stmts = [];
  const projectName = toStringValue(project.name) || projectId;
  const webdavPath = toStringValue(project.webdavPath) || "";
  stmts.push(db.prepare(
    `INSERT INTO projects (id, name, webdav_path, last_updated)
     VALUES (?, ?, ?, datetime('now'))
     ON CONFLICT(id) DO UPDATE SET 
       name=excluded.name, webdav_path=excluded.webdav_path, last_updated=excluded.last_updated`
  ).bind(projectId, projectName, webdavPath));
  const validIds = project.drawings.map((d) => toStringValue(d.id)).filter(Boolean);
  const existingRows = await queryAll(db, `SELECT id FROM drawings WHERE project_id = ?`, [projectId]);
  const toDelete = existingRows.map((r) => toStringValue(r.id)).filter((id) => id && !validIds.includes(id));
  for (const delId of toDelete) {
    stmts.push(db.prepare(`DELETE FROM drawings WHERE project_id = ? AND id = ?`).bind(projectId, delId));
  }
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
      id,
      projectId,
      toStringValue(drawing.customId) || "",
      toStringValue(drawing.drawingNo) || "",
      toStringValue(drawing.discipline) || "",
      toStringValue(drawing.title) || "",
      toStringValue(drawing.status) || "Pending",
      toStringValue(drawing.version) || "",
      toStringValue(drawing.currentRound) || "A",
      toStringValue(drawing.reviewDeadline) || null,
      toNumberValue(drawing.manualCommentsCount, 0),
      toNumberValue(drawing.manualOpenCommentsCount, 0),
      toBooleanValue(drawing.checked) ? 1 : 0,
      toBooleanValue(drawing.checkedSynced) ? 1 : 0,
      toStringValue(drawing.receivedDate) || null,
      toStringValue(drawing.category) || null,
      toStringValue(drawing.deadline) || null
    ));
    stmts.push(db.prepare(`DELETE FROM drawing_assignees WHERE drawing_id = ?`).bind(id));
    if (Array.isArray(drawing.assignees)) {
      for (const assignee of drawing.assignees) {
        stmts.push(db.prepare(`INSERT INTO drawing_assignees (drawing_id, reviewer_id) VALUES (?, ?)`).bind(id, String(assignee)));
      }
    }
    stmts.push(db.prepare(`DELETE FROM drawing_status_history WHERE drawing_id = ?`).bind(id));
    if (Array.isArray(drawing.statusHistory)) {
      for (const history of drawing.statusHistory) {
        stmts.push(db.prepare(`INSERT INTO drawing_status_history (id, drawing_id, content, created_at) VALUES (?, ?, ?, ?)`).bind(
          toStringValue(history.id) || crypto.randomUUID(),
          id,
          toStringValue(history.content) || "",
          toStringValue(history.createdAt) || (/* @__PURE__ */ new Date()).toISOString()
        ));
      }
    }
    stmts.push(db.prepare(`DELETE FROM drawing_remarks WHERE drawing_id = ?`).bind(id));
    if (Array.isArray(drawing.remarks)) {
      for (const remark of drawing.remarks) {
        stmts.push(db.prepare(
          `INSERT INTO drawing_remarks (id, project_id, drawing_id, content, created_at, resolved) VALUES (?, ?, ?, ?, ?, ?)`
        ).bind(
          toStringValue(remark.id) || crypto.randomUUID(),
          projectId,
          id,
          toStringValue(remark.content) || "",
          toStringValue(remark.createdAt) || (/* @__PURE__ */ new Date()).toISOString(),
          toBooleanValue(remark.resolved) ? 1 : 0
        ));
      }
    }
  }
  if (project.conf) {
    const conf = project.conf;
    const settingsMap = {
      displayName: conf.displayName,
      password: conf.password,
      holidays: Array.isArray(conf.holidays) ? JSON.stringify(conf.holidays) : "[]",
      roundACycle: conf.roundACycle,
      otherRoundsCycle: conf.otherRoundsCycle,
      autoSyncInterval: conf.autoSyncInterval
    };
    for (const [key, val] of Object.entries(settingsMap)) {
      if (val !== void 0 && val !== null) {
        stmts.push(db.prepare(
          `INSERT INTO project_settings (project_id, setting_key, setting_value)
           VALUES (?, ?, ?)
           ON CONFLICT(project_id, setting_key) DO UPDATE SET setting_value=excluded.setting_value`
        ).bind(projectId, key, String(val)));
      }
    }
    if (conf.disciplineDefaults && typeof conf.disciplineDefaults === "object") {
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
    if (conf.defaultAssignees && typeof conf.defaultAssignees === "object") {
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
    if (Array.isArray(conf.reviewers) && conf.reviewers.length > 0) {
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
  if (reviewTracker && typeof reviewTracker === "object" && Object.keys(reviewTracker).length > 0) {
    stmts.push(...buildReviewTrackerStatements(db, projectId, reviewTracker));
  }
  if (stmts.length > 0) {
    const chunkSize = 80;
    for (let i = 0; i < stmts.length; i += chunkSize) {
      const chunk = stmts.slice(i, i + chunkSize);
      await db.batch(chunk);
    }
  }
}, "saveProjectData");
var buildReviewTrackerStatements = /* @__PURE__ */ __name((db, projectId, data) => {
  const stmts = [];
  stmts.push(db.prepare(`DELETE FROM review_tracker WHERE project_id = ?`).bind(projectId));
  for (const [drawingId, assignees] of Object.entries(data)) {
    if (!assignees || typeof assignees !== "object") continue;
    for (const [reviewerId, info] of Object.entries(assignees)) {
      stmts.push(db.prepare(
        `INSERT INTO review_tracker (project_id, drawing_id, raw_drawing_ref, reviewer_id, done, done_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).bind(
        projectId,
        drawingId,
        drawingId,
        reviewerId,
        toBooleanValue(info.done) ? 1 : 0,
        toStringValue(info.doneAt) || null
      ));
    }
  }
  return stmts;
}, "buildReviewTrackerStatements");
var saveReviewTrackerData = /* @__PURE__ */ __name(async (db, projectId, data) => {
  const stmts = buildReviewTrackerStatements(db, projectId, data);
  if (stmts.length > 0) {
    const chunkSize = 80;
    for (let i = 0; i < stmts.length; i += chunkSize) {
      const chunk = stmts.slice(i, i + chunkSize);
      await db.batch(chunk);
    }
  }
}, "saveReviewTrackerData");
var handleHealth = /* @__PURE__ */ __name(async (env) => {
  const db = requireDb(env);
  const settingsSource = "api_settings";
  const settingsCountRow = await db.prepare(`SELECT COUNT(*) AS count FROM ${settingsSource}`).first();
  return json(env, 200, {
    ok: true,
    service: "papc-d1-api",
    database: "connected",
    settingsSource,
    appSettingsRows: Number(settingsCountRow?.count || 0)
  });
}, "handleHealth");
var notImplemented = /* @__PURE__ */ __name((env, method, path) => json(env, 501, {
  error: "Not implemented in phase 2 scaffold.",
  method,
  path,
  supportedToday: [
    "GET /health",
    "GET /settings",
    "GET /projects",
    "POST /projects/:projectId",
    "GET /projects/:projectId/review-tracker"
  ]
}), "notImplemented");
var handleAdminRequest = /* @__PURE__ */ __name(async (request, env, url) => {
  if (url.pathname === "/admin") {
    return new Response(adminHtml, { headers: { "Content-Type": "text/html; charset=utf-8" } });
  }
  const pwd = env.ADMIN_PASSWORD || "papc-admin-2026";
  const adminToken = "admin_token_" + btoa(pwd).substring(0, 10);
  if (url.pathname === "/admin/auth" && request.method === "POST") {
    const body = await request.json();
    if (body.password === pwd) return json(env, 200, { token: adminToken });
    return json(env, 401, { error: "Unauthorized" });
  }
  const authHeader = request.headers.get("Authorization");
  if (authHeader !== `Bearer ${adminToken}`) return json(env, 401, { error: "Unauthorized" });
  const db = requireDb(env);
  const segments = url.pathname.split("/").filter(Boolean);
  if (segments.length >= 3 && segments[1] === "api" && segments[2] === "tables") {
    if (segments.length === 3 && request.method === "GET") {
      const tablesRaw = await queryAll(db, `SELECT name FROM sqlite_master WHERE type='table'`);
      const tables = [];
      for (const t of tablesRaw) {
        const name = toStringValue(t.name);
        if (!name || name.startsWith("sqlite_") || name.startsWith("d1_") || name.startsWith("_cf_") || name === "sqlite_sequence") continue;
        const countRow = await db.prepare(`SELECT COUNT(*) AS c FROM ${name}`).first();
        tables.push({ name, count: countRow?.c || 0 });
      }
      return json(env, 200, { tables });
    }
    const table = segments[3];
    if (!table) return json(env, 400, { error: "Table required" });
    const ALLOWED_TABLES = [
      "projects",
      "reviewers",
      "drawings",
      "drawing_assignees",
      "drawing_status_history",
      "review_tracker",
      "discipline_defaults",
      "discipline_default_assignees",
      "project_settings",
      "snapshots",
      "audit_log"
    ];
    if (!ALLOWED_TABLES.includes(table)) return json(env, 403, { error: "Forbidden table" });
    if (segments.length === 5 && segments[4] === "schema" && request.method === "GET") {
      const schemaRows = await queryAll(db, `PRAGMA table_info(${table})`);
      return json(env, 200, { schema: schemaRows });
    }
    if (segments.length === 4 && request.method === "GET") {
      const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
      const search = url.searchParams.get("search") || "";
      const pageSize = 50;
      const offset = (page - 1) * pageSize;
      const projectId = url.searchParams.get("projectId");
      let whereStr = "";
      const params = [];
      const schemaRows = await queryAll(db, `PRAGMA table_info(${table})`);
      const colNames = schemaRows.map((r) => toStringValue(r.name)).filter(Boolean);
      if (search && colNames.length > 0) {
        whereStr = "WHERE (" + colNames.map((c) => `CAST(${c} AS TEXT) LIKE ?`).join(" OR ") + ")";
        colNames.forEach(() => params.push(`%${search}%`));
      }
      if (colNames.includes("_deleted")) {
        whereStr = (whereStr ? whereStr + " AND " : "WHERE ") + `IFNULL(_deleted, 0) != 1`;
      }
      if (projectId) {
        if (table === "projects") {
          whereStr = (whereStr ? whereStr + " AND " : "WHERE ") + `id = ?`;
          params.push(projectId);
        } else if (colNames.includes("project_id")) {
          whereStr = (whereStr ? whereStr + " AND " : "WHERE ") + `project_id = ?`;
          params.push(projectId);
        } else if (table === "drawing_status_history" || table === "drawing_assignees") {
          whereStr = (whereStr ? whereStr + " AND " : "WHERE ") + `drawing_id IN (SELECT id FROM drawings WHERE project_id = ?)`;
          params.push(projectId);
        }
      }
      let selectClause = "*";
      if (colNames.includes("drawing_id") && colNames.includes("raw_drawing_ref")) {
        selectClause = `*, (SELECT custom_id FROM drawings d WHERE d.id = COALESCE(${table}.drawing_id, ${table}.raw_drawing_ref)) AS _custom_id`;
      } else if (colNames.includes("drawing_id")) {
        selectClause = `*, (SELECT custom_id FROM drawings d WHERE d.id = ${table}.drawing_id) AS _custom_id`;
      }
      const totalRow = await queryFirst(db, `SELECT COUNT(*) AS c FROM ${table} ${whereStr}`, params);
      const rows = await queryAll(db, `SELECT ${selectClause} FROM ${table} ${whereStr} LIMIT ? OFFSET ?`, [...params, pageSize, offset]);
      return json(env, 200, { rows, total: Number(totalRow?.c) || 0, page, pageSize });
    }
    if (segments.length === 4 && request.method === "POST") {
      const body = await request.json();
      const cols = Object.keys(body);
      const vals = Object.values(body);
      const placeholders = cols.map(() => "?").join(",");
      await db.prepare(`INSERT INTO ${table} (${cols.join(",")}) VALUES (${placeholders})`).bind(...vals).run();
      const auditDetails = JSON.stringify(body);
      await db.prepare(`INSERT INTO audit_log (table_name, action, detail) VALUES (?, ?, ?)`).bind(table, "INSERT", auditDetails).run();
      return json(env, 200, { success: true });
    }
    if (segments.length === 5 && request.method === "PUT") {
      const id = decodeURIComponent(segments[4]);
      const body = await request.json();
      const cols = Object.keys(body);
      const vals = Object.values(body);
      const schemaRows = await queryAll(db, `PRAGMA table_info(${table})`);
      const colNames = schemaRows.map((r) => toStringValue(r.name)).filter(Boolean);
      let pkCol = "id";
      if (!colNames.includes("id") && colNames.includes("project_id")) pkCol = "project_id";
      const updateCols = cols.filter((c) => c !== pkCol);
      const updateVals = updateCols.map((c) => body[c]);
      const setStr = updateCols.map((c) => `${c}=?`).join(",");
      await db.prepare(`UPDATE ${table} SET ${setStr} WHERE ${pkCol} = ?`).bind(...updateVals, id).run();
      const auditDetails = JSON.stringify({ id, updates: body });
      await db.prepare(`INSERT INTO audit_log (table_name, row_id, action, detail) VALUES (?, ?, ?, ?)`).bind(table, id, "UPDATE", auditDetails).run();
      return json(env, 200, { success: true });
    }
    if (segments.length === 5 && request.method === "DELETE") {
      const id = decodeURIComponent(segments[4]);
      const schemaRows = await queryAll(db, `PRAGMA table_info(${table})`);
      const colNames = schemaRows.map((r) => toStringValue(r.name)).filter(Boolean);
      let pkCol = "id";
      if (!colNames.includes("id") && colNames.includes("project_id")) pkCol = "project_id";
      if (colNames.includes("_deleted")) {
        await db.prepare(`UPDATE ${table} SET _deleted = 1 WHERE ${pkCol} = ?`).bind(id).run();
      } else {
        await db.prepare(`DELETE FROM ${table} WHERE ${pkCol} = ?`).bind(id).run();
      }
      await db.prepare(`INSERT INTO audit_log (table_name, row_id, action) VALUES (?, ?, ?)`).bind(table, id, "DELETE").run();
      return json(env, 200, { success: true });
    }
  }
  if (segments.length === 3 && segments[1] === "api" && segments[2] === "sql" && request.method === "POST") {
    const body = await request.json();
    const sql = body.query.trim();
    if (sql.toUpperCase().startsWith("DROP") || sql.toUpperCase().startsWith("ALTER") || sql.toUpperCase().startsWith("CREATE") || sql.toUpperCase().startsWith("ATTACH")) {
      return json(env, 400, { error: "DDL not allowed" });
    }
    const res = await db.prepare(sql).all();
    if (!sql.toUpperCase().startsWith("SELECT")) {
      await db.prepare(`INSERT INTO audit_log (table_name, action, detail) VALUES (?, ?, ?)`).bind("SQL", "EXECUTE", sql).run();
    }
    return json(env, 200, { results: res.results || [] });
  }
  return json(env, 404, { error: "Admin API not found" });
}, "handleAdminRequest");
var src_default = {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: withCors(new Headers(), env) });
    }
    if (!isAuthorized(request, env)) {
      return json(env, 401, { error: "Unauthorized" });
    }
    try {
      const url = new URL(request.url);
      const path = url.pathname;
      if (path.startsWith("/admin")) {
        return handleAdminRequest(request, env, url);
      }
      const expectedToken = env.API_TOKEN?.trim() || "";
      const segments = path.split("/").filter(Boolean);
      if (path === "/") {
        return json(env, 200, {
          service: "papc-d1-api",
          phase: "read-first",
          endpoints: [
            "GET /health",
            "GET /settings",
            "GET /projects",
            "POST /projects/:projectId",
            "GET /projects/:projectId/review-tracker"
          ]
        });
      }
      if (path === "/health" && request.method === "GET") {
        return handleHealth(env);
      }
      const db = requireDb(env);
      if (path === "/settings" && request.method === "GET") {
        return json(env, 200, await getSettings(db));
      }
      if (path === "/projects" && request.method === "GET") {
        return json(env, 200, await getProjectList(db));
      }
      if (segments[0] === "projects" && segments[1]) {
        const projectId = decodeURIComponent(segments[1]);
        if (segments.length === 2 && request.method === "POST") {
          const body = await request.json();
          const project = await getProjectDetail(db, projectId);
          if (!project) {
            return json(env, 404, { error: `Project not found: ${projectId}` });
          }
          const projectPassword = project.conf?.password;
          if (projectPassword && projectPassword.trim() !== "") {
            if (!body.password) {
              return text(env, 401, "PASSWORD_REQUIRED");
            }
            if (body.password !== projectPassword) {
              return text(env, 401, "INVALID_PASSWORD");
            }
          }
          return json(env, 200, project);
        }
        if (segments.length === 2 && request.method === "PUT") {
          const body = await request.json();
          await saveProjectData(db, projectId, body.project, body.reviewTracker);
          return json(env, 200, { success: true });
        }
        if (segments.length === 2 && request.method === "PATCH") {
          const body = await request.json();
          const stmts = [];
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
                id,
                projectId,
                toStringValue(drawing.customId) || "",
                toStringValue(drawing.drawingNo) || "",
                toStringValue(drawing.discipline) || "",
                toStringValue(drawing.title) || "",
                toStringValue(drawing.status) || "Pending",
                toStringValue(drawing.version) || "",
                toStringValue(drawing.currentRound) || "A",
                toStringValue(drawing.reviewDeadline) || null,
                toNumberValue(drawing.manualCommentsCount, 0),
                toNumberValue(drawing.manualOpenCommentsCount, 0),
                toBooleanValue(drawing.checked) ? 1 : 0,
                toBooleanValue(drawing.checkedSynced) ? 1 : 0,
                toStringValue(drawing.receivedDate) || null,
                toStringValue(drawing.category) || null,
                toStringValue(drawing.deadline) || null
              ));
              stmts.push(db.prepare(`DELETE FROM drawing_assignees WHERE drawing_id = ?`).bind(id));
              if (Array.isArray(drawing.assignees)) {
                for (const assignee of drawing.assignees) {
                  stmts.push(db.prepare(`INSERT INTO drawing_assignees (drawing_id, reviewer_id) VALUES (?, ?)`).bind(id, String(assignee)));
                }
              }
              stmts.push(db.prepare(`DELETE FROM drawing_status_history WHERE drawing_id = ?`).bind(id));
              if (Array.isArray(drawing.statusHistory)) {
                for (const history of drawing.statusHistory) {
                  stmts.push(db.prepare(`INSERT INTO drawing_status_history (id, drawing_id, content, created_at) VALUES (?, ?, ?, ?)`).bind(
                    toStringValue(history.id) || crypto.randomUUID(),
                    id,
                    toStringValue(history.content) || "",
                    toStringValue(history.createdAt) || (/* @__PURE__ */ new Date()).toISOString()
                  ));
                }
              }
              stmts.push(db.prepare(`DELETE FROM drawing_remarks WHERE drawing_id = ?`).bind(id));
              if (Array.isArray(drawing.remarks)) {
                for (const remark of drawing.remarks) {
                  stmts.push(db.prepare(
                    `INSERT INTO drawing_remarks (id, project_id, drawing_id, content, created_at, resolved) VALUES (?, ?, ?, ?, ?, ?)`
                  ).bind(
                    toStringValue(remark.id) || crypto.randomUUID(),
                    projectId,
                    id,
                    toStringValue(remark.content) || "",
                    toStringValue(remark.createdAt) || (/* @__PURE__ */ new Date()).toISOString(),
                    toBooleanValue(remark.resolved) ? 1 : 0
                  ));
                }
              }
            }
          }
          if (Array.isArray(body.deletedDrawingIds)) {
            for (const delId of body.deletedDrawingIds) {
              stmts.push(db.prepare(`DELETE FROM drawing_assignees WHERE drawing_id = ?`).bind(delId));
              stmts.push(db.prepare(`DELETE FROM drawing_status_history WHERE drawing_id = ?`).bind(delId));
              stmts.push(db.prepare(`DELETE FROM drawing_remarks WHERE drawing_id = ?`).bind(delId));
              stmts.push(db.prepare(`DELETE FROM drawings WHERE project_id = ? AND id = ?`).bind(projectId, delId));
            }
          }
          if (body.conf) {
            const conf = body.conf;
            const settingsMap = {
              displayName: conf.displayName,
              password: conf.password,
              holidays: Array.isArray(conf.holidays) ? JSON.stringify(conf.holidays) : void 0,
              roundACycle: conf.roundACycle,
              otherRoundsCycle: conf.otherRoundsCycle,
              autoSyncInterval: conf.autoSyncInterval
            };
            for (const [key, val] of Object.entries(settingsMap)) {
              if (val !== void 0 && val !== null) {
                stmts.push(db.prepare(
                  `INSERT INTO project_settings (project_id, setting_key, setting_value)
                   VALUES (?, ?, ?)
                   ON CONFLICT(project_id, setting_key) DO UPDATE SET setting_value=excluded.setting_value`
                ).bind(projectId, key, String(val)));
              }
            }
            if (conf.disciplineDefaults && typeof conf.disciplineDefaults === "object") {
              stmts.push(db.prepare(`DELETE FROM discipline_defaults WHERE project_id = ?`).bind(projectId));
              for (const [discipline, reviewerId] of Object.entries(conf.disciplineDefaults)) {
                if (reviewerId) {
                  stmts.push(db.prepare(
                    `INSERT INTO discipline_defaults (project_id, discipline, reviewer_id) VALUES (?, ?, ?)`
                  ).bind(projectId, discipline, String(reviewerId)));
                }
              }
            }
            if (conf.defaultAssignees && typeof conf.defaultAssignees === "object") {
              stmts.push(db.prepare(`DELETE FROM discipline_default_assignees WHERE project_id = ?`).bind(projectId));
              for (const [discipline, reviewerIds] of Object.entries(conf.defaultAssignees)) {
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
          if (body.reviewTracker && typeof body.reviewTracker === "object") {
            for (const [drawingId, assignees] of Object.entries(body.reviewTracker)) {
              if (!assignees || typeof assignees !== "object") continue;
              for (const [reviewerId, info] of Object.entries(assignees)) {
                stmts.push(db.prepare(
                  `INSERT INTO review_tracker (project_id, drawing_id, raw_drawing_ref, reviewer_id, done, done_at)
                   VALUES (?, ?, ?, ?, ?, ?)
                   ON CONFLICT(project_id, drawing_id, reviewer_id) DO UPDATE SET
                     done=excluded.done, done_at=excluded.done_at`
                ).bind(
                  projectId,
                  drawingId,
                  drawingId,
                  reviewerId,
                  toBooleanValue(info.done) ? 1 : 0,
                  toStringValue(info.doneAt) || null
                ));
              }
            }
          }
          stmts.push(db.prepare(`UPDATE projects SET last_updated = datetime('now') WHERE id = ?`).bind(projectId));
          if (stmts.length > 0) {
            const chunkSize = 80;
            for (let i = 0; i < stmts.length; i += chunkSize) {
              await db.batch(stmts.slice(i, i + chunkSize));
            }
          }
          return json(env, 200, { success: true, mode: "delta", statements: stmts.length });
        }
        if (segments.length === 3 && segments[2] === "review-tracker") {
          if (request.method === "GET") {
            return json(env, 200, await getReviewTracker(db, projectId));
          }
          if (request.method === "PUT") {
            const data = await request.json();
            await saveReviewTrackerData(db, projectId, data);
            return json(env, 200, { success: true });
          }
        }
        const isSnapshotEnd = segments.length >= 3 && segments[2] === "snapshots";
        if (isSnapshotEnd) {
          if (segments.length === 3 && request.method === "GET") {
            const all = url.searchParams.get("all") === "1";
            const limit = all ? "" : "LIMIT 10";
            const rows = await queryAll(db, `SELECT id, note, created_at FROM snapshots WHERE project_id = ? ORDER BY created_at DESC ${limit}`, [projectId]);
            const snaps = rows.map((r) => ({ id: toStringValue(r.id), note: toStringValue(r.note), timestamp: toStringValue(r.created_at) }));
            return json(env, 200, snaps);
          }
          if (segments.length === 3 && request.method === "POST") {
            const body = await request.json();
            const note = toStringValue(body?.note) || `Snapshot ${(/* @__PURE__ */ new Date()).toLocaleString()}`;
            const projectData = await getProjectDetail(db, projectId);
            const dataJson = JSON.stringify(projectData);
            await db.prepare(`INSERT INTO snapshots (id, project_id, note, data_json) VALUES (?, ?, ?, ?)`).bind(
              crypto.randomUUID(),
              projectId,
              note,
              dataJson
            ).run();
            return json(env, 200, { success: true });
          }
          if (segments.length === 4 && request.method === "DELETE") {
            const snapshotId = decodeURIComponent(segments[3]);
            await db.prepare(`DELETE FROM snapshots WHERE project_id = ? AND id = ?`).bind(projectId, snapshotId).run();
            return json(env, 200, { success: true });
          }
          if (segments.length === 5 && segments[4] === "restore" && request.method === "POST") {
            const snapshotId = decodeURIComponent(segments[3]);
            const snap = await queryFirst(db, `SELECT data_json FROM snapshots WHERE project_id = ? AND id = ?`, [projectId, snapshotId]);
            if (!snap) return json(env, 404, { error: "Snapshot not found" });
            const projectData = readJson(toStringValue(snap.data_json), {});
            if (projectData && Object.keys(projectData).length > 0) {
              await saveProjectData(db, projectId, projectData, {});
            }
            return json(env, 200, { success: true });
          }
        }
      }
      return notImplemented(env, request.method, path);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      console.error("Worker request failed.", error);
      const status = message.includes("Missing D1 binding") ? 503 : 500;
      return text(env, status, message);
    }
  }
};

// C:/Users/Xing/AppData/Roaming/npm/node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// .wrangler/tmp/bundle-TjZ8f2/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default
];
var middleware_insertion_facade_default = src_default;

// C:/Users/Xing/AppData/Roaming/npm/node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-TjZ8f2/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=index.js.map

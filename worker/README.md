<h1>PAPC Cloudflare Worker Scaffold</h1>
<p>This folder contains the read-first Worker used by the existing frontend repository contract.</p>
<h2>Endpoints implemented now</h2>
<ul>
<li><code>GET /health</code></li>
<li><code>GET /settings</code></li>
<li><code>GET /projects</code></li>
<li><code>POST /projects/:projectId</code></li>
<li><code>GET /projects/:projectId/review-tracker</code></li>
</ul>
<p>All write and snapshot routes intentionally return <code>501 Not implemented</code> in this phase.</p>
<h2>What the Worker reads now</h2>
<p>The Worker now checks these sources in order:</p>
<ol>
<li><code>api_*</code> compatibility views if you create them</li>
<li>The original JSON-column scaffold tables</li>
<li>A normalized schema assembled at runtime from likely real tables:
<ul>
<li><code>settings</code></li>
<li><code>projects</code></li>
<li><code>project_configs</code></li>
<li><code>drawings</code></li>
<li><code>drawing_logs</code></li>
<li><code>remarks</code></li>
<li><code>review_tracker_entries</code></li>
</ul>
</li>
</ol>
<p>If your imported D1 database already uses those normalized table names, the read endpoints can work without duplicating data into a second model.</p>
<p>If your imported schema is close but not exact, use <a href="/mnt/kjxing/workspace/cf-PAPC/worker/sql/compat-views-from-normalized.sql" rel="nofollow">compat-views-from-normalized.sql</a> and adjust only the column names that differ.</p>
<h2>Local setup</h2>
<ol>
<li>Copy <code>worker/wrangler.toml.example</code> to <code>worker/wrangler.toml</code>.</li>
<li>Replace <code>database_id</code> with the actual D1 database ID for <code>papc-review-db-final</code>.</li>
<li>Optionally set <code>API_TOKEN</code>.</li>
<li>If needed, add compatibility views to the imported DB:</li>
</ol>
<pre><code>npx wrangler d1 execute papc-review-db-final --file=worker/sql/compat-views-from-normalized.sql
</code></pre>
<ol>
<li>Run with Wrangler:</li>
</ol>
<pre><code>npx wrangler dev --config worker/wrangler.toml
</code></pre>
<p>Then point the frontend at the Worker:</p>
<pre><code>VITE_DATA_API_BASE_URL=http://127.0.0.1:8787
VITE_DATA_API_TOKEN=
VITE_DATA_API_FALLBACK=true
</code></pre>
<h2>Write journal migration (required for existing databases)</h2>
<p>Status changes and comment-count changes are recorded into <code>audit_log</code>. Existing databases need the new <code>project_id</code> column and indexes before that works — <code>init-local.sql</code> and <code>admin-init.sql</code> already include them for fresh setups.</p>
<p>The migration is additive only: <code>ALTER TABLE audit_log ADD COLUMN</code> plus two <code>CREATE INDEX IF NOT EXISTS</code>. It touches no business table and rewrites no rows.</p>
<p>Check what the target database already has:</p>
<pre><code>npx wrangler d1 execute papc-review-db-final --remote --config worker/wrangler.toml \
  --command "SELECT name FROM pragma_table_info('audit_log')"
</code></pre>
<p>If <code>project_id</code> is absent, apply it (use <code>--local</code> instead of <code>--remote</code> for the wrangler-dev database):</p>
<pre><code>npx wrangler d1 execute papc-review-db-final --remote --config worker/wrangler.toml \
  --file=worker/sql/audit-journal.sql
</code></pre>
<p>If <code>project_id</code> is already present the <code>ALTER TABLE</code> fails with <code>duplicate column name</code> and wrangler stops there — harmless, but the two indexes will not have been created, so run those two <code>CREATE INDEX</code> statements on their own.</p>
<p>Skipping the migration is safe: journal writes fail closed (<code>writeJournal</code> only warns, business writes are unaffected) and the Log page's Server view reports the error instead of showing data.</p>
<p>Read the journal via <code>GET /projects/:projectId/audit?from=&lt;ISO&gt;&amp;to=&lt;ISO&gt;</code>. Both bounds are full ISO instants, not dates — the frontend converts local-day boundaries to UTC so a +08:00 day is not split at 08:00.</p>

<h2>Notes</h2>
<ul>
<li>If <code>VITE_DATA_API_BASE_URL</code> is unset, the frontend keeps using the existing WebDAV / OneDrive repository path.</li>
<li>If the Worker is configured but unavailable, the frontend still falls back unless <code>VITE_DATA_API_FALLBACK=false</code>.</li>
<li><code>POST /projects/:projectId</code> is preserved because the current frontend repository already uses that route for loading full project detail.</li>
<li><code>/health</code> now reports which settings source was detected so you can confirm whether the Worker is reading <code>api_settings</code>, <code>app_settings</code>, or <code>settings</code>.</li>
<li>Write routes (<code>PUT</code>/<code>PATCH</code> <code>/projects/:projectId</code>, <code>PUT /projects/:projectId/review-tracker</code>) return a <code>verification</code> block: the Worker re-reads what it just wrote and reports any drawing whose stored row does not match the request. A mismatch is still HTTP 200 — the write was partial, and the client decides what to retry.</li>
</ul>

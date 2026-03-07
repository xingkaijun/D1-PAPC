<h1>D1 Readiness Note</h1>
<p>This repo now has a dedicated data access boundary for persistence-related operations. The goal is to let the UI and Zustand store keep their current behavior while making it straightforward to swap in a Cloudflare Worker + D1 backend later.</p>
<h2>Current data paths</h2>
<p>Application persistence currently flows through these paths:</p>
<ul>
<li><code>store.ts</code>
<ul>
<li>Fetches global settings</li>
<li>Fetches project list</li>
<li>Loads project detail</li>
<li>Saves project detail</li>
<li>Loads and saves snapshots</li>
<li>Loads and saves review tracker data</li>
</ul>
</li>
<li><code>services/storage/WebDAVProvider.ts</code>
<ul>
<li>Reads/writes remote JSON files for WebDAV storage</li>
<li>Current JSON files include <code>PA_Settings.json</code>, <code>{project}/settings.json</code>, <code>{project}/PA_{project}.json</code>, <code>{project}/review-tracker.json</code>, and snapshot JSON files</li>
</ul>
</li>
<li><code>services/storage/OneDriveProxyProvider.ts</code>
<ul>
<li>Reads/writes the same logical JSON files through the OneDrive proxy</li>
</ul>
</li>
<li><code>components/Settings.tsx</code>
<ul>
<li>Local manual backup/export of a full project JSON file</li>
<li>Local manual restore/import of a full project JSON file</li>
</ul>
</li>
<li>Browser persistence
<ul>
<li>Zustand <code>persist(...)</code> stores <code>data</code> and <code>activeProjectId</code> in local browser storage</li>
</ul>
</li>
</ul>
<h2>What changed</h2>
<p>New data boundary files:</p>
<ul>
<li><code>services/data/AppRepository.ts</code>
<ul>
<li>Main app-facing repository selector</li>
<li>Uses a Cloudflare API backend when <code>VITE_DATA_API_BASE_URL</code> is configured</li>
<li>Falls back to the existing storage providers by default if the API is not configured or unavailable</li>
</ul>
</li>
<li><code>services/data/CloudflareApiRepository.ts</code>
<ul>
<li>Minimal HTTP client contract for a future Worker/D1 backend</li>
</ul>
</li>
<li><code>services/data/StorageProviderRepository.ts</code>
<ul>
<li>Adapter over the existing WebDAV and OneDrive providers</li>
</ul>
</li>
<li><code>services/data/localProjectFile.ts</code>
<ul>
<li>Isolates manual JSON backup/restore helpers used by the settings screen</li>
</ul>
</li>
</ul>
<p><code>store.ts</code> now talks to the repository layer instead of directly to provider classes.</p>
<h2>Expected Worker/D1 API shape</h2>
<p>If you later add a Cloudflare Worker, the current frontend expects these endpoints relative to <code>VITE_DATA_API_BASE_URL</code>:</p>
<ul>
<li><code>GET /health</code></li>
<li><code>GET /settings</code></li>
<li><code>GET /projects</code></li>
<li><code>POST /projects/:projectId</code>
<ul>
<li>request body: <code>{ &#34;password&#34;: &#34;optional&#34; }</code></li>
</ul>
</li>
<li><code>PUT /projects/:projectId</code>
<ul>
<li>request body: <code>{ &#34;project&#34;: Project, &#34;reviewTracker&#34;: ReviewTrackerData }</code></li>
</ul>
</li>
<li><code>GET /projects/:projectId/snapshots</code></li>
<li><code>GET /projects/:projectId/snapshots?all=1</code></li>
<li><code>POST /projects/:projectId/snapshots</code>
<ul>
<li>request body: <code>{ &#34;note&#34;: &#34;...&#34; }</code></li>
</ul>
</li>
<li><code>POST /projects/:projectId/snapshots/:snapshotId/restore</code></li>
<li><code>DELETE /projects/:projectId/snapshots/:snapshotId</code></li>
<li><code>GET /projects/:projectId/review-tracker</code></li>
<li><code>PUT /projects/:projectId/review-tracker</code></li>
</ul>
<p>Phase 2 scaffold status in this repo:</p>
<ul>
<li>Ready now in <code>worker/src/index.ts</code>
<ul>
<li><code>GET /health</code></li>
<li><code>GET /settings</code></li>
<li><code>GET /projects</code></li>
<li><code>POST /projects/:projectId</code></li>
<li><code>GET /projects/:projectId/review-tracker</code></li>
</ul>
</li>
<li>Stubbed with <code>501 Not implemented</code>
<ul>
<li><code>PUT /projects/:projectId</code></li>
<li>snapshot endpoints</li>
<li><code>PUT /projects/:projectId/review-tracker</code></li>
</ul>
</li>
</ul>
<h2>Frontend repository to API mapping</h2>
<p>The current React app already routes through <code>services/data/AppRepository.ts</code>. The mapping is:</p>
<p>| Frontend method | HTTP route | Phase 2 status |
| :--- | :--- | :--- |
| <code>appRepository.testConnection(...)</code> | <code>GET /health</code> | Ready |
| <code>appRepository.fetchGlobalSettings(...)</code> | <code>GET /settings</code> | Ready |
| <code>appRepository.fetchProjectList(...)</code> | <code>GET /projects</code> | Ready |
| <code>appRepository.loadProject(...)</code> | <code>POST /projects/:projectId</code> | Ready |
| <code>appRepository.loadReviewTracker(...)</code> | <code>GET /projects/:projectId/review-tracker</code> | Ready |
| <code>appRepository.saveProject(...)</code> | <code>PUT /projects/:projectId</code> | TODO |
| <code>appRepository.loadSnapshots(...)</code> | <code>GET /projects/:projectId/snapshots</code> | TODO |
| <code>appRepository.createSnapshot(...)</code> | <code>POST /projects/:projectId/snapshots</code> | TODO |
| <code>appRepository.restoreSnapshot(...)</code> | <code>POST /projects/:projectId/snapshots/:snapshotId/restore</code> | TODO |
| <code>appRepository.deleteSnapshot(...)</code> | <code>DELETE /projects/:projectId/snapshots/:snapshotId</code> | TODO |
| <code>appRepository.saveReviewTracker(...)</code> | <code>PUT /projects/:projectId/review-tracker</code> | TODO |</p>
<h2>Real-schema Worker direction</h2>
<p>Keep the UI contract stable and map it to the imported D1 schema behind the Worker:</p>
<ul>
<li><code>app_settings</code></li>
<li><code>projects</code></li>
<li><code>project_configs</code></li>
<li><code>drawings</code></li>
<li><code>drawing_logs</code></li>
<li><code>remarks</code></li>
<li><code>snapshots</code></li>
<li><code>review_tracker</code></li>
</ul>
<p>Start by preserving the existing frontend payload shape at the Worker boundary. Normalize inside the Worker, not in the React app.</p>
<p>The Worker is no longer limited to the original starter tables. It now prefers, in order:</p>
<ol>
<li><code>api_settings</code>, <code>api_projects</code>, <code>api_project_details</code>, <code>api_review_trackers</code> views</li>
<li>The earlier JSON-column scaffold tables</li>
<li>Direct assembly from normalized tables with these names:
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
<p>That means phase 3 can connect to <code>papc-review-db-final</code> without inventing a second storage model, as long as the imported schema either already uses those names or is close enough to expose them through thin <code>api_*</code> views.</p>
<p>See:</p>
<ul>
<li><code>worker/src/index.ts</code></li>
<li><code>worker/sql/compat-views-from-normalized.sql</code></li>
<li><code>worker/wrangler.toml.example</code></li>
</ul>
<h2>Frontend configuration</h2>
<p>Optional env vars for the future API path:</p>
<pre><code>VITE_DATA_API_BASE_URL=https://your-worker.example.workers.dev/
VITE_DATA_API_TOKEN=
VITE_DATA_API_FALLBACK=true
</code></pre>
<p>Notes:</p>
<ul>
<li>No Cloudflare credentials are required for local development.</li>
<li>If <code>VITE_DATA_API_BASE_URL</code> is not set, the app keeps using the current WebDAV/OneDrive storage flow.</li>
<li>If the API is configured but unavailable, the app falls back to the current storage providers unless <code>VITE_DATA_API_FALLBACK=false</code>.</li>
</ul>
<h2>Exact next steps to connect <code>papc-review-db-final</code></h2>
<ol>
<li>
<p>Install Wrangler in your usual way, or use <code>npx wrangler</code>.</p>
</li>
<li>
<p>Copy <code>worker/wrangler.toml.example</code> to <code>worker/wrangler.toml</code>.</p>
</li>
<li>
<p>Fetch the real D1 database ID for <code>papc-review-db-final</code>:</p>
<pre><code>npx wrangler d1 list
</code></pre>
</li>
<li>
<p>Replace <code>database_id = &#34;REPLACE_WITH_REAL_DATABASE_ID&#34;</code> in <code>worker/wrangler.toml</code>.</p>
</li>
<li>
<p>Inspect the imported schema so you know whether you can use the Worker’s direct normalized-table path as-is:</p>
<pre><code>npx wrangler d1 execute papc-review-db-final --command &#34;SELECT type, name FROM sqlite_master WHERE type IN (&#39;table&#39;,&#39;view&#39;) ORDER BY type, name&#34;
</code></pre>
</li>
<li>
<p>If the imported DB already has <code>settings</code>, <code>projects</code>, <code>project_configs</code>, <code>drawings</code>, <code>drawing_logs</code>, <code>remarks</code>, and <code>review_tracker_entries</code>, skip to step 8.</p>
</li>
<li>
<p>If the schema is close but column names differ, create compatibility views and adjust <code>worker/sql/compat-views-from-normalized.sql</code> as needed before applying it:</p>
<pre><code>npx wrangler d1 execute papc-review-db-final --file=worker/sql/compat-views-from-normalized.sql
</code></pre>
</li>
<li>
<p>Start the Worker locally:</p>
<pre><code>npx wrangler dev --config worker/wrangler.toml
</code></pre>
</li>
<li>
<p>Point the frontend to the Worker:</p>
<pre><code>VITE_DATA_API_BASE_URL=http://127.0.0.1:8787
VITE_DATA_API_TOKEN=
VITE_DATA_API_FALLBACK=true
</code></pre>
</li>
<li>
<p>Verify read paths in order:</p>
</li>
</ol>
<ul>
<li><code>GET /health</code>
<ul>
<li>confirm <code>settingsSource</code> is <code>api_settings</code>, <code>app_settings</code>, or <code>settings</code></li>
</ul>
</li>
<li>app bootstrap settings load</li>
<li>project selector list</li>
<li>project detail load</li>
<li>review tracker load</li>
</ul>
<ol>
<li>Once D1 reads are stable, implement writes and snapshots, then optionally set <code>VITE_DATA_API_FALLBACK=false</code>.</li>
</ol>

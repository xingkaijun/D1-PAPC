<h1>Anti-PAPC 图纸审批追踪系统操作手册</h1>
<h2>📚 简介</h2>
<p><strong>Anti-PAPC (Plan Approval Status Tracking System)</strong> 是一个专为海事/工程项目设计的图纸审批状态追踪与管理系统。它旨在帮助团队高效管理图纸的提交、审核、返修及批准流程，支持多项目管理、数据云同步（WebDAV）及自动化报表生成。</p>
<hr>
<h2>🚀 快速开始</h2>
<h3>1. 环境要求</h3>
<ul>
<li>Node.js (v16+)</li>
<li>现代浏览器 (Chrome, Edge 等)</li>
</ul>
<h3>2. 启动项目</h3>
<pre><code># 安装依赖
npm install

# 启动前端开发服务器
npm run dev

# (可选) 启动 OneDrive 代理服务器
cd server
npm install
npm start
</code></pre>
<h3>3. 初始登录</h3>
<ul>
<li>系统默认以“只读模式”运行。</li>
<li>点击右上角的 <strong>Lock/Unlock</strong> 按钮进入编辑模式。</li>
<li>默认无密码或使用环境变量配置的密码。</li>
</ul>
<hr>
<h2>🛠 功能详解</h2>
<h3>1. 项目大厅 (Dashboard)</h3>
<ul>
<li><strong>卡片式管理</strong>：每个卡片代表一个独立的项目。</li>
<li><strong>状态概览</strong>：直接显示项目内的图纸统计（Total, Reviewing, Overdue 等）。</li>
<li><strong>云同步状态</strong>：显示项目与 WebDAV 服务器的同步时间。</li>
<li><strong>操作</strong>：
<ul>
<li><code>Connect to Cloud</code>：首次连接 WebDAV 服务器。</li>
<li><code>New Project</code>：创建本地新项目。</li>
<li><code>Delete</code>：删除项目（需确认）。</li>
</ul>
</li>
</ul>
<h3>2. 图纸列表 (Drawing List)</h3>
<p>核心工作区，支持高效的数据录入与筛选。</p>
<ul>
<li><strong>筛选器 (Filter)</strong>：
<ul>
<li>顶部支持按状态筛选：<code>Pending</code>, <code>Reviewing</code>, <code>Waiting</code>, <code>Approved</code>。</li>
<li><strong>逻辑</strong>：多选时为 <strong>AND (且)</strong> 关系。例如同时选中 <code>Reviewing</code> 和 <code>Overdue</code>，仅显示既在审查中又超期的图纸。</li>
</ul>
</li>
<li><strong>搜索 (Search)</strong>：
<ul>
<li>支持搜索图纸号、标题、专业、自定义ID、负责人。</li>
</ul>
</li>
<li><strong>视图操作</strong>：
<ul>
<li><strong>列宽调整</strong>：拖动表头边缘调整列宽。</li>
<li><strong>排序</strong>：默认按添加顺序，支持分页。</li>
<li><strong>展开详情</strong>：点击行首箭头查看备注 (Remarks) 和历史记录 (Logs)。</li>
</ul>
</li>
<li><strong>编辑功能 (需解锁)</strong>：
<ul>
<li>双击单元格直接编辑内容。</li>
<li>右键菜单（或操作列）进行删除、状态变更。</li>
</ul>
</li>
<li><strong>批量导入 (Bulk Load)</strong>：
<ul>
<li>支持从 Excel/文本批量粘贴。</li>
<li>格式：<code>ID, Drawing No, Discipline, Title</code>。</li>
</ul>
</li>
</ul>
<h3>3. 进度追踪与截止日期</h3>
<ul>
<li><strong>自动计算</strong>：
<ul>
<li>输入 <code>Received Date</code> 和类别 (<code>A</code>/<code>B</code>/<code>C</code>) 后，系统根据预设周期（如 A类14天）自动计算 <code>Deadline</code>。</li>
<li>自动跳过配置的节假日 (<code>Holidays</code>) 和周末。</li>
</ul>
</li>
<li><strong>超期提醒</strong>：
<ul>
<li>临期或超期的图纸会高亮显示，<code>Overdue</code> 筛选器可快速定位。</li>
</ul>
</li>
</ul>
<h3>4. 报表与日志 (Reports)</h3>
<ul>
<li><strong>Daily Log</strong>：生成每日工作日志，汇总当天的图纸变动、评论及状态更新。</li>
<li><strong>打印模式</strong>：列表页提供 <code>Print List</code> 按钮，生成针对 A4 纸优化的打印视图。</li>
</ul>
<h3>5. 版本控制与快照 (Snapshots)</h3>
<ul>
<li><strong>手动快照</strong>：在设置中可手动创建当前项目的数据快照（备份）。</li>
<li><strong>时光倒流</strong>：随时查看或恢复到历史快照状态。</li>
</ul>
<hr>
<h2>⚙️ 系统设置 (Settings)</h2>
<h3>1. 全局配置</h3>
<ul>
<li><strong>Reviewers</strong>：配置审核人员名单。</li>
<li><strong>Discipline Defaults</strong>：设置各专业默认的审核负责人。</li>
<li><strong>Cycles</strong>：
<ul>
<li><code>Round A Cycle</code>：首次审核周期（默认14天）。</li>
<li><code>Other Rounds</code>：复审周期（默认7天）。</li>
</ul>
</li>
<li><strong>Holidays</strong>：配置节假日列表（YYYY-MM-DD），用于截止日期计算排除。</li>
</ul>
<h3>2. 数据存储 (Data Storage)</h3>
<p>系统支持两种模式：</p>
<ol>
<li><strong>WebDAV (推荐)</strong>：
<ul>
<li>直接连接 Nextcloud, Synology NAS 等支持 WebDAV 的网盘。</li>
<li>配置 <code>Server URL</code>, <code>Username</code>, <code>Password</code>。</li>
<li>数据以 <code>.json</code> 文件形式存储在云端。</li>
</ul>
</li>
<li><strong>OneDrive Proxy (高级)</strong>：
<ul>
<li>需启动本地 <code>server/</code> 目录下的代理服务。</li>
<li>通过 Microsoft Graph API 进行同步。</li>
</ul>
</li>
</ol>
<hr>
<h2>💡 使用技巧 (Tips)</h2>
<ol>
<li><strong>快速筛选</strong>：使用顶部筛选栏组合条件，例如查找 &#34;Hull&#34; 专业下 &#34;Reviewing&#34; 的图纸。</li>
<li><strong>备注管理</strong>：在图纸详情中添加备注，支持标记 <code>Resolved</code>（已解决），方便内部沟通。</li>
<li><strong>打印报表</strong>：月度汇报时，直接使用打印功能导出 PDF，版面已自动优化。</li>
<li><strong>安全锁定</strong>：离开座位前点击 <code>Unlock</code> 按钮重新上锁，防止误操作。</li>
</ol>
<hr>
<h2>⚠️ 注意事项</h2>
<ul>
<li><strong>数据同步</strong>：
<ul>
<li>系统会定期自动同步（Auto-sync），但在关闭浏览器前，建议手动点击 <code>Push to Cloud</code> 确保数据保存。</li>
<li>多人协作时，请注意“后提交覆盖先提交”的原则，尽量错峰编辑或使用快照功能作为保险。</li>
</ul>
</li>
<li><strong>密码安全</strong>：WebDAV 密码仅保存在本地浏览器 LocalStorage 中，请勿在公共电脑上保存配置。</li>
</ul>
<hr>
<h2>💻 命令行与开发指南</h2>
<h3>目录结构</h3>
<pre><code>d:\Code\anti-PAPC\
├── components\       # UI 组件 (DrawingList, Settings, etc.)
├── services\         # 核心服务 (WebDAV, Storage)
├── server\           # OneDrive 本地代理服务
├── store.ts          # 全局状态管理 (Zustand)
├── types.ts          # TS 类型定义
└── App.tsx           # 主入口
</code></pre>
<h3>常用命令</h3>
<p>| 命令 | 说明 |
| :--- | :--- |
| <code>npm run dev</code> | 启动前端开发环境 (Vite) |
| <code>npm run build</code> | 构建生产版本 |
| <code>npm run preview</code> | 预览生产构建 |
| <code>git push</code> | 提交代码到仓库 |</p>
<h3>环境变量 (.env)</h3>
<p>可在项目根目录创建 <code>.env</code> 文件预设配置：</p>
<pre><code>VITE_WEBDAV_URL=https://your-webdav-server/
VITE_WEBDAV_USERNAME=admin
VITE_WEBDAV_PASSWORD=secret
VITE_PWD_ADMIN=admin123  # 解锁编辑模式的密码
</code></pre>

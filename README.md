<h1>PAPC - Plan Approval Progress Control</h1>
<p><strong>PAPC</strong> 是一个专为工程项目设计的图纸审批进度控制系统。不仅可以追踪图纸的送审、批复状态，还提供了强大的命令行交互工具，极大地提升了文控人员和工程师的操作效率。</p>
<h2>✨ 核心功能</h2>
<h3>1. 图纸全生命周期管理</h3>
<ul>
<li><strong>状态追踪</strong>: 精确记录图纸的 Reviewing (审核中), Waiting Reply (待回复), Approved (已批准) 等状态。</li>
<li><strong>版本控制</strong>: 支持 Version (版本号) 和 Round (轮次) 的自动与手动管理。</li>
<li><strong>截止日期</strong>: 自动计算 reviewDeadline，并支持手动强制指定 (<code>due:日期</code>)。</li>
</ul>
<h3>2. ⚡ 高效命令行 (Command Bar)</h3>
<p>摒弃繁琐的鼠标点击，通过顶部常驻的命令行实现飞一般的操作体验：</p>
<ul>
<li><strong>批量操作</strong>: <code>@001,002,005 #Urgent</code> (批量打标签)</li>
<li><strong>人员分配</strong>: <code>@Hull to:TeamA</code> (按专业批量分配人员) / <code>@001 add:Kevin</code></li>
<li><strong>属性覆写</strong>: <code>@001 v:3</code> (修改版本) / <code>@001 c:10/2</code> (更新意见数)</li>
<li><strong>快速筛选</strong>: <code>show:Kevin</code> (只看 Kevin 的图纸) / <code>show:Urgent</code></li>
</ul>
<h3>3. 可视化报表</h3>
<ul>
<li><strong>进度趋势图</strong>: 双轴图表展示累计完成进度与基于权重的实际进度。</li>
<li><strong>专业分析</strong>: 自动生成各专业的送审/批复状态分布饼图。</li>
<li><strong>活动日历</strong>: 追踪每日、每周的图纸提交与批复动态。</li>
</ul>
<h3>4. 数据安全与同步</h3>
<ul>
<li><strong>本地优先</strong>: 数据默认存储在本地，操作零延迟。</li>
<li><strong>快照系统</strong>: 支持创建项目快照，随时回溯历史状态。</li>
<li><strong>WebDAV 同步</strong>: 内置 WebDAV 支持，可将项目数据同步至私有云或 NAS。</li>
</ul>
<h2>🚀 快速开始</h2>
<h3>安装依赖</h3>
<pre><code>npm install
</code></pre>
<h3>启动开发服务器</h3>
<pre><code>npm run dev
</code></pre>
<h3>构建生产版本</h3>
<pre><code>npm run build
</code></pre>
<h2>D1 准备状态</h2>
<p>本次已做的是“接入边界整理”，不是完整 Cloudflare 部署：</p>
<ul>
<li>前端状态层现在通过统一的数据仓储层访问持久化数据，便于后续切换到 Cloudflare Worker + D1。</li>
<li>现有 WebDAV / OneDrive Proxy 行为保留，未配置 Cloudflare API 时仍按原路径运行。</li>
<li>本地项目 JSON 备份/恢复已抽到独立辅助模块，避免 UI 直接散落处理持久化格式。</li>
</ul>
<p>可选环境变量：</p>
<pre><code>VITE_DATA_API_BASE_URL=https://your-worker.example.workers.dev/
VITE_DATA_API_TOKEN=
VITE_DATA_API_FALLBACK=true
</code></pre>
<p>详细迁移说明见 <a href="/mnt/kjxing/workspace/cf-PAPC/docs/d1-migration.md" rel="nofollow">docs/d1-migration.md</a>。</p>
<p>仓库内现在也包含了一个可直接接真实 D1 schema 的 Cloudflare Worker 读取脚手架：</p>
<ul>
<li>Worker 入口：<code>worker/src/index.ts</code></li>
<li>Wrangler 模板：<code>worker/wrangler.toml.example</code></li>
<li>兼容视图示例：<code>worker/sql/compat-views-from-normalized.sql</code></li>
</ul>
<p>该脚手架目前只覆盖读取路径，优先读取真实 schema 或 <code>api_*</code> 兼容视图；前端未配置 <code>VITE_DATA_API_BASE_URL</code> 时仍继续走现有 WebDAV / OneDrive 流程。</p>
<h2>🛠️ 技术栈</h2>
<ul>
<li><strong>Frontend</strong>: React, TypeScript, Tailwind CSS</li>
<li><strong>Icons</strong>: Lucide React</li>
<li><strong>Charts</strong>: Recharts</li>
<li><strong>Build Tool</strong>: Vite</li>
</ul>
<h2>📝 常用指令速查 (Command Bar)</h2>
<p>| 功能 | 语法示例 | 说明 |
| :--- | :--- | :--- |
| <strong>打标签</strong> | <code>@001 #Urgent</code> | 标记红色紧急标签 |
| <strong>移除标签</strong> | <code>@001 -#Urgent</code> | 移除标签 |
| <strong>分配人员</strong> | <code>@001 to:Alice</code> | 设置负责人为 Alice |
| <strong>追加人员</strong> | <code>@Hull add:Bob</code> | 给所有 Hull 图纸增加 Bob |
| <strong>设置日期</strong> | <code>@001 dl:02-14</code> | 设置截止日期为 2月14日 |
| <strong>筛选视图</strong> | <code>show:Urgent</code> | 仅显示带 Urgent 标签的图纸 |
| <strong>状态变更</strong> | <code>@R 001,002</code> | 批量设为 Reviewing |</p>
<hr>
<p><em>Designed for Efficiency.</em></p>

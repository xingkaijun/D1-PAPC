# PAPC - Plan Approval Progress Control

**PAPC** 是一个专为工程项目设计的图纸审批进度控制系统。不仅可以追踪图纸的送审、批复状态，还提供了强大的命令行交互工具，极大地提升了文控人员和工程师的操作效率。

## 🏛️ 技术架构 (Architecture)

系统已全面迁移至 **Cloudflare Serverless 架构**，实现了全云端实时数据存储与分发，摒弃了旧版的 LocalStorage 和 WebDAV 同步方案。

### 核心组件
- **前端页面 (Client)**: 部署于 Cloudflare Pages。通过 React + Zustand 进行全生命周期的状态管理。
- **中间层 API (Worker)**: 部署于 Cloudflare Workers。提供轻量级 RESTful API 及基于 JSON 的业务拼装处理。
- **结构化数据库 (D1)**: 关系型后端数据库。负责业务逻辑（用户、项目设置、基础图纸信息、审查跟踪）存储及快照系统管理。
- **文件存储 (R2)**: 对象存储。后续支持挂载文件大附件等能力支持。

### 数据流向
1. **实时通讯**: 前端每次进行状态更改（例如在 Tracker 或命令行中更新），即触发发送请求到 Worker 端点，由 Worker 写入 D1，实现全实时落库。
2. **读写分离与缓存**: 项目加载时，Worker 将 D1 中的多表关联结构拼装成大 JSON 提供给客户端使用。客户端在未主动请求刷新时依赖本地 Zustand 缓存。

## ✨ 核心功能亮点

### 1. 实时防冲突与心跳机制 (Lock & Heartbeat)
当项目内有人取得编辑权限并进入修改状态时，其客户端将每 30 秒向 D1 发送心跳包。其余查看该项目的用户，会在 UI 顶部明显位置看到管理员在线状态（例如 `Admin Online` 绿灯），防止其他人同时进行覆盖性写入导致数据丢失。

### 2. 多维度进度追踪 (Tracker & Dashboard)
- **Review Tracker**: 以矩阵视角同时查看图纸和审查人（Reviewer）完成情况。采用专用 `__approved__` 记录槽位存储主管的发行审批状态，实现双重落库。
- **历史快照 (Snapshots)**: 从 D1 抓取历史数据进行横向比较。进度图表生成数据不依赖内部备忘，严格依赖手动更新的记录数（`manualCommentsCount`），保证数据纯洁性。

### 3. ⚡ 高效命令行 (Command Bar)
摒弃繁琐的鼠标点击，通过顶部常驻的命令行实现飞一般的操作体验（所有指令支持批量目标如 `@001,002`）：
- **状态变更**: `@R 001,002` (设为 Reviewing) / `@W 001` (设为 Waiting Reply) / `@A 001` (设为 Approved)
- **批量人员分配**: `@Hull to:TeamA` / `@001 add:Kevin` / `@001 rm:Alice`
- **属性快速覆写**: `@001 v:3` (修改版本) / `@001 c:10/2` (更新：10条总意见/2条未关闭意见) / `@001 dl:02-14` (设定期限)
- **快速筛选查询**: `show:Kevin` (过滤带有 Kevin) / `show:Hull` (显示专业) / `reset` (清空) 

## 🚀 快速部署与启动

### 初始化本地环境
```bash
npm install
npm run dev
```

### 数据库迁移与配置
1. 复制 `.dev.vars.example` 到 `.dev.vars` (如果存在)，或者配置环境：
```env
VITE_DATA_API_BASE_URL=https://papc-d1-api.your-account.workers.dev/
VITE_DATA_API_TOKEN=your-authentication-token
```
2. 在 `worker` 目录下，使用 `wrangler` 创建并配置 D1 绑定，运用 schema 文件和 migration 初始化你的数据库实例：
```bash
npx wrangler d1 execute papc-review-db-final --local --file=./schema.sql
```

## 🛠️ 技术栈清单 (Tech Stack)

- **UI & Framework**: React (Vite)
- **State Management**: Zustand
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **Charts**: Recharts
- **Backend & DB**: Cloudflare Workers + D1 Database

---
*Designed for Efficiency.*

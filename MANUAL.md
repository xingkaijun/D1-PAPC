# Anti-PAPC 图纸审批追踪系统操作手册

## 📚 简介
**Anti-PAPC (Plan Approval Status Tracking System)** 是一个专为海事/工程项目设计的图纸审批状态追踪与管理系统。它旨在帮助团队高效管理图纸的提交、审核、返修及批准流程，支持多项目管理、数据云同步（WebDAV）及自动化报表生成。

---

## 🚀 快速开始

### 1. 环境要求
- Node.js (v16+)
- 现代浏览器 (Chrome, Edge 等)

### 2. 启动项目
```bash
# 安装依赖
npm install

# 启动前端开发服务器
npm run dev

# (可选) 启动 OneDrive 代理服务器
cd server
npm install
npm start
```

### 3. 初始登录
- 系统默认以“只读模式”运行。
- 点击右上角的 **Lock/Unlock** 按钮进入编辑模式。
- 默认无密码或使用环境变量配置的密码。

---

## 🛠 功能详解

### 1. 项目大厅 (Dashboard)
- **卡片式管理**：每个卡片代表一个独立的项目。
- **状态概览**：直接显示项目内的图纸统计（Total, Reviewing, Overdue 等）。
- **云同步状态**：显示项目与 WebDAV 服务器的同步时间。
- **操作**：
    - `Connect to Cloud`：首次连接 WebDAV 服务器。
    - `New Project`：创建本地新项目。
    - `Delete`：删除项目（需确认）。

### 2. 图纸列表 (Drawing List)
核心工作区，支持高效的数据录入与筛选。
- **筛选器 (Filter)**：
    - 顶部支持按状态筛选：`Pending`, `Reviewing`, `Waiting`, `Approved`。
    - **逻辑**：多选时为 **AND (且)** 关系。例如同时选中 `Reviewing` 和 `Overdue`，仅显示既在审查中又超期的图纸。
- **搜索 (Search)**：
    - 支持搜索图纸号、标题、专业、自定义ID、负责人。
- **视图操作**：
    - **列宽调整**：拖动表头边缘调整列宽。
    - **排序**：默认按添加顺序，支持分页。
    - **展开详情**：点击行首箭头查看备注 (Remarks) 和历史记录 (Logs)。
- **编辑功能 (需解锁)**：
    - 双击单元格直接编辑内容。
    - 右键菜单（或操作列）进行删除、状态变更。
- **批量导入 (Bulk Load)**：
    - 支持从 Excel/文本批量粘贴。
    - 格式：`ID, Drawing No, Discipline, Title`。

### 3. 进度追踪与截止日期
- **自动计算**：
    - 输入 `Received Date` 和类别 (`A`/`B`/`C`) 后，系统根据预设周期（如 A类14天）自动计算 `Deadline`。
    - 自动跳过配置的节假日 (`Holidays`) 和周末。
- **超期提醒**：
    - 临期或超期的图纸会高亮显示，`Overdue` 筛选器可快速定位。

### 4. 报表与日志 (Reports)
- **Daily Log**：生成每日工作日志，汇总当天的图纸变动、评论及状态更新。
- **打印模式**：列表页提供 `Print List` 按钮，生成针对 A4 纸优化的打印视图。

### 5. 版本控制与快照 (Snapshots)
- **手动快照**：在设置中可手动创建当前项目的数据快照（备份）。
- **时光倒流**：随时查看或恢复到历史快照状态。

---

## ⚙️ 系统设置 (Settings)

### 1. 全局配置
- **Reviewers**：配置审核人员名单。
- **Discipline Defaults**：设置各专业默认的审核负责人。
- **Cycles**：
    - `Round A Cycle`：首次审核周期（默认14天）。
    - `Other Rounds`：复审周期（默认7天）。
- **Holidays**：配置节假日列表（YYYY-MM-DD），用于截止日期计算排除。

### 2. 数据存储 (Data Storage)
系统支持两种模式：
1.  **WebDAV (推荐)**：
    - 直接连接 Nextcloud, Synology NAS 等支持 WebDAV 的网盘。
    - 配置 `Server URL`, `Username`, `Password`。
    - 数据以 `.json` 文件形式存储在云端。
2.  **OneDrive Proxy (高级)**：
    - 需启动本地 `server/` 目录下的代理服务。
    - 通过 Microsoft Graph API 进行同步。

---

## 💡 使用技巧 (Tips)

1.  **快速筛选**：使用顶部筛选栏组合条件，例如查找 "Hull" 专业下 "Reviewing" 的图纸。
2.  **备注管理**：在图纸详情中添加备注，支持标记 `Resolved`（已解决），方便内部沟通。
3.  **打印报表**：月度汇报时，直接使用打印功能导出 PDF，版面已自动优化。
4.  **安全锁定**：离开座位前点击 `Unlock` 按钮重新上锁，防止误操作。

---

## ⚠️ 注意事项

- **数据同步**：
    - 系统会定期自动同步（Auto-sync），但在关闭浏览器前，建议手动点击 `Push to Cloud` 确保数据保存。
    - 多人协作时，请注意“后提交覆盖先提交”的原则，尽量错峰编辑或使用快照功能作为保险。
- **密码安全**：WebDAV 密码仅保存在本地浏览器 LocalStorage 中，请勿在公共电脑上保存配置。

---

## 💻 命令行与开发指南

### 目录结构
```
d:\Code\anti-PAPC\
├── components\       # UI 组件 (DrawingList, Settings, etc.)
├── services\         # 核心服务 (WebDAV, Storage)
├── server\           # OneDrive 本地代理服务
├── store.ts          # 全局状态管理 (Zustand)
├── types.ts          # TS 类型定义
└── App.tsx           # 主入口
```

### 常用命令
| 命令 | 说明 |
| :--- | :--- |
| `npm run dev` | 启动前端开发环境 (Vite) |
| `npm run build` | 构建生产版本 |
| `npm run preview` | 预览生产构建 |
| `git push` | 提交代码到仓库 |

### 环境变量 (.env)
可在项目根目录创建 `.env` 文件预设配置：
```ini
VITE_WEBDAV_URL=https://your-webdav-server/
VITE_WEBDAV_USERNAME=admin
VITE_WEBDAV_PASSWORD=secret
VITE_PWD_ADMIN=admin123  # 解锁编辑模式的密码
```

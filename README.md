# PAPC - Plan Approval Progress Control

**PAPC** 是一个专为工程项目设计的图纸审批进度控制系统。不仅可以追踪图纸的送审、批复状态，还提供了强大的命令行交互工具，极大地提升了文控人员和工程师的操作效率。

## ✨ 核心功能

### 1. 图纸全生命周期管理
*   **状态追踪**: 精确记录图纸的 Reviewing (审核中), Waiting Reply (待回复), Approved (已批准) 等状态。
*   **版本控制**: 支持 Version (版本号) 和 Round (轮次) 的自动与手动管理。
*   **截止日期**: 自动计算 reviewDeadline，并支持手动强制指定 (`due:日期`)。

### 2. ⚡ 高效命令行 (Command Bar)
摒弃繁琐的鼠标点击，通过顶部常驻的命令行实现飞一般的操作体验：
*   **批量操作**: `@001,002,005 #Urgent` (批量打标签)
*   **人员分配**: `@Hull to:TeamA` (按专业批量分配人员) / `@001 add:Kevin`
*   **属性覆写**: `@001 v:3` (修改版本) / `@001 c:10/2` (更新意见数)
*   **快速筛选**: `show:Kevin` (只看 Kevin 的图纸) / `show:Urgent`

### 3. 可视化报表
*   **进度趋势图**: 双轴图表展示累计完成进度与基于权重的实际进度。
*   **专业分析**: 自动生成各专业的送审/批复状态分布饼图。
*   **活动日历**: 追踪每日、每周的图纸提交与批复动态。

### 4. 数据安全与同步
*   **本地优先**: 数据默认存储在本地，操作零延迟。
*   **快照系统**: 支持创建项目快照，随时回溯历史状态。
*   **WebDAV 同步**: 内置 WebDAV 支持，可将项目数据同步至私有云或 NAS。

## 🚀 快速开始

### 安装依赖
```bash
npm install
```

### 启动开发服务器
```bash
npm run dev
```

### 构建生产版本
```bash
npm run build
```

## 🛠️ 技术栈
*   **Frontend**: React, TypeScript, Tailwind CSS
*   **Icons**: Lucide React
*   **Charts**: Recharts
*   **Build Tool**: Vite

## 📝 常用指令速查 (Command Bar)

| 功能 | 语法示例 | 说明 |
| :--- | :--- | :--- |
| **打标签** | `@001 #Urgent` | 标记红色紧急标签 |
| **移除标签** | `@001 -#Urgent` | 移除标签 |
| **分配人员** | `@001 to:Alice` | 设置负责人为 Alice |
| **追加人员** | `@Hull add:Bob` | 给所有 Hull 图纸增加 Bob |
| **设置日期** | `@001 dl:02-14` | 设置截止日期为 2月14日 |
| **筛选视图** | `show:Urgent` | 仅显示带 Urgent 标签的图纸 |
| **状态变更** | `@R 001,002` | 批量设为 Reviewing |

---
*Designed for Efficiency.*

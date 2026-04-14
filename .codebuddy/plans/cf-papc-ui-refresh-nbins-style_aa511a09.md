---
name: cf-papc-ui-refresh-nbins-style
overview: 参考同级 `nbins` 项目的顶部 banner 与胶囊按钮风格，统一 `cf-PAPC` 的主界面与按钮配色，并调整图纸列表顶部筛选区的状态统计与按钮顺序。
design:
  architecture:
    framework: react
  styleKeywords:
    - Glassmorphism
    - Teal Gradient
    - Capsule Navigation
    - Premium Dashboard
    - Soft Contrast
  fontSystem:
    fontFamily: Helvetica Neue
    heading:
      size: 28px
      weight: 800
    subheading:
      size: 14px
      weight: 700
    body:
      size: 12px
      weight: 500
  colorSystem:
    primary:
      - "#006A63"
      - "#0F766E"
      - "#9CF2E8"
    background:
      - "#F7FAFC"
      - "#FFFFFF"
      - "#ECFDF5"
    text:
      - "#0F172A"
      - "#64748B"
      - "#FFFFFF"
    functional:
      - "#10B981"
      - "#F59E0B"
      - "#EF4444"
      - "#0F766E"
todos:
  - id: audit-ui-targets
    content: 使用[subagent:code-explorer]复核 banner 与黑底按钮影响范围
    status: completed
  - id: refresh-app-shell
    content: 重做 App.tsx 顶部 banner、导航胶囊与项目切换按钮
    status: completed
    dependencies:
      - audit-ui-targets
  - id: update-drawing-filters
    content: 调整 DrawingList.tsx 筛选胶囊，新增 Progress 标签并重排按钮
    status: completed
    dependencies:
      - audit-ui-targets
  - id: unify-page-actions
    content: 统一 ReviewTracker、DrawingRow、Settings、ActivityReport 按钮配色
    status: completed
    dependencies:
      - refresh-app-shell
      - update-drawing-filters
  - id: verify-ui-regression
    content: 检查 Progress 统计、Ready 位置与禁用态显示一致性
    status: completed
    dependencies:
      - unify-page-actions
---

## User Requirements

- 参考同级 `nbins` 项目的视觉语言，调整 `cf-papc` 现有界面，重点学习顶部 banner 的样式、主色和层次感。
- 复制 `nbins` 的胶囊按钮风格，包括配色、超圆角形状、激活态与悬停效果，并应用到当前关键操作区域。
- 将现有一些黑色背景按钮重新配色，使整体风格更统一、更柔和、更高级。

## Product Overview

- 页面整体升级为统一的青绿色工作台风格：顶部区域更有品牌感，按钮由生硬深色块改为轻盈的胶囊式视觉，筛选和操作区域层级更清晰。
- 在不改变现有功能流程的前提下，增强图纸列表顶部筛选区的状态表达和可读性。

## Core Features

- 重做顶部 banner、导航与项目切换区的视觉样式，靠近 `nbins` 的青绿玻璃感与胶囊导航效果。
- 统一图纸列表、Review Tracker 等页面的关键按钮配色，替换不协调的黑底按钮。
- 在表格头部筛选区 `Pending` 后新增 `Progress` 标签，显示 `Reviewing + Waiting + Approved` 的总数，即非 `Pending` 总数。
- 调整筛选按钮分组与顺序：`Pending + Progress` 为第一组，之后加竖线；`Reviewing + Waiting + Approved` 为第二组，之后加竖线；`Ready + Warning + Overdue` 为第三组，之后加竖线。
- 保留现有交互逻辑、编辑态/禁用态和状态语义，仅优化视觉呈现与统计展示。

## Tech Stack Selection

- 前端框架：React 19 + TypeScript
- 构建工具：Vite 6
- 样式方案：Tailwind CSS 4（当前项目以 TSX 内联 utility class 为主）
- 状态管理：Zustand
- 图标：lucide-react
- 状态与日期处理：项目现有 `types.ts` 与 `date-fns`

## Implementation Approach

### 总体策略

基于现有 React + Tailwind 结构，直接在现有页面组件内复用并调整 className，避免引入新的 UI 库或大规模重构。视觉上对齐 `nbins` 的青绿主色、玻璃感 banner、白底激活胶囊和青绿渐变主按钮；逻辑上仅扩展图纸列表筛选统计，不改动 store、接口和数据结构。

### 关键技术决策

- **复用现有视图层模式**：当前项目的样式主要写在 `App.tsx` 与各 `components/*.tsx` 中，适合做局部、低风险的 UI 改造。
- **Progress 作为聚合展示标签**：用户要求是“标签”而非新筛选条件，因此优先实现为展示型 capsule，不加入 `statusFilters`，避免改变现有筛选行为。
- **计数逻辑尽量复用现有筛选语义**：`DrawingList.tsx` 里已有搜索与筛选统计逻辑，新增 Progress 统计时应抽出共享判断或使用 `useMemo` 统一计算，减少重复条件分支。
- **性能控制**：图纸统计本质是线性遍历，单次复杂度为 `O(n)`；通过 `useMemo` 绑定 `project.drawings`、`filterQuery`、`statusFilters` 等依赖，避免多次重复扫描导致无意义重算。

## Implementation Notes

- 保持现有状态值不变：`Pending`、`Reviewing`、`Waiting Reply`、`Approved`，以及现有派生筛选 `Ready`、`Warning`、`Overdue`。
- 不修改 `store.ts`、`types.ts` 和后端接口，只在视图层做配色、顺序和聚合统计增强。
- 保留当前编辑锁、同步、批量导入、筛选交互和禁用态行为，避免功能回归。
- 黑底按钮替换应遵循同一套主次按钮规则：主操作用青绿渐变胶囊，次操作用白底/浅底描边胶囊，激活态保持可辨识。

## Architecture Design

### 当前改造落点

- `App.tsx` 负责应用级 banner、主导航、项目切换入口，是 `nbins` 顶部视觉语言的主要承接点。
- `components/DrawingList.tsx` 负责图纸列表顶部工具区、筛选胶囊和统计展示，是本次功能性 UI 调整的核心文件。
- `components/ReviewTracker.tsx`、`components/DrawingRow.tsx` 承接次级按钮、状态胶囊和行内交互的统一风格。
- 其余存在黑底按钮的页面仅做视觉统一，不改业务链路。

### 数据与交互关系

- 用户输入搜索/点击筛选
- 现有 `filterQuery` / `statusFilters` 更新
- 视图层重新计算筛选结果与聚合计数
- 表格和状态胶囊同步刷新

## Directory Structure

本次改造聚焦现有前端视图文件，不新增数据层或服务层模块。

- `d:/Code/cf-PAPC/App.tsx`  [MODIFY]  
负责应用顶部 banner、主导航、项目切换按钮和项目选择页头部样式。需参考 `nbins` 调整顶部青绿玻璃感、胶囊导航和主切换入口的配色与圆角体系。

- `d:/Code/cf-PAPC/components/DrawingList.tsx`  [MODIFY]  
负责图纸列表搜索区、操作按钮、筛选胶囊和表格头部区域。需重做 `FilterButton` 胶囊样式，新增 `Progress` 聚合标签，调整 `Ready` 排序，并统一顶部主次按钮配色。

- `d:/Code/cf-PAPC/components/ReviewTracker.tsx`  [MODIFY]  
负责 Review Tracker 顶部概览、同步/编辑按钮、Ready 区块与行内 assignee 胶囊。需与新主视觉保持一致，替换黑底按钮并统一状态标签语言。

- `d:/Code/cf-PAPC/components/DrawingRow.tsx`  [MODIFY]  
负责列表行中的 assignee 头像胶囊、状态标签、展开区卡片。需同步调整深色圆点与次级胶囊的色板，保证表格内外视觉一致。

- `d:/Code/cf-PAPC/components/Settings.tsx`  [MODIFY]  
存在 `Local Restore` 和新增项按钮等黑底操作按钮。需改为统一的主次按钮体系，不改变原有设置逻辑。

- `d:/Code/cf-PAPC/components/ActivityReport.tsx`  [MODIFY]  
存在 `Print / Export` 黑底按钮。需替换为与主界面一致的胶囊化按钮样式，保持报表页风格连贯。

## Key Code Structures

本次无需新增数据结构；如需减少重复判断，优先在 `DrawingList.tsx` 内抽出共享的筛选匹配函数或聚合计数 `useMemo`，避免散落的重复条件分支。

## Design Approach

整体采用参考 `nbins` 的高质感企业工作台风格：顶部使用青绿色半透明 banner、轻微模糊和白色品牌卡片；导航与筛选都使用超圆角胶囊按钮，激活态以白底青绿文字呈现，非激活态保持柔和浅底或半透明描边。

### Affected Screens

1. **应用顶部区域**：品牌区、主导航、项目切换区统一成青绿玻璃感 header，强调层次与品牌一致性。  
2. **图纸列表工具区**：搜索框右侧动作按钮与下方筛选胶囊统一成一套主次按钮体系，`Progress` 用统计型胶囊强调状态总览。  
3. **Review Tracker 页面**：顶部统计条、同步/编辑按钮、Ready/Progress 标签与行内责任人按钮统一为同一视觉语言。  
4. **次级页面按钮**：Settings、Activity Report 等局部黑底按钮改为胶囊式主次按钮，避免页面风格割裂。

### Visual Effect

- 顶部更通透、有品牌感，按钮从“硬黑色块”变为“青绿渐变 + 白底激活”的轻盈效果。
- 筛选区更像状态驾驶舱，`Pending`、`Progress`、各状态胶囊一眼可分辨。
- 页面整体更统一、更现代，同时保持表格和功能区的专业工作台气质。

## Agent Extensions

### SubAgent

- **code-explorer**
- Purpose: 在实施前复核所有 banner、筛选条与黑底按钮的实际调用点，避免遗漏同风格入口。
- Expected outcome: 形成完整的受影响文件清单，并支撑后续统一配色与胶囊样式落地。
# 保存机制说明

## 概述

D1项目使用了**混合保存机制**：大部分数据需要手动保存，部分数据即时保存但有兜底机制。

## 详细说明

### 1. 需要手动保存的数据（会显示未保存提示）

以下操作会标记数据为"脏数据"（dirty），需要点击保存按钮或等待自动同步：

#### Drawing相关修改
- **添加Drawing**: `addDrawing()` → 标记 `_dirtyDrawingIds`
- **更新Drawing**: `updateDrawing()` → 标记 `_dirtyDrawingIds`
  - 修改状态（Status）
  - 修改版本（Version）
  - 修改轮次（Round）
  - 修改评论数量（Comments Count）
  - **修改Assignees** ✅（同时标记 `_dirtyTracker` 和 `_dirtyTrackerDrawingIds`）
  - 修改其他字段
- **删除Drawing**: `deleteDrawing()` → 标记 `_deletedDrawingIds`
- **批量更新Drawings**: `batchUpdateDrawings()` → 标记 `_dirtyDrawingIds`
  - 包括批量修改Assignees
- **添加备注**: `addRemark()` → 标记 `_dirtyDrawingIds`
- **删除备注**: `deleteRemark()` → 标记 `_dirtyDrawingIds`
- **批量导入**: `bulkImportDrawings()` → 标记 `_dirtyDrawingIds`
- **重置所有Assignees**: `resetAllAssignees()` → 标记 `_dirtyDrawingIds`

#### 配置相关修改
- **更新项目配置**: `updateProjectConfig()` → 标记 `_dirtyConf`
  - 修改审核人员列表
  - 修改学科默认分配
  - 修改假期设置
  - 修改审核周期

#### 本地恢复
- **恢复项目**: `restoreProject()` → 标记 `_dirtyDrawingIds`、`_dirtyConf`、`_dirtyTracker`
  - 恢复后数据仅存在于本地，需要手动 "Save to Cloud" 同步到云端
  - UI 会提示用户需要手动保存

### 2. 即时保存 + 脏数据兜底的数据

以下操作会**立即尝试保存到服务器**，但同时标记脏数据以确保失败时可重试：

#### Review Tracker相关
- **切换Assignee完成状态**: `toggleAssigneeDone()` → 即时保存 + 标记 `_dirtyTracker`
  - 在ReviewTracker页面勾选/取消勾选完成状态
  - 先尝试 fire-and-forget 异步保存到服务端
  - 同时标记 `_dirtyTracker = true` 和 `_dirtyTrackerDrawingIds`
  - 如果即时保存失败，脏标记保留，下次手动/自动保存时会兜底
  - `reviewTracker` 已纳入 Zustand persist，页面刷新不会丢失未同步的 tracker 状态

**代码实现**：
```typescript
toggleAssigneeDone: (drawingId: string, assignee: string) => {
  // 1. 立即更新本地状态，并标记 tracker 为脏数据
  set(state => ({
    _dirtyTracker: true,
    _dirtyTrackerDrawingIds: newDirtyTrackerIds,
    reviewTracker: { ...updatedTracker }
  }));

  // 2. 异步保存到服务端（fire-and-forget，但失败时脏标记已保留可供手动重试）
  appRepository.saveReviewTracker(data.settings, project, singleUpdate)
    .then(() => console.log(`[Tracker] Saved`))
    .catch(err => {
      console.error('[Tracker] Save failed (will retry on next manual/auto save):', err);
      // 不恢复本地状态，脏标记已保留，下次手动/自动保存时会兜底
    });
}
```

### 3. Delta 保存中的 Tracker 增量

当 `saveProject` 使用增量保存（PATCH）时，tracker 增量使用 `_dirtyTrackerDrawingIds` 构造，而非 `_dirtyDrawingIds`。这确保纯 tracker 变更（不涉及 drawing 本身修改）也能正确发送。

```
if (dirtyTrackerSnapshotFlag) {
  const trackerSlice = {};
  for (const id of dirtyTrackerSnapshot) {
    // 发送完整 drawing 级 tracker；空对象表示清空远端残留
    trackerSlice[id] = reviewTracker[id] || {};
  }
  if (Object.keys(trackerSlice).length > 0) payload.reviewTracker = trackerSlice;
}
```

同时，保存期间如果用户继续修改，已发送且未再次变更的脏标记才会被清理，避免新修改被误清空。

## 后端数据一致性保障

### 删除 Drawing 时清理关联数据

无论是全量保存还是增量保存，删除 drawing 时都会清理以下关联表：
- `drawing_assignees`
- `drawing_status_history`
- `drawing_remarks`
- `review_tracker` ← **新增**：确保删除 drawing 后不会有孤立的 tracker 行

### Tracker 增量保存时的清理

Delta PATCH 中更新 tracker 时，会先 `DELETE FROM review_tracker WHERE project_id = ? AND drawing_id = ?` 再重新插入，确保已移除的 assignee 的 tracker 行不会残留。

### 全量保存时的孤立 Tracker 清理

全量保存时，会检测已删除的 drawing 并清理对应的 `review_tracker` 行。此外，新增 `sanitizeProjectReviewTracker` 函数在写入前对 tracker 数据进行清洗，仅保留当前项目中存在的 drawing 且 reviewer 属于该 drawing 当前 assignees（或 `__approved__`）的 tracker 条目，防止旧 drawing 或旧 assignee 的 tracker 被重新写回。

## 为什么Assignees修改应该显示未保存提示

根据代码分析，**修改Assignees确实会触发未保存提示**，因为：

1. CommandBar中的assignees修改调用 `batchUpdateDrawings()`
2. DrawingList中的assignees修改也调用 `batchUpdateDrawings()`
3. `batchUpdateDrawings()` 会将所有修改的drawing ID添加到 `_dirtyDrawingIds`
4. `hasUnsavedChanges()` 检查 `_dirtyDrawingIds.size > 0 || _dirtyTracker`

## 自动同步机制

项目有自动同步功能，默认每3分钟自动保存一次：

```typescript
// 在 App.tsx 中
useEffect(() => {
  const interval = setInterval(async () => {
    if (isEditMode) {
      // 编辑模式：推送到服务器
      await saveProject(activeProjectId);
    } else {
      // 只读模式：如果本地有任何待保存状态，跳过拉取以避免覆盖
      const state = useStore.getState();
      const hasPending = state._dirtyDrawingIds.size > 0 || state._deletedDrawingIds.size > 0 || state._dirtyConf || state._dirtyTracker;
      if (hasPending) {
        console.log('Skipping auto-fetch: local unsaved changes pending.');
        return;
      }
      await loadProject(activeProjectId, projectConfPw);
    }
  }, intervalMinutes * 60 * 1000);
}, [activeProjectId, ...]);
```

## 项目列表合并

`fetchProjectList` 按 **项目 ID**（而非名称）合并远程和本地项目，避免同名项目污染 id 或 webdavPath。

## 持久化范围

Zustand persist 会持久化以下状态：
- `data`（包含 projects 和 settings）
- `activeProjectId`
- `reviewTracker` ← **新增**：确保页面刷新后 tracker 状态不丢失
- `_dirtyTracker` ← **新增**：确保重启后仍能检测到未保存的 tracker 变更
- `_dirtyTrackerDrawingIds` ← **新增**：以数组形式序列化，加载时反序列化为 Set

## 测试建议

1. **Tracker 保存兜底测试**：
   - 在 ReviewTracker 页面勾选多个 assignee
   - 断开网络连接
   - 刷新页面
   - 恢复网络后点击 Sync → 应能成功同步所有待保存的 tracker 变更

2. **Assignees 修改后的 Tracker 清理**：
   - 修改 drawing 的 assignees（移除某个已标记 done 的 assignee）
   - 保存后检查 `review_tracker` 表中不应有该 assignee 的残留行

3. **删除 Drawing 后的 Tracker 清理**：
   - 删除一个有 tracker 记录的 drawing
   - 保存后检查 `review_tracker` 表中不应有该 drawing 的残留行

4. **本地恢复提示**：
   - 执行 Local Restore
   - 确认出现"请使用 Save to Cloud 同步到云端"的提示
   - 确认未保存提示出现

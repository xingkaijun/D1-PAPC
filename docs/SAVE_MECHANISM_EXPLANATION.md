# 保存机制说明

## 概述

D1项目使用了**混合保存机制**：部分数据需要手动保存，部分数据即时保存。

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
  - **修改Assignees** ✅
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

### 2. 即时保存的数据（不显示未保存提示）

以下操作会**立即保存到服务器**，不需要手动保存：

#### Review Tracker相关
- **切换Assignee完成状态**: `toggleAssigneeDone()` → 即时保存
  - 在ReviewTracker页面勾选/取消勾选完成状态
  - 使用fire-and-forget模式异步保存
  - 保存失败会在控制台显示错误，但不会阻塞UI

**代码实现**：
```typescript
toggleAssigneeDone: (drawingId: string, assignee: string) => {
  // 1. 立即更新本地状态（不标记 _dirtyTracker）
  set(state => ({
    reviewTracker: {
      ...state.reviewTracker,
      [drawingId]: {
        ...(state.reviewTracker[drawingId] || {}),
        [assignee]: { done: newDone, doneAt }
      }
    }
  }));

  // 2. 异步保存到服务端（fire-and-forget）
  appRepository.saveReviewTracker(data.settings, project, singleUpdate)
    .then(() => console.log(`[Tracker] Saved`))
    .catch(err => console.error('[Tracker] Save failed:', err));
}
```

## 为什么Assignees修改应该显示未保存提示

根据代码分析，**修改Assignees确实会触发未保存提示**，因为：

1. CommandBar中的assignees修改调用 `batchUpdateDrawings()`
2. DrawingList中的assignees修改也调用 `batchUpdateDrawings()`
3. `batchUpdateDrawings()` 会将所有修改的drawing ID添加到 `_dirtyDrawingIds`
4. `hasUnsavedChanges()` 检查 `_dirtyDrawingIds.size > 0`

### 如果没有显示未保存提示，可能的原因：

1. **不在编辑模式**：未保存提示只在 `isEditMode = true` 时显示
2. **自动同步太快**：如果自动同步间隔很短（如1-3分钟），可能在你注意到之前就已经保存了
3. **浏览器缓存问题**：需要刷新页面确保使用最新代码

## 自动同步机制

项目有自动同步功能，默认每3分钟自动保存一次：

```typescript
// 在 App.tsx 中
useEffect(() => {
  const intervalMinutes = configInterval ?? globalInterval ?? 3;
  
  const interval = setInterval(async () => {
    if (isEditMode) {
      // 编辑模式：推送到服务器
      await saveProject(activeProjectId);
    } else {
      // 只读模式：从服务器拉取
      await loadProject(activeProjectId, projectConfPw);
    }
  }, intervalMinutes * 60 * 1000);

  return () => clearInterval(interval);
}, [activeProjectId, ...]);
```

## 测试建议

要验证Assignees修改是否触发未保存提示：

1. 确保处于**编辑模式**（Edit Mode已解锁）
2. 修改一个drawing的assignees
3. 立即查看右下角是否出现青绿色的"Unsaved Changes"提示
4. 查看项目切换按钮是否显示数字徽章
5. 尝试刷新页面，应该会弹出浏览器警告

## 建议

如果希望Tracker也显示未保存提示（而不是即时保存），可以修改 `toggleAssigneeDone` 方法：

```typescript
// 将即时保存改为标记dirty
toggleAssigneeDone: (drawingId: string, assignee: string) => {
  set(state => ({
    _dirtyTracker: true,  // 标记为dirty
    reviewTracker: {
      ...state.reviewTracker,
      [drawingId]: {
        ...(state.reviewTracker[drawingId] || {}),
        [assignee]: { done: newDone, doneAt }
      }
    }
  }));
  // 移除即时保存逻辑
}
```

但这样会改变用户体验，需要手动保存tracker的勾选状态。

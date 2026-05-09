# Review Tracker - Ready Drawings 排序功能

## 功能说明

在 Review Tracker 页面中，Ready Drawings 栏现在按照图纸变成 ready 状态的时间排序，而不是按 ID 排序。

## 实现逻辑

### Ready 状态的定义
图纸变成 "Ready" 状态是指：
- 图纸有 assignees（审查人员）
- 所有 assignees 都已完成审查（`done: true`）

### Ready 时间的计算
图纸变成 ready 的时间 = **所有 assignees 完成时间中最晚的一个**

例如：
- 图纸 A001 有 3 个 assignees：
  - Kevin 完成时间：2026-05-08 10:00
  - Alice 完成时间：2026-05-08 14:00
  - Bob 完成时间：2026-05-08 16:00
- 该图纸的 ready 时间 = 2026-05-08 16:00（Bob 完成的时间）

### 排序规则
- **降序排列**：最新变成 ready 的图纸在前
- **没有完成时间的图纸**：排在最后

## 代码实现

```typescript
// 对 ready 图纸按变成 ready 的时间排序
ready.sort((a, b) => {
    const getReadyTime = (d: typeof a) => {
        const trackerEntry = reviewTracker[d.id] || {};
        const assignees = d.assignees || [];
        if (assignees.length === 0) return new Date(0);
        
        // 找到所有 assignee 完成时间中最晚的一个
        const doneTimes = assignees
            .map(assignee => trackerEntry[assignee]?.doneAt)
            .filter(Boolean)
            .map(dateStr => new Date(dateStr).getTime());
        
        if (doneTimes.length === 0) return new Date(0).getTime();
        return Math.max(...doneTimes);
    };
    
    const timeA = getReadyTime(a);
    const timeB = getReadyTime(b);
    
    // 降序排列：最新变成 ready 的在前
    return timeB - timeA;
});
```

## 使用场景

### 之前（按 ID 排序）
```
Ready Drawings (5)
├─ A001 (ID 最小)
├─ A002
├─ A016
├─ CH5002
└─ M004 (ID 最大)
```

### 现在（按 ready 时间排序）
```
Ready Drawings (5)
├─ M004 (刚刚完成，5月8日 16:00)
├─ A016 (5月8日 14:30)
├─ CH5002 (5月8日 10:00)
├─ A002 (5月7日 15:00)
└─ A001 (5月7日 09:00)
```

## 优势

1. **时间敏感性**：最新完成的图纸优先显示，便于及时处理
2. **工作流优化**：按完成顺序处理，符合实际工作流程
3. **优先级明确**：最新的图纸通常需要优先发送给业主

## 相关文件

- `d:\Code\D1\components\ReviewTracker.tsx` - 主要实现

## 测试建议

1. 在 Tracker 页面标记多个图纸的 assignees 为完成
2. 验证 Ready Drawings 栏中最新完成的图纸在最前面
3. 验证有多个 assignees 的图纸，按最后一个完成的时间排序
4. 验证筛选功能不影响排序

---

**实现日期**: 2026-05-08  
**功能状态**: ✅ 已完成

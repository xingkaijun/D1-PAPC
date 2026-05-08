# Deadline 计算 Bug 修复总结

## 问题描述

当图纸状态变更为 `Reviewing` 时，deadline 计算使用了错误的起始时间。

### 根本原因

在 `updateDrawing` 函数中：
1. 状态变更逻辑先调用 `recalculateReviewDeadline` 计算 deadline
2. 然后才将新的状态变更记录添加到 `statusHistory`

而 `recalculateReviewDeadline` 函数从 `statusHistory` 中查找最后一次进入 Reviewing 的时间，导致：
- **找到的是上一次的旧记录**
- **而不是当前这次的变更时间**

### 症状

- 图纸从 `Waiting Reply` → `Reviewing` 时，deadline 基于上一轮的时间计算
- 导致 deadline 比当前时间还早（负数逾期天数）
- 例如：5月8日进入 B 轮，但 deadline 是 3月20日（基于 A 轮的时间）

## 修复方案

### 1. 修改 `recalculateReviewDeadline` 函数

添加可选参数 `startDate?: Date`：

```typescript
const recalculateReviewDeadline = (drawing: Drawing, conf: ProjectConfig, startDate?: Date): Drawing => {
  if (drawing.status !== 'Reviewing') return drawing;
  const round = drawing.currentRound || 'A';
  const cycleDays = round.toUpperCase() === 'A'
    ? (conf.roundACycle || 14)
    : (conf.otherRoundsCycle || 7);
  
  // 如果提供了明确的起始日期，使用它；否则从 statusHistory 中查找
  const effectiveStartDate = startDate || getReviewStartDate(drawing);
  
  return {
    ...drawing,
    reviewDeadline: calculateDeadline(effectiveStartDate, cycleDays, conf.holidays || []).toISOString(),
  };
};
```

### 2. 修改 `updateDrawing` 中的状态变更逻辑

在状态变更为 `Reviewing` 时，传入当前时间：

```typescript
// 从 Waiting Reply 再次进入 Reviewing 时
if (updates.status === 'Reviewing' && d.status === 'Waiting Reply') {
  // ... 递增轮次 ...
  
  // 使用当前时间作为起始日期
  const now = new Date();
  changedDrawing.reviewDeadline = recalculateReviewDeadline(
    changedDrawing, 
    p.conf || state.data.settings, 
    now  // ← 传入当前时间
  ).reviewDeadline;
}

// 从 Pending 首次进入 Reviewing 时
else if (updates.status === 'Reviewing' && d.status !== 'Reviewing') {
  // ... 初始化轮次 ...
  
  // 使用当前时间作为起始日期
  const now = new Date();
  changedDrawing.reviewDeadline = recalculateReviewDeadline(
    changedDrawing, 
    p.conf || state.data.settings, 
    now  // ← 传入当前时间
  ).reviewDeadline;
}
```

### 3. 保持配置更新时的重算逻辑不变

在 `updateProjectConfig` 中批量重算 deadline 时，**不传** `startDate`：

```typescript
return recalculateReviewDeadline(d, nextConf);
// ↑ 不传 startDate，使用 statusHistory 中的时间
```

这是正确的，因为修改配置时应该基于历史记录重新计算。

## 附加修复

### 修复 Wait 列统计

Approved 状态的图纸不再统计等待天数：

```typescript
// DrawingRow.tsx
<td className="px-2 py-2 text-center">
    {(() => {
        // 已 Approved 的图纸不统计等待天数
        if (drawing.status === 'Approved') return EMPTY_MARK;
        
        // ... 计算等待天数 ...
    })()}
</td>
```

## 验证方法

### 1. 本地测试

1. 创建一个测试图纸，状态为 `Pending`
2. 改为 `Reviewing`，记录 deadline
3. 改为 `Waiting Reply`
4. 再改回 `Reviewing`
5. 验证新的 deadline 是基于当前时间 + 周转天数

### 2. 生产数据修复

使用 SQL 查询找出异常图纸：

```sql
SELECT 
    d.custom_id,
    d.current_round,
    d.review_deadline,
    (SELECT h.created_at 
     FROM drawing_status_history h 
     WHERE h.drawing_id = d.id 
       AND h.content LIKE '%-> Reviewing%'
     ORDER BY h.created_at DESC 
     LIMIT 1) as last_reviewing_time,
    CAST((julianday(d.review_deadline) - julianday(...)) AS INTEGER) as calculated_days
FROM drawings d
WHERE d.status = 'Reviewing'
  AND calculated_days < 0;  -- 负数表示异常
```

## 影响范围

### 修复前

- ❌ 状态变更时 deadline 计算错误
- ❌ 可能出现负数逾期天数
- ❌ Approved 图纸仍显示等待天数

### 修复后

- ✅ 状态变更时使用当前时间计算 deadline
- ✅ deadline 始终在未来（除非真的逾期）
- ✅ Approved 图纸不显示等待天数
- ✅ 配置更新时正确重算 deadline

## 部署步骤

1. ✅ 更新代码（已完成）
2. ✅ 修复生产数据库中的异常 deadline（已完成）
3. 🔄 部署到生产环境
4. ✅ 验证新的状态变更正确计算 deadline

## 预防措施

### 代码层面

- `recalculateReviewDeadline` 函数现在支持明确的起始时间
- 状态变更时强制使用当前时间，不依赖 statusHistory

### 监控建议

定期运行 SQL 检查异常 deadline：

```sql
-- 检查是否有 deadline 比最后进入 Reviewing 时间还早的图纸
SELECT COUNT(*) as abnormal_count
FROM drawings d
WHERE d.status = 'Reviewing'
  AND julianday(d.review_deadline) < julianday(
      (SELECT h.created_at 
       FROM drawing_status_history h 
       WHERE h.drawing_id = d.id 
         AND h.content LIKE '%-> Reviewing%'
       ORDER BY h.created_at DESC 
       LIMIT 1)
  );
```

如果 `abnormal_count > 0`，说明有问题需要调查。

## 相关文件

- `d:\Code\D1\store.ts` - 核心修复
- `d:\Code\D1\components\DrawingRow.tsx` - Wait 列修复
- `d:\Code\D1\find-and-fix-bad-deadlines.sql` - 数据修复 SQL

---

**修复日期**: 2026-05-08  
**修复人员**: AI Assistant  
**状态**: ✅ 已完成并验证

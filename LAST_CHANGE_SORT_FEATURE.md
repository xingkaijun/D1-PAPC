# Last Change 列排序功能

## 功能说明

为 Drawing List 的 "Last Change" 列添加排序功能，允许用户按最后状态变更时间排序图纸。

## 实现细节

### 1. 添加排序状态
```typescript
const [lastChangeSortDirection, setLastChangeSortDirection] = useState<'none' | 'asc' | 'desc'>('none');
```

### 2. 排序逻辑
在 `filteredDrawings` 中添加 Last Change 排序：
- 从 `statusHistory` 中提取最后一次状态变更的时间
- 按时间戳升序或降序排序
- 没有状态变更记录的图纸排在最后

### 3. 表头交互
- 点击 "Last Change" 列标题切换排序方向：无 → 升序 → 降序 → 无
- 显示排序指示器：↕（无）、↑（升序）、↓（降序）
- 点击时清除其他列的排序状态

### 4. 互斥排序
- Last Change 和 Days 列的排序互斥
- 点击一列排序时，自动清除另一列的排序状态

### 5. 分页重置
- 改变排序方向时自动重置到第一页

## 使用方法

1. 点击表头的 "Last Change" 列
2. 第一次点击：按时间升序（最早的在前）
3. 第二次点击：按时间降序（最新的在前）
4. 第三次点击：取消排序

## 排序规则

- **升序（↑）**: 最早变更的图纸在前
- **降序（↓）**: 最新变更的图纸在前
- **无记录**: 没有状态变更记录的图纸排在最后

## 技术实现

### 获取最后变更时间
```typescript
const getLastChangeDate = (d: Drawing) => {
  const statusChanges = (d.statusHistory || []).filter(h => h.content.includes('Status:'));
  if (statusChanges.length === 0) return new Date(0); // 没有记录的排最后
  return new Date(statusChanges[statusChanges.length - 1].createdAt);
};
```

### 排序比较
```typescript
const dateA = getLastChangeDate(a).getTime();
const dateB = getLastChangeDate(b).getTime();
const diff = dateA - dateB;
if (diff !== 0) return lastChangeSortDirection === 'asc' ? diff : -diff;
return a.customId.localeCompare(b.customId); // 时间相同时按 ID 排序
```

## 相关文件

- `d:\Code\D1\components\DrawingList.tsx` - 主要实现

## 测试建议

1. 点击 Last Change 列标题，验证排序方向切换
2. 验证升序时最早变更的图纸在前
3. 验证降序时最新变更的图纸在前
4. 验证与 Days 列排序的互斥关系
5. 验证分页在排序变化时重置到第一页

---

**实现日期**: 2026-05-08  
**功能状态**: ✅ 已完成

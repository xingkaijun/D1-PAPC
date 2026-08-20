
import React, { useEffect, useMemo, useState } from 'react';
import { useStore } from '../store';
import type { SentDrawingExpectation } from '../store';
import { RefreshCw, CheckCircle2, Circle, ClipboardCheck, Search, ChevronDown, ChevronRight, Cloud, Lock, Unlock, Send, Award, Flame, FileSpreadsheet } from 'lucide-react';
import { differenceInCalendarDays, format, isAfter } from 'date-fns';
import type { Drawing } from '../types';

const REVIEW_TRACKER_LAYOUT_STORAGE_KEY = 'review-tracker-layout-single-column';

// 单个关键词对图纸各字段做子串匹配
const matchTerm = (drawing: Drawing, term: string): boolean => {
    const t = term.trim().toLowerCase();
    if (!t) return true;
    return (
        drawing.customId.toLowerCase().includes(t) ||
        drawing.title.toLowerCase().includes(t) ||
        (!!drawing.discipline && drawing.discipline.toLowerCase().includes(t)) ||
        drawing.assignees.some(a => a.toLowerCase().includes(t))
    );
};

// 布尔筛选语法：'+' 为与(AND)，'/' 为或(OR)，AND 优先级高于 OR。
// 例：owner+shell = 同时匹配；owner/shell = 匹配任一；a+b/c = (a 且 b) 或 c
const matchFilter = (drawing: Drawing, filterText: string): boolean => {
    const raw = filterText.trim();
    if (!raw) return true;
    const orGroups = raw.split('/').map(g => g.trim()).filter(Boolean);
    if (orGroups.length === 0) return true;
    return orGroups.some(group => {
        const andTerms = group.split('+').map(t => t.trim()).filter(Boolean);
        if (andTerms.length === 0) return true;
        return andTerms.every(term => matchTerm(drawing, term));
    });
};

export const ReviewTracker: React.FC = () => {
    const {
        data,
        activeProjectId,
        reviewTracker,
        loadReviewTracker,
        toggleAssigneeDone,
        clearTrackerForDrawings,
        verifySentDrawings,
        saveProject,
        updateDrawing,
        isEditMode,
        toggleEditMode
    } = useStore();

    const currentProject = data.projects.find(p => p.id === activeProjectId);
    const primaryActionClass = 'flex items-center gap-2 px-5 py-2.5 rounded-full text-[10px] font-[1000] uppercase tracking-[0.18em] border shadow-sm transition-all active:scale-95';
    const softActionClass = 'flex items-center gap-2 px-4.5 py-2.5 rounded-full text-[10px] font-[1000] uppercase tracking-[0.18em] border transition-all active:scale-95 shadow-sm';
    const statPillClass = 'inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border bg-white/75 backdrop-blur text-[10px] font-[1000] uppercase tracking-[0.18em]';

    const [filterText, setFilterText] = useState('');
    const [showReady, setShowReady] = useState(true);
    const [showUrgeOnly, setShowUrgeOnly] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);
    const [sendPhase, setSendPhase] = useState<'saving' | 'verifying' | null>(null);
    const isSending = sendPhase !== null;
    const [isSingleColumn, setIsSingleColumn] = useState(() => {
        if (typeof window === 'undefined') return false;
        return window.localStorage.getItem(REVIEW_TRACKER_LAYOUT_STORAGE_KEY) === 'true';
    });
    const drawingGridClass = isSingleColumn ? 'grid grid-cols-1 gap-2' : 'grid grid-cols-1 lg:grid-cols-2 gap-2';
    const getDeadlineDays = (deadline?: string) => deadline ? differenceInCalendarDays(new Date(deadline), new Date()) : null;
    // approved 标记：通过 reviewTracker 持久化（使用特殊 key '__approved__'）
    const isApprovedMark = (drawingId: string) => reviewTracker[drawingId]?.['__approved__']?.done ?? false;

    // 进入页面时自动加载追踪数据
    useEffect(() => {
        if (activeProjectId) {
            loadReviewTracker(activeProjectId);
        }
    }, [activeProjectId]);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        window.localStorage.setItem(REVIEW_TRACKER_LAYOUT_STORAGE_KEY, String(isSingleColumn));
    }, [isSingleColumn]);

    // 只显示 Reviewing 状态的图纸
    const reviewingDrawings = useMemo(() => {
        if (!currentProject) return [];
        return currentProject.drawings.filter(d => d.status === 'Reviewing');
    }, [currentProject]);

    // 筛选后的图纸（支持布尔语法：+ 与、/ 或）
    const filteredDrawings = useMemo(() => {
        if (!filterText.trim()) return reviewingDrawings;
        return reviewingDrawings.filter(d => matchFilter(d, filterText));
    }, [reviewingDrawings, filterText]);

    // 按 ready / not ready 分组
    const { readyDrawings, pendingDrawings } = useMemo(() => {
        const ready: typeof filteredDrawings = [];
        const pending: typeof filteredDrawings = [];
        filteredDrawings.forEach(d => {
            const trackerEntry = reviewTracker[d.id] || {};
            const assignees = d.assignees || [];
            const allDone = assignees.length > 0 && assignees.every(a => trackerEntry[a]?.done);
            const isOverdue = d.reviewDeadline && isAfter(new Date(), new Date(d.reviewDeadline));

            if (showUrgeOnly) {
                // 催促模式：只显示超期图纸
                if (isOverdue) {
                    if (allDone) ready.push(d);
                    else pending.push(d);
                }
            } else {
                if (allDone) ready.push(d);
                else pending.push(d);
            }
        });
        
        // 对 ready 图纸按变成 ready 的时间排序（最后一个 assignee 完成的时间）
        ready.sort((a, b) => {
            const getReadyTime = (d: typeof a) => {
                const trackerEntry = reviewTracker[d.id] || {};
                const assignees = d.assignees || [];
                if (assignees.length === 0) return new Date(0).getTime();

                // 找到所有 assignee 完成时间中最晚的一个（即变成 ready 的时间）
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
        
        return { readyDrawings: ready, pendingDrawings: pending };
    }, [filteredDrawings, reviewTracker, showUrgeOnly]);

    // 统计概览
    const stats = useMemo(() => {
        let totalDrawings = reviewingDrawings.length;
        let allDoneCount = 0;
        reviewingDrawings.forEach(d => {
            if (d.assignees.length === 0) return;
            const trackerEntry = reviewTracker[d.id] || {};
            const allDone = d.assignees.every(a => trackerEntry[a]?.done);
            if (allDone) allDoneCount++;
        });
        return { totalDrawings, allDoneCount };
    }, [reviewingDrawings, reviewTracker]);

    const handleRefresh = () => {
        if (activeProjectId) loadReviewTracker(activeProjectId);
    };

    const handleSync = async () => {
        if (!activeProjectId || isSyncing) return;
        setIsSyncing(true);
        try {
            await saveProject(activeProjectId);
        } catch (e) {
            console.warn('Sync failed', e);
        } finally {
            setIsSyncing(false);
        }
    };

    // 导出当前筛选结果为 CSV（全英文，带 UTF-8 BOM，Excel/WPS 双击直接打开，无格式警告）
    const handleExportExcel = () => {
        const rows = [...readyDrawings, ...pendingDrawings];
        if (rows.length === 0) {
            alert('No drawings to export for the current filter.');
            return;
        }

        // CSV 字段转义：含逗号/引号/换行时用双引号包裹，内部引号翻倍
        const csvCell = (value: string | number): string => {
            const s = String(value ?? '');
            return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        };

        // 收集导出范围内出现过的所有负责人，每人固定一列（列头=人名），方便按人筛选
        const assigneeNames = Array.from(
            new Set(rows.flatMap(d => d.assignees || []))
        ).sort((a, b) => a.localeCompare(b, 'zh-Hans-CN'));
        const headers = ['No', 'Drawing No', 'Title', 'Discipline', 'Status', 'Overdue', 'Deadline', ...assigneeNames];

        const dataRows = rows.map((d, i) => {
            const trackerEntry = reviewTracker[d.id] || {};
            const assignees = d.assignees || [];
            const doneCount = assignees.filter(a => trackerEntry[a]?.done).length;
            const allDone = assignees.length > 0 && doneCount === assignees.length;
            const days = getDeadlineDays(d.reviewDeadline);

            const statusText = allDone ? 'Ready' : `Reviewing ${doneCount}/${assignees.length}`;
            const overdueText = days === null ? '-' : (days < 0 ? `Overdue ${-days}d` : `${days}d left`);
            const deadline = d.reviewDeadline ? format(new Date(d.reviewDeadline), 'yyyy-MM-dd') : '-';

            // 每个负责人固定一列：归他负责则填状态(Done/Pending)，否则留空
            const assigneeCells = assigneeNames.map(name =>
                assignees.includes(name) ? (trackerEntry[name]?.done ? 'Done' : 'Pending') : ''
            );

            return [
                i + 1,
                d.customId,
                d.title || '',
                d.discipline || '-',
                statusText,
                overdueText,
                deadline,
                ...assigneeCells,
            ].map(csvCell).join(',');
        });

        const csv = [headers.map(csvCell).join(','), ...dataRows].join('\r\n');

        // UTF-8 BOM 确保 Excel 正确识别编码（含中文负责人姓名）
        const blob = new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8;' });
        const projectName = currentProject?.conf?.displayName || currentProject?.name || 'Project';
        const safeName = projectName.replace(/[\\/:*?"<>|]/g, '_');
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `${safeName}_Review_List_${format(new Date(), 'yyyyMMdd_HHmm')}.csv`;
        link.click();
        URL.revokeObjectURL(link.href);
    };

    // 一键发送 Ready 图纸：本地更新状态 + 清空 check 后立即整体保存，再回读服务器确认落库。
    // 避免 check 已推送服务端而 status 只留在本地（刷新后状态被远端覆盖回 Reviewing）
    const handleSendReady = async () => {
        if (!isEditMode || sendPhase || !activeProjectId) return;
        const count = readyDrawings.length;
        if (count === 0) return;

        // 发送前先固化每张图纸的目标状态，保存后用它回读比对
        const expected: SentDrawingExpectation[] = readyDrawings.map(d => ({
            id: d.id,
            customId: d.customId,
            status: isApprovedMark(d.id) ? 'Approved' : 'Waiting Reply',
        }));
        const approvedCount = expected.filter(e => e.status === 'Approved').length;
        const waitingCount = count - approvedCount;

        const msg = `将 ${count} 张 Ready 图纸状态更新：\n` +
            (approvedCount > 0 ? `• ${approvedCount} 张 → Approved\n` : '') +
            (waitingCount > 0 ? `• ${waitingCount} 张 → Waiting Reply\n` : '') +
            `确认继续？`;

        if (!window.confirm(msg)) return;

        setSendPhase('saving');
        try {
            expected.forEach(e => updateDrawing(e.id, { status: e.status }));
            // 清空所有 assignee 的 done 状态与 approved 标记（本地，随下面的保存一起推送）
            clearTrackerForDrawings(expected.map(e => e.id));

            const saved = await saveProject(activeProjectId);
            if (!saved) {
                alert('状态已在本地更新，但保存到服务器失败。请点击 Sync to Cloud 重试。');
                return;
            }

            // 回读校验：确认服务器上状态已更新、check 已清空
            setSendPhase('verifying');
            const result = await verifySentDrawings(activeProjectId, expected);
            if (result.error) {
                alert(`已保存，但无法回读确认服务器结果（${result.error}）。\n请点击 Refresh 后核对状态。`);
            } else if (!result.ok) {
                const parts = [
                    result.mismatchedDrawings.length > 0 ? `状态未更新：${result.mismatchedDrawings.join(', ')}` : '',
                    result.mismatchedTracker.length > 0 ? `Check 未清空：${result.mismatchedTracker.join(', ')}` : '',
                ].filter(Boolean).join('\n');
                alert(`服务器写入校验未通过：\n${parts}\n\n这些图纸已重新标记为待保存，请点击 Sync to Cloud 重试。`);
            }
        } finally {
            setSendPhase(null);
        }
    };

    const toggleApproved = (drawingId: string) => {
        if (!isEditMode) return;
        toggleAssigneeDone(drawingId, '__approved__');
    };

    if (!currentProject) {
        return (
            <div className="flex-1 flex items-center justify-center text-slate-400 text-sm font-bold uppercase tracking-widest">
                No Project Selected
            </div>
        );
    }

    // 单行图纸渲染
    const renderDrawingRow = (drawing: typeof reviewingDrawings[0], isReady: boolean = false) => {
        const trackerEntry = reviewTracker[drawing.id] || {};
        const assignees = drawing.assignees || [];
        const doneCount = assignees.filter(a => trackerEntry[a]?.done).length;
        const allDone = assignees.length > 0 && doneCount === assignees.length;
        const isApproved = isApprovedMark(drawing.id);
        const isOverdue = drawing.reviewDeadline && isAfter(new Date(), new Date(drawing.reviewDeadline));
        const deadlineDays = getDeadlineDays(drawing.reviewDeadline);

        return (
            <div
                key={drawing.id}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-[1.25rem] border transition-all shadow-sm ${isOverdue
                    ? 'bg-[linear-gradient(135deg,rgba(254,242,242,0.95),rgba(255,255,255,0.98))] border-red-200'
                    : allDone
                        ? 'bg-[linear-gradient(135deg,rgba(236,253,245,0.95),rgba(255,255,255,0.98))] border-emerald-200'
                        : 'bg-white/90 border-slate-200 hover:border-teal-200'
                    }`}
            >
                {/* 图纸号 + discipline */}
                <div className="flex items-center gap-2 shrink-0 min-w-[160px]">
                    <span className="text-xs font-[1000] text-teal-600 uppercase tracking-[0.18em]">
                        {drawing.customId}
                    </span>
                    {drawing.discipline && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full border border-white/80 bg-white/80 text-[9px] font-black text-slate-500 uppercase tracking-[0.16em] shadow-sm">
                            {drawing.discipline}
                        </span>
                    )}
                </div>

                {/* 标题 */}
                <span className="text-[11px] font-bold text-slate-500 truncate flex-1 min-w-0">
                    {drawing.title}
                </span>

                <div className="shrink-0">
                    {drawing.reviewDeadline ? (
                        <div
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[9px] font-[1000] uppercase tracking-[0.14em] ${
                                deadlineDays !== null && deadlineDays < 0
                                    ? 'bg-red-50 text-red-700 border-red-200'
                                    : deadlineDays !== null && deadlineDays <= 3
                                        ? 'bg-amber-50 text-amber-700 border-amber-200'
                                        : 'bg-white/90 text-slate-500 border-slate-200'
                            }`}
                            title={`Deadline ${format(new Date(drawing.reviewDeadline), 'yyyy-MM-dd')}`}
                        >
                            <span>{deadlineDays}d</span>
                        </div>
                    ) : (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full border border-slate-200 bg-white/80 text-[9px] font-[1000] uppercase tracking-[0.14em] text-slate-300">
                            --
                        </span>
                    )}
                </div>

                {/* Assignee 按钮 */}
                <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                    {assignees.length === 0 ? (
                        <span className="text-[9px] text-slate-300 font-bold uppercase tracking-wider italic">
                            No Assignees
                        </span>
                    ) : (
                        assignees.map(assignee => {
                            const isDone = trackerEntry[assignee]?.done;
                            return (
                                <button
                                    key={assignee}
                                    onClick={() => toggleAssigneeDone(drawing.id, assignee)}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold transition-all active:scale-95 border shadow-sm ${isDone
                                        ? 'bg-emerald-100/90 text-emerald-700 border-emerald-200 hover:bg-emerald-50'
                                        : isOverdue
                                            ? 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100 shadow-red-500/10'
                                            : 'bg-white/85 text-slate-600 border-white/80 hover:bg-white hover:border-teal-200 hover:text-teal-700'
                                        }`}
                                    title={isDone ? `${assignee}: 已完成 (点击取消)` : `${assignee}: 点击标记完成`}
                                >
                                    {isDone ? (
                                        <CheckCircle2 size={12} className="text-emerald-500" />
                                    ) : (
                                        <Circle size={12} className={isOverdue ? 'text-red-400' : 'text-slate-300'} />
                                    )}
                                    <span className="uppercase tracking-[0.16em]">{assignee}</span>
                                </button>
                            );
                        })
                    )}
                </div>

                {/* 进度标签 */}
                <div className={`text-[9px] font-[1000] uppercase tracking-[0.18em] px-3 py-1.5 rounded-full border shrink-0 shadow-sm ${allDone
                    ? 'bg-emerald-100/90 text-emerald-700 border-emerald-200'
                    : 'bg-white/85 text-slate-500 border-white/80'
                    }`}>
                    {allDone ? 'Ready' : `${doneCount}/${assignees.length}`}
                </div>

                {/* Approved 标记 (仅 Ready 图纸显示) */}
                {isReady && (
                    <button
                        onClick={() => toggleApproved(drawing.id)}
                        disabled={!isEditMode}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[9px] font-[1000] uppercase tracking-[0.18em] border transition-all shrink-0 shadow-sm ${isApproved
                            ? 'bg-violet-100/90 text-violet-700 border-violet-200'
                            : 'bg-white/85 text-slate-400 border-white/80 hover:border-violet-200 hover:text-violet-500'
                            } ${!isEditMode ? 'opacity-50 cursor-not-allowed' : 'active:scale-95'}`}
                        title={isApproved ? '已标记 Approved（点击取消）' : '标记为 Approved（一键发送时生效）'}
                    >
                        <Award size={11} />
                        APR
                    </button>
                )}
            </div>
        );
    };

    return (
        <div className="flex-1 flex flex-col overflow-hidden">
            {/* 顶部概览 */}
            <div className="px-6 py-4 border-b border-teal-100/70 bg-[linear-gradient(135deg,rgba(15,118,110,0.14),rgba(236,253,245,0.96))] flex items-center justify-between gap-4 shrink-0">
                <div className="flex items-center gap-4 flex-wrap">
                    <div className="flex items-center gap-3 pr-1">
                        <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/70 bg-white/75 shadow-sm backdrop-blur">
                            <ClipboardCheck size={18} className="text-teal-600" />
                        </div>
                        <div>
                            <div className="text-[9px] font-black uppercase tracking-[0.22em] text-teal-600/80">Review Console</div>
                            <h2 className="text-sm font-[1000] uppercase tracking-[0.18em] text-slate-800">
                                Review Tracker
                            </h2>
                        </div>
                    </div>
                    <div className="flex items-center gap-2.5 text-[10px] font-[1000] uppercase tracking-widest flex-wrap">
                        <span className={`${statPillClass} border-amber-100 text-amber-700 shadow-[0_10px_24px_-18px_rgba(245,158,11,0.45)]`}>
                            Reviewing · {stats.totalDrawings}
                        </span>
                        <span className={`${statPillClass} border-emerald-100 text-emerald-700 shadow-[0_10px_24px_-18px_rgba(16,185,129,0.45)]`}>
                            Ready · {stats.allDoneCount}
                        </span>
                    </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap justify-end">
                    {/* 同步按钮 */}
                    <button
                        onClick={async () => {
                            if (!isEditMode) {
                                alert("Permission Denied: Edit Mode is required to sync to cloud.");
                                return;
                            }
                            await handleSync();
                        }}
                        disabled={isSyncing || !isEditMode}
                        className={`${primaryActionClass} ${!isEditMode
                            ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed opacity-60'
                            : isSyncing
                                ? 'bg-white text-teal-400 border-teal-200 cursor-wait'
                                : 'bg-[linear-gradient(135deg,#005c55_0%,#0f766e_100%)] text-white border-transparent shadow-[0_12px_24px_-16px_rgba(13,148,136,0.45)] hover:brightness-105'
                            }`}
                        title={!isEditMode ? "Unlock Edit Mode to Sync" : "同步项目数据到服务器"}
                    >
                        <Cloud size={14} className={isSyncing ? 'animate-pulse' : ''} />
                        {isSyncing ? 'Syncing...' : 'Sync to Cloud'}
                    </button>
                    {/* 刷新按钮 */}
                    <button
                        onClick={handleRefresh}
                        className={`${softActionClass} bg-white/80 text-teal-700 border-white/80 hover:bg-white hover:border-teal-200 hover:text-teal-800`}
                        title="从服务器刷新追踪数据"
                    >
                        <RefreshCw size={14} />
                        Refresh
                    </button>
                    {/* 编辑锁定按钮 */}
                    <button
                        onClick={() => {
                            if (isEditMode) {
                                toggleEditMode();
                            } else {
                                const pwd = prompt("Enter Administrator Password to Edit:");
                                if (pwd !== null) {
                                    const success = toggleEditMode(pwd);
                                    if (!success) alert("Incorrect Password");
                                }
                            }
                        }}
                        className={`${softActionClass} ${isEditMode
                            ? 'bg-white text-amber-700 border-amber-200 hover:bg-amber-50 shadow-[0_10px_24px_-18px_rgba(245,158,11,0.4)]'
                            : 'bg-[linear-gradient(135deg,#0f766e_0%,#115e59_100%)] text-white border-transparent hover:brightness-105 shadow-[0_12px_24px_-18px_rgba(15,118,110,0.45)]'
                            }`}
                    >
                        {isEditMode ? <Unlock size={14} /> : <Lock size={14} />}
                        {isEditMode ? 'Unlocked' : 'Edit'}
                    </button>
                </div>
            </div>

            {/* 筛选输入框 */}
            <div className="px-6 py-3 border-b border-slate-100 shrink-0 flex flex-col gap-2 bg-white/60 backdrop-blur-sm">
                <div className="flex items-center gap-3">
                    <div className="relative flex-1">
                        <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-300" />
                        <input
                            type="text"
                            value={filterText}
                            onChange={e => setFilterText(e.target.value)}
                            placeholder="筛选 图号/图名/专业/负责人..."
                            className="w-full pl-10 pr-4 py-2.5 text-xs font-bold text-slate-700 bg-white/85 border border-slate-200 rounded-full shadow-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-300 transition-all placeholder:text-slate-300 placeholder:font-bold placeholder:uppercase placeholder:tracking-wider"
                        />
                    </div>
                    <button
                        onClick={() => setIsSingleColumn(prev => !prev)}
                        className={`${softActionClass} shrink-0 ${isSingleColumn
                            ? 'bg-[linear-gradient(135deg,#0f766e_0%,#115e59_100%)] text-white border-transparent shadow-[0_12px_24px_-18px_rgba(15,118,110,0.45)]'
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:border-teal-200 hover:text-teal-700'
                            }`}
                        title={isSingleColumn ? 'Switch to two-column layout' : 'Switch to single-column layout'}
                    >
                        {isSingleColumn ? 'To 2 Columns' : 'To 1 Column'}
                    </button>
                    <button
                        onClick={() => setShowUrgeOnly(!showUrgeOnly)}
                        className={`${softActionClass} shrink-0 ${showUrgeOnly
                            ? 'bg-[linear-gradient(135deg,#dc2626_0%,#f97316_100%)] text-white border-transparent shadow-[0_12px_24px_-18px_rgba(239,68,68,0.45)]'
                            : 'bg-white text-rose-600 border-rose-100 hover:bg-rose-50 hover:border-rose-200'
                            }`}
                        title="仅显示超期且仍有责任人未完成审查的图纸"
                    >
                        <Flame size={14} className={showUrgeOnly ? 'animate-pulse' : ''} />
                        {showUrgeOnly ? 'Urge Active' : 'Urge List'}
                    </button>
                    <button
                        onClick={handleExportExcel}
                        className={`${softActionClass} shrink-0 bg-white text-emerald-700 border-emerald-100 hover:bg-emerald-50 hover:border-emerald-200`}
                        title="Export the current filtered result as CSV (opens directly in Excel)"
                    >
                        <FileSpreadsheet size={14} />
                        Export CSV
                    </button>
                </div>
                {/* 筛选语法说明（浅色常驻提示） */}
                <div className="pl-4 flex items-center gap-1.5 flex-wrap text-[10px] font-medium text-slate-400/90 tracking-wide">
                    <span>Syntax:</span>
                    <code className="px-1.5 py-0.5 rounded bg-slate-100/80 text-slate-500 font-mono">a+b</code>
                    <span className="text-slate-400/80">match all (AND)</span>
                    <span className="text-slate-300">·</span>
                    <code className="px-1.5 py-0.5 rounded bg-slate-100/80 text-slate-500 font-mono">a/b</code>
                    <span className="text-slate-400/80">match any (OR)</span>
                    <span className="text-slate-300">·</span>
                    <span className="text-slate-400/80">AND binds first, e.g.</span>
                    <code className="px-1.5 py-0.5 rounded bg-slate-100/80 text-slate-500 font-mono">tom+shell</code>
                </div>
            </div>

            {/* 滚动区域 */}
            <div className="flex-1 overflow-y-auto px-6 py-3">
                {filteredDrawings.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-3">
                        <ClipboardCheck size={48} className="text-slate-200" />
                        <p className="text-sm font-bold uppercase tracking-widest">No drawings found</p>
                        <p className="text-xs text-slate-300">
                            {filterText ? '尝试调整筛选条件' : '图纸进入 Reviewing 状态后会自动出现在这里'}
                        </p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {/* Ready 图纸模块 */}
                        {readyDrawings.length > 0 && (
                            <div className="mb-2">
                                <div className="flex items-center gap-3 mb-2 flex-wrap">
                                    <button
                                        onClick={() => setShowReady(!showReady)}
                                        className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-emerald-100 bg-emerald-50/80 text-[10px] font-[1000] uppercase tracking-[0.18em] text-emerald-700 transition-all hover:bg-white hover:border-emerald-200 shadow-sm"
                                    >
                                        {showReady ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                        <span>Ready Drawings ({readyDrawings.length})</span>
                                    </button>
                                    {/* 一键发送按钮 */}
                                    {isEditMode && (
                                        <button
                                            onClick={handleSendReady}
                                            disabled={isSending}
                                            className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-[linear-gradient(135deg,#059669_0%,#10b981_100%)] text-white text-[10px] font-[1000] uppercase tracking-[0.18em] border border-transparent hover:brightness-105 shadow-[0_12px_24px_-18px_rgba(16,185,129,0.45)] transition-all active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
                                            title="将 Ready 图纸状态更新为 Waiting Reply（或 Approved，如标记了 APR），并立即保存到服务器"
                                        >
                                            <Send size={12} className={isSending ? 'animate-pulse' : ''} />
                                            {sendPhase === 'saving' ? 'Sending...' : sendPhase === 'verifying' ? 'Verifying...' : 'Send All'}
                                        </button>
                                    )}
                                </div>
                                {showReady && (
                                    <div className={`${drawingGridClass} mb-3`}>
                                        {readyDrawings.map(d => renderDrawingRow(d, true))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* 待审图纸 */}
                        {pendingDrawings.length > 0 && (
                            <div>
                                {readyDrawings.length > 0 && (
                                    <div className="flex items-center gap-2 mb-2 text-[10px] font-[1000] uppercase tracking-widest text-slate-400">
                                        <span className="inline-flex items-center px-3 py-1.5 rounded-full border border-slate-200 bg-white/80 text-slate-500 shadow-sm tracking-[0.18em]">In Progress ({pendingDrawings.length})</span>
                                    </div>
                                )}
                                <div className={drawingGridClass}>
                                    {pendingDrawings.map(d => renderDrawingRow(d, false))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

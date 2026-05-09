
import React, { useEffect, useMemo, useState } from 'react';
import { useStore } from '../store';
import { RefreshCw, CheckCircle2, Circle, ClipboardCheck, Search, ChevronDown, ChevronRight, Cloud, Lock, Unlock, Send, Award, Flame } from 'lucide-react';
import { differenceInCalendarDays, format, isAfter } from 'date-fns';

const REVIEW_TRACKER_LAYOUT_STORAGE_KEY = 'review-tracker-layout-single-column';

export const ReviewTracker: React.FC = () => {
    const {
        data,
        activeProjectId,
        reviewTracker,
        loadReviewTracker,
        toggleAssigneeDone,
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

    // 筛选后的图纸
    const filteredDrawings = useMemo(() => {
        if (!filterText.trim()) return reviewingDrawings;
        const q = filterText.toLowerCase();
        return reviewingDrawings.filter(d =>
            d.customId.toLowerCase().includes(q) ||
            d.title.toLowerCase().includes(q) ||
            (d.discipline && d.discipline.toLowerCase().includes(q)) ||
            d.assignees.some(a => a.toLowerCase().includes(q))
        );
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
                if (assignees.length === 0) return new Date(0);
                
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

    // 一键发送 Ready 图纸
    const handleSendReady = () => {
        if (!isEditMode) return;
        const count = readyDrawings.length;
        if (count === 0) return;

        const approvedCount = readyDrawings.filter(d => isApprovedMark(d.id)).length;
        const waitingCount = count - approvedCount;

        const msg = `将 ${count} 张 Ready 图纸状态更新：\n` +
            (approvedCount > 0 ? `• ${approvedCount} 张 → Approved\n` : '') +
            (waitingCount > 0 ? `• ${waitingCount} 张 → Waiting Reply\n` : '') +
            `确认继续？`;

        if (!window.confirm(msg)) return;

        readyDrawings.forEach(d => {
            const newStatus = isApprovedMark(d.id) ? 'Approved' : 'Waiting Reply';
            updateDrawing(d.id, { status: newStatus });
            // 清理 approved 标记（如有）
            if (isApprovedMark(d.id)) {
                toggleAssigneeDone(d.id, '__approved__');
            }
            // 清空所有 assignee 的 done 状态
            const trackerEntry = reviewTracker[d.id] || {};
            d.assignees.forEach(assignee => {
                if (trackerEntry[assignee]?.done) {
                    toggleAssigneeDone(d.id, assignee);
                }
            });
        });
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
            <div className="px-6 py-3 border-b border-slate-100 shrink-0 flex items-center gap-3 bg-white/60 backdrop-blur-sm">
                <div className="relative flex-1">
                    <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-300" />
                    <input
                        type="text"
                        value={filterText}
                        onChange={e => setFilterText(e.target.value)}
                        placeholder="Filter by drawing no, title, discipline, or assignee..."
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
                                            className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-[linear-gradient(135deg,#059669_0%,#10b981_100%)] text-white text-[10px] font-[1000] uppercase tracking-[0.18em] border border-transparent hover:brightness-105 shadow-[0_12px_24px_-18px_rgba(16,185,129,0.45)] transition-all active:scale-95"
                                            title="将 Ready 图纸状态更新为 Waiting Reply（或 Approved，如标记了 APR）"
                                        >
                                            <Send size={12} />
                                            Send All
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

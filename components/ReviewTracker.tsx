
import React, { useEffect, useMemo, useState } from 'react';
import { useStore } from '../store';
import { RefreshCw, CheckCircle2, Circle, ClipboardCheck, Search, ChevronDown, ChevronRight, Cloud, Lock, Unlock, Send, Award } from 'lucide-react';

export const ReviewTracker: React.FC = () => {
    const {
        data,
        activeProjectId,
        reviewTracker,
        loadReviewTracker,
        toggleAssigneeDone,
        pushProjectToWebDAV,
        updateDrawing,
        isEditMode,
        toggleEditMode
    } = useStore();

    const currentProject = data.projects.find(p => p.id === activeProjectId);

    const [filterText, setFilterText] = useState('');
    const [showReady, setShowReady] = useState(true);
    const [isSyncing, setIsSyncing] = useState(false);
    // 每张图纸的 approved 标记（本地状态，用于一键发送时判断）
    const [approvedMarks, setApprovedMarks] = useState<Record<string, boolean>>({});

    // 进入页面时自动加载追踪数据
    useEffect(() => {
        if (activeProjectId) {
            loadReviewTracker(activeProjectId);
        }
    }, [activeProjectId]);

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
            if (allDone) ready.push(d);
            else pending.push(d);
        });
        return { readyDrawings: ready, pendingDrawings: pending };
    }, [filteredDrawings, reviewTracker]);

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
            await pushProjectToWebDAV(activeProjectId);
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

        const approvedCount = readyDrawings.filter(d => approvedMarks[d.id]).length;
        const waitingCount = count - approvedCount;

        const msg = `将 ${count} 张 Ready 图纸状态更新：\n` +
            (approvedCount > 0 ? `• ${approvedCount} 张 → Approved\n` : '') +
            (waitingCount > 0 ? `• ${waitingCount} 张 → Waiting Reply\n` : '') +
            `确认继续？`;

        if (!window.confirm(msg)) return;

        readyDrawings.forEach(d => {
            const newStatus = approvedMarks[d.id] ? 'Approved' : 'Waiting Reply';
            updateDrawing(d.id, { status: newStatus });
        });

        // 清理已处理的 approved 标记
        setApprovedMarks(prev => {
            const next = { ...prev };
            readyDrawings.forEach(d => delete next[d.id]);
            return next;
        });
    };

    const toggleApproved = (drawingId: string) => {
        if (!isEditMode) return;
        setApprovedMarks(prev => ({ ...prev, [drawingId]: !prev[drawingId] }));
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
        const isApproved = approvedMarks[drawing.id];

        return (
            <div
                key={drawing.id}
                className={`flex items-center gap-3 px-4 py-2 rounded-xl border transition-all ${allDone
                    ? 'bg-emerald-50/60 border-emerald-200'
                    : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
            >
                {/* 图纸号 + discipline */}
                <div className="flex items-center gap-2 shrink-0 min-w-[160px]">
                    <span className="text-xs font-[1000] text-teal-600 uppercase tracking-wider">
                        {drawing.customId}
                    </span>
                    {drawing.discipline && (
                        <span className="text-[9px] font-black bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-md uppercase tracking-wider">
                            {drawing.discipline}
                        </span>
                    )}
                </div>

                {/* 标题 */}
                <span className="text-[11px] font-bold text-slate-500 truncate flex-1 min-w-0">
                    {drawing.title}
                </span>

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
                                    onClick={() => isEditMode && toggleAssigneeDone(drawing.id, assignee)}
                                    disabled={!isEditMode}
                                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all active:scale-95 border ${isDone
                                        ? 'bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-150'
                                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:border-slate-300'
                                        } ${!isEditMode ? 'opacity-60 cursor-not-allowed' : ''}`}
                                    title={!isEditMode ? '需要解锁编辑模式' : isDone ? `${assignee}: 已完成 (点击取消)` : `${assignee}: 点击标记完成`}
                                >
                                    {isDone ? (
                                        <CheckCircle2 size={12} className="text-emerald-500" />
                                    ) : (
                                        <Circle size={12} className="text-slate-300" />
                                    )}
                                    <span className="uppercase tracking-wider">{assignee}</span>
                                </button>
                            );
                        })
                    )}
                </div>

                {/* 进度标签 */}
                <div className={`text-[9px] font-[1000] uppercase tracking-wider px-2.5 py-1 rounded-full border shrink-0 ${allDone
                    ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                    : 'bg-slate-50 text-slate-500 border-slate-200'
                    }`}>
                    {allDone ? '✅ READY' : `${doneCount}/${assignees.length}`}
                </div>

                {/* Approved 标记 (仅 Ready 图纸显示) */}
                {isReady && (
                    <button
                        onClick={() => toggleApproved(drawing.id)}
                        disabled={!isEditMode}
                        className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-[1000] uppercase tracking-wider border transition-all shrink-0 ${isApproved
                            ? 'bg-violet-100 text-violet-700 border-violet-300 shadow-sm'
                            : 'bg-white text-slate-400 border-slate-200 hover:border-violet-300 hover:text-violet-500'
                            } ${!isEditMode ? 'opacity-50 cursor-not-allowed' : 'active:scale-95'}`}
                        title={isApproved ? '已标记 Approved（点击取消）' : '标记为 Approved（一键发送时生效）'}
                    >
                        <Award size={11} />
                        {isApproved ? 'APR' : 'APR'}
                    </button>
                )}
            </div>
        );
    };

    return (
        <div className="flex-1 flex flex-col overflow-hidden">
            {/* 顶部概览 */}
            <div className="px-6 py-3 border-b border-slate-200/60 bg-slate-50/50 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <ClipboardCheck size={18} className="text-teal-600" />
                        <h2 className="text-sm font-[1000] uppercase tracking-wider text-slate-800">
                            Review Tracker
                        </h2>
                    </div>
                    <div className="flex items-center gap-3 text-[10px] font-[1000] uppercase tracking-widest">
                        <span className="bg-amber-50 text-amber-600 px-3 py-1 rounded-full border border-amber-100">
                            Reviewing: {stats.totalDrawings}
                        </span>
                        <span className="bg-emerald-50 text-emerald-600 px-3 py-1 rounded-full border border-emerald-100">
                            Ready: {stats.allDoneCount}
                        </span>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {/* 同步按钮 */}
                    <button
                        onClick={handleSync}
                        disabled={isSyncing}
                        className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-[10px] font-[1000] uppercase tracking-wider border shadow-sm transition-all active:scale-95 ${isSyncing
                            ? 'bg-teal-50 text-teal-400 border-teal-200 cursor-wait'
                            : 'bg-teal-600 text-white border-teal-600 hover:bg-teal-700 shadow-teal-500/20'
                            }`}
                        title="同步项目数据到服务器"
                    >
                        <Cloud size={14} className={isSyncing ? 'animate-pulse' : ''} />
                        {isSyncing ? 'Syncing...' : 'Sync to Cloud'}
                    </button>
                    {/* 刷新按钮 */}
                    <button
                        onClick={handleRefresh}
                        className="p-2.5 bg-white hover:bg-teal-50 text-slate-400 hover:text-teal-600 rounded-xl border border-slate-200 shadow-sm transition-all active:scale-95"
                        title="从服务器刷新追踪数据"
                    >
                        <RefreshCw size={14} />
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
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-[10px] font-[1000] uppercase tracking-wider transition-all active:scale-95 ${isEditMode
                            ? 'bg-amber-100 text-amber-700 hover:bg-amber-200 border border-amber-200'
                            : 'bg-slate-900 text-white hover:bg-slate-800 shadow-lg shadow-slate-900/20'
                            }`}
                    >
                        {isEditMode ? <Unlock size={14} /> : <Lock size={14} />}
                        {isEditMode ? 'Unlocked' : 'Edit'}
                    </button>
                </div>
            </div>

            {/* 筛选输入框 */}
            <div className="px-6 py-2 border-b border-slate-100 shrink-0">
                <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" />
                    <input
                        type="text"
                        value={filterText}
                        onChange={e => setFilterText(e.target.value)}
                        placeholder="Filter by drawing no, title, discipline, or assignee..."
                        className="w-full pl-9 pr-4 py-2 text-xs font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400 transition-all placeholder:text-slate-300 placeholder:font-bold placeholder:uppercase placeholder:tracking-wider"
                    />
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
                                <div className="flex items-center gap-3 mb-2">
                                    <button
                                        onClick={() => setShowReady(!showReady)}
                                        className="flex items-center gap-2 text-[10px] font-[1000] uppercase tracking-widest text-emerald-600 hover:text-emerald-700 transition-colors"
                                    >
                                        {showReady ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                        <span>Ready Drawings ({readyDrawings.length})</span>
                                    </button>
                                    {/* 一键发送按钮 */}
                                    {isEditMode && (
                                        <button
                                            onClick={handleSendReady}
                                            className="flex items-center gap-1.5 px-4 py-1.5 bg-emerald-600 text-white rounded-lg text-[10px] font-[1000] uppercase tracking-wider hover:bg-emerald-700 shadow-md shadow-emerald-500/20 transition-all active:scale-95"
                                            title="将 Ready 图纸状态更新为 Waiting Reply（或 Approved，如标记了 APR）"
                                        >
                                            <Send size={12} />
                                            Send All
                                        </button>
                                    )}
                                </div>
                                {showReady && (
                                    <div className="grid grid-cols-2 gap-2 mb-3">
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
                                        <span>In Progress ({pendingDrawings.length})</span>
                                    </div>
                                )}
                                <div className="grid grid-cols-2 gap-2">
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

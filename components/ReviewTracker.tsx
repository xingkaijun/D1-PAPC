
import React, { useEffect, useMemo } from 'react';
import { useStore } from '../store';
import { RefreshCw, CheckCircle2, Circle, ClipboardCheck } from 'lucide-react';

export const ReviewTracker: React.FC = () => {
    const {
        data,
        activeProjectId,
        reviewTracker,
        loadReviewTracker,
        toggleAssigneeDone
    } = useStore();

    const currentProject = data.projects.find(p => p.id === activeProjectId);

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

    if (!currentProject) {
        return (
            <div className="flex-1 flex items-center justify-center text-slate-400 text-sm font-bold uppercase tracking-widest">
                No Project Selected
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col overflow-hidden">
            {/* 顶部概览 */}
            <div className="px-6 py-4 border-b border-slate-200/60 bg-slate-50/50 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <ClipboardCheck size={18} className="text-teal-600" />
                        <h2 className="text-sm font-[1000] uppercase tracking-wider text-slate-800">
                            Review Tracker
                        </h2>
                    </div>
                    <div className="flex items-center gap-3 text-[10px] font-[1000] uppercase tracking-widest">
                        <span className="bg-amber-50 text-amber-600 px-3 py-1.5 rounded-full border border-amber-100">
                            Reviewing: {stats.totalDrawings}
                        </span>
                        <span className="bg-emerald-50 text-emerald-600 px-3 py-1.5 rounded-full border border-emerald-100">
                            Ready: {stats.allDoneCount}
                        </span>
                    </div>
                </div>
                <button
                    onClick={handleRefresh}
                    className="p-2 bg-white hover:bg-teal-50 text-slate-400 hover:text-teal-600 rounded-xl border border-slate-200 shadow-sm transition-all active:scale-95"
                    title="从服务器刷新追踪数据"
                >
                    <RefreshCw size={14} />
                </button>
            </div>

            {/* 图纸列表 */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
                {reviewingDrawings.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-3">
                        <ClipboardCheck size={48} className="text-slate-200" />
                        <p className="text-sm font-bold uppercase tracking-widest">No drawings in review</p>
                        <p className="text-xs text-slate-300">图纸进入 Reviewing 状态后会自动出现在这里</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {reviewingDrawings.map(drawing => {
                            const trackerEntry = reviewTracker[drawing.id] || {};
                            const assignees = drawing.assignees || [];
                            const doneCount = assignees.filter(a => trackerEntry[a]?.done).length;
                            const allDone = assignees.length > 0 && doneCount === assignees.length;

                            return (
                                <div
                                    key={drawing.id}
                                    className={`rounded-2xl border transition-all ${allDone
                                            ? 'bg-emerald-50/60 border-emerald-200 shadow-sm shadow-emerald-100/50'
                                            : 'bg-white border-slate-200 shadow-sm'
                                        }`}
                                >
                                    {/* 图纸信息头 */}
                                    <div className="px-5 py-3.5 flex items-center justify-between border-b border-slate-100/80">
                                        <div className="flex items-center gap-4 min-w-0">
                                            <div className="flex flex-col min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs font-[1000] text-teal-600 uppercase tracking-wider shrink-0">
                                                        {drawing.drawingNo}
                                                    </span>
                                                    {drawing.discipline && (
                                                        <span className="text-[9px] font-black bg-slate-100 text-slate-500 px-2 py-0.5 rounded-md uppercase tracking-wider">
                                                            {drawing.discipline}
                                                        </span>
                                                    )}
                                                </div>
                                                <span className="text-[11px] font-bold text-slate-500 truncate mt-0.5">
                                                    {drawing.title}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-3 shrink-0">
                                            {/* 进度指示 */}
                                            <div className={`text-[10px] font-[1000] uppercase tracking-wider px-3 py-1.5 rounded-full border ${allDone
                                                    ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                                                    : 'bg-slate-50 text-slate-500 border-slate-200'
                                                }`}>
                                                {allDone ? '✅ READY' : `${doneCount}/${assignees.length}`}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Assignee 列表 */}
                                    <div className="px-5 py-3 flex flex-wrap gap-2">
                                        {assignees.length === 0 ? (
                                            <span className="text-[10px] text-slate-300 font-bold uppercase tracking-wider italic">
                                                No Assignees
                                            </span>
                                        ) : (
                                            assignees.map(assignee => {
                                                const isDone = trackerEntry[assignee]?.done;
                                                return (
                                                    <button
                                                        key={assignee}
                                                        onClick={() => toggleAssigneeDone(drawing.id, assignee)}
                                                        className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all active:scale-95 border ${isDone
                                                                ? 'bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-150 shadow-sm'
                                                                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:border-slate-300'
                                                            }`}
                                                        title={isDone ? `${assignee}: 已完成 (点击取消)` : `${assignee}: 点击标记完成`}
                                                    >
                                                        {isDone ? (
                                                            <CheckCircle2 size={14} className="text-emerald-500" />
                                                        ) : (
                                                            <Circle size={14} className="text-slate-300" />
                                                        )}
                                                        <span className="uppercase tracking-wider">{assignee}</span>
                                                    </button>
                                                );
                                            })
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};

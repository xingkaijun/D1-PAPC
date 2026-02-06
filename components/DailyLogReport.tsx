import React, { useState, useMemo } from 'react';
import { useStore } from '../store';
import { Calendar, Download, Copy, FileText } from 'lucide-react';
import { format, isWithinInterval, startOfDay, endOfDay, parseISO } from 'date-fns';

export const DailyLogReport: React.FC = () => {
    const { data, activeProjectId } = useStore();
    const activeProject = data.projects.find(p => p.id === activeProjectId);

    const [selectedDate, setSelectedDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));

    // 数据聚合引擎
    const dailyChanges = useMemo(() => {
        if (!activeProject) return [];

        const targetDate = parseISO(selectedDate);
        const dateStart = startOfDay(targetDate);
        const dateEnd = endOfDay(targetDate);

        const changes: Array<{
            time: string;
            drawingNo: string;
            drawingTitle: string;
            customId: string;
            eventType: string;
            detail: string;
            note: string;
        }> = [];

        // 遍历所有图纸
        activeProject.drawings.forEach(drawing => {
            // 1. 从 statusHistory 提取
            (drawing.statusHistory || []).forEach(history => {
                const historyDate = parseISO(history.createdAt);
                if (isWithinInterval(historyDate, { start: dateStart, end: dateEnd })) {
                    changes.push({
                        time: format(historyDate, 'HH:mm:ss'),
                        drawingNo: drawing.drawingNo,
                        drawingTitle: drawing.title || '',
                        customId: drawing.customId,
                        eventType: 'Change',
                        detail: history.content,
                        note: ''
                    });
                }
            });

            // 2. 从 logs (Transmittal) 提取
            (drawing.logs || []).forEach(log => {
                // 检查 receivedDate
                if (log.receivedDate) {
                    const receivedDate = parseISO(log.receivedDate);
                    if (isWithinInterval(receivedDate, { start: dateStart, end: dateEnd })) {
                        changes.push({
                            time: format(receivedDate, 'HH:mm:ss'),
                            drawingNo: drawing.drawingNo,
                            drawingTitle: drawing.title || '',
                            customId: drawing.customId,
                            eventType: 'Received',
                            detail: `Version: ${log.version}, Comments: ${log.commentCount}`,
                            note: log.dueDate ? `Due: ${log.dueDate}` : ''
                        });
                    }
                }

                // 检查 sentDate
                if (log.sentDate) {
                    const sentDate = parseISO(log.sentDate);
                    if (isWithinInterval(sentDate, { start: dateStart, end: dateEnd })) {
                        changes.push({
                            time: format(sentDate, 'HH:mm:ss'),
                            drawingNo: drawing.drawingNo,
                            drawingTitle: drawing.title || '',
                            customId: drawing.customId,
                            eventType: 'Sent',
                            detail: `Version: ${log.version}`,
                            note: ''
                        });
                    }
                }
            });
        });

        // 按时间正序排列（旧到新，方便合并）
        const sortedChanges = changes.sort((a, b) => a.time.localeCompare(b.time));

        // 合并同一分钟内相同图纸的 Comments 变更
        const mergedChanges: typeof changes = [];
        const mergeMap = new Map<string, typeof changes[0]>();

        sortedChanges.forEach((change) => {
            // 只合并 Change 类型且包含 Comments 的记录
            if (change.eventType === 'Change' && change.detail.includes('Comments:')) {
                const timeKey = change.time.substring(0, 5); // HH:mm (精确到分钟)
                const key = `${change.drawingNo}-${timeKey}`;

                if (mergeMap.has(key)) {
                    // 合并：提取最终状态
                    const existing = mergeMap.get(key)!;
                    const newValue = change.detail.match(/Comments: .+ -> (.+)$/)?.[1];
                    if (newValue) {
                        // 保留初始状态，更新最终状态
                        const initialValue = existing.detail.match(/Comments: (.+) ->/)?.[1];
                        existing.detail = existing.detail.replace(/Comments: .+ -> .+/, `Comments: ${initialValue} -> ${newValue}`);
                        existing.time = change.time; // 使用最后一次修改的时间
                    }
                } else {
                    mergeMap.set(key, change);
                    mergedChanges.push(change);
                }
            } else {
                // 非 Comments 变更或其他类型，直接添加
                mergedChanges.push(change);
            }
        });

        // 按时间倒序排列（新到旧）
        return mergedChanges.sort((a, b) => b.time.localeCompare(a.time));
    }, [activeProject, selectedDate]);

    // 导出为文本
    const handleCopyText = () => {
        const text = [
            `Daily Change Log - ${selectedDate}`,
            `Project: ${activeProject?.name || 'N/A'}`,
            `Total Events: ${dailyChanges.length}`,
            '',
            'Time\t\tID\t\tDrawing No\t\tTitle\t\tType\t\tDetail\t\tNote',
            ...dailyChanges.map(c =>
                `${c.time}\t\t${c.customId}\t\t${c.drawingNo}\t\t${c.drawingTitle}\t\t${c.eventType}\t\t${c.detail}\t\t${c.note}`
            )
        ].join('\n');

        navigator.clipboard.writeText(text);
        alert('Copied to clipboard');
    };

    // 导出为 CSV
    const handleExportCSV = () => {
        const csv = [
            'Time,ID,Drawing No,Title,Type,Detail,Note',
            ...dailyChanges.map(c =>
                `${c.time},"${c.customId}","${c.drawingNo}","${c.drawingTitle}","${c.eventType}","${c.detail}","${c.note}"`
            )
        ].join('\n');

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `daily_log_${selectedDate}.csv`;
        link.click();
    };

    if (!activeProject) {
        return (
            <div className="p-8 text-center text-slate-400">
                <FileText size={48} className="mx-auto mb-4 opacity-20" />
                <p>Please select a project first</p>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col overflow-hidden">
            {/* Header */}
            <div className="p-6 pb-3 shrink-0">
                <h2 className="text-2xl font-black text-slate-800 mb-2">Daily Logs</h2>
                <p className="text-sm text-slate-500">Track changes based on Log Stream</p>
            </div>

            {/* Controls */}
            <div className="px-6 pb-3 shrink-0">
                <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-4">
                    <div className="flex items-center gap-2 flex-1">
                        <Calendar size={18} className="text-slate-400" />
                        <label className="text-sm font-bold text-slate-600">Select Date:</label>
                        <input
                            type="date"
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            className="px-3 py-2 border border-slate-200 rounded-lg text-sm font-bold focus:outline-none focus:ring-2 focus:ring-teal-500"
                        />
                    </div>

                    <div className="flex gap-2">
                        <button
                            onClick={handleCopyText}
                            className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-bold transition-colors"
                        >
                            <Copy size={14} />
                            Copy
                        </button>
                        <button
                            onClick={handleExportCSV}
                            className="flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-sm font-bold transition-colors"
                        >
                            <Download size={14} />
                            Export CSV
                        </button>
                    </div>
                </div>
            </div>

            {/* Stats */}
            <div className="px-6 pb-3 shrink-0">
                <div className="bg-gradient-to-r from-teal-50 to-cyan-50 rounded-xl p-4 border border-teal-100">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs font-black uppercase text-teal-600 tracking-widest">Total Events</p>
                            <p className="text-3xl font-black text-teal-800">{dailyChanges.length}</p>
                        </div>
                        <div className="text-right">
                            <p className="text-xs font-bold text-slate-500">Project: {activeProject.name}</p>
                            <p className="text-xs font-bold text-slate-500">Date: {selectedDate}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Table - Scrollable Area */}
            <div className="flex-1 px-6 pb-6 overflow-hidden">
                <div className="bg-white rounded-xl border border-slate-200 h-full overflow-auto">
                    <table className="w-full">
                        <thead className="bg-slate-50 border-b border-slate-200 sticky top-0">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-black uppercase text-slate-600 tracking-widest">Time</th>
                                <th className="px-4 py-3 text-left text-xs font-black uppercase text-slate-600 tracking-widest">ID</th>
                                <th className="px-4 py-3 text-left text-xs font-black uppercase text-slate-600 tracking-widest">Drawing No</th>
                                <th className="px-4 py-3 text-left text-xs font-black uppercase text-slate-600 tracking-widest">Title</th>
                                <th className="px-4 py-3 text-left text-xs font-black uppercase text-slate-600 tracking-widest">Type</th>
                                <th className="px-4 py-3 text-left text-xs font-black uppercase text-slate-600 tracking-widest">Detail</th>
                                <th className="px-4 py-3 text-left text-xs font-black uppercase text-slate-600 tracking-widest" title="Additional information like Due Date for Transmittals">Note</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {dailyChanges.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-4 py-12 text-center">
                                        <div className="text-slate-300">
                                            <FileText size={48} className="mx-auto mb-3 opacity-20" />
                                            <p className="text-sm font-bold">No changes recorded for this date</p>
                                            <p className="text-xs mt-1">Try selecting another date or check data</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                dailyChanges.map((change, idx) => (
                                    <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-4 py-3 text-sm font-mono text-slate-600">{change.time}</td>
                                        <td className="px-4 py-3 text-sm font-black text-slate-800">{change.customId}</td>
                                        <td className="px-4 py-3 text-sm font-mono text-teal-600">{change.drawingNo}</td>
                                        <td className="px-4 py-3 text-sm font-bold text-slate-700">{change.drawingTitle}</td>
                                        <td className="px-4 py-3">
                                            <span className={`px-2 py-1 rounded-md text-xs font-black uppercase ${change.eventType === 'Change' ? 'bg-blue-50 text-blue-700' :
                                                change.eventType === 'Received' ? 'bg-green-50 text-green-700' :
                                                    'bg-purple-50 text-purple-700'
                                                }`}>
                                                {change.eventType}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-sm font-bold text-slate-700">{change.detail}</td>
                                        <td className="px-4 py-3 text-xs text-slate-500">{change.note}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

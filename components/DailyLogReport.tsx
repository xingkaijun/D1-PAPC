import React, { useState, useMemo } from 'react';
import { useStore } from '../store';
import { Calendar, Download, Copy, FileText, Printer, Check } from 'lucide-react';
import { format, isWithinInterval, startOfDay, endOfDay, parseISO } from 'date-fns';

export const DailyLogReport: React.FC = () => {
    const { data, activeProjectId } = useStore();
    const activeProject = data.projects.find(p => p.id === activeProjectId);

    const [selectedDate, setSelectedDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
    const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

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

    // 筛选出当天状态变为 Waiting Reply 或 Approved 的图纸（用于打印流转单）
    const transmittalDrawings = useMemo(() => {
        if (!activeProject) return [];
        const targetDate = parseISO(selectedDate);
        const dateStart = startOfDay(targetDate);
        const dateEnd = endOfDay(targetDate);

        // 记录符合条件的图纸 ID 及其相关状态信息
        const validDrawingsMap = new Map<string, {
            time: string;
            drawingItem: typeof activeProject.drawings[0];
            finalStatus: string;
        }>();

        activeProject.drawings.forEach(drawing => {
            (drawing.statusHistory || []).forEach(history => {
                const historyDate = parseISO(history.createdAt);
                if (isWithinInterval(historyDate, { start: dateStart, end: dateEnd })) {
                    // 匹配 "Status: Reviewing -> Waiting Reply" 或 "Status: Reviewing -> Approved"
                    const match = history.content.match(/Status: Reviewing -> (Waiting Reply|Approved)/i);
                    // 或者更通用一点，只要最后变成了 Waiting/Approved
                    const anyMatch = history.content.match(/Status: .* -> (Waiting Reply|Approved)/i);
                    if (anyMatch) {
                        const newStatus = anyMatch[1];
                        // 如果同一天多次变更，保留最后一次匹配的
                        validDrawingsMap.set(drawing.id, {
                            time: format(historyDate, 'HH:mm'),
                            drawingItem: drawing,
                            finalStatus: newStatus
                        });
                    }
                }
            });
        });

        // 转换回数组形式，供打印渲染
        return Array.from(validDrawingsMap.values()).map(d => {
            const dwg = d.drawingItem;
            return {
                id: dwg.id,
                customId: dwg.customId,
                drawingNo: dwg.drawingNo,
                title: dwg.title || '',
                round: dwg.currentRound,
                openComments: dwg.manualOpenCommentsCount || 0,
                totalComments: dwg.manualCommentsCount || 0,
                isApproved: d.finalStatus === 'Approved' || dwg.status === 'Approved'
            };
        });
    }, [activeProject, selectedDate]);

    // 动态从 CDN 加载脚本（绕过 Vite import 分析）
    const loadScript = (src: string): Promise<void> => {
        return new Promise((resolve, reject) => {
            if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
            const s = document.createElement('script');
            s.src = src;
            s.onload = () => resolve();
            s.onerror = () => reject(new Error(`Failed to load ${src}`));
            document.head.appendChild(s);
        });
    };

    // 导出为 PDF
    const handleDownloadPDF = async () => {
        setIsGeneratingPDF(true);
        try {
            // 尝试多个 CDN 源
            const cdnSources = [
                {
                    html2canvas: 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js',
                    jspdf: 'https://cdn.jsdelivr.net/npm/jspdf@2.5.2/dist/jspdf.umd.min.js'
                },
                {
                    html2canvas: 'https://unpkg.com/html2canvas@1.4.1/dist/html2canvas.min.js',
                    jspdf: 'https://unpkg.com/jspdf@2.5.2/dist/jspdf.umd.min.js'
                }
            ];

            let loaded = false;
            for (const cdn of cdnSources) {
                try {
                    await Promise.all([loadScript(cdn.html2canvas), loadScript(cdn.jspdf)]);
                    loaded = true;
                    break;
                } catch { /* try next CDN */ }
            }

            if (!loaded) throw new Error('CDN unavailable');

            const html2canvas = (window as any).html2canvas;
            const jsPDF = (window as any).jspdf?.jsPDF;
            if (!html2canvas || !jsPDF) throw new Error('Libraries not loaded');

            const printElement = document.getElementById('print-transmittal-area');
            if (!printElement) return;

            // 临时让它可见以便被 canvas 截取
            const originalClasses = printElement.className;
            printElement.className = "block absolute top-0 left-0 w-[794px] bg-white z-[9999] px-[15mm] py-[10mm] text-black";

            await new Promise(resolve => setTimeout(resolve, 400));

            const canvas = await html2canvas(printElement, {
                scale: 2,
                useCORS: true,
                logging: false,
                backgroundColor: '#ffffff'
            });

            printElement.className = originalClasses;

            const imgData = canvas.toDataURL('image/jpeg', 0.95);
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

            pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
            pdf.save(`Transmittal_Record_${selectedDate}.pdf`);

        } catch (error) {
            console.error('PDF export failed, falling back to browser print:', error);
            // 回退方案：使用浏览器打印（用户可选"另存为 PDF"）
            window.print();
        } finally {
            setIsGeneratingPDF(false);
        }
    };

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
            {/* 正常视图 - 打印时隐藏 */}
            <div className="flex flex-col h-full overflow-hidden print:hidden">
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
                                onClick={handleDownloadPDF}
                                disabled={isGeneratingPDF}
                                className={`flex items-center gap-2 px-4 py-2 ${isGeneratingPDF ? 'bg-slate-300' : 'bg-indigo-600 hover:bg-indigo-700'} text-white rounded-lg text-sm font-bold transition-colors shadow-sm`}
                            >
                                <Printer size={14} className={isGeneratingPDF ? "animate-spin" : ""} />
                                {isGeneratingPDF ? "Generating PDF..." : "Export PDF"}
                            </button>
                            <button
                                onClick={handleCopyText}
                                className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-bold transition-colors ml-2"
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

            {/* 隐藏的打印区域 - 图纸流转单 */}
            <div id="print-transmittal-area" className="hidden print:block absolute top-0 left-0 w-[794px] bg-white z-[9999] px-[15mm] py-[10mm] text-black">
                {/* 打印表头 Logo & Title */}
                <div className="flex justify-between items-end border-b-2 border-slate-900 pb-4 mb-6">
                    <div className="flex items-center">
                        <img
                            src="https://i.postimg.cc/sf8Qvb1Q/PACIFIC-GAS-logo-(yuan-se-tou-ming-di-04.png"
                            alt="Pacific Gas Logo"
                            className="h-16 w-auto object-contain"
                        />
                    </div>
                    <div className="text-right">
                        <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight leading-none mb-1">
                            Document Transmittal Record
                        </h2>
                        <div className="text-sm font-bold text-slate-500 uppercase mt-2">
                            DATE: {format(parseISO(selectedDate), 'dd MMM yyyy')}
                        </div>
                    </div>
                </div>

                {/* 项目信息栏 */}
                <div className="flex justify-between items-center mb-6 px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg">
                    <div className="flex items-center gap-3">
                        <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Project Name:</span>
                        <span className="text-sm font-bold text-slate-900 uppercase">{activeProject.name}</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Total Items:</span>
                        <span className="text-sm font-bold text-slate-900">{transmittalDrawings.length}</span>
                    </div>
                </div>

                {/* 打印表格主体 */}
                <table className="w-full text-left border-collapse border border-slate-300">
                    <thead className="bg-slate-100">
                        <tr>
                            <th className="border border-slate-300 px-3 py-2 text-[10px] font-black uppercase text-slate-600 tracking-wider">No.</th>
                            <th className="border border-slate-300 px-3 py-2 text-[10px] font-black uppercase text-slate-600 tracking-wider">ID</th>
                            <th className="border border-slate-300 px-3 py-2 text-[10px] font-black uppercase text-slate-600 tracking-wider">Drawing No.</th>
                            <th className="border border-slate-300 px-3 py-2 text-[10px] font-black uppercase text-slate-600 tracking-wider">Title</th>
                            <th className="border border-slate-300 px-3 py-2 text-[10px] font-black uppercase text-slate-600 tracking-wider text-center">Round</th>
                            <th className="border border-slate-300 px-3 py-2 text-[10px] font-black uppercase text-slate-600 tracking-wider text-center">Open Cmt</th>
                            <th className="border border-slate-300 px-3 py-2 text-[10px] font-black uppercase text-slate-600 tracking-wider text-center">Total Cmt</th>
                            <th className="border border-slate-300 px-3 py-2 text-[10px] font-black uppercase text-slate-600 tracking-wider text-center">Approved</th>
                        </tr>
                    </thead>
                    <tbody>
                        {transmittalDrawings.length === 0 ? (
                            <tr>
                                <td colSpan={8} className="border border-slate-300 px-3 py-8 text-center text-xs font-bold text-slate-400 italic">
                                    No drawings processed (Waiting Reply / Approved) on this date.
                                </td>
                            </tr>
                        ) : (
                            transmittalDrawings.map((dwg, idx) => (
                                <tr key={dwg.id} className="text-[10px] font-medium text-slate-800">
                                    <td className="border border-slate-300 px-3 py-1.5 text-center text-slate-500 font-bold">{idx + 1}</td>
                                    <td className="border border-slate-300 px-3 py-1.5 font-bold uppercase">{dwg.customId}</td>
                                    <td className="border border-slate-300 px-3 py-1.5">{dwg.drawingNo}</td>
                                    <td className="border border-slate-300 px-3 py-1.5 leading-snug">{dwg.title}</td>
                                    <td className="border border-slate-300 px-3 py-1.5 text-center">{dwg.round}</td>
                                    <td className="border border-slate-300 px-3 py-1.5 text-center">{dwg.openComments}</td>
                                    <td className="border border-slate-300 px-3 py-1.5 text-center">{dwg.totalComments}</td>
                                    <td className="border border-slate-300 px-3 py-1.5 text-center align-middle">
                                        {dwg.isApproved ? (
                                            <div className="flex justify-center">
                                                <Check size={14} className="text-emerald-600 border border-emerald-600 rounded-sm" strokeWidth={3} />
                                            </div>
                                        ) : null}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>

                {/* 页脚备注区 */}
                <div className="mt-4 text-left text-[8px] font-bold text-slate-400 tracking-widest uppercase">
                    Generated by Plan Approval Platform - {format(new Date(), 'yyyy-MM-dd HH:mm:ss')}
                </div>
            </div>
        </div>
    );
};

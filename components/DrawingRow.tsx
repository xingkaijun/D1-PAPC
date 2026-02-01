
import React, { memo } from 'react';
import { Drawing, DrawingStatus } from '../types';
import {
    ChevronDown, ChevronRight, AlertTriangle, Clock,
    Trash2, History, StickyNote, CheckCircle2, Circle, Check
} from 'lucide-react';
import { format, isAfter, differenceInCalendarDays } from 'date-fns';

interface DrawingRowProps {
    drawing: Drawing;
    activeProjectId: string;
    isExpanded: boolean;
    onToggleExpand: (id: string) => void;
    updateDrawing: (projectId: string, drawingId: string, updates: Partial<Drawing>) => void;
    deleteDrawing: (projectId: string, drawingId: string) => void;
    toggleRemarkStatus: (projectId: string, drawingId: string, remarkId: string) => void;
    reviewers: (string | { id: string, name: string })[];
    derivedDisciplines: string[];
}

// Sub-components used in Row
const StatusBadge = ({ drawing, onStatusChange }: { drawing: Drawing, onStatusChange: (s: DrawingStatus) => void }) => {
    const isOverdue = drawing.status === 'Reviewing' && drawing.reviewDeadline && isAfter(new Date(), new Date(drawing.reviewDeadline));
    const config = {
        'Pending': 'bg-slate-100 text-slate-500 border-slate-200',
        'Reviewing': isOverdue
            ? 'bg-red-50 text-red-700 border-red-200 animate-pulse'
            : 'bg-teal-50 text-teal-700 border-teal-200/50',
        'Waiting Reply': 'bg-cyan-50 text-cyan-700 border-cyan-200/50',
        'Approved': 'bg-emerald-50 text-emerald-700 border-emerald-200/50',
    };
    return (
        <div className="relative flex flex-col items-center group/status" title={`Manual Status: ${drawing.status}`}>
            <span className={`px-2 py-0.5 rounded-md text-[8px] font-black uppercase border tracking-tight leading-none pointer-events-none ${config[drawing.status]}`}>
                {drawing.status}
            </span>
            {isOverdue && (
                <span className="text-[7px] text-red-600 font-black mt-1 flex items-center gap-0.5 leading-none">
                    <AlertTriangle size={8} /> OVERDUE
                </span>
            )}
            <select
                value={drawing.status}
                onChange={(e) => onStatusChange(e.target.value as DrawingStatus)}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
            >
                {['Pending', 'Reviewing', 'Waiting Reply', 'Approved'].map(s => (
                    <option key={s} value={s}>{s}</option>
                ))}
            </select>
        </div>
    );
};

const MultiAssigneeDropdown = ({ drawing, reviewers, onUpdate }: { drawing: Drawing, reviewers: (string | { id: string, name: string })[], onUpdate: (ids: string[]) => void }) => {
    const [open, setOpen] = React.useState(false);

    // Helper to normalize reviewer to ID/Name
    const getRevId = (r: string | { id: string, name: string }) => typeof r === 'string' ? r : r.id;
    const getRevName = (r: string | { id: string, name: string }) => typeof r === 'string' ? r : r.name;

    const toggle = (r: string | { id: string, name: string }) => {
        const id = getRevId(r);
        const name = getRevName(r); // We store Name or ID? Usually Name for display.
        // Actually, existing logic likely stores Names in `drawing.assignees`.
        // If we switch to objects, we might want to store IDs?
        // Let's assume we continue storing NAMES (or whatever string representation was used).
        // If the reviewer is {id: 'kevin', name: 'Kevin'}, we likely store 'Kevin'.
        // Let's use getRevName(r) as the value for consistency with previous string-only array.
        const val = getRevName(r);

        const current = drawing.assignees || [];
        const next = current.includes(val) ? current.filter(n => n !== val) : [...current, val];
        onUpdate(next);
    };

    return (
        <div className="relative no-print">
            <button
                onClick={() => setOpen(!open)}
                className="flex items-center gap-1.5 px-2 py-1 bg-slate-50 border border-slate-100 rounded-lg hover:bg-white hover:border-teal-400 transition-all w-full shadow-sm"
            >
                <div className="flex -space-x-1.5 overflow-hidden flex-1">
                    {(drawing.assignees || []).length > 0 ? (
                        drawing.assignees.map(a => (
                            <div key={a} className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-slate-900 text-white text-[7px] font-black border-2 border-white shadow-sm" title={a}>
                                {a.charAt(0)}
                            </div>
                        ))
                    ) : <span className="text-[8px] text-slate-300 font-black uppercase ml-1">Unset</span>}
                </div>
                <ChevronDown size={8} className="text-slate-400" />
            </button>

            {open && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
                    <div className="absolute top-full left-0 mt-1 w-36 bg-white border border-slate-200 rounded-2xl shadow-2xl z-50 p-1 animate-in zoom-in-95 duration-75">
                        <div className="text-[7px] font-black text-slate-400 uppercase p-1.5 tracking-widest border-b border-slate-50 mb-1">Reviewers</div>
                        {reviewers.map(r => {
                            const id = getRevId(r);
                            const name = getRevName(r);
                            return (
                                <label key={id} className="flex items-center gap-2 px-2 py-1.5 hover:bg-teal-50 rounded-lg cursor-pointer transition-colors group">
                                    <input
                                        type="checkbox"
                                        checked={drawing.assignees.includes(name)}
                                        onChange={() => toggle(r)}
                                        className="w-3 h-3 rounded text-teal-600 focus:ring-teal-500 border-slate-200"
                                    />
                                    <span className="text-[10px] font-bold text-slate-700">{name}</span>
                                </label>
                            );
                        })}
                    </div>
                </>
            )}
        </div>
    );
};

export const DrawingRow = memo(({
    drawing,
    activeProjectId,
    isExpanded,
    onToggleExpand,
    updateDrawing,
    deleteDrawing,
    toggleRemarkStatus,
    reviewers,
    derivedDisciplines
}: DrawingRowProps) => {
    const liveRemarkCount = drawing.remarks?.length || 0;
    const liveOpenRemarkCount = drawing.remarks?.filter(r => !r.resolved).length || 0;

    return (
        <React.Fragment>
            <tr className={`group transition-all duration-200 ${isExpanded ? 'bg-teal-50/30' : 'hover:bg-slate-50/40'}`}>
                <td className="px-3 py-2 text-center">
                    <button
                        onClick={() => onToggleExpand(drawing.id)}
                        className={`p-1.5 rounded-lg transition-all relative ${isExpanded ? 'bg-teal-600 text-white shadow-md' : 'text-slate-300 hover:text-teal-600'}`}
                    >
                        {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                    </button>
                </td>
                <td className="px-3 py-2 font-black text-slate-900 text-[10px] relative">
                    <div className="flex items-center gap-1.5">
                        {liveOpenRemarkCount > 0 && (() => {
                            const openRemarks = drawing.remarks?.filter(r => !r.resolved) || [];
                            const hasUrgent = openRemarks.some(r => r.content.toLowerCase().includes('#urgent'));
                            const hasHold = openRemarks.some(r => r.content.toLowerCase().includes('#hold'));
                            const hasOtherTag = openRemarks.some(r => r.content.startsWith('#'));

                            let dotColor = 'bg-blue-500 shadow-blue-500/30'; // Default text (Blue)
                            if (hasUrgent) dotColor = 'bg-red-500 shadow-red-500/30';
                            else if (hasHold) dotColor = 'bg-amber-500 shadow-amber-500/30';
                            else if (hasOtherTag) dotColor = 'bg-purple-500 shadow-purple-500/30';

                            return (
                                <div className={`w-2 h-2 rounded-full shrink-0 shadow-sm ${dotColor}`} title="Unresolved internal remarks" />
                            );
                        })()}
                        <span>{drawing.customId}</span>
                    </div>
                </td>
                <td className="px-1 py-2 font-mono text-[10px] font-bold text-teal-600 truncate">{drawing.drawingNo}</td>
                <td className="px-3 py-2">
                    <input
                        type="text" value={drawing.version}
                        onChange={(e) => updateDrawing(activeProjectId, drawing.id, { version: e.target.value })}
                        className="w-full bg-slate-100/50 border-none rounded-md text-[9px] font-black text-center py-0.5 focus:bg-white"
                    />
                </td>
                <td className="px-3 py-2 text-center">
                    <span className="text-[8px] font-black text-slate-400">{drawing.currentRound}</span>
                </td>
                <td className="px-3 py-2">
                    <select
                        value={drawing.discipline}
                        onChange={(e) => updateDrawing(activeProjectId, drawing.id, { discipline: e.target.value })}
                        className="w-full bg-transparent border-none text-[9px] font-black uppercase text-slate-500 cursor-pointer p-0"
                    >
                        {derivedDisciplines.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                </td>
                <td className="px-3 py-2 truncate text-[10px] font-bold text-slate-700 tracking-tight" title={drawing.title}>{drawing.title}</td>
                <td className="px-3 py-2">
                    {drawing.reviewDeadline ? (
                        <div className={`text-[9px] font-black flex items-center gap-1 ${isAfter(new Date(), new Date(drawing.reviewDeadline)) ? 'text-red-600' : 'text-slate-500'}`}>
                            <Clock size={10} /> {format(new Date(drawing.reviewDeadline), 'MM-dd')}
                        </div>
                    ) : <span className="text-slate-200">—</span>}
                </td>
                <td className="px-3 py-2 text-center">
                    {drawing.reviewDeadline ? (() => {
                        const days = differenceInCalendarDays(new Date(drawing.reviewDeadline), new Date());
                        let colorClass = 'text-slate-500';
                        if (days < 0) colorClass = 'text-red-600 font-black'; // Overdue
                        else if (days <= 3) colorClass = 'text-amber-500 font-black'; // Warning
                        else colorClass = 'text-emerald-500 font-bold'; // Safe

                        return (
                            <span className={`text-[10px] ${colorClass}`}>{days}d</span>
                        );
                    })() : <span className="text-slate-200">—</span>}
                </td>
                <td className="px-1 py-2">
                    <MultiAssigneeDropdown drawing={drawing} reviewers={reviewers} onUpdate={(ids) => updateDrawing(activeProjectId, drawing.id, { assignees: ids })} />
                </td>
                <td className="px-3 py-2 text-center">
                    <StatusBadge drawing={drawing} onStatusChange={(s) => updateDrawing(activeProjectId, drawing.id, { status: s })} />
                </td>
                <td className="px-3 py-2 text-center group/cell">
                    <input
                        type="number"
                        min="0"
                        value={drawing.manualCommentsCount}
                        onChange={(e) => updateDrawing(activeProjectId, drawing.id, { manualCommentsCount: parseInt(e.target.value) || 0 })}
                        className="w-full bg-slate-100/50 border-none rounded-md text-[10px] font-black text-center py-0.5 focus:bg-white focus:ring-1 focus:ring-teal-500/30"
                    />
                </td>
                <td className="px-3 py-2 text-center">
                    <input
                        type="number"
                        min="0"
                        value={drawing.manualOpenCommentsCount}
                        onChange={(e) => updateDrawing(activeProjectId, drawing.id, { manualOpenCommentsCount: parseInt(e.target.value) || 0 })}
                        className={`w-full border-none rounded-md text-[10px] font-black text-center py-0.5 focus:bg-white focus:ring-1 focus:ring-teal-500/30 ${drawing.manualOpenCommentsCount > 0 ? 'bg-red-50 text-red-500' : 'bg-slate-100/50 text-slate-400'}`}
                    />
                </td>
                <td className="px-3 py-2 text-center">
                    <div className={`w-5 h-5 rounded-lg flex items-center justify-center mx-auto transition-all ${drawing.status === 'Approved' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20 scale-110' : 'bg-slate-100 text-slate-200'}`}>
                        <Check size={12} strokeWidth={4} />
                    </div>
                </td>
                <td className="px-3 py-2 text-right">
                    <button onClick={() => deleteDrawing(activeProjectId, drawing.id)} className="p-1.5 text-slate-200 hover:text-red-500 transition-colors">
                        <Trash2 size={12} />
                    </button>
                </td>
            </tr>
            {isExpanded && (
                <tr className="bg-slate-50/50 border-l-2 border-teal-500 animate-in slide-in-from-left-1">
                    <td colSpan={14} className="px-8 py-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                                <h4 className="text-[8px] font-black uppercase text-slate-400 mb-3 tracking-widest flex items-center gap-2"><History size={12} /> Log Stream</h4>
                                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-2 scrollbar-thin">
                                    {drawing.statusHistory.slice().reverse().map(h => (
                                        <div key={h.id} className="text-[9px] px-3 py-1.5 bg-slate-50 rounded-lg flex justify-between items-center">
                                            <span className="font-bold text-slate-600">{h.content}</span>
                                            <span className="font-mono text-slate-400">{format(new Date(h.createdAt), 'MM-dd HH:mm')}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                                <h4 className="text-[8px] font-black uppercase text-slate-400 mb-3 tracking-widest flex items-center gap-2"><StickyNote size={12} className="text-teal-500" /> Internal Notes ({liveRemarkCount})</h4>
                                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-2 scrollbar-thin">
                                    {drawing.remarks.map(r => {
                                        const lower = r.content.toLowerCase();
                                        let bgClass = 'bg-blue-50 text-blue-700'; // Default text (Blue)
                                        let iconClass = 'text-blue-400';

                                        if (lower.includes('#urgent')) {
                                            bgClass = 'bg-red-50 text-red-700 border border-red-100';
                                            iconClass = 'text-red-500';
                                        } else if (lower.includes('#hold')) {
                                            bgClass = 'bg-amber-50 text-amber-700 border border-amber-100';
                                            iconClass = 'text-amber-500';
                                        } else if (lower.startsWith('#')) {
                                            bgClass = 'bg-purple-50 text-purple-700 border border-purple-100'; // Other tags
                                            iconClass = 'text-purple-500';
                                        }

                                        return (
                                            <div key={r.id} className={`text-[9px] px-3 py-1.5 rounded-lg flex items-start gap-2 transition-colors ${bgClass} ${r.resolved ? 'opacity-50 grayscale' : ''}`}>
                                                <button onClick={() => toggleRemarkStatus(activeProjectId, drawing.id, r.id)} className={`mt-0.5 ${r.resolved ? 'text-slate-400' : iconClass} hover:opacity-80`}>
                                                    {r.resolved ? <CheckCircle2 size={14} /> : <Circle size={14} fill="currentColor" className="opacity-20" />}
                                                </button>
                                                <span className={`font-bold leading-normal flex-1 ${r.resolved ? 'line-through' : ''}`}>{r.content}</span>
                                                <span className="text-[7px] font-mono opacity-50 mt-0.5">{format(new Date(r.createdAt), 'MM-dd')}</span>
                                            </div>
                                        );
                                    })}
                                    {drawing.remarks.length === 0 && (
                                        <div className="py-10 text-center text-slate-300 text-[8px] font-black uppercase tracking-widest italic">No remarks recorded via command bar</div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </td>
                </tr>
            )}
        </React.Fragment>
    );
});

DrawingRow.displayName = "DrawingRow";

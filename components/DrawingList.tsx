
import React, { useState, useMemo, useRef, useCallback } from 'react';
import { useStore } from '../store';
import { Drawing, DrawingStatus } from '../types';
import { 
  MessageSquare, ChevronDown, ChevronRight, Search, FileUp, History, Trash2, 
  AlertTriangle, Clock, StickyNote, X, CheckCircle2, Circle, Check, UserPlus, Edit3,
  Layers, FilterX, Printer
} from 'lucide-react';
import { format, isAfter } from 'date-fns';

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

const MultiAssigneeDropdown = ({ drawing, reviewers, onUpdate }: { drawing: Drawing, reviewers: string[], onUpdate: (ids: string[]) => void }) => {
  const [open, setOpen] = useState(false);
  const toggle = (name: string) => {
    const current = drawing.assignees || [];
    const next = current.includes(name) ? current.filter(n => n !== name) : [...current, name];
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
            {reviewers.map(r => (
              <label key={r} className="flex items-center gap-2 px-2 py-1.5 hover:bg-teal-50 rounded-lg cursor-pointer transition-colors group">
                <input 
                  type="checkbox" 
                  checked={drawing.assignees.includes(r)} 
                  onChange={() => toggle(r)}
                  className="w-3 h-3 rounded text-teal-600 focus:ring-teal-500 border-slate-200"
                />
                <span className="text-[10px] font-bold text-slate-700">{r}</span>
              </label>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

const ResizableHeader = ({ children, onResize, width }: { children?: React.ReactNode, onResize: (w: number) => void, width?: number }) => {
  const headerRef = useRef<HTMLTableHeaderCellElement>(null);
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const startX = e.pageX;
    const startWidth = headerRef.current?.offsetWidth || 0;
    const handleMouseMove = (e: MouseEvent) => onResize(Math.max(40, startWidth + (e.pageX - startX)));
    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'default';
    };
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = 'col-resize';
  }, [onResize]);

  return (
    <th ref={headerRef} style={{ width }} className="px-3 py-3 relative group/header select-none overflow-hidden bg-slate-50/50">
      <div className="flex items-center gap-1.5">{children}</div>
      <div onMouseDown={handleMouseDown} className="absolute top-0 right-0 w-0.5 h-full cursor-col-resize hover:bg-teal-500/50 transition-colors z-30" />
    </th>
  );
};

export const DrawingList: React.FC = () => {
  const { activeProjectId, data, updateDrawing, bulkImportDrawings, deleteDrawing, toggleRemarkStatus, resetAllAssignees } = useStore();
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<DrawingStatus | 'Overdue' | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importText, setImportText] = useState('');
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
  const project = data.projects.find(p => p.id === activeProjectId);
  const reviewers = data.settings.reviewers;
  
  const derivedDisciplines = useMemo(() => {
    if (!project) return [];
    return Array.from(new Set(project.drawings.map(d => d.discipline))).filter(Boolean).sort();
  }, [project]);
  
  const filteredDrawings = useMemo(() => {
    if (!project) return [];
    const lowerSearch = searchTerm.toLowerCase();
    return project.drawings.filter(d => {
      const matchesSearch = !searchTerm || 
        d.drawingNo.toLowerCase().includes(lowerSearch) || 
        d.title.toLowerCase().includes(lowerSearch) ||
        d.discipline.toLowerCase().includes(lowerSearch) ||
        d.customId.toLowerCase().includes(lowerSearch);
      if (!matchesSearch) return false;
      if (statusFilter === 'Overdue') {
        return d.status === 'Reviewing' && d.reviewDeadline && isAfter(new Date(), new Date(d.reviewDeadline));
      }
      if (statusFilter) return d.status === statusFilter;
      return true;
    });
  }, [project, searchTerm, statusFilter]);

  if (!project) return (
    <div className="flex-1 flex flex-col items-center justify-center p-10 text-center">
      <div className="bg-slate-50 p-6 rounded-3xl mb-4 border border-slate-100">
        <Layers size={40} className="text-slate-200" />
      </div>
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Fleet Entry Required</p>
    </div>
  );

  const handleBulkImport = () => {
    const lines = importText.trim().split('\n');
    const newDrawings: any[] = [];
    lines.forEach(line => {
      const parts = line.split(/[,，\t]/); 
      if (parts.length >= 4) {
        newDrawings.push({
          customId: parts[0].trim(),
          drawingNo: parts[1].trim(),
          discipline: parts[2].trim(),
          title: parts[3].trim(),
          assignees: [], 
          status: 'Pending', 
          version: '0'
        });
      }
    });
    if (newDrawings.length > 0) {
      bulkImportDrawings(activeProjectId!, newDrawings);
      setImportText('');
      setShowImportModal(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Search and Filters (no-print) */}
      <div className="px-5 py-3 border-b border-slate-100 flex flex-col gap-3 no-print bg-white shrink-0">
        <div className="flex items-center justify-between">
          <div className="relative w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={14} />
            <input 
              type="text"
              placeholder="Search drawings..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:bg-white focus:ring-4 focus:ring-teal-500/5 transition-all text-[10px] font-black uppercase tracking-tight"
            />
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => window.print()}
              className="px-4 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl text-[9px] font-black uppercase tracking-wider flex items-center gap-2 hover:bg-slate-50 active:scale-95 transition-all"
            >
              <Printer size={14} /> Print List
            </button>
            <button 
              onClick={() => window.confirm("Reset team defaults?") && resetAllAssignees(activeProjectId!)}
              className="px-4 py-2.5 bg-white border border-slate-200 text-slate-500 rounded-xl text-[9px] font-black uppercase tracking-wider flex items-center gap-2 hover:bg-slate-50 active:scale-95 transition-all"
            >
              <UserPlus size={14} /> Team Setup
            </button>
            <button 
              onClick={() => setShowImportModal(true)} 
              className="px-4 py-2.5 bg-teal-600 text-white rounded-xl text-[9px] font-black uppercase tracking-wider flex items-center gap-2 hover:bg-teal-700 active:scale-95 transition-all shadow-lg shadow-teal-500/10"
            >
              <FileUp size={14} /> Bulk Load
            </button>
          </div>
        </div>
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          <FilterButton active={statusFilter === null} onClick={() => setStatusFilter(null)} label="All Units" icon={<Layers size={12}/>} color="slate" />
          <div className="w-px h-4 bg-slate-200 mx-1" />
          <FilterButton active={statusFilter === 'Pending'} onClick={() => setStatusFilter('Pending')} label="Pending" color="slate" count={project.drawings.filter(d => d.status === 'Pending').length} />
          <FilterButton active={statusFilter === 'Reviewing'} onClick={() => setStatusFilter('Reviewing')} label="Reviewing" color="teal" count={project.drawings.filter(d => d.status === 'Reviewing').length} />
          <FilterButton active={statusFilter === 'Waiting Reply'} onClick={() => setStatusFilter('Waiting Reply')} label="Waiting" color="cyan" count={project.drawings.filter(d => d.status === 'Waiting Reply').length} />
          <FilterButton active={statusFilter === 'Approved'} onClick={() => setStatusFilter('Approved')} label="Approved" color="emerald" count={project.drawings.filter(d => d.status === 'Approved').length} />
          <FilterButton active={statusFilter === 'Overdue'} onClick={() => setStatusFilter('Overdue')} label="Overdue" color="red" icon={<AlertTriangle size={12}/>} count={project.drawings.filter(d => d.status === 'Reviewing' && d.reviewDeadline && isAfter(new Date(), new Date(d.reviewDeadline))).length} />
        </div>
      </div>

      {/* Main Table (Visible on Screen) */}
      <div className="overflow-auto flex-1 relative scrollbar-thin scrollbar-thumb-slate-200 no-print">
        <table className="w-full text-left border-collapse table-fixed min-w-[1400px]">
          <thead className="sticky top-0 z-40">
            <tr className="text-slate-400 uppercase text-[8px] font-black tracking-[0.1em] border-b border-slate-100 shadow-sm">
              <th className="px-3 py-3 w-10 bg-slate-50/80 backdrop-blur-md"></th>
              <ResizableHeader onResize={w => setColumnWidths(p => ({...p, id: w}))} width={columnWidths.id || 70}>ID</ResizableHeader>
              <ResizableHeader onResize={w => setColumnWidths(p => ({...p, no: w}))} width={columnWidths.no || 140}>Code</ResizableHeader>
              <ResizableHeader onResize={w => setColumnWidths(p => ({...p, ver: w}))} width={columnWidths.ver || 50}>Ver</ResizableHeader>
              <ResizableHeader onResize={w => setColumnWidths(p => ({...p, rnd: w}))} width={columnWidths.rnd || 40}>Rd</ResizableHeader>
              <ResizableHeader onResize={w => setColumnWidths(p => ({...p, disc: w}))} width={columnWidths.disc || 120}>Discipline</ResizableHeader>
              <ResizableHeader onResize={w => setColumnWidths(p => ({...p, title: w}))} width={columnWidths.title || 250}>Drawing Title</ResizableHeader>
              <ResizableHeader onResize={w => setColumnWidths(p => ({...p, dead: w}))} width={columnWidths.dead || 90}>Deadline</ResizableHeader>
              <ResizableHeader onResize={w => setColumnWidths(p => ({...p, ass: w}))} width={columnWidths.ass || 130}>Assignees</ResizableHeader>
              <ResizableHeader onResize={w => setColumnWidths(p => ({...p, stat: w}))} width={columnWidths.stat || 100}>Status</ResizableHeader>
              <ResizableHeader onResize={w => setColumnWidths(p => ({...p, cmt: w}))} width={columnWidths.cmt || 75}>Total Cmt</ResizableHeader>
              <ResizableHeader onResize={w => setColumnWidths(p => ({...p, opn: w}))} width={columnWidths.opn || 75}>Open Cmt</ResizableHeader>
              <ResizableHeader onResize={w => setColumnWidths(p => ({...p, ok: w}))} width={columnWidths.ok || 50}>OK</ResizableHeader>
              <th className="px-3 py-3 w-10 bg-slate-50/50"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50/50">
            {filteredDrawings.map((drawing) => {
              const liveRemarkCount = drawing.remarks?.length || 0;
              const liveOpenRemarkCount = drawing.remarks?.filter(r => !r.resolved).length || 0;
              return (
                <React.Fragment key={drawing.id}>
                  <tr className={`group transition-all duration-200 ${expandedRows.has(drawing.id) ? 'bg-teal-50/30' : 'hover:bg-slate-50/40'}`}>
                    <td className="px-3 py-2 text-center">
                      <button 
                        onClick={() => setExpandedRows(prev => {
                          const n = new Set(prev);
                          if(n.has(drawing.id)) n.delete(drawing.id); else n.add(drawing.id);
                          return n;
                        })} 
                        className={`p-1.5 rounded-lg transition-all relative ${expandedRows.has(drawing.id) ? 'bg-teal-600 text-white shadow-md' : 'text-slate-300 hover:text-teal-600'}`}
                      >
                        {expandedRows.has(drawing.id) ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                      </button>
                    </td>
                    <td className="px-3 py-2 font-black text-slate-900 text-[10px] relative">
                      <div className="flex items-center gap-1.5">
                        {liveOpenRemarkCount > 0 && (
                          <div className="w-2 h-2 bg-red-500 rounded-full shrink-0 shadow-sm shadow-red-500/30" title="Unresolved internal remarks" />
                        )}
                        <span>{drawing.customId}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2 font-mono text-[10px] font-bold text-teal-600 truncate">{drawing.drawingNo}</td>
                    <td className="px-3 py-2">
                      <input 
                        type="text" value={drawing.version} 
                        onChange={(e) => updateDrawing(activeProjectId!, drawing.id, { version: e.target.value })}
                        className="w-full bg-slate-100/50 border-none rounded-md text-[9px] font-black text-center py-0.5 focus:bg-white"
                      />
                    </td>
                    <td className="px-3 py-2 text-center">
                      <span className="text-[8px] font-black text-slate-400">{drawing.currentRound}</span>
                    </td>
                    <td className="px-3 py-2">
                      <select 
                        value={drawing.discipline}
                        onChange={(e) => updateDrawing(activeProjectId!, drawing.id, { discipline: e.target.value })}
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
                    <td className="px-3 py-2">
                      <MultiAssigneeDropdown drawing={drawing} reviewers={reviewers} onUpdate={(ids) => updateDrawing(activeProjectId!, drawing.id, { assignees: ids })} />
                    </td>
                    <td className="px-3 py-2 text-center">
                      <StatusBadge drawing={drawing} onStatusChange={(s) => updateDrawing(activeProjectId!, drawing.id, { status: s })} />
                    </td>
                    <td className="px-3 py-2 text-center group/cell">
                      <input 
                        type="number"
                        min="0"
                        value={drawing.manualCommentsCount}
                        onChange={(e) => updateDrawing(activeProjectId!, drawing.id, { manualCommentsCount: parseInt(e.target.value) || 0 })}
                        className="w-full bg-slate-100/50 border-none rounded-md text-[10px] font-black text-center py-0.5 focus:bg-white focus:ring-1 focus:ring-teal-500/30"
                      />
                    </td>
                    <td className="px-3 py-2 text-center">
                      <input 
                        type="number"
                        min="0"
                        value={drawing.manualOpenCommentsCount}
                        onChange={(e) => updateDrawing(activeProjectId!, drawing.id, { manualOpenCommentsCount: parseInt(e.target.value) || 0 })}
                        className={`w-full border-none rounded-md text-[10px] font-black text-center py-0.5 focus:bg-white focus:ring-1 focus:ring-teal-500/30 ${drawing.manualOpenCommentsCount > 0 ? 'bg-red-50 text-red-500' : 'bg-slate-100/50 text-slate-400'}`}
                      />
                    </td>
                    <td className="px-3 py-2 text-center">
                       <div className={`w-5 h-5 rounded-lg flex items-center justify-center mx-auto transition-all ${drawing.status === 'Approved' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20 scale-110' : 'bg-slate-100 text-slate-200'}`}>
                         <Check size={12} strokeWidth={4} />
                       </div>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button onClick={() => deleteDrawing(activeProjectId!, drawing.id)} className="p-1.5 text-slate-200 hover:text-red-500 transition-colors">
                        <Trash2 size={12} />
                      </button>
                    </td>
                  </tr>
                  {expandedRows.has(drawing.id) && (
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
                                {drawing.remarks.map(r => (
                                  <div key={r.id} className="text-[9px] px-3 py-1.5 bg-teal-50/30 rounded-lg flex items-start gap-2">
                                    <button onClick={() => toggleRemarkStatus(activeProjectId!, drawing.id, r.id)} className={`mt-0.5 ${r.resolved ? 'text-emerald-500' : 'text-slate-300 hover:text-teal-500'}`}>
                                      {r.resolved ? <CheckCircle2 size={14}/> : <Circle size={14}/>}
                                    </button>
                                    <span className={`font-bold leading-normal flex-1 ${r.resolved ? 'line-through text-slate-400' : 'text-slate-700'}`}>{r.content}</span>
                                    <span className="text-[7px] font-mono text-slate-300 mt-0.5">{format(new Date(r.createdAt), 'MM-dd')}</span>
                                  </div>
                                ))}
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
            })}
          </tbody>
        </table>
      </div>

      {/* Printable Section (Refined for professional output) */}
      <div className="print-only w-full p-[15mm] bg-white text-black">
        <div className="flex justify-between items-end border-b-2 border-black pb-5 mb-8">
          <div className="flex items-center gap-5">
            <div className="bg-white p-1 overflow-hidden shrink-0">
              <img 
                src="https://i.postimg.cc/sf8Qvb1Q/PACIFIC-GAS-logo-(yuan-se-tou-ming-di-04.png" 
                alt="Pacific Gas Logo" 
                className="h-12 w-auto object-contain"
              />
            </div>
            <div>
              <div className="text-[9px] font-[1000] text-teal-600 uppercase tracking-[0.2em] mb-0.5">PACIFIC GAS PTE. LTD.</div>
              <h1 className="text-2xl font-[1000] uppercase tracking-tighter leading-none">Drawing Inventory Report</h1>
              <p className="text-slate-600 text-[9px] font-bold uppercase tracking-[0.2em] mt-2">Project Registry: {project.name}</p>
            </div>
          </div>
          <div className="text-right">
             <div className="text-[8px] font-black uppercase text-slate-400 mb-1 tracking-widest">Print Timestamp</div>
             <div className="text-[10px] font-black text-black">{format(new Date(), 'yyyy-MM-dd HH:mm')}</div>
          </div>
        </div>

        <table className="w-full text-[9px] border-collapse border border-black">
          <thead>
            <tr className="bg-slate-100 font-black uppercase text-[8px] tracking-widest">
              <th className="border border-black px-2 py-2 text-left w-12">ID</th>
              <th className="border border-black px-2 py-2 text-left">Drawing Number</th>
              <th className="border border-black px-1 py-2 text-center w-8">V</th>
              <th className="border border-black px-1 py-2 text-center w-8">R</th>
              <th className="border border-black px-2 py-2 text-left">Discipline</th>
              <th className="border border-black px-2 py-2 text-left">Drawing Title</th>
              <th className="border border-black px-2 py-2 text-left">Assignees</th>
              <th className="border border-black px-2 py-2 text-center">Status</th>
              <th className="border border-black px-1 py-2 text-center w-8">Tot</th>
              <th className="border border-black px-1 py-2 text-center w-8 font-black">Opn</th>
            </tr>
          </thead>
          <tbody>
            {filteredDrawings.map((drawing) => (
              <tr key={drawing.id} className="break-inside-avoid odd:bg-white even:bg-slate-50/20">
                <td className="border border-black px-2 py-1.5 font-bold text-center">{drawing.customId}</td>
                <td className="border border-black px-2 py-1.5 font-mono text-[8px]">{drawing.drawingNo}</td>
                <td className="border border-black px-1 py-1.5 text-center">{drawing.version}</td>
                <td className="border border-black px-1 py-1.5 text-center">{drawing.currentRound}</td>
                <td className="border border-black px-2 py-1.5 uppercase text-[8px]">{drawing.discipline}</td>
                <td className="border border-black px-2 py-1.5 font-medium leading-tight">{drawing.title}</td>
                <td className="border border-black px-2 py-1.5 text-[8px]">{(drawing.assignees || []).join(', ') || '-'}</td>
                <td className="border border-black px-2 py-1.5 text-center uppercase font-bold text-[8px]">{drawing.status}</td>
                <td className="border border-black px-1 py-1.5 text-center">{drawing.manualCommentsCount}</td>
                <td className="border border-black px-1 py-1.5 text-center font-black">{drawing.manualOpenCommentsCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
        
        <div className="mt-8 text-center text-[7px] font-black text-slate-300 uppercase tracking-[0.4em]">
          PACIFIC GAS PTE. LTD. • CONFIDENTIAL • INTERNAL USE ONLY
        </div>
      </div>

      {showImportModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md no-print">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-lg border border-slate-200 flex flex-col p-6 animate-in zoom-in-95">
            <div className="flex items-center justify-between mb-4">
               <div>
                 <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Fleet Bulk Entry</h3>
                 <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">Format: ID, Drawing No., Discipline, Title</p>
               </div>
               <button onClick={() => setShowImportModal(false)} className="p-1 text-slate-300 hover:text-slate-600 transition-all"><X size={20} /></button>
            </div>
            <textarea 
              value={importText} 
              onChange={(e) => setImportText(e.target.value)}
              placeholder="001, PG-VLEC-H2684-01, Hull, General Arrangement Plan"
              className="w-full h-48 p-4 border border-slate-100 bg-slate-50/50 rounded-2xl outline-none font-mono text-[10px] font-bold focus:bg-white focus:border-teal-500/20 resize-none shadow-inner"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setShowImportModal(false)} className="px-4 py-2 text-[9px] font-black uppercase tracking-widest text-slate-400 hover:bg-slate-50 rounded-xl transition-all">Discard</button>
              <button onClick={handleBulkImport} className="px-6 py-2 bg-teal-600 text-white text-[9px] font-black uppercase tracking-widest rounded-xl shadow-lg shadow-teal-500/20 hover:bg-teal-700 active:scale-95 transition-all">Execute Import</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const FilterButton = ({ active, onClick, label, icon, color, count }: { active: boolean, onClick: () => void, label: string, icon?: React.ReactNode, color: string, count?: number }) => {
  const colorMap: any = {
    slate: active ? 'bg-slate-900 text-white shadow-lg' : 'bg-slate-100 text-slate-500 hover:bg-slate-200',
    teal: active ? 'bg-teal-600 text-white shadow-lg shadow-teal-600/20' : 'bg-teal-50 text-teal-600 hover:bg-teal-100',
    cyan: active ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-600/20' : 'bg-cyan-50 text-cyan-600 hover:bg-cyan-100',
    emerald: active ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100',
    red: active ? 'bg-red-600 text-white shadow-lg shadow-red-600/20' : 'bg-red-50 text-red-600 hover:bg-red-100 animate-pulse',
  };
  return (
    <button onClick={onClick} className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center gap-2 transition-all active:scale-95 shrink-0 ${colorMap[color]}`}>
      {icon}
      <span>{label}</span>
      {count !== undefined && (
        <span className={`px-1.5 py-0.5 rounded-md text-[8px] font-black ${active ? 'bg-white/20' : 'bg-white/50'}`}>
          {count}
        </span>
      )}
    </button>
  );
};

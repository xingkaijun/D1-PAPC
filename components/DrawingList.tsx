
import React, { useState, useMemo, useRef, useCallback } from 'react';
import { useStore } from '../store';
import { Drawing, DrawingStatus } from '../types';
import {
  Search, FileUp, Layers, FilterX, Printer, ChevronLeft, ChevronRight as ChevronRightIcon
} from 'lucide-react';
import { isAfter } from 'date-fns';
import { DrawingRow } from './DrawingRow';

// Reusable Button Component for Filter
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

const PaginationControls = ({
  currentPage,
  totalPages,
  totalItems,
  startIndex,
  endIndex,
  onPageChange
}: {
  currentPage: number,
  totalPages: number,
  totalItems: number,
  startIndex: number,
  endIndex: number,
  onPageChange: (page: number) => void
}) => {
  if (totalItems === 0) return null;

  return (
    <div className="bg-white border-t border-slate-100 px-6 py-3 flex items-center justify-between no-print shrink-0 z-50">
      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
        Showing <span className="text-slate-900">{startIndex + 1}</span> to <span className="text-slate-900">{Math.min(endIndex, totalItems)}</span> of <span className="text-slate-900">{totalItems}</span> drawings
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="p-2 rounded-lg hover:bg-slate-50 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
        >
          <ChevronLeft size={14} className="text-slate-600" />
        </button>

        <div className="flex items-center gap-1">
          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
            let p = i + 1;
            if (totalPages > 5 && currentPage > 3) {
              p = currentPage - 2 + i; // Center around current page
              if (p > totalPages) p = totalPages - (4 - i);
            }
            return (
              <button
                key={p}
                onClick={() => onPageChange(p)}
                className={`w-7 h-7 flex items-center justify-center rounded-lg text-[10px] font-black transition-all ${currentPage === p ? 'bg-slate-900 text-white shadow-md shadow-slate-900/20' : 'text-slate-500 hover:bg-slate-50'}`}
              >
                {p}
              </button>
            );
          })}
        </div>

        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="p-2 rounded-lg hover:bg-slate-50 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
        >
          <ChevronRightIcon size={14} className="text-slate-600" />
        </button>
      </div>
    </div>
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

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const ROWS_PER_PAGE = 50;

  const project = data.projects.find(p => p.id === activeProjectId);
  const reviewers = project?.conf?.reviewers || data.settings.reviewers;

  const derivedDisciplines = useMemo(() => {
    if (!project || !project.drawings) return [];
    return Array.from(new Set(project.drawings.map(d => d.discipline))).filter(Boolean).sort();
  }, [project]);

  const filteredDrawings = useMemo(() => {
    if (!project) return [];
    const lowerSearch = searchTerm.toLowerCase();

    // Reset to page 1 when filter changes
    // Note: We can't set state directly in useMemo, use useEffect below or handle in onChange

    return (project.drawings || []).filter(d => {
      const matchesSearch = !searchTerm ||
        d.drawingNo.toLowerCase().includes(lowerSearch) ||
        d.title.toLowerCase().includes(lowerSearch) ||
        d.discipline.toLowerCase().includes(lowerSearch) ||
        d.customId.toLowerCase().includes(lowerSearch) ||
        (d.assignees && d.assignees.some(a => a.toLowerCase().includes(lowerSearch)));
      if (!matchesSearch) return false;
      if (statusFilter === 'Overdue') {
        return d.status === 'Reviewing' && d.reviewDeadline && isAfter(new Date(), new Date(d.reviewDeadline));
      }
      if (statusFilter) return d.status === statusFilter;
      return true;
    });
  }, [project, searchTerm, statusFilter]);

  // Reset pagination when filter changes
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter]);

  // Calculate Paginated Data
  const paginatedDrawings = useMemo(() => {
    const startIndex = (currentPage - 1) * ROWS_PER_PAGE;
    return filteredDrawings.slice(startIndex, startIndex + ROWS_PER_PAGE);
  }, [filteredDrawings, currentPage]);

  const totalPages = Math.ceil(filteredDrawings.length / ROWS_PER_PAGE);

  // Memoized handlers to prevent prop changes for Memoized Rows
  const handleToggleExpand = useCallback((id: string) => {
    setExpandedRows(prev => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }, []);

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
              <Layers size={14} /> Team Setup
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
          <FilterButton active={statusFilter === null} onClick={() => setStatusFilter(null)} label="All Units" icon={<Layers size={12} />} color="slate" />
          <div className="w-px h-4 bg-slate-200 mx-1" />
          <FilterButton active={statusFilter === 'Pending'} onClick={() => setStatusFilter('Pending')} label="Pending" color="slate" count={(project.drawings || []).filter(d => d.status === 'Pending').length} />
          <FilterButton active={statusFilter === 'Reviewing'} onClick={() => setStatusFilter('Reviewing')} label="Reviewing" color="teal" count={(project.drawings || []).filter(d => d.status === 'Reviewing').length} />
          <FilterButton active={statusFilter === 'Waiting Reply'} onClick={() => setStatusFilter('Waiting Reply')} label="Waiting" color="cyan" count={(project.drawings || []).filter(d => d.status === 'Waiting Reply').length} />
          <FilterButton active={statusFilter === 'Approved'} onClick={() => setStatusFilter('Approved')} label="Approved" color="emerald" count={(project.drawings || []).filter(d => d.status === 'Approved').length} />
          <FilterButton active={statusFilter === 'Overdue'} onClick={() => setStatusFilter('Overdue')} label="Overdue" color="red" icon={<Layers size={12} />} count={(project.drawings || []).filter(d => d.status === 'Reviewing' && d.reviewDeadline && isAfter(new Date(), new Date(d.reviewDeadline))).length} />
        </div>
      </div>

      {/* Main Table (Visible on Screen) */}
      <div className="overflow-auto flex-1 relative scrollbar-thin scrollbar-thumb-slate-200 no-print">
        <table className="w-full text-left border-collapse table-fixed min-w-[1400px]">
          <thead className="sticky top-0 z-40">
            <tr className="text-slate-400 uppercase text-[8px] font-black tracking-[0.1em] border-b border-slate-100 shadow-sm">
              <th className="px-3 py-3 w-10 bg-slate-50/80 backdrop-blur-md"></th>
              <ResizableHeader onResize={w => setColumnWidths(p => ({ ...p, id: w }))} width={columnWidths.id || 70}>ID</ResizableHeader>
              <ResizableHeader onResize={w => setColumnWidths(p => ({ ...p, no: w }))} width={columnWidths.no || 110}>Code</ResizableHeader>
              <ResizableHeader onResize={w => setColumnWidths(p => ({ ...p, ver: w }))} width={columnWidths.ver || 50}>Ver</ResizableHeader>
              <ResizableHeader onResize={w => setColumnWidths(p => ({ ...p, rnd: w }))} width={columnWidths.rnd || 40}>Rd</ResizableHeader>
              <ResizableHeader onResize={w => setColumnWidths(p => ({ ...p, disc: w }))} width={columnWidths.disc || 120}>Discipline</ResizableHeader>
              <ResizableHeader onResize={w => setColumnWidths(p => ({ ...p, title: w }))} width={columnWidths.title || 250}>Drawing Title</ResizableHeader>
              <ResizableHeader onResize={w => setColumnWidths(p => ({ ...p, dead: w }))} width={columnWidths.dead || 90}>Deadline</ResizableHeader>
              <ResizableHeader onResize={w => setColumnWidths(p => ({ ...p, ass: w }))} width={columnWidths.ass || 90}>Assignees</ResizableHeader>
              <ResizableHeader onResize={w => setColumnWidths(p => ({ ...p, stat: w }))} width={columnWidths.stat || 100}>Status</ResizableHeader>
              <ResizableHeader onResize={w => setColumnWidths(p => ({ ...p, cmt: w }))} width={columnWidths.cmt || 50}>Total Cmt</ResizableHeader>
              <ResizableHeader onResize={w => setColumnWidths(p => ({ ...p, opn: w }))} width={columnWidths.opn || 50}>Open Cmt</ResizableHeader>
              <ResizableHeader onResize={w => setColumnWidths(p => ({ ...p, ok: w }))} width={columnWidths.ok || 50}>OK</ResizableHeader>
              <th className="px-3 py-3 w-10 bg-slate-50/50"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50/50">
            {paginatedDrawings.map((drawing) => (
              <DrawingRow
                key={drawing.id}
                drawing={drawing}
                activeProjectId={activeProjectId!}
                isExpanded={expandedRows.has(drawing.id)}
                onToggleExpand={handleToggleExpand}
                updateDrawing={updateDrawing}
                deleteDrawing={deleteDrawing}
                toggleRemarkStatus={toggleRemarkStatus}
                reviewers={reviewers}
                derivedDisciplines={derivedDisciplines}
              />
            ))}
            {paginatedDrawings.length === 0 && (
              <tr>
                <td colSpan={14} className="py-20 text-center text-slate-300 pointer-events-none">
                  <div className="text-[10px] font-black uppercase tracking-widest">No match found</div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <PaginationControls
        currentPage={currentPage}
        totalPages={totalPages}
        totalItems={filteredDrawings.length}
        startIndex={(currentPage - 1) * ROWS_PER_PAGE}
        endIndex={currentPage * ROWS_PER_PAGE}
        onPageChange={setCurrentPage}
      />

      {/* Printable Section (Hidden in Screen View, Visible in Print) */}
      <div className="hidden print:block absolute top-0 left-0 w-full bg-white z-[9999] p-[10mm] text-black">
        {/* Print Header - Use table-header-group behavior trick or just static header */}
        <div className="flex justify-between items-end border-b-2 border-black pb-4 mb-4">
          <div className="flex items-center gap-4">
            <img
              src="https://i.postimg.cc/sf8Qvb1Q/PACIFIC-GAS-logo-(yuan-se-tou-ming-di-04.png"
              alt="Logo"
              className="h-12 object-contain grayscale"
            />
            <div>
              <h1 className="text-2xl font-bold uppercase tracking-tighter">Plan Approval Status</h1>
              <p className="text-xs font-bold uppercase tracking-[0.3em] text-gray-600">Technical Intelligence System</p>
            </div>
          </div>
          <div className="text-right">
            <h2 className="text-xl font-black uppercase tracking-widest">{project.name}</h2>
            <div className="text-[10px] font-bold uppercase tracking-wider mt-1">
              Generated: {new Date().toLocaleDateString()}
            </div>
          </div>
        </div>

        {/* Print Table - Flattened (No Pagination) */}
        <table className="w-full text-left border-collapse text-[9px]">
          <thead>
            <tr className="border-b-2 border-black uppercase font-bold tracking-wider">
              <th className="py-2 w-16">ID</th>
              <th className="py-2 w-24">Code</th>
              <th className="py-2 w-10">Ver</th>
              <th className="py-2 w-10">Rd</th>
              <th className="py-2 w-28">Discipline</th>
              <th className="py-2">Title</th>
              <th className="py-2 w-20">Deadline</th>
              <th className="py-2 w-24">Assignees</th>
              <th className="py-2 w-20">Status</th>
              <th className="py-2 w-10 text-center">Cmt</th>
              <th className="py-2 w-10 text-center">Opn</th>
            </tr>
          </thead>
          <tbody className="">
            {filteredDrawings.map((drawing, idx) => (
              <tr key={drawing.id} className={`border-b border-gray-200 break-inside-avoid ${idx % 2 === 0 ? 'bg-gray-50' : 'bg-white'}`}>
                <td className="py-1.5 px-1 font-mono">{drawing.customId}</td>
                <td className="py-1.5 px-1 font-mono">{drawing.drawingNo}</td>
                <td className="py-1.5 px-1">{drawing.version || 0}</td>
                <td className="py-1.5 px-1 font-bold">{drawing.currentRound}</td>
                <td className="py-1.5 px-1 truncate max-w-[100px]">{drawing.discipline}</td>
                <td className="py-1.5 px-1 font-medium truncate max-w-[200px]">{drawing.title}</td>
                <td className="py-1.5 px-1 text-gray-600">{drawing.reviewDeadline ? new Date(drawing.reviewDeadline).toLocaleDateString() : '-'}</td>
                <td className="py-1.5 px-1 truncate max-w-[100px]">{drawing.assignees.join(', ')}</td>
                <td className="py-1.5 px-1 font-bold">
                  <span className={`${drawing.status === 'Approved' ? 'text-black' : drawing.status === 'Overdue' ? 'text-black font-extrabold underline' : 'text-gray-700'}`}>
                    {drawing.status}
                  </span>
                </td>
                <td className="py-1.5 px-1 text-center font-bold">{drawing.manualCommentsCount}</td>
                <td className="py-1.5 px-1 text-center font-bold text-gray-800">{drawing.manualOpenCommentsCount}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Print Footer */}
        <div className="mt-8 pt-4 border-t border-black flex justify-between text-[8px] uppercase font-bold text-gray-500">
          <div>Pacific Gas Pte. Ltd.</div>
          <div>Page <span className="page-number"></span></div>
        </div>
      </div>

      {showImportModal && (
        // ... (Modal Content kept same)
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md no-print">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-lg border border-slate-200 flex flex-col p-6 animate-in zoom-in-95">
            {/* ... modal content ... */}
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Fleet Bulk Entry</h3>
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">Format: ID, Drawing No., Discipline, Title</p>
              </div>
              <button onClick={() => setShowImportModal(false)} className="p-1 text-slate-300 hover:text-slate-600 transition-all">X</button>
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



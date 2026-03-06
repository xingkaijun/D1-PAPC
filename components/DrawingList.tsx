

import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { useStore } from '../store';
import { Drawing, DrawingStatus } from '../types';
import {
  Search, FileUp, Layers, FilterX, Printer, ChevronLeft, ChevronRight as ChevronRightIcon,
  Lock, Unlock, X, Cloud
} from 'lucide-react';
import { isAfter, differenceInCalendarDays } from 'date-fns';
import { DrawingRow } from './DrawingRow';

// Reusable Button Component for Filter
const FilterButton = ({ active, onClick, label, icon, color, count }: { active: boolean, onClick: () => void, label: string, icon?: React.ReactNode, color: string, count?: number }) => {
  const colorMap: any = {
    slate: active ? 'bg-slate-900 text-white shadow-lg' : 'bg-slate-100 text-slate-500 hover:bg-slate-200',
    amber: active ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/20' : 'bg-amber-50 text-amber-600 hover:bg-amber-100',
    blue: active ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'bg-blue-50 text-blue-600 hover:bg-blue-100',
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
  const { activeProjectId, data, updateDrawing, bulkImportDrawings, deleteDrawing, toggleRemarkStatus, resetAllAssignees, filterQuery, setFilterQuery, isEditMode, toggleEditMode, pushProjectToWebDAV, reviewTracker } = useStore();
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [isSyncing, setIsSyncing] = useState(false);
  // Search state moved to store: filterQuery
  const [statusFilters, setStatusFilters] = useState<Set<string>>(new Set());
  const [showImportModal, setShowImportModal] = useState(false);
  const [showTeamSetupModal, setShowTeamSetupModal] = useState(false);
  const [importText, setImportText] = useState('');
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const ROWS_PER_PAGE = 50;

  const project = data.projects.find(p => p.id === activeProjectId);
  const reviewers = project?.conf?.reviewers || data.settings.reviewers;

  // 当 Team Setup 弹窗打开时，自动初始化 defaultAssignees
  useEffect(() => {
    if (showTeamSetupModal && project) {
      const disciplineDefaults = project.conf?.disciplineDefaults || {};
      const currentDefaultAssignees = project.conf?.defaultAssignees || {};
      let needsUpdate = false;
      const updatedAssignees = { ...currentDefaultAssignees };

      // 遍历所有 disciplineDefaults，确保每个有 default lead 的 discipline 都在 defaultAssignees 中
      Object.keys(disciplineDefaults).forEach(discipline => {
        const defaultLead = disciplineDefaults[discipline];
        if (defaultLead && defaultLead.trim() !== '') {
          // 如果该 discipline 还没有配置 defaultAssignees，或者 defaultLead 不在列表中
          if (!updatedAssignees[discipline]) {
            updatedAssignees[discipline] = [defaultLead];
            needsUpdate = true;
          } else if (!updatedAssignees[discipline].includes(defaultLead)) {
            updatedAssignees[discipline] = [...updatedAssignees[discipline], defaultLead];
            needsUpdate = true;
          }
        }
      });

      if (needsUpdate) {
        useStore.getState().updateProjectConfig(project.id, {
          defaultAssignees: updatedAssignees
        });
      }
    }
  }, [showTeamSetupModal, project?.id]);

  const derivedDisciplines = useMemo(() => {
    if (!project || !project.drawings) return [];
    return Array.from(new Set(project.drawings.map(d => d.discipline))).filter(Boolean).sort();
  }, [project]);

  const filteredDrawings = useMemo(() => {
    if (!project) return [];
    const lowerSearch = filterQuery.toLowerCase();

    return (project.drawings || []).filter(d => {
      const matchesSearch = !filterQuery ||
        d.drawingNo.toLowerCase().includes(lowerSearch) ||
        d.title.toLowerCase().includes(lowerSearch) ||
        d.discipline.toLowerCase().includes(lowerSearch) ||
        d.customId.toLowerCase().includes(lowerSearch) ||
        (d.assignees && d.assignees.some(a => a.toLowerCase().includes(lowerSearch))) ||
        (d.remarks && d.remarks.some(r => r.content.toLowerCase().includes(lowerSearch)));

      if (!matchesSearch) return false;

      // 多选筛选逻辑
      if (statusFilters.size === 0) return true;

      const overdueDays = d.reviewDeadline ? differenceInCalendarDays(new Date(d.reviewDeadline), new Date()) : null;
      const isOverdue = d.status === 'Reviewing' && overdueDays !== null && overdueDays < 0;
      const isWarning = d.status === 'Reviewing' && overdueDays !== null && overdueDays >= 0 && overdueDays <= 3;
      const isChecked = d.checked === true;

      // 检查是否同时满足所有筛选条件 (AND 逻辑)
      for (const filter of statusFilters) {
        let match = false;
        if (filter === 'Overdue') {
          match = !!isOverdue;
        } else if (filter === 'Warning') {
          match = !!isWarning;
        } else if (filter === 'Checked') {
          match = !!isChecked;
        } else if (filter === 'Ready') {
          if (d.status !== 'Reviewing' || !d.assignees || d.assignees.length === 0) {
            match = false;
          } else {
            const trackerEntry = reviewTracker[d.id] || {};
            match = d.assignees.every(a => trackerEntry[a]?.done);
          }
        } else {
          // 默认为状态筛选
          match = d.status === filter;
        }

        if (!match) return false;
      }
      return true;
    });
  }, [project, filterQuery, statusFilters]);

  // 动态计算每个筛选按钮的数量（基于当前筛选结果）
  const getFilterCount = useCallback((filterName: string) => {
    if (!project) return 0;

    // 创建一个包含该筛选条件的新 Set
    const testFilters = new Set(statusFilters);
    if (testFilters.has(filterName)) {
      // 如果已经激活，返回当前筛选结果数量
      return filteredDrawings.length;
    } else {
      // 如果未激活，添加该条件并计算
      testFilters.add(filterName);
    }

    // 使用相同的筛选逻辑计算
    return (project.drawings || []).filter(d => {
      // 搜索框筛选（与主筛选逻辑保持一致）
      const lowerSearch = filterQuery.toLowerCase();
      const matchesSearch = !filterQuery ||
        d.drawingNo.toLowerCase().includes(lowerSearch) ||
        d.title.toLowerCase().includes(lowerSearch) ||
        d.discipline.toLowerCase().includes(lowerSearch) ||
        d.customId.toLowerCase().includes(lowerSearch) ||
        (d.assignees && d.assignees.some(a => a.toLowerCase().includes(lowerSearch))) ||
        (d.remarks && d.remarks.some(r => r.content.toLowerCase().includes(lowerSearch)));

      if (!matchesSearch) return false;

      // 如果没有筛选条件，显示所有
      if (testFilters.size === 0) return true;

      const overdueDays = d.reviewDeadline ? differenceInCalendarDays(new Date(d.reviewDeadline), new Date()) : null;
      const isOverdue = d.status === 'Reviewing' && overdueDays !== null && overdueDays < 0;
      const isWarning = d.status === 'Reviewing' && overdueDays !== null && overdueDays >= 0 && overdueDays <= 3;
      const isChecked = d.checked === true;

      // 检查是否同时满足所有筛选条件
      for (const filter of testFilters) {
        let match = false;
        if (filter === 'Overdue') {
          match = !!isOverdue;
        } else if (filter === 'Warning') {
          match = !!isWarning;
        } else if (filter === 'Checked') {
          match = !!isChecked;
        } else if (filter === 'Ready') {
          if (d.status !== 'Reviewing' || !d.assignees || d.assignees.length === 0) {
            match = false;
          } else {
            const trackerEntry = reviewTracker[d.id] || {};
            match = d.assignees.every(a => trackerEntry[a]?.done);
          }
        } else {
          match = d.status === filter;
        }

        if (!match) return false;
      }
      return true;
    }).length;
  }, [project, filterQuery, statusFilters, filteredDrawings]);


  // Reset pagination when filter changes
  React.useEffect(() => {
    setCurrentPage(1);
  }, [filterQuery, statusFilters]);

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
      bulkImportDrawings(newDrawings);
      setImportText('');
      setShowImportModal(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Main scrollable area - everything scrolls together */}
      <div className="overflow-auto flex-1 no-print" style={{ position: 'relative' }}>
        <div style={{ minWidth: '1400px' }}>
          {/* Search and Filters - scrolls away */}
          <div className="px-5 py-3 border-b border-slate-100 flex flex-col gap-3 bg-white">
            <div className="flex items-center justify-between">
              <div className="relative w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={14} />
                <input
                  type="text"
                  placeholder="Search drawings or show:tag..."
                  value={filterQuery}
                  onChange={(e) => setFilterQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:bg-white focus:ring-4 focus:ring-teal-500/5 transition-all text-[10px] font-black uppercase tracking-tight"
                />
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={async () => {
                    if (!isEditMode) {
                      alert("Permission Denied: Edit Mode is required to sync to cloud.");
                      return;
                    }
                    if (!activeProjectId || isSyncing) return;
                    setIsSyncing(true);
                    try {
                      await pushProjectToWebDAV(activeProjectId);
                    } catch (e) {
                      console.warn('Sync failed', e);
                    } finally {
                      setIsSyncing(false);
                    }
                  }}
                  disabled={isSyncing || !isEditMode}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all active:scale-95 shadow-sm ${!isEditMode
                    ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed opacity-60'
                    : isSyncing
                      ? 'bg-teal-50 text-teal-400 border border-teal-200 cursor-wait'
                      : 'bg-teal-600 text-white hover:bg-teal-700 shadow-teal-500/20'}
                    `}
                  title={!isEditMode ? "Unlock Edit Mode to Sync" : "同步项目数据到服务器"}
                >
                  <Cloud size={14} className={isSyncing ? 'animate-pulse' : ''} />
                  {isSyncing ? 'Syncing...' : 'Sync to Cloud'}
                </button>
                <button
                  onClick={() => window.print()}
                  className="px-4 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl text-[9px] font-black uppercase tracking-wider flex items-center gap-2 hover:bg-slate-50 active:scale-95 transition-all"
                >
                  <Printer size={14} /> Print List
                </button>
                <button
                  onClick={() => isEditMode && setShowTeamSetupModal(true)}
                  disabled={!isEditMode}
                  className={`px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-[9px] font-black uppercase tracking-wider flex items-center gap-2 transition-all ${!isEditMode ? 'opacity-50 cursor-not-allowed text-slate-400' : 'text-slate-500 hover:bg-slate-50 active:scale-95'}`}
                >
                  <Layers size={14} /> Team Setup
                </button>
                <button
                  onClick={() => isEditMode && setShowImportModal(true)}
                  disabled={!isEditMode}
                  className={`px-4 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-wider flex items-center gap-2 transition-all shadow-lg shadow-teal-500/10 ${!isEditMode ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-teal-600 text-white hover:bg-teal-700 active:scale-95'}`}
                >
                  <FileUp size={14} /> Bulk Load
                </button>
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
                  className={`px-4 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-wider flex items-center gap-2 transition-all ${isEditMode ? 'bg-amber-100 text-amber-700 hover:bg-amber-200' : 'bg-slate-900 text-white hover:bg-slate-800 shadow-lg shadow-slate-900/20'}`}
                >
                  {isEditMode ? <Unlock size={14} /> : <Lock size={14} />}
                  {isEditMode ? 'Unlocked' : 'Edit'}
                </button>
              </div>
            </div>
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              <FilterButton active={statusFilters.size === 0} onClick={() => setStatusFilters(new Set())} label="All Units" icon={<Layers size={12} />} color="slate" />
              <div className="w-px h-4 bg-slate-200 mx-1" />
              <FilterButton active={statusFilters.has('Pending')} onClick={() => setStatusFilters(prev => { const n = new Set(prev); n.has('Pending') ? n.delete('Pending') : n.add('Pending'); return n; })} label="Pending" color="slate" count={getFilterCount('Pending')} />
              <FilterButton active={statusFilters.has('Reviewing')} onClick={() => setStatusFilters(prev => { const n = new Set(prev); n.has('Reviewing') ? n.delete('Reviewing') : n.add('Reviewing'); return n; })} label="Reviewing" color="amber" count={getFilterCount('Reviewing')} />
              <FilterButton active={statusFilters.has('Ready')} onClick={() => setStatusFilters(prev => { const n = new Set(prev); n.has('Ready') ? n.delete('Ready') : n.add('Ready'); return n; })} label="Ready" color="emerald" count={getFilterCount('Ready')} />
              <FilterButton active={statusFilters.has('Waiting Reply')} onClick={() => setStatusFilters(prev => { const n = new Set(prev); n.has('Waiting Reply') ? n.delete('Waiting Reply') : n.add('Waiting Reply'); return n; })} label="Waiting" color="blue" count={getFilterCount('Waiting Reply')} />
              <FilterButton active={statusFilters.has('Approved')} onClick={() => setStatusFilters(prev => { const n = new Set(prev); n.has('Approved') ? n.delete('Approved') : n.add('Approved'); return n; })} label="Approved" color="emerald" count={getFilterCount('Approved')} />
              <FilterButton active={statusFilters.has('Warning')} onClick={() => setStatusFilters(prev => { const n = new Set(prev); n.has('Warning') ? n.delete('Warning') : n.add('Warning'); return n; })} label="Warning" color="amber" icon={<Layers size={12} />} count={getFilterCount('Warning')} />
              <FilterButton active={statusFilters.has('Overdue')} onClick={() => setStatusFilters(prev => { const n = new Set(prev); n.has('Overdue') ? n.delete('Overdue') : n.add('Overdue'); return n; })} label="Overdue" color="red" icon={<Layers size={12} />} count={getFilterCount('Overdue')} />
              <div className="w-px h-4 bg-slate-200 mx-1" />
              <FilterButton active={statusFilters.has('Checked')} onClick={() => setStatusFilters(prev => { const n = new Set(prev); n.has('Checked') ? n.delete('Checked') : n.add('Checked'); return n; })} label="Checked" color="emerald" count={getFilterCount('Checked')} />
              <FilterButton active={statusFilters.has('Unchecked')} onClick={() => setStatusFilters(prev => { const n = new Set(prev); n.has('Unchecked') ? n.delete('Unchecked') : n.add('Unchecked'); return n; })} label="Unchecked" color="slate" count={getFilterCount('Unchecked')} />
            </div>
          </div>

          {/* Table */}
          <table className="w-full text-left border-collapse table-fixed">
            <thead className="sticky top-0 z-40">
              <tr className="text-slate-400 uppercase text-[8px] font-black tracking-[0.1em] border-b border-slate-100 shadow-sm">
                <th className="px-3 py-3 w-10 bg-slate-50/80 backdrop-blur-md"></th>
                <ResizableHeader onResize={w => setColumnWidths(p => ({ ...p, id: w }))} width={columnWidths.id || 70}>ID</ResizableHeader>
                <ResizableHeader onResize={w => setColumnWidths(p => ({ ...p, no: w }))} width={columnWidths.no || 110}>Code</ResizableHeader>
                <ResizableHeader onResize={w => setColumnWidths(p => ({ ...p, ver: w }))} width={columnWidths.ver || 50}>Ver</ResizableHeader>
                <ResizableHeader onResize={w => setColumnWidths(p => ({ ...p, rnd: w }))} width={columnWidths.rnd || 40}>Rd</ResizableHeader>
                <ResizableHeader onResize={w => setColumnWidths(p => ({ ...p, disc: w }))} width={columnWidths.disc || 120}>Discipline</ResizableHeader>
                <ResizableHeader onResize={w => setColumnWidths(p => ({ ...p, title: w }))} width={columnWidths.title || 250}>Drawing Title</ResizableHeader>
                <ResizableHeader onResize={w => setColumnWidths(p => ({ ...p, lchg: w }))} width={columnWidths.lchg || 80}>Last Change</ResizableHeader>
                <ResizableHeader onResize={w => setColumnWidths(p => ({ ...p, wait: w }))} width={columnWidths.wait || 50}>Wait</ResizableHeader>
                <ResizableHeader onResize={w => setColumnWidths(p => ({ ...p, dead: w }))} width={columnWidths.dead || 90}>Deadline</ResizableHeader>
                <ResizableHeader onResize={w => setColumnWidths(p => ({ ...p, days: w }))} width={columnWidths.days || 60}>Days</ResizableHeader>
                <ResizableHeader onResize={w => setColumnWidths(p => ({ ...p, ass: w }))} width={columnWidths.ass || 90}>Assignees</ResizableHeader>
                <ResizableHeader onResize={w => setColumnWidths(p => ({ ...p, stat: w }))} width={columnWidths.stat || 100}>Status</ResizableHeader>
                <ResizableHeader onResize={w => setColumnWidths(p => ({ ...p, cmt: w }))} width={columnWidths.cmt || 50}>Total Cmt</ResizableHeader>
                <ResizableHeader onResize={w => setColumnWidths(p => ({ ...p, opn: w }))} width={columnWidths.opn || 50}>Open Cmt</ResizableHeader>
                <th className="px-2 py-3 bg-slate-50/50" style={{ width: columnWidths.ok || 70 }}>
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-[8px] font-black uppercase tracking-[0.1em]">Check</span>
                    <button
                      onClick={async () => {
                        if (!isEditMode) {
                          alert("Permission Denied: Edit Mode is required to sync check statuses.");
                          return;
                        }
                        const store = useStore.getState();
                        const success = await store.pushProjectToWebDAV(activeProjectId!);
                        if (success) {
                          // 将所有 checked 的图纸标记为已同步
                          const project = store.data.projects.find(p => p.id === activeProjectId);
                          if (project) {
                            project.drawings.forEach(d => {
                              if (d.checked && !d.checkedSynced) {
                                updateDrawing(d.id, { checkedSynced: true });
                              }
                            });
                          }
                          alert('Check 状态已同步');
                        } else {
                          alert('同步失败');
                        }
                      }}
                      disabled={!isEditMode}
                      className={`px-2 py-0.5 text-[7px] font-black uppercase rounded-md transition-all shadow-sm ${isEditMode ? 'bg-teal-500 text-white hover:bg-teal-600' : 'bg-slate-200 text-slate-400 cursor-not-allowed opacity-60'}`}
                      title={isEditMode ? "Sync all check statuses" : "Unlock Edit Mode to Sync"}
                    >
                      Sync
                    </button>
                  </div>
                </th>
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
                  <td colSpan={16} className="py-20 text-center text-slate-300 pointer-events-none">
                    <div className="text-[10px] font-black uppercase tracking-widest">No match found</div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
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
              src="https://i.postimg.cc/7LVr6n5m/PG-Logo.jpg"
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
            <div className="text-[9px] font-bold text-gray-500 mt-1">
              {statusFilters.size > 0 || filterQuery
                ? [
                  statusFilters.size > 0 && `Filter: ${Array.from(statusFilters).join(' + ')}`,
                  filterQuery && `Search: "${filterQuery}"`
                ].filter(Boolean).join(' | ')
                : 'All Drawings'}
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
              <th className="py-2 w-12 text-center">Days</th>
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
                <td className="py-1.5 px-1 text-center font-bold text-gray-700">
                  {drawing.reviewDeadline ? differenceInCalendarDays(new Date(drawing.reviewDeadline), new Date()) : '-'}
                </td>
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
          <div>PG SHIPMANAGEMENT PTE. LTD.</div>
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

      {showTeamSetupModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md no-print">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-2xl border border-slate-200 flex flex-col max-h-[80vh] animate-in zoom-in-95">
            <div className="p-6 border-b border-slate-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-50 rounded-xl">
                    <Layers size={20} className="text-indigo-600" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Team Setup</h3>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-0.5">Configure default assignees for each discipline</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowTeamSetupModal(false)}
                  className="p-2 text-slate-300 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-all"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              <div className="space-y-4">
                {derivedDisciplines.map(discipline => {
                  const currentDefaults = project?.conf?.defaultAssignees?.[discipline] || [];
                  const availableReviewers = reviewers.map(r => typeof r === 'string' ? r : r.name);

                  return (
                    <div key={discipline} className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-[10px] font-black uppercase text-slate-700 tracking-widest">{discipline}</span>
                        <span className="text-[8px] font-black text-slate-400 uppercase">{currentDefaults.length} assigned</span>
                      </div>

                      <div className="space-y-2">
                        {availableReviewers.map(reviewer => {
                          const isSelected = currentDefaults.includes(reviewer);
                          return (
                            <button
                              key={reviewer}
                              onClick={() => {
                                if (!project) return;
                                const current = project.conf?.defaultAssignees || {};
                                const disciplineAssignees = current[discipline] || [];
                                const updated = isSelected
                                  ? disciplineAssignees.filter(a => a !== reviewer)
                                  : [...disciplineAssignees, reviewer];

                                useStore.getState().updateProjectConfig(project.id, {
                                  defaultAssignees: {
                                    ...current,
                                    [discipline]: updated
                                  }
                                });
                              }}
                              className={`w-full text-left px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${isSelected
                                ? 'bg-indigo-500 text-white shadow-md shadow-indigo-500/20'
                                : 'bg-white text-slate-600 hover:bg-indigo-50 border border-slate-200'
                                }`}
                            >
                              {reviewer}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}

                {derivedDisciplines.length === 0 && (
                  <div className="text-center py-12 text-slate-400">
                    <Layers size={48} className="mx-auto mb-4 opacity-20" />
                    <p className="text-[10px] font-black uppercase tracking-widest">No disciplines found</p>
                    <p className="text-[9px] font-bold text-slate-300 mt-1">Add drawings first</p>
                  </div>
                )}
              </div>
            </div>

            <div className="p-6 border-t border-slate-100 flex justify-end gap-3">
              <button
                onClick={() => setShowTeamSetupModal(false)}
                className="px-6 py-2.5 text-[9px] font-black uppercase tracking-widest text-slate-500 hover:bg-slate-50 rounded-xl transition-all"
              >
                Close
              </button>
              <button
                onClick={() => {
                  if (window.confirm("Apply team setup to all drawings? This will reset assignees based on discipline defaults.")) {
                    resetAllAssignees();
                    setShowTeamSetupModal(false);
                  }
                }}
                className="px-6 py-2.5 bg-indigo-600 text-white text-[9px] font-black uppercase tracking-widest rounded-xl shadow-lg shadow-indigo-500/20 hover:bg-indigo-700 active:scale-95 transition-all"
              >
                Apply & Reset All
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};



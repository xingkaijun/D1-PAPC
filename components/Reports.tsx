
import React, { useMemo, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area, Legend, LabelList
} from 'recharts';
import { useStore } from '../store';
import { Drawing } from '../types';
import {
  TrendingUp, CheckCircle, Search, Hash, Trash2, Printer, Camera, History, Clock, MessageSquare, RefreshCw
} from 'lucide-react';
// Fix: Removed missing isWithinInterval from date-fns imports
import { format, endOfWeek, eachWeekOfInterval } from 'date-fns';

// Fix: Local implementation of isWithinInterval to resolve missing export error from date-fns
const isWithinInterval = (date: Date, interval: { start: Date; end: Date }) => {
  if (!date || !interval || !interval.start || !interval.end) return false;
  const time = date.getTime();
  return time >= interval.start.getTime() && time <= interval.end.getTime();
};

const COLORS = ['#10b981', '#f59e0b', '#3b82f6', '#94a3b8', '#8b5cf6', '#06b6d4', '#ec4899'];
const HEALTH_COLORS = ['#10b981', '#f59e0b', '#3b82f6', '#e2e8f0']; // Approved, Reviewing, Waiting, Pending
const HEALTH_LABELS = ['Approved', 'Reviewing', 'Waiting Reply', 'Pending'];

// --- Helper Components for the New Structure ---

const PageHeader: React.FC<{ projectName: string }> = ({ projectName }) => (
  <div className="border-b-2 border-slate-900 pb-5 mb-8 flex justify-between items-end shrink-0">
    <div className="flex items-center gap-5">
      <div className="bg-white p-1 rounded-lg shadow-sm border border-slate-100 overflow-hidden shrink-0">
        <img
          src="https://i.postimg.cc/sf8Qvb1Q/PACIFIC-GAS-logo-(yuan-se-tou-ming-di-04.png"
          alt="Pacific Gas Logo"
          className="h-10 w-auto object-contain"
        />
      </div>
      <div>
        <div className="text-[9px] font-[1000] text-teal-600 uppercase tracking-[0.2em] mb-0.5">PACIFIC GAS PTE. LTD.</div>
        <h1 className="text-2xl font-[1000] text-slate-900 uppercase tracking-tighter leading-none">Plan Approval Intelligence</h1>
        <p className="text-slate-400 text-[9px] font-bold uppercase tracking-[0.2em] mt-2">Project Registry: {projectName}</p>
      </div>
    </div>
    <div className="text-right">
      <div className="text-[8px] font-black uppercase text-slate-400 mb-1 tracking-widest">Report Reference</div>
      <div className="text-[10px] font-black text-slate-900">{format(new Date(), 'yyyyMMdd-HHmm')}</div>
    </div>
  </div>
);

const PageFooter: React.FC<{ pageNumber: number, totalPages: number, projectName: string }> = ({ pageNumber, totalPages, projectName }) => (
  <div className="mt-auto pt-6 border-t border-slate-100 flex justify-between items-center relative shrink-0">
    <div className="text-[7px] font-black text-slate-300 uppercase tracking-[0.4em]">
      CONFIDENTIAL • {projectName} • INTERNAL USE ONLY
    </div>
    <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest">
      Page {pageNumber} of {totalPages}
    </div>
  </div>
);

const ReportPage: React.FC<{ children: React.ReactNode, pageNumber: number, totalPages: number, projectName: string }> = ({ children, pageNumber, totalPages, projectName }) => (
  <div className="mx-auto my-8 bg-white w-[210mm] h-[297mm] shadow-[0_0_50px_-12px_rgba(0,0,0,0.12)] border border-slate-200 p-[15mm] flex flex-col relative box-border break-after-page print:m-0 print:border-none print:shadow-none mb-12 shrink-0">
    <PageHeader projectName={projectName} />
    <div className="flex-1 flex flex-col overflow-hidden min-h-0 print:overflow-visible print:h-auto print:flex-none">
      {children}
    </div>
    <PageFooter pageNumber={pageNumber} totalPages={totalPages} projectName={projectName} />
  </div>
);

const LegendItem: React.FC<{ color: string, label: string }> = ({ color, label }) => (
  <div className="flex items-center gap-1.5">
    <div className={`w-2 h-2 rounded-full ${color}`} />
    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{label}</span>
  </div>
);

const MiniMetric: React.FC<{ label: string, value: string | number, color: string }> = ({ label, value, color }) => (
  <div className="text-center">
    <div className={`text-[7px] font-black uppercase tracking-widest mb-0.5 opacity-40`}>{label}</div>
    <div className={`text-[11px] font-[1000] ${color}`}>{value}</div>
  </div>
);

const StatCard: React.FC<{ label: string, value: string | number, icon: React.ReactNode, color: string }> = ({ label, value, icon, color }) => {
  const styles: any = {
    blue: 'bg-blue-50/50 text-blue-700 border-blue-100',
    cyan: 'bg-cyan-50/50 text-cyan-700 border-cyan-100',
    emerald: 'bg-emerald-50/50 text-emerald-700 border-emerald-100',
    amber: 'bg-amber-50/50 text-amber-700 border-amber-100',
    slate: 'bg-slate-50/50 text-slate-700 border-slate-100',
    indigo: 'bg-indigo-50/50 text-indigo-700 border-indigo-100',
  };
  return (
    <div className={`p-4 rounded-2xl border-2 ${styles[color]} flex flex-col justify-between h-full`}>
      <div className="flex items-center gap-2 mb-2">
        <div className="p-1.5 bg-white rounded-lg shadow-sm shrink-0">{icon}</div>
        <span className="text-[8px] font-black uppercase tracking-widest opacity-60 leading-none">{label}</span>
      </div>
      <div className="text-xl font-[1000] leading-none tracking-tight">{value}</div>
    </div>
  );
};

// --- Main Reports Component ---

export const Reports: React.FC = () => {
  const { activeProjectId, data, takeSnapshot, deleteSnapshot, refreshSnapshots, isLoading } = useStore();
  const project = data.projects.find(p => p.id === activeProjectId);

  if (!project) return <div className="p-20 text-center text-slate-400 font-black uppercase tracking-widest">Select a project to view reports.</div>;

  const drawings = project.drawings;
  const snapshots = project.snapshots || [];

  // Local state for Snapshot filtering
  const [selectedSnapshotIds, setSelectedSnapshotIds] = useState<string[]>([]);

  // Initialize/Sync selection when snapshots change (Default: Top 10 Recent)
  React.useEffect(() => {
    if (snapshots.length > 0) {
      // User Request: Default to most recent 10 snapshots on load/refresh
      setSelectedSnapshotIds(snapshots.slice(0, 10).map(s => s.id));
    }
  }, [snapshots]);

  const activeSnapshots = useMemo(() => {
    return snapshots.filter(s => selectedSnapshotIds.includes(s.id));
  }, [snapshots, selectedSnapshotIds]);

  // Aggressively normalize discipline names for derivation to prevent visual duplicates
  const derivedDisciplines = useMemo(() => {
    return Array.from(new Set(drawings.map(d => d.discipline.trim().split(/\s+/).map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ')))).filter(Boolean).sort();
  }, [drawings]);

  const stats = useMemo(() => {
    const total = drawings.length;
    const pending = drawings.filter(d => d.status === 'Pending').length;
    const reviewing = drawings.filter(d => d.status === 'Reviewing').length;
    const approved = drawings.filter(d => d.status === 'Approved').length;
    const totalComments = drawings.reduce((acc, d) => acc + (d.manualCommentsCount || 0), 0);
    const openComments = drawings.reduce((acc, d) => acc + (d.manualOpenCommentsCount || 0), 0);
    const progressPercent = total > 0 ? Math.round((approved / total) * 100) : 0;

    return { total, reviewing, approved, totalComments, openComments, progressPercent };
  }, [drawings]);

  /* --- CHANGED: Use activeSnapshots instead of all snapshots --- */
  const snapshotActivityData = useMemo(() => {
    const rawData = activeSnapshots.slice().reverse().map(s => {
      let underReview = 0;
      let waitingReply = 0;
      let approved = 0;

      if (s.stats) {
        s.stats.forEach(ds => {
          underReview += (ds.flowToReview || 0);
          waitingReply += (ds.flowToWaiting || 0);
          approved += (ds.flowToApproved || 0);
        });
      }

      return {
        timestamp: s.timestamp,
        date: format(new Date(s.timestamp), 'MM/dd'),
        'Under Review': underReview,
        'Waiting Reply': waitingReply,
        'Approved': approved,
        isPadding: false
      };
    });

    // --- Padding Logic (Min 10 items) ---
    const minItems = 10;
    if (rawData.length < minItems) {
      const paddingCount = minItems - rawData.length;
      const padding = Array.from({ length: paddingCount }).map((_, i) => ({
        timestamp: `pad-${i}`,
        date: '',
        'Under Review': 0, 'Waiting Reply': 0, 'Approved': 0, isPadding: true
      }));
      // Append padding to the right (future empty slots)
      return [...rawData, ...padding];
    }
    return rawData;
  }, [activeSnapshots]);


  const disciplineMainData = useMemo(() => {
    const disciplineMap = new Map();
    drawings.forEach(d => {
      // Use Title Case for mapping
      const discName = d.discipline.trim().split(/\s+/).map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');
      const entry = disciplineMap.get(discName) || { name: discName, totalComments: 0, openComments: 0 };
      entry.totalComments += (d.manualCommentsCount || 0);
      entry.openComments += (d.manualOpenCommentsCount || 0);
      disciplineMap.set(discName, entry);
    });
    return Array.from(disciplineMap.values());
  }, [drawings]);

  const historicalTrends = useMemo(() => {
    const latestSnapshot = activeSnapshots.length > 0 ? activeSnapshots[0] : null; // Fixed to use index 0 for latest
    return derivedDisciplines.map(disc => {
      const trendData = activeSnapshots.slice().reverse().map(s => { // Reversed for Old->New trend
        // Compare with normalized logic
        if (!s.stats) return { date: '', totalComments: 0, openComments: 0, approvedCount: 0, reviewingCount: 0, waitingReplyCount: 0 };

        const dStat = s.stats.find(ds => ds.discipline && ds.discipline.trim().toLowerCase() === disc.trim().toLowerCase());

        let dateStr = 'Invalid';
        try {
          dateStr = format(new Date(s.timestamp), 'MM/dd');
        } catch (e) {
          console.error('Invalid date in snapshot:', s);
        }

        return {
          date: dateStr,
          totalComments: dStat?.totalComments || 0,
          openComments: dStat?.openComments || 0,
          approvedCount: dStat?.approved || 0,
          reviewingCount: dStat?.reviewing || 0,
          waitingReplyCount: dStat?.waitingReply || 0,
        };
      });

      const latestDiscStat = latestSnapshot?.stats ? latestSnapshot.stats.find(ds => ds.discipline && ds.discipline.trim().toLowerCase() === disc.trim().toLowerCase()) : null;

      return {
        discipline: disc, trendData,
        latest: latestDiscStat ? {
          approved: latestDiscStat.approved,
          reviewing: latestDiscStat.reviewing,
          waiting: latestDiscStat.waitingReply,
          openComments: latestDiscStat.openComments,
          totalComments: latestDiscStat.totalComments,
          timestamp: latestSnapshot?.timestamp
        } : null
      };
    });
  }, [activeSnapshots, derivedDisciplines]);

  const velocityData = useMemo(() => {
    const latestSnapshot = activeSnapshots.length > 0 ? activeSnapshots[0] : null;
    return latestSnapshot && latestSnapshot.stats ? latestSnapshot.stats.map(s => ({
      name: s.discipline,
      toReview: s.flowToReview || 0,
      toWaiting: s.flowToWaiting || 0,
      toApproved: s.flowToApproved || 0
    })).filter(d => d.toReview > 0 || d.toWaiting > 0 || d.toApproved > 0) : [];
  }, [activeSnapshots]);

  const progressTrendData = useMemo(() => {
    return activeSnapshots.slice().reverse().map(s => {
      let total = 0;
      let pending = 0;
      let approved = 0;
      let totalComments = 0;

      if (s.stats) {
        s.stats.forEach(ds => {
          const disciplineTotal = ds.approved + ds.reviewing + ds.waitingReply + ds.pending;
          total += disciplineTotal;
          pending += ds.pending;
          approved += ds.approved;
          totalComments += (ds.totalComments || 0);
        });
      }

      return {
        timestamp: s.timestamp,
        date: format(new Date(s.timestamp), 'MM/dd'),
        'Issued Drawings': total - pending,
        'Approved': approved, // Renamed from 'Completed Output'
        'Total Comments': totalComments,
      };
    });
  }, [activeSnapshots]);

  // Dynamic Pagination Logic
  // If velocityData (Table) exists, it consumes vertical space. To ensure charts aren't squashed, we split Exec Summary.
  const execSplitRequired = velocityData.length > 0;
  const execPages = execSplitRequired ? 2 : 1;

  // Calculate pages: 1 (Dashboard) + execPages + N (Health) + M (Trends)
  const healthPages = Math.ceil(derivedDisciplines.length / 8);
  const trendPages = Math.ceil(historicalTrends.length / 2);
  const totalPages = 1 + execPages + healthPages + trendPages;

  // Stale drawings calculation
  const staleDrawings = useMemo(() => {
    const now = new Date();
    return drawings
      .filter(d => d.status !== 'Pending' && d.status !== 'Approved')
      .filter(d => {
        // Safe date extraction with fallback
        let lastUpdate = now;
        if (d.statusHistory && d.statusHistory.length > 0) {
          lastUpdate = new Date(d.statusHistory[d.statusHistory.length - 1].createdAt);
        } else if (d.logs && d.logs.length > 0 && d.logs[0].receivedDate) {
          lastUpdate = new Date(d.logs[0].receivedDate);
        }

        const daysSince = Math.floor((now.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60 * 24));
        return daysSince > 14;
      })
      .sort((a, b) => {
        const getLastUpdate = (drawing: typeof drawings[0]) => {
          if (drawing.statusHistory && drawing.statusHistory.length > 0) {
            return new Date(drawing.statusHistory[drawing.statusHistory.length - 1].createdAt);
          } else if (drawing.logs && drawing.logs.length > 0 && drawing.logs[0].receivedDate) {
            return new Date(drawing.logs[0].receivedDate);
          }
          return now;
        };

        const aDate = getLastUpdate(a);
        const bDate = getLastUpdate(b);
        return aDate.getTime() - bDate.getTime();
      });
  }, [drawings]);

  // Helper function to safely extract last update date from a drawing
  const getDrawingLastUpdate = (drawing: Drawing): Date => {
    const now = new Date();
    if (drawing.statusHistory && drawing.statusHistory.length > 0) {
      return new Date(drawing.statusHistory[drawing.statusHistory.length - 1].createdAt);
    }
    if (drawing.logs && drawing.logs.length > 0) {
      const log = drawing.logs[0];
      if (log && log.receivedDate) {
        return new Date(log.receivedDate);
      }
    }
    return now;
  };

  // Inject print-specific styles
  React.useEffect(() => {
    const styleId = 'reports-print-styles';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = `
        @media print {
          @page {
            size: A4 portrait;
            margin: 0;
          }
          
          body {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
          }
          
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          
          .no-print {
            display: none !important;
          }
          
          /* Force exact dimensions */
          .w-\\[210mm\\] {
            width: 210mm !important;
            min-width: 210mm !important;
            max-width: 210mm !important;
          }
          
          .h-\\[297mm\\] {
            height: 297mm !important;
            min-height: 297mm !important;
            max-height: 297mm !important;
          }
          
          /* Ensure grid layouts stay intact */
          .grid {
            display: grid !important;
          }
          
          .grid-cols-2 {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }
          
          .grid-cols-3 {
            grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
          }
          
          /* Prevent page breaks inside cards */
          .break-inside-avoid {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }
          
          /* Force page breaks after pages */
          .break-after-page {
            break-after: page !important;
            page-break-after: always !important;
          }
        }
      `;
      document.head.appendChild(style);
    }

    return () => {
      const style = document.getElementById(styleId);
      if (style) style.remove();
    };
  }, []);

  return (
    <div className="bg-slate-100 min-h-full overflow-y-auto print:overflow-visible print:min-h-0 print:h-auto print:pb-0 print:bg-white scrollbar-thin scrollbar-thumb-slate-300 pb-20">
      {/* Floating Action Header (Screen only) */}
      <div className="sticky top-0 z-50 bg-white/80 backdrop-blur-md px-6 py-3 border-b border-slate-200 flex items-center justify-between no-print shadow-sm">
        <div className="flex items-center gap-4">
          <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest">Reports Intelligence</h2>
          <div className="h-4 w-px bg-slate-200" />
          <p className="text-[10px] font-bold text-slate-500 uppercase">{project.name}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => window.print()} className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all shadow-sm"><Printer size={12} /> Export PDF</button>
          <button onClick={() => takeSnapshot(activeProjectId!)} className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-teal-700 transition-all shadow-md shadow-teal-500/20"><Camera size={12} /> Snapshot</button>
        </div>
      </div>

      {/* Snapshot Registry Card (Screen only) */}
      {snapshots.length > 0 && (
        <div className="mx-auto my-6 max-w-[210mm] no-print">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-50 rounded-xl">
                  <History size={16} className="text-indigo-600" />
                </div>
                <div>
                  <h3 className="text-[10px] font-[1000] text-slate-800 uppercase tracking-widest">Snapshot Registry</h3>
                  <p className="text-[8px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">{snapshots.length} Captured | {activeSnapshots.length} Selected</p>
                </div>
              </div>
              <button
                onClick={() => refreshSnapshots(activeProjectId!)}
                disabled={isLoading}
                className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-indigo-100 transition-all"
              >
                <RefreshCw size={12} className={isLoading ? "animate-spin" : ""} /> Refresh List
              </button>
            </div>
            <div className="grid grid-cols-6 gap-2">
              {snapshots.slice().reverse().map((s) => {
                const isSelected = selectedSnapshotIds.includes(s.id);
                return (
                  <div key={s.id}
                    className={`border p-3 rounded-xl flex flex-col items-center justify-between transition-all group cursor-pointer relative ${isSelected ? 'bg-indigo-50 border-indigo-200' : 'bg-slate-50 border-slate-200 hover:border-slate-300'}`}
                    onClick={() => {
                      setSelectedSnapshotIds(prev => prev.includes(s.id) ? prev.filter(id => id !== s.id) : [...prev, s.id]);
                    }}
                  >
                    <div className="absolute top-2 right-2">
                      <div className={`w-3 h-3 rounded border flex items-center justify-center ${isSelected ? 'bg-indigo-500 border-indigo-500' : 'bg-white border-slate-300'}`}>
                        {isSelected && <CheckCircle size={8} className="text-white" />}
                      </div>
                    </div>

                    <div className="flex flex-col items-center mb-2 mt-1">
                      <span className={`text-[9px] font-black uppercase leading-none ${isSelected ? 'text-indigo-700' : 'text-slate-700'}`}>
                        {(() => {
                          try { return format(new Date(s.timestamp), 'MM-dd'); } catch { return 'Err'; }
                        })()}
                      </span>
                      <span className={`text-[7px] font-mono mt-1 ${isSelected ? 'text-indigo-400' : 'text-slate-400'}`}>
                        {(() => {
                          try { return format(new Date(s.timestamp), 'HH:mm'); } catch { return '--:--'; }
                        })()}
                      </span>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        window.confirm('Delete snapshot?') && deleteSnapshot(activeProjectId!, s.id);
                      }}
                      className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100 z-10"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* --- PAGE 1: PROJECT INTELLIGENCE DASHBOARD --- */}
      <ReportPage pageNumber={1} totalPages={totalPages} projectName={project.name}>
        <div className="flex flex-col gap-6">
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b-2 border-teal-500">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-gradient-to-br from-teal-500 to-teal-600 rounded-2xl shadow-lg">
                <TrendingUp size={20} className="text-white" strokeWidth={2.5} />
              </div>
              <div>
                <h2 className="text-xl font-[1000] text-slate-900 uppercase tracking-tight leading-none">
                  {project.conf?.displayName || project.name}
                </h2>
                <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-1">Project Dashboard</p>
              </div>
            </div>
            {/* Removed Total Drawings as requested */}
          </div>

          {/* Stat Cards Grid (Moved from Page 2) */}
          <div className="grid grid-cols-3 gap-4 shrink-0">
            <StatCard label="Total DWG" value={stats.total} icon={<Hash size={12} />} color="blue" />
            <StatCard label="In-Review" value={stats.reviewing} icon={<Search size={12} />} color="amber" />
            <StatCard label="Approved" value={stats.approved} icon={<CheckCircle size={12} />} color="emerald" />
            <StatCard label="Comments Flow" value={`${stats.openComments}/${stats.totalComments}`} icon={<MessageSquare size={12} />} color="slate" />
            <StatCard label="Progress" value={`${stats.progressPercent}%`} icon={<TrendingUp size={12} />} color="indigo" />
            <StatCard label="Report Date" value={activeSnapshots.length > 0 ? format(new Date(activeSnapshots[0].timestamp), 'dd-MMM') : 'N/A'} icon={<Clock size={12} />} color="cyan" />
          </div>

          {/* Status Distribution & Comments */}
          <div className="grid grid-cols-2 gap-5">
            {/* Status Pie Chart */}
            <div className="bg-slate-50 rounded-2xl border border-slate-200 p-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-[9px] font-[1000] text-slate-800 uppercase tracking-widest">Status Distribution</h3>
                <div className="flex gap-1.5 flex-wrap">
                  <LegendItem color="bg-emerald-500" label="Approved" />
                  <LegendItem color="bg-amber-500" label="Reviewing" />
                  <LegendItem color="bg-blue-500" label="Waiting" />
                  <LegendItem color="bg-slate-300" label="Pending" />
                </div>
              </div>
              <div className="flex items-center justify-center h-[140px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={(() => {
                        let data = [
                          { name: 'Approved', value: stats.approved },
                          { name: 'Reviewing', value: stats.reviewing },
                          { name: 'Waiting Reply', value: drawings.filter(d => d.status === 'Waiting Reply').length },
                          { name: 'Pending', value: drawings.filter(d => d.status === 'Pending').length },
                        ].map(d => ({ ...d, value: d.value || 0 })).filter(d => d.value > 0);

                        // Safety: Recharts fails if all values are 0 or data is undefined
                        if (data.length === 0) {
                          data = [{ name: 'Empty', value: 1 }]; // Placeholder or handle empty
                        }
                        return data;
                      })()}
                      cx="50%" cy="50%"
                      innerRadius={35} outerRadius={55}
                      paddingAngle={3} dataKey="value"
                    >
                      <Cell fill="#10b981" />
                      <Cell fill="#f59e0b" />
                      <Cell fill="#3b82f6" />
                      <Cell fill="#cbd5e1" />
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Comments Analysis */}
            <div className="bg-slate-50 rounded-2xl border border-slate-200 p-4 shadow-sm">
              <h3 className="text-[9px] font-[1000] text-slate-800 uppercase tracking-widest mb-3">Comments Intelligence</h3>
              <div className="space-y-2">
                <div className="flex items-center justify-between p-2.5 bg-red-50 border border-red-100 rounded-xl">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-red-500 rounded-lg">
                      <MessageSquare size={12} className="text-white" />
                    </div>
                    <div>
                      <div className="text-[7px] font-black text-red-600 uppercase tracking-widest">Open</div>
                      <div className="text-lg font-[1000] text-red-700 leading-none mt-0.5">{stats.openComments}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[6px] font-black text-red-400 uppercase">Critical</div>
                    <div className="text-[9px] font-bold text-red-600">{stats.totalComments > 0 ? ((stats.openComments / stats.totalComments) * 100).toFixed(0) : 0}%</div>
                  </div>
                </div>
                <div className="flex items-center justify-between p-2.5 bg-white border border-slate-100 rounded-xl">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-slate-600 rounded-lg">
                      <MessageSquare size={12} className="text-white" />
                    </div>
                    <div>
                      <div className="text-[7px] font-black text-slate-600 uppercase tracking-widest">Total</div>
                      <div className="text-lg font-[1000] text-slate-700 leading-none mt-0.5">{stats.totalComments}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[6px] font-black text-slate-400 uppercase">Avg/Dwg</div>
                    <div className="text-[9px] font-bold text-slate-600">{stats.total > 0 ? (stats.totalComments / stats.total).toFixed(1) : 0}</div>
                  </div>
                </div>
                <div className="flex items-center justify-between p-2.5 bg-emerald-50 border border-emerald-100 rounded-xl">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-emerald-500 rounded-lg">
                      <CheckCircle size={12} className="text-white" />
                    </div>
                    <div>
                      <div className="text-[7px] font-black text-emerald-600 uppercase tracking-widest">Resolved</div>
                      <div className="text-lg font-[1000] text-emerald-700 leading-none mt-0.5">{stats.totalComments - stats.openComments}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[6px] font-black text-emerald-400 uppercase">Rate</div>
                    <div className="text-[9px] font-bold text-emerald-600">{stats.totalComments > 0 ? (((stats.totalComments - stats.openComments) / stats.totalComments) * 100).toFixed(0) : 0}%</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Workload & Stale Drawings */}
          <div className="space-y-4">
            {/* Progress Trend Chart (Replaces Workload Hotspots) */}
            <div className="bg-slate-50 rounded-2xl border border-slate-200 p-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-[9px] font-[1000] text-slate-800 uppercase tracking-widest">Overall Progress Trend</h3>
                <div className="flex gap-2">
                  <LegendItem color="bg-blue-500" label="Issued" />
                  <LegendItem color="bg-emerald-500" label="Approved" /> {/* Renamed Label */}
                </div>
              </div>
              <div className="h-[180px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  {/* 
                   // @ts-ignore */}
                  <AreaChart data={progressTrendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorIssued" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="colorCompleted" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.1} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis
                      dataKey="timestamp"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 8, fontWeight: 700, fill: '#94a3b8' }}
                      tickFormatter={(t) => {
                        try { return format(new Date(t), 'MM/dd'); } catch { return ''; }
                      }}
                    />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 8, fill: '#94a3b8' }} />
                    <Tooltip
                      contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '8px' }}
                      labelStyle={{ display: 'none' }}
                    />
                    <Area
                      type="monotone"
                      dataKey="Issued Drawings"
                      stroke="#3b82f6"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#colorIssued)"
                    />
                    <Area
                      type="monotone"
                      dataKey="Approved" // Renamed Key
                      stroke="#10b981"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#colorCompleted)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      </ReportPage >

      {/* --- PAGE 2: EXECUTIVE SUMMARY --- */}
      < ReportPage pageNumber={2} totalPages={totalPages} projectName={project.name} >
        <div className="flex flex-col gap-6">


          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between border-l-4 border-teal-500 pl-4">
              <h3 className="text-[10px] font-[1000] text-slate-800 uppercase tracking-widest">Period Activities</h3>
            </div>

            {/* --- NEW: SNAPSHOT ACTIVITIES TABLE -- */}
            {velocityData.length > 0 && (
              <div className="flex flex-col gap-2 mt-4">
                <div className="flex items-center justify-between border-l-4 border-indigo-400 pl-4 py-1">
                  <h3 className="text-[10px] font-[1000] text-slate-800 uppercase tracking-widest">Snapshot Activities (Since Last)</h3>
                </div>

                <div className="bg-white rounded-xl border border-indigo-100 overflow-hidden shadow-sm">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-indigo-50/50 border-b border-indigo-100">
                        <th className="px-4 py-2 text-left text-[8px] font-black text-slate-500 uppercase tracking-wider">Discipline</th>
                        <th className="px-4 py-2 text-center text-[8px] font-black text-amber-600 uppercase tracking-wider">Under Review</th>
                        <th className="px-4 py-2 text-center text-[8px] font-black text-cyan-600 uppercase tracking-wider">Waiting Reply</th>
                        <th className="px-4 py-2 text-center text-[8px] font-black text-emerald-600 uppercase tracking-wider">Approved</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {velocityData.map((row) => (
                        <tr key={row.name} className="hover:bg-slate-50 transition-colors">
                          <td className="px-4 py-2 text-[9px] font-bold text-slate-700">{row.name}</td>
                          <td className="px-4 py-2 text-center">
                            {row.toReview > 0 ? (
                              <span className="inline-flex items-center justify-center px-2 py-0.5 rounded text-[9px] font-black bg-amber-100 text-amber-700">
                                +{row.toReview}
                              </span>
                            ) : <span className="text-[9px] text-slate-300">-</span>}
                          </td>
                          <td className="px-4 py-2 text-center">
                            {row.toWaiting > 0 ? (
                              <span className="inline-flex items-center justify-center px-2 py-0.5 rounded text-[9px] font-black bg-cyan-100 text-cyan-700">
                                +{row.toWaiting}
                              </span>
                            ) : <span className="text-[9px] text-slate-300">-</span>}
                          </td>
                          <td className="px-4 py-2 text-center">
                            {row.toApproved > 0 ? (
                              <span className="inline-flex items-center justify-center px-2 py-0.5 rounded text-[9px] font-black bg-emerald-100 text-emerald-700">
                                +{row.toApproved}
                              </span>
                            ) : <span className="text-[9px] text-slate-300">-</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Margins increased to top: 30 to prevent label clipping */}
            <div className="h-[220px] bg-slate-50/50 rounded-2xl p-4 border border-slate-100 shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={snapshotActivityData || []} margin={{ top: 30, right: 10, left: -30, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="2 2" vertical={false} stroke="#e2e8f0" />
                  <XAxis
                    dataKey="timestamp"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 8, fontWeight: 900, fill: '#94a3b8' }}
                    tickFormatter={(t) => {
                      try { return format(new Date(t), 'MM/dd'); } catch { return ''; }
                    }}
                  />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 8, fill: '#94a3b8' }} />
                  <Bar dataKey="Under Review" fill="#f59e0b" radius={[2, 2, 0, 0]}>
                    <LabelList dataKey="Under Review" position="top" style={{ fill: '#f59e0b', fontSize: 9, fontWeight: 900 }} />
                  </Bar>
                  <Bar dataKey="Waiting Reply" fill="#0d9488" radius={[2, 2, 0, 0]}>
                    <LabelList dataKey="Waiting Reply" position="top" style={{ fill: '#0d9488', fontSize: 9, fontWeight: 900 }} />
                  </Bar>
                  <Bar dataKey="Approved" fill="#10b981" radius={[2, 2, 0, 0]}>
                    <LabelList dataKey="Approved" position="top" style={{ fill: '#10b981', fontSize: 9, fontWeight: 900 }} />
                  </Bar>

                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Workload Hotspots (Moved from Page 1) */}
            <div className="bg-slate-50 rounded-2xl border border-slate-200 p-4 shadow-sm shrink-0">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-[9px] font-[1000] text-slate-800 uppercase tracking-widest">Workload Hotspots</h3>
                <span className="text-[7px] font-bold text-slate-400 uppercase tracking-wider">Top Disciplines by Open Comments</span>
              </div>
              <div className="grid grid-cols-3 gap-4">
                {[...disciplineMainData]
                  .sort((a, b) => b.openComments - a.openComments)
                  .slice(0, 9)
                  .map((disc, idx) => (
                    <div key={disc.name} className="flex items-center gap-2">
                      <div className={`w-5 h-5 rounded-md flex items-center justify-center text-[7px] font-black shrink-0 ${idx === 0 ? 'bg-red-500 text-white' : idx === 1 ? 'bg-orange-400 text-white' : idx === 2 ? 'bg-amber-400 text-white' : 'bg-slate-200 text-slate-600'}`}>
                        {idx + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[7px] font-black text-slate-700 uppercase truncate">{disc.name}</div>
                        <div className="flex items-center gap-1 mt-0.5">
                          <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-red-500 to-orange-400 rounded-full"
                              style={{ width: `${(disc.openComments / Math.max(...disciplineMainData.map(d => d.openComments), 1)) * 100}%` }}
                            />
                          </div>
                          <span className="text-[7px] font-black text-red-600 w-6 text-right">{disc.openComments}</span>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>

          {/* If NOT split, show Discipline Chart here */}
          {!execSplitRequired && (
            <div className="flex flex-col gap-4 shrink-0">
              <h3 className="text-[10px] font-[1000] text-slate-800 uppercase tracking-widest border-l-4 border-indigo-500 pl-4">Discipline Comments Status</h3>
              {/* Margins increased on right: 50 to prevent label clipping */}
              <div className="h-[350px] bg-slate-50/50 rounded-2xl p-6 border border-slate-100">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={disciplineMainData || []} layout="vertical" margin={{ top: 0, right: 40, left: 10, bottom: 0 }} barGap={2}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                    <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#94a3b8', fontWeight: 600 }} />
                    <YAxis
                      dataKey="name"
                      type="category"
                      axisLine={false}
                      tickLine={false}
                      width={120}
                      tick={{ fontSize: 10, fill: '#475569', fontWeight: 800, textTransform: 'uppercase' }}
                    />
                    <Tooltip
                      cursor={{ fill: '#f1f5f9', radius: 4 }}
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', padding: '12px' }}
                      itemStyle={{ fontSize: '11px', fontWeight: 700, padding: '2px 0' }}
                      labelStyle={{ fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', color: '#94a3b8', marginBottom: '8px' }}
                    />
                    <Legend verticalAlign="top" align="right" iconType="circle" wrapperStyle={{ fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', paddingBottom: '20px' }} />

                    <Bar dataKey="totalComments" name="Total Comments" fill="#cbd5e1" radius={[0, 4, 4, 0]} barSize={12}>
                    </Bar>
                    <Bar dataKey="openComments" name="Open Comments" fill="#ef4444" radius={[0, 4, 4, 0]} barSize={12}>
                      <LabelList dataKey="openComments" position="right" style={{ fill: '#ef4444', fontSize: 10, fontWeight: 900 }} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      </ReportPage >

      {/* --- PAGE 3: EXECUTIVE SUMMARY (PART 2 - Conditional) --- */}
      {execSplitRequired && (
        <ReportPage pageNumber={3} totalPages={totalPages} projectName={project.name}>
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-4 shrink-0">
              <h3 className="text-[10px] font-[1000] text-slate-800 uppercase tracking-widest border-l-4 border-indigo-500 pl-4">Discipline Comments Status</h3>
              {/* Margins increased on right: 50 to prevent label clipping */}
              <div className="h-[350px] bg-slate-50/50 rounded-2xl p-6 border border-slate-100">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={disciplineMainData || []} layout="vertical" margin={{ top: 0, right: 40, left: 10, bottom: 0 }} barGap={2}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                    <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#94a3b8', fontWeight: 600 }} />
                    <YAxis
                      dataKey="name"
                      type="category"
                      axisLine={false}
                      tickLine={false}
                      width={120}
                      tick={{ fontSize: 10, fill: '#475569', fontWeight: 800, textTransform: 'uppercase' }}
                    />
                    <Tooltip
                      cursor={{ fill: '#f1f5f9', radius: 4 }}
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', padding: '12px' }}
                      itemStyle={{ fontSize: '11px', fontWeight: 700, padding: '2px 0' }}
                      labelStyle={{ fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', color: '#94a3b8', marginBottom: '8px' }}
                    />
                    <Legend verticalAlign="top" align="right" iconType="circle" wrapperStyle={{ fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', paddingBottom: '20px' }} />

                    <Bar dataKey="totalComments" name="Total Comments" fill="#cbd5e1" radius={[0, 4, 4, 0]} barSize={12}>
                    </Bar>
                    <Bar dataKey="openComments" name="Open Comments" fill="#ef4444" radius={[0, 4, 4, 0]} barSize={12}>
                      <LabelList dataKey="openComments" position="right" style={{ fill: '#ef4444', fontSize: 10, fontWeight: 900 }} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </ReportPage>
      )}

      {/* --- PAGE 3+: DISCIPLINE HEALTH (Paginated) --- */}
      {
        Array.from({ length: Math.ceil(derivedDisciplines.length / 8) }).map((_, healthPageIdx) => (
          <ReportPage key={`health-${healthPageIdx}`} pageNumber={1 + execPages + 1 + healthPageIdx} totalPages={totalPages} projectName={project.name}>
            <div className="flex flex-col gap-6">
              <div className="flex items-center justify-between border-l-4 border-emerald-500 pl-4">
                <h3 className="text-[10px] font-[1000] text-slate-800 uppercase tracking-widest">Health Snapshot {derivedDisciplines.length > 8 ? `(${healthPageIdx + 1}/${Math.ceil(derivedDisciplines.length / 8)})` : ''}</h3>
                <div className="flex gap-3">
                  {HEALTH_LABELS.map((l, i) => <LegendItem key={l} color={`bg-[${HEALTH_COLORS[i]}]`} label={l} />)}
                </div>
              </div>
              <div className="flex flex-wrap gap-4 shrink-0">
                {derivedDisciplines.slice(healthPageIdx * 8, healthPageIdx * 8 + 8).map(disc => {
                  const discDrawings = drawings.filter(d => d.discipline.trim().toLowerCase() === disc.toLowerCase());
                  const pieData = [
                    { name: 'Approved', value: discDrawings.filter(d => d.status === 'Approved').length },
                    { name: 'Reviewing', value: discDrawings.filter(d => d.status === 'Reviewing').length },
                    { name: 'Waiting Reply', value: discDrawings.filter(d => d.status === 'Waiting Reply').length },
                    { name: 'Pending', value: discDrawings.filter(d => d.status === 'Pending').length },
                  ].filter(p => p.value > 0);
                  return (
                    <div key={disc} className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex items-center justify-between gap-4 shadow-sm group break-inside-avoid" style={{ width: 'calc((100% - 1rem) / 2)' }}>
                      <div className="flex-1 min-w-0">
                        <div className="text-[10px] font-[1000] text-slate-900 uppercase mb-2 tracking-widest border-b border-slate-200 pb-2 truncate">{disc}</div>
                        <div className="space-y-1">
                          {HEALTH_LABELS.map((label) => {
                            const count = discDrawings.filter(d => d.status === (label as any)).length;
                            const colorClass =
                              label === 'Approved' ? 'text-emerald-500' :
                                label === 'Reviewing' ? 'text-amber-500' :
                                  label === 'Waiting Reply' ? 'text-blue-500' :
                                    'text-slate-400';

                            return (
                              <div key={label} className="flex items-center justify-between text-[8px] font-black uppercase tracking-tight">
                                <span className={count > 0 ? 'text-slate-600' : 'text-slate-300'}>{label}</span>
                                <span className={count > 0 ? colorClass : 'text-slate-100'}>{count}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                      <div className="h-24 w-24 shrink-0 bg-white rounded-xl border border-slate-100 flex items-center justify-center">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={pieData}
                              cx="50%" cy="50%"
                              innerRadius={22} outerRadius={32}
                              paddingAngle={2} dataKey="value" stroke="none"
                            >
                              {pieData.map((p, i) => <Cell key={i} fill={HEALTH_COLORS[HEALTH_LABELS.indexOf(p.name)]} />)}
                            </Pie>
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </ReportPage>
        ))
      }

      {/* --- TREND ANALYSIS PAGES --- */}
      {
        Array.from({ length: Math.ceil(historicalTrends.length / 2) }).map((_, pageIdx) => (
          <ReportPage
            key={pageIdx}
            pageNumber={1 + execPages + healthPages + 1 + pageIdx}
            totalPages={totalPages}
            projectName={project.name}
          >
            <div className="flex flex-col gap-10">
              <div className="flex items-center justify-between border-l-4 border-indigo-600 pl-4">
                <h3 className="text-[10px] font-[1000] text-slate-800 uppercase tracking-widest">Progress Trends</h3>
              </div>
              <div className="flex flex-col gap-10">
                {historicalTrends.slice(pageIdx * 2, pageIdx * 2 + 2).map(trend => (
                  <div key={trend.discipline} className="bg-white rounded-[2rem] border border-slate-200 p-6 flex flex-col gap-4 shadow-sm shrink-0">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="text-[11px] font-[1000] text-slate-900 uppercase tracking-widest">{trend.discipline} TREND</h4>
                        {trend.latest && <p className="text-[8px] font-bold text-slate-300 uppercase mt-1">Status as of {format(new Date(trend.latest.timestamp), 'MM-dd HH:mm')}</p>}
                      </div>
                      {trend.latest && (
                        <div className="flex gap-4 bg-slate-50 border border-slate-100 px-4 py-2 rounded-xl">
                          <MiniMetric label="Approved" value={trend.latest.approved} color="text-emerald-500" />
                          <MiniMetric label="Reviewing" value={trend.latest.reviewing} color="text-amber-500" />
                          <MiniMetric label="Waiting" value={trend.latest.waiting} color="text-blue-500" />
                          <MiniMetric label="Open Cmt" value={trend.latest.openComments} color="text-red-500" />
                        </div>
                      )}
                    </div>
                    <div className="h-[200px] w-full bg-slate-50/20 rounded-2xl p-2 border border-slate-100/50 shrink-0">
                      <ResponsiveContainer width="100%" height="100%">
                        {/* 
                         // @ts-ignore */}
                        <AreaChart data={trend.trendData || []} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                          <defs>
                            {/* Gradient defs if needed, or reuse existing ones in scope if accessible, 
                                 or define new ones inline here if not global. 
                                 For simplicity we use solid colors/fills based on previous design. */}
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                          <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 8, fontWeight: 900, fill: '#94a3b8' }} />

                          {/* Left Axis: Comments */}
                          <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fontSize: 8, fontWeight: 900, fill: '#ef4444' }} />

                          {/* Right Axis: Drawings Count */}
                          <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fontSize: 8, fontWeight: 900, fill: '#64748b' }} />

                          <Tooltip
                            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '9px' }}
                            itemStyle={{ padding: 0 }}
                          />

                          <Area yAxisId="right" type="monotone" dataKey="approvedCount" name="Approved" stroke="#10b981" strokeWidth={2} fill="#10b981" fillOpacity={0.05} />
                          <Area yAxisId="right" type="monotone" dataKey="reviewingCount" name="Reviewing" stroke="#f59e0b" strokeWidth={2} fill="#f59e0b" fillOpacity={0.1} />
                          <Area yAxisId="right" type="monotone" dataKey="waitingReplyCount" name="Waiting Reply" stroke="#3b82f6" strokeWidth={2} fill="#3b82f6" fillOpacity={0.05} />

                          {/* Comments on Left Axis */}
                          <Area yAxisId="left" type="monotone" dataKey="openComments" name="Open Comments" stroke="#ef4444" strokeWidth={2} strokeDasharray="4 4" fill="transparent" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </ReportPage>
        ))
      }
    </div >
  );
};

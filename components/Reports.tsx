
import React, { useMemo, useState } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, AreaChart, Area, Legend, LabelList
} from 'recharts';
import { useStore } from '../store';
import { 
  TrendingUp, CheckCircle, Search, Hash, Trash2, Printer, Camera, History, Clock, MessageSquare
} from 'lucide-react';
// Fix: Removed missing isWithinInterval from date-fns imports
import { format, endOfWeek, eachWeekOfInterval } from 'date-fns';

// Fix: Local implementation of isWithinInterval to resolve missing export error from date-fns
const isWithinInterval = (date: Date, interval: { start: Date; end: Date }) => {
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
    <div className="flex-1 flex flex-col overflow-hidden min-h-0">
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
  const { activeProjectId, data, takeSnapshot, deleteSnapshot } = useStore();
  const [showSnapshotList, setShowSnapshotList] = useState(true);
  const project = data.projects.find(p => p.id === activeProjectId);

  if (!project) return <div className="p-20 text-center text-slate-400 font-black uppercase tracking-widest">Select a project to view reports.</div>;

  const drawings = project.drawings;
  const snapshots = project.snapshots || [];

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

  const weeklyData = useMemo(() => {
    const end = new Date();
    const start = new Date();
    start.setMonth(start.getMonth() - 2);
    const weeks = eachWeekOfInterval({ start, end });
    
    return weeks.map(weekStart => {
      const weekEnd = endOfWeek(weekStart);
      const interval = { start: weekStart, end: weekEnd };
      let criticalActivity = 0; 
      let approvalsThisWeek = 0;
      let reviewStartsThisWeek = 0;

      drawings.forEach(d => {
        (d.statusHistory || []).forEach(h => {
          const logDate = new Date(h.createdAt);
          if (isWithinInterval(logDate, interval)) {
            if (h.content.includes('Status: Waiting Reply') || h.content.includes('Status: Approved')) criticalActivity++;
            if (h.content.includes('Status: Approved')) approvalsThisWeek++;
            if (h.content.includes('Status: Reviewing')) reviewStartsThisWeek++;
          }
        });
      });
      return {
        week: format(weekStart, 'MM/dd'),
        'Activity': criticalActivity,
        'Approvals': approvalsThisWeek,
        'Starts': reviewStartsThisWeek,
      };
    });
  }, [drawings]);

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
    const latestSnapshot = snapshots.length > 0 ? snapshots[snapshots.length - 1] : null;
    return derivedDisciplines.map(disc => {
      const trendData = snapshots.map(s => {
        // Compare with normalized logic
        const dStat = s.stats.find(ds => ds.discipline.trim().toLowerCase() === disc.trim().toLowerCase());
        return {
          date: format(new Date(s.timestamp), 'MM/dd'),
          totalComments: dStat?.totalComments || 0,
          openComments: dStat?.openComments || 0,
          approvedCount: dStat?.approved || 0,
          reviewingCount: dStat?.reviewing || 0,
          waitingReplyCount: dStat?.waitingReply || 0,
        };
      });
      const latestDiscStat = latestSnapshot?.stats.find(ds => ds.discipline.trim().toLowerCase() === disc.trim().toLowerCase());
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
  }, [snapshots, derivedDisciplines]);

  // Calculate pages: 1 (Exec) + 1 (Health) + N (Trends, 2 per page)
  const totalPages = 2 + Math.ceil(historicalTrends.length / 2);

  return (
    <div className="bg-slate-100 min-h-full overflow-y-auto scrollbar-thin scrollbar-thumb-slate-300 pb-20">
      {/* Floating Action Header (Screen only) */}
      <div className="sticky top-0 z-50 bg-white/80 backdrop-blur-md px-6 py-3 border-b border-slate-200 flex items-center justify-between no-print shadow-sm">
         <div className="flex items-center gap-4">
           <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest">Reports Intelligence</h2>
           <div className="h-4 w-px bg-slate-200" />
           <p className="text-[10px] font-bold text-slate-500 uppercase">{project.name}</p>
         </div>
         <div className="flex gap-2">
           <button 
             onClick={() => setShowSnapshotList(!showSnapshotList)}
             className={`flex items-center gap-2 px-4 py-2 border rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${showSnapshotList ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200'}`}
           >
             <History size={12}/> {showSnapshotList ? 'Hide Snapshots' : 'Show Snapshots'}
           </button>
           <button onClick={() => window.print()} className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all shadow-sm"><Printer size={12}/> Export PDF</button>
           <button onClick={() => takeSnapshot(activeProjectId!)} className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-teal-700 transition-all shadow-md shadow-teal-500/20"><Camera size={12}/> Snapshot</button>
         </div>
      </div>

      {/* --- PAGE 1: EXECUTIVE SUMMARY --- */}
      <ReportPage pageNumber={1} totalPages={totalPages} projectName={project.name}>
        <div className="flex flex-col gap-10">
          <div className="grid grid-cols-3 gap-4 shrink-0">
            <StatCard label="Total Units" value={stats.total} icon={<Hash size={12}/>} color="blue" />
            <StatCard label="In-Review" value={stats.reviewing} icon={<Search size={12}/>} color="amber" />
            <StatCard label="Approved" value={stats.approved} icon={<CheckCircle size={12}/>} color="emerald" />
            <StatCard label="Comments Flow" value={`${stats.openComments}/${stats.totalComments}`} icon={<MessageSquare size={12}/>} color="slate" />
            <StatCard label="Progress" value={`${stats.progressPercent}%`} icon={<TrendingUp size={12}/>} color="indigo" />
            <StatCard label="Latest Pulse" value={snapshots.length > 0 ? format(new Date(snapshots[snapshots.length-1].timestamp), 'MM-dd') : 'N/A'} icon={<Clock size={12}/>} color="cyan" />
          </div>

          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between border-l-4 border-teal-500 pl-4">
              <h3 className="text-[10px] font-[1000] text-slate-800 uppercase tracking-widest">Velocity History (8 Weeks)</h3>
              <div className="flex gap-4">
                <LegendItem color="bg-amber-400" label="Starts" />
                <LegendItem color="bg-teal-500" label="Activity" />
                <LegendItem color="bg-emerald-500" label="Approvals" />
              </div>
            </div>
            {/* Margins increased to top: 30 to prevent label clipping */}
            <div className="h-[220px] bg-slate-50/50 rounded-2xl p-4 border border-slate-100 shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weeklyData} margin={{ top: 30, right: 10, left: -30, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="2 2" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="week" axisLine={false} tickLine={false} tick={{fontSize: 8, fontWeight: 900, fill: '#94a3b8'}} />
                  <YAxis axisLine={false} tickLine={false} tick={{fontSize: 8, fill: '#94a3b8'}} />
                  <Bar dataKey="Starts" fill="#f59e0b" radius={[2, 2, 0, 0]}>
                    <LabelList dataKey="Starts" position="top" style={{ fill: '#f59e0b', fontSize: 9, fontWeight: 900 }} />
                  </Bar>
                  <Bar dataKey="Activity" fill="#0d9488" radius={[2, 2, 0, 0]}>
                    <LabelList dataKey="Activity" position="top" style={{ fill: '#0d9488', fontSize: 9, fontWeight: 900 }} />
                  </Bar>
                  <Bar dataKey="Approvals" fill="#10b981" radius={[2, 2, 0, 0]}>
                    <LabelList dataKey="Approvals" position="top" style={{ fill: '#10b981', fontSize: 9, fontWeight: 900 }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="flex flex-col gap-4 shrink-0">
            <h3 className="text-[10px] font-[1000] text-slate-800 uppercase tracking-widest border-l-4 border-indigo-500 pl-4">Discipline Comments Status</h3>
            {/* Margins increased on right: 50 to prevent label clipping */}
            <div className="h-[220px] bg-slate-50/50 rounded-2xl p-4 border border-slate-100">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={disciplineMainData} layout="vertical" margin={{ top: 20, right: 50, left: 10, bottom: 0 }}>
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} width={100} tick={{fontSize: 8, fontWeight: 900, fill: '#64748b'}} />
                  <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '8px' }} />
                  <Legend verticalAlign="top" align="right" iconType="circle" wrapperStyle={{ fontSize: '8px', fontWeight: 900, textTransform: 'uppercase', paddingBottom: '10px' }} />
                  <Bar dataKey="openComments" name="Open Comments" fill="#ef4444" radius={[0, 2, 2, 0]} barSize={12}>
                    <LabelList dataKey="openComments" position="right" style={{ fill: '#ef4444', fontSize: 9, fontWeight: 900 }} />
                  </Bar>
                  <Bar dataKey="totalComments" name="Total Comments" fill="#94a3b8" radius={[0, 2, 2, 0]} barSize={12}>
                    <LabelList dataKey="totalComments" position="right" style={{ fill: '#64748b', fontSize: 9, fontWeight: 900 }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </ReportPage>

      {/* --- PAGE 2: DISCIPLINE HEALTH --- */}
      <ReportPage pageNumber={2} totalPages={totalPages} projectName={project.name}>
        <div className="flex flex-col gap-6">
          <div className="flex items-center justify-between border-l-4 border-emerald-500 pl-4">
            <h3 className="text-[10px] font-[1000] text-slate-800 uppercase tracking-widest">Health Snapshot</h3>
            <div className="flex gap-3">
              {HEALTH_LABELS.map((l, i) => <LegendItem key={l} color={`bg-[${HEALTH_COLORS[i]}]`} label={l} />)}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 shrink-0">
            {derivedDisciplines.map(disc => {
              const discDrawings = drawings.filter(d => d.discipline.trim().toLowerCase() === disc.toLowerCase());
              const pieData = [
                { name: 'Approved', value: discDrawings.filter(d => d.status === 'Approved').length },
                { name: 'Reviewing', value: discDrawings.filter(d => d.status === 'Reviewing').length },
                { name: 'Waiting Reply', value: discDrawings.filter(d => d.status === 'Waiting Reply').length },
                { name: 'Pending', value: discDrawings.filter(d => d.status === 'Pending').length },
              ].filter(p => p.value > 0);
              return (
                <div key={disc} className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex items-center gap-4 shadow-sm group">
                  <div className="flex-1 min-w-0">
                    <div className="text-[10px] font-[1000] text-slate-900 uppercase mb-2 tracking-widest border-b border-slate-200 pb-2 truncate">{disc}</div>
                    <div className="space-y-1">
                      {HEALTH_LABELS.map((label) => {
                        const count = discDrawings.filter(d => d.status === (label as any)).length;
                        return (
                          <div key={label} className="flex items-center justify-between text-[8px] font-black uppercase tracking-tight">
                            <span className="text-slate-400">{label}</span>
                            <span className={count > 0 ? 'text-slate-800' : 'text-slate-200'}>{count}</span>
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
                          label={({ value }) => value}
                          labelLine={false}
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

          {showSnapshotList && snapshots.length > 0 && (
            <div className="mt-4 no-print shrink-0">
               <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-2 border-l-2 border-indigo-400 pl-2">Capture Registry</div>
               <div className="grid grid-cols-4 gap-2">
                  {snapshots.slice().reverse().map((s) => (
                    <div key={s.id} className="bg-slate-50 border border-slate-200 p-2 rounded-lg flex items-center justify-between">
                      <div className="flex flex-col">
                        <span className="text-[8px] font-black text-slate-700 uppercase leading-none">{format(new Date(s.timestamp), 'MM-dd')}</span>
                        <span className="text-[7px] font-mono text-slate-300 mt-0.5">{format(new Date(s.timestamp), 'HH:mm')}</span>
                      </div>
                      <button onClick={() => window.confirm('Delete snapshot?') && deleteSnapshot(activeProjectId!, s.id)} className="p-1 text-slate-200 hover:text-red-500 transition-all"><Trash2 size={10}/></button>
                    </div>
                  ))}
               </div>
            </div>
          )}
        </div>
      </ReportPage>

      {/* --- PAGE 3+: TREND ANALYSIS --- */}
      {Array.from({ length: Math.ceil(historicalTrends.length / 2) }).map((_, pageIdx) => (
        <ReportPage 
          key={pageIdx} 
          pageNumber={3 + pageIdx} 
          totalPages={totalPages} 
          projectName={project.name}
        >
          <div className="flex flex-col gap-10">
            <div className="flex items-center justify-between border-l-4 border-indigo-600 pl-4">
              <h3 className="text-[10px] font-[1000] text-slate-800 uppercase tracking-widest">Progress Trends</h3>
              <div className="flex gap-4">
                 <LegendItem color="bg-emerald-500" label="Approved" />
                 <LegendItem color="bg-amber-500" label="Reviewing" />
                 <LegendItem color="bg-blue-500" label="Waiting" />
                 <LegendItem color="bg-red-500" label="Open Cmts" />
              </div>
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
                      <AreaChart data={trend.trendData} margin={{ top: 10, right: 10, left: -30, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                        <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fontSize: 8, fontWeight: 900, fill: '#94a3b8'}} />
                        <YAxis axisLine={false} tickLine={false} tick={{fontSize: 8, fontWeight: 900, fill: '#94a3b8'}} />
                        <Area type="monotone" dataKey="approvedCount" stroke="#10b981" strokeWidth={2} fill="#10b981" fillOpacity={0.05} />
                        <Area type="monotone" dataKey="reviewingCount" stroke="#f59e0b" strokeWidth={2} fill="#f59e0b" fillOpacity={0.1} />
                        <Area type="monotone" dataKey="waitingReplyCount" stroke="#3b82f6" strokeWidth={2} fill="#3b82f6" fillOpacity={0.05} />
                        <Area type="monotone" dataKey="openComments" stroke="#ef4444" strokeWidth={1} strokeDasharray="4 4" fill="transparent" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </ReportPage>
      ))}
    </div>
  );
};

import React, { useState, useMemo } from 'react';
import { useStore } from '../store';
import { format, subDays, startOfDay, endOfDay, parseISO, eachWeekOfInterval, endOfWeek } from 'date-fns';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area, Legend, LabelList
} from 'recharts';
import { Printer, Calendar as CalendarIcon, Filter, TrendingUp, CheckCircle, Search, Hash, Clock, MessageSquare } from 'lucide-react';

// --- 复用 Intelligence 页面的颜色系统 ---
const HEALTH_COLORS = ['#10b981', '#eab308', '#3b82f6', '#94a3b8'];
const HEALTH_LABELS = ['Approved', 'Reviewing', 'Waiting Reply', 'Pending'];

// --- 日期区间过滤 ---
const isWithinInterval = (date: Date, interval: { start: Date; end: Date }) => {
  if (!date || !interval?.start || !interval?.end) return false;
  const t = date.getTime();
  return t >= interval.start.getTime() && t <= interval.end.getTime();
};

// --- A4 版面组件（同 Intelligence） ---
const PageHeader: React.FC<{ projectName: string; reportTitle?: string }> = ({ projectName, reportTitle }) => (
  <div className="border-b-2 border-slate-900 pb-5 mb-8 flex justify-between items-end shrink-0">
    <div className="flex items-center gap-5">
      <div className="bg-white p-1 rounded-lg shadow-sm border border-slate-100 overflow-hidden shrink-0">
        <img
          src="https://i.postimg.cc/7LVr6n5m/PG-Logo.jpg"
          alt="PG SHIPMANAGEMENT PTE. LTD. Logo"
          className="h-10 w-auto object-contain"
        />
      </div>
      <div>
        <div className="text-[9px] font-[1000] text-teal-600 uppercase tracking-[0.2em] mb-0.5">PG SHIPMANAGEMENT</div>
        <h1 className="text-2xl font-[1000] text-slate-900 uppercase tracking-tighter leading-none">{reportTitle || 'Activity Report'}</h1>
        <p className="text-slate-400 text-[9px] font-bold uppercase tracking-[0.2em] mt-2">Project Registry: {projectName}</p>
      </div>
    </div>
    <div className="text-right">
      <div className="text-[8px] font-black uppercase text-slate-400 mb-1 tracking-widest">Report Reference</div>
      <div className="text-[10px] font-black text-slate-900">{format(new Date(), 'yyyyMMdd-HHmm')}</div>
    </div>
  </div>
);

const PageFooter: React.FC<{ pageNumber: number; totalPages: number; projectName: string }> = ({ pageNumber, totalPages, projectName }) => (
  <div className="mt-auto pt-6 border-t border-slate-100 flex justify-between items-center relative shrink-0">
    <div className="text-[7px] font-black text-slate-300 uppercase tracking-[0.4em]">
      {projectName} • ACTIVITY REPORT • INTERNAL USE ONLY
    </div>
    <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest">
      Page {pageNumber} of {totalPages}
    </div>
  </div>
);

const ReportPage: React.FC<{ children: React.ReactNode; pageNumber: number; totalPages: number; projectName: string }> = ({ children, pageNumber, totalPages, projectName }) => (
  <div className="mx-auto my-8 bg-white w-[210mm] h-[297mm] shadow-[0_0_50px_-12px_rgba(0,0,0,0.12)] border border-slate-200 p-[15mm] flex flex-col relative box-border break-after-page print:m-0 print:border-none print:shadow-none mb-12 shrink-0">
    <PageHeader projectName={projectName} />
    <div className="flex-1 flex flex-col overflow-hidden min-h-0 print:overflow-visible print:h-auto print:flex-none print:block">
      {children}
    </div>
    <PageFooter pageNumber={pageNumber} totalPages={totalPages} projectName={projectName} />
  </div>
);

const StatCard: React.FC<{ label: string; value: string | number; icon: React.ReactNode; color: string }> = ({ label, value, icon, color }) => {
  const styles: any = {
    blue: 'bg-blue-50/50 text-blue-700 border-blue-100',
    emerald: 'bg-emerald-50/50 text-emerald-700 border-emerald-100',
    amber: 'bg-amber-50/50 text-amber-700 border-amber-100',
    slate: 'bg-slate-50/50 text-slate-700 border-slate-100',
    indigo: 'bg-indigo-50/50 text-indigo-700 border-indigo-100',
    purple: 'bg-purple-50/50 text-purple-700 border-purple-100',
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

const MiniMetric: React.FC<{ label: string; value: string | number; color: string }> = ({ label, value, color }) => (
  <div className="text-center">
    <div className="text-[7px] font-black uppercase tracking-widest mb-0.5 opacity-40">{label}</div>
    <div className={`text-[11px] font-[1000] ${color}`}>{value}</div>
  </div>
);

const LegendItem: React.FC<{ color: string; label: string }> = ({ color, label }) => (
  <div className="flex items-center gap-1.5">
    <div className={`w-2 h-2 rounded-full`} style={{ backgroundColor: color }} />
    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{label}</span>
  </div>
);

// --- 主组件 ---
export const ActivityReport: React.FC = () => {
  const { data, activeProjectId } = useStore();
  const activeProject = data.projects.find(p => p.id === activeProjectId);

  const [timeRange, setTimeRange] = useState<number>(14);
  const [customRange, setCustomRange] = useState<{ start: string; end: string } | null>(null);

  if (!activeProject) return <div className="p-20 text-center text-slate-400 font-black uppercase tracking-widest">Select a project to view reports.</div>;

  const drawings = activeProject.drawings;
  const projectName = activeProject.name;

  // --- 时间范围计算 ---
  const now = new Date();
  const rangeEnd = customRange?.end ? endOfDay(parseISO(customRange.end)) : endOfDay(now);
  const rangeStart = customRange?.start ? startOfDay(parseISO(customRange.start)) : startOfDay(subDays(now, timeRange - 1));
  const interval = { start: rangeStart, end: rangeEnd };
  const rangeLabel = `${format(rangeStart, 'yyyy/MM/dd')} – ${format(rangeEnd, 'yyyy/MM/dd')}`;

  // --- Discipline 列表 ---
  const derivedDisciplines = useMemo(() => {
    return Array.from(new Set(drawings.map(d => d.discipline.trim().split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ')))).filter(Boolean).sort();
  }, [drawings]);

  // --- 全局统计 ---
  const stats = useMemo(() => {
    const total = drawings.length;
    const pending = drawings.filter(d => d.status === 'Pending').length;
    const reviewing = drawings.filter(d => d.status === 'Reviewing').length;
    const waiting = drawings.filter(d => d.status === 'Waiting Reply').length;
    const approved = drawings.filter(d => d.status === 'Approved').length;
    const totalComments = drawings.reduce((a, d) => a + (d.manualCommentsCount || 0), 0);
    const openComments = drawings.reduce((a, d) => a + (d.manualOpenCommentsCount || 0), 0);
    const issued = total - pending;
    const completion = total > 0 ? Math.round((approved / total) * 100) : 0;
    return { total, pending, reviewing, waiting, approved, totalComments, openComments, issued, completion };
  }, [drawings]);

  // --- 从 statusHistory 聚合事件 ---
  const eventData = useMemo(() => {
    const events: Array<{
      dateStr: string; dateObj: Date; type: string; toStatus: string | null; discipline: string;
    }> = [];

    drawings.forEach(drawing => {
      (drawing.statusHistory || []).forEach(h => {
        const d = parseISO(h.createdAt);
        if (isWithinInterval(d, interval)) {
          let type = 'Other', toStatus: string | null = null;
          if (h.content.includes('Status:')) {
            type = 'Status';
            const m = h.content.match(/Status: .* -> (.*)/);
            if (m) toStatus = m[1].trim();
          } else if (h.content.includes('Comments:')) type = 'Comment';
          else if (h.content.includes('Round:')) type = 'Round';
          events.push({ dateStr: format(d, 'MM/dd'), dateObj: d, type, toStatus, discipline: drawing.discipline });
        }
      });
    });

    // 按天聚合
    const daysMap = new Map<string, any>();
    let cur = new Date(rangeStart);
    while (cur <= rangeEnd) {
      daysMap.set(format(cur, 'MM/dd'), { date: format(cur, 'MM/dd'), 'To Reviewing': 0, 'To Waiting': 0, 'To Approved': 0, 'Other': 0, total: 0 });
      cur.setDate(cur.getDate() + 1);
    }

    const flow = { reviewing: 0, waiting: 0, approved: 0 };
    const discStats = new Map<string, number>();
    // 按 discipline 的 transition 明细
    const discTransitions = new Map<string, { toReview: number; toWaiting: number; toApproved: number }>();

    events.forEach(ev => {
      const day = daysMap.get(ev.dateStr);
      if (day) {
        day.total += 1;
        if (ev.type === 'Status' && ev.toStatus) {
          if (ev.toStatus.includes('Review')) { day['To Reviewing'] += 1; flow.reviewing += 1; }
          else if (ev.toStatus.includes('Waiting')) { day['To Waiting'] += 1; flow.waiting += 1; }
          else if (ev.toStatus === 'Approved') { day['To Approved'] += 1; flow.approved += 1; }
          else day['Other'] += 1;

          // Discipline transition
          const dt = discTransitions.get(ev.discipline) || { toReview: 0, toWaiting: 0, toApproved: 0 };
          if (ev.toStatus.includes('Review')) dt.toReview += 1;
          else if (ev.toStatus.includes('Waiting')) dt.toWaiting += 1;
          else if (ev.toStatus === 'Approved') dt.toApproved += 1;
          discTransitions.set(ev.discipline, dt);
        } else {
          day['Other'] += 1;
        }
      }
      discStats.set(ev.discipline, (discStats.get(ev.discipline) || 0) + 1);
    });

    const timeline = Array.from(daysMap.values());
    const disciplineRank = Array.from(discStats.entries()).map(([n, v]) => ({ name: n, value: v })).sort((a, b) => b.value - a.value).slice(0, 10);
    const transitionTable = Array.from(discTransitions.entries()).map(([name, dt]) => ({ name, ...dt })).filter(r => r.toReview > 0 || r.toWaiting > 0 || r.toApproved > 0);

    return { timeline, flow, disciplineRank, transitionTable, totalEvents: events.length };
  }, [drawings, rangeStart, rangeEnd]);

  // --- Comments 数据 ---
  const disciplineMainData = useMemo(() => {
    const map = new Map<string, { name: string; totalComments: number; openComments: number }>();
    drawings.forEach(d => {
      const disc = d.discipline.trim().split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
      const e = map.get(disc) || { name: disc, totalComments: 0, openComments: 0 };
      e.totalComments += (d.manualCommentsCount || 0);
      e.openComments += (d.manualOpenCommentsCount || 0);
      map.set(disc, e);
    });
    return Array.from(map.values());
  }, [drawings]);

  // --- 逾期图纸 ---
  const staleDrawings = useMemo(() => {
    return drawings
      .filter(d => d.status !== 'Pending' && d.status !== 'Approved')
      .filter(d => {
        let last = now;
        if (d.statusHistory?.length) last = new Date(d.statusHistory[d.statusHistory.length - 1].createdAt);
        return Math.floor((now.getTime() - last.getTime()) / 86400000) > 14;
      })
      .sort((a, b) => {
        const aD = a.statusHistory?.length ? new Date(a.statusHistory[a.statusHistory.length - 1].createdAt).getTime() : now.getTime();
        const bD = b.statusHistory?.length ? new Date(b.statusHistory[b.statusHistory.length - 1].createdAt).getTime() : now.getTime();
        return aD - bD;
      })
      .slice(0, 15);
  }, [drawings]);

  // --- 各 discipline 的每周活跃度趋势 ---
  const weeklyTrends = useMemo(() => {
    const weeks = eachWeekOfInterval({ start: rangeStart, end: rangeEnd }, { weekStartsOn: 1 });
    return derivedDisciplines.map(disc => {
      const discDrawings = drawings.filter(d => d.discipline.trim().toLowerCase() === disc.toLowerCase());
      
      const weekData = weeks.map(weekStart => {
        const weekEnd2 = endOfWeek(weekStart, { weekStartsOn: 1 });
        
        // 我们需要计算截至 `weekEnd2` 时，这个专业下图纸的状态分布和 open comments 数量
        let approved = 0;
        let reviewing = 0;
        let waiting = 0;
        let openCmt = 0;

        discDrawings.forEach(d => {
          // 寻找该图纸在 weekEnd2 及之前的最后一条状态记录
          const historyBeforeOrAtEnd = (d.statusHistory || [])
            .filter(h => parseISO(h.createdAt).getTime() <= weekEnd2.getTime())
            .sort((a, b) => parseISO(a.createdAt).getTime() - parseISO(b.createdAt).getTime());

          let currentStatusAtTime = 'Pending';
          let currentOpenCmtAtTime = 0;

          historyBeforeOrAtEnd.forEach(h => {
             if (h.content.includes('Status:')) {
               const m = h.content.match(/Status: .* -> (.*)/);
               if (m) currentStatusAtTime = m[1].trim();
             }
             if (h.content.includes('Comments:')) {
               // 解析出 "X open" 或者是我们简单的回放 manualOpenCommentsCount
               // 因为早期可能没有记录准确数字，我们从历史提取
               const match = h.content.match(/(\d+) open/i);
               if (match) {
                 currentOpenCmtAtTime = parseInt(match[1], 10);
               } else if (h.content.includes('resolved') || h.content.includes('Closed')) {
                 currentOpenCmtAtTime = Math.max(0, currentOpenCmtAtTime - 1);
               } else {
                 currentOpenCmtAtTime += 1;
               }
             }
          });

          if (currentStatusAtTime === 'Approved') approved++;
          else if (currentStatusAtTime.includes('Review')) reviewing++;
          else if (currentStatusAtTime.includes('Waiting')) waiting++;
          
          openCmt += currentOpenCmtAtTime;
        });

        return { 
          date: format(weekStart, 'MM/dd'), 
          approvedCount: approved,
          reviewingCount: reviewing,
          waitingCount: waiting,
          openComments: openCmt
        };
      });

      // 当前状态
      const latestApproved = discDrawings.filter(d => d.status === 'Approved').length;
      const latestReviewing = discDrawings.filter(d => d.status === 'Reviewing').length;
      const latestWaiting = discDrawings.filter(d => d.status === 'Waiting Reply').length;
      const latestOpen = discDrawings.reduce((a, d) => a + (d.manualOpenCommentsCount || 0), 0);

      // 通过修正最后一周的数据为当前最新的精确值，防止回放误差
      if (weekData.length > 0) {
         weekData[weekData.length - 1].approvedCount = latestApproved;
         weekData[weekData.length - 1].reviewingCount = latestReviewing;
         weekData[weekData.length - 1].waitingCount = latestWaiting;
         // weekData[weekData.length - 1].openComments = latestOpen; // Comment this out if historic is preferred over actual
      }

      return { discipline: disc, weekData, latest: { approved: latestApproved, reviewing: latestReviewing, waiting: latestWaiting, openComments: latestOpen } };
    });
  }, [drawings, derivedDisciplines, rangeStart, rangeEnd]);

  // --- 状态分布饼图数据 ---
  const statusPieData = [
    { name: 'Approved', value: stats.approved },
    { name: 'Reviewing', value: stats.reviewing },
    { name: 'Waiting Reply', value: stats.waiting },
    { name: 'Pending', value: stats.pending },
  ].filter(p => p.value > 0);

  // --- 进度面积图：按周汇总 Issued vs Approved ---
  const progressData = useMemo(() => {
    const weeks = eachWeekOfInterval({ start: rangeStart, end: rangeEnd }, { weekStartsOn: 1 });
    return weeks.map(weekStart => {
      const wEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
      const wInterval = { start: weekStart, end: wEnd };
      let newIssued = 0, newApproved = 0;
      drawings.forEach(d => {
        (d.statusHistory || []).forEach(h => {
          const hd = parseISO(h.createdAt);
          if (isWithinInterval(hd, wInterval) && h.content.includes('Status:')) {
            const m = h.content.match(/Status: .* -> (.*)/);
            if (m) {
              if (m[1].trim().includes('Review')) newIssued++;
              if (m[1].trim() === 'Approved') newApproved++;
            }
          }
        });
      });
      return { date: format(weekStart, 'MM/dd'), 'Issued': newIssued, 'Approved': newApproved };
    });
  }, [drawings, rangeStart, rangeEnd]);

  // --- 页数计算 ---
  const healthPages = Math.ceil(derivedDisciplines.length / 8);
  const trendPages = Math.ceil(weeklyTrends.length / 2);
  const totalPages = 3 + healthPages + trendPages;

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* ===== 设置控制栏（不打印） ===== */}
      <div className="no-print px-6 py-4 bg-white border-b border-slate-200 shrink-0">
        <div className="max-w-[210mm] mx-auto">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            {/* 左：标题 + Logo */}
            <div className="flex items-center gap-4">
              <div className="bg-white p-1 rounded-lg shadow-sm border border-slate-100 overflow-hidden">
                <img src="https://i.postimg.cc/7LVr6n5m/PG-Logo.jpg" alt="Logo" className="h-8 w-auto object-contain" />
              </div>
              <div>
                <h2 className="text-lg font-[1000] text-slate-800 uppercase tracking-tight flex items-center gap-2">
                  <TrendingUp className="text-teal-600" size={18} />
                  Activity Report
                </h2>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  {projectName} • {rangeLabel}
                </p>
              </div>
            </div>

            {/* 右：设置面板 */}
            <div className="flex flex-wrap items-center gap-3">
              {/* 预设时间 */}
              <div className="flex items-center bg-slate-100 rounded-xl p-1 border border-slate-200">
                {[7, 14, 30, 60].map(days => (
                  <button key={days} onClick={() => { setTimeRange(days); setCustomRange(null); }}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${timeRange === days && !customRange ? 'bg-white text-teal-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                  >{days}D</button>
                ))}
              </div>

              {/* 自定义范围 */}
              {customRange ? (
                <div className="flex items-center gap-2 bg-indigo-50 rounded-xl px-3 py-1.5 border border-indigo-200">
                  <CalendarIcon size={14} className="text-indigo-500" />
                  <input type="date" value={customRange.start} onChange={(e) => setCustomRange({ ...customRange, start: e.target.value })}
                    className="bg-transparent text-xs font-bold text-indigo-900 focus:outline-none w-28" />
                  <span className="text-slate-400">→</span>
                  <input type="date" value={customRange.end} onChange={(e) => setCustomRange({ ...customRange, end: e.target.value })}
                    className="bg-transparent text-xs font-bold text-indigo-900 focus:outline-none w-28" />
                  <button onClick={() => setCustomRange(null)} className="text-xs font-black text-indigo-400 hover:text-indigo-700 ml-1">✕</button>
                </div>
              ) : (
                <button onClick={() => setCustomRange({ start: format(rangeStart, 'yyyy-MM-dd'), end: format(rangeEnd, 'yyyy-MM-dd') })}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 transition-all">
                  <CalendarIcon size={14} /> Custom
                </button>
              )}

              {/* 打印按钮 */}
              <button onClick={() => window.print()}
                className="flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-black text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all shadow-lg active:scale-95">
                <Printer size={14} /> Print / Export
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ===== A4 报告内容（可滚动 + 可打印） ===== */}
      <div className="flex-1 overflow-y-auto bg-slate-100 print:bg-white print:overflow-visible">

        {/* ===== PAGE 1: DASHBOARD ===== */}
        <ReportPage pageNumber={1} totalPages={totalPages} projectName={projectName}>
          <div className="flex flex-col gap-6">
            {/* 时间范围标签 */}
            <div className="bg-teal-50 border border-teal-200 rounded-xl px-4 py-2 flex items-center justify-between">
              <span className="text-[9px] font-black text-teal-700 uppercase tracking-widest">Report Period</span>
              <span className="text-[10px] font-bold text-teal-900">{rangeLabel}</span>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-3 gap-3">
              <StatCard label="Total Drawings" value={stats.total} icon={<Hash size={14} className="text-slate-500" />} color="slate" />
              <StatCard label="Issued for Review" value={stats.issued} icon={<Search size={14} className="text-blue-500" />} color="blue" />
              <StatCard label="Approved" value={`${stats.approved} (${stats.completion}%)`} icon={<CheckCircle size={14} className="text-emerald-500" />} color="emerald" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <StatCard label="Events in Period" value={eventData.totalEvents} icon={<TrendingUp size={14} className="text-indigo-500" />} color="indigo" />
              <StatCard label="Open Comments" value={stats.openComments} icon={<MessageSquare size={14} className="text-amber-500" />} color="amber" />
              <StatCard label="Stale (>14d)" value={staleDrawings.length} icon={<Clock size={14} className="text-purple-500" />} color="purple" />
            </div>

            {/* 状态分布饼图 + 进度面积图 */}
            <div className="grid grid-cols-5 gap-4">
              {/* 饼图 */}
              <div className="col-span-2 bg-slate-50 rounded-2xl border border-slate-100 p-4 flex flex-col items-center">
                <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-2 self-start">Current Status Distribution</div>
                <div className="h-[150px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={statusPieData} cx="50%" cy="50%" innerRadius={35} outerRadius={55} paddingAngle={2} dataKey="value" stroke="none">
                        {statusPieData.map((p, i) => <Cell key={i} fill={HEALTH_COLORS[HEALTH_LABELS.indexOf(p.name)]} />)}
                      </Pie>
                      <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '10px', fontWeight: 700 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex gap-3 mt-2">
                  {HEALTH_LABELS.map((l, i) => <LegendItem key={l} color={HEALTH_COLORS[i]} label={l} />)}
                </div>
              </div>

              {/* 面积图 */}
              <div className="col-span-3 bg-slate-50 rounded-2xl border border-slate-100 p-4 flex flex-col">
                <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-2">Weekly: Submitted vs Approved</div>
                <div className="flex-1 min-h-0 h-[180px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={progressData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="actIssued" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="actApproved" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 8, fontWeight: 900, fill: '#94a3b8' }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 8, fontWeight: 900, fill: '#94a3b8' }} />
                      <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '10px', fontWeight: 700 }} />
                      <Area type="monotone" dataKey="Issued" stroke="#3b82f6" strokeWidth={2} fill="url(#actIssued)" />
                      <Area type="monotone" dataKey="Approved" stroke="#10b981" strokeWidth={2} fill="url(#actApproved)" />
                      <Legend iconType="circle" wrapperStyle={{ fontSize: '9px', fontWeight: 900, textTransform: 'uppercase' }} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>
        </ReportPage>

        {/* ===== PAGE 2: PERIOD ACTIVITIES ===== */}
        <ReportPage pageNumber={2} totalPages={totalPages} projectName={projectName}>
          <div className="flex flex-col gap-5">
            <div className="flex items-center justify-between border-l-4 border-teal-500 pl-4">
              <h3 className="text-[10px] font-[1000] text-slate-800 uppercase tracking-widest">Period Activities</h3>
              <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">{rangeLabel}</span>
            </div>

            {/* Transition 表格 */}
            {eventData.transitionTable.length > 0 && (
              <div className="bg-white rounded-xl border border-indigo-100 overflow-hidden shadow-sm">
                <div className="px-4 py-2 bg-indigo-50/50 border-b border-indigo-100">
                  <span className="text-[9px] font-black text-indigo-700 uppercase tracking-widest">Status Transitions by Discipline</span>
                </div>
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="px-4 py-2 text-left text-[8px] font-black text-slate-500 uppercase tracking-wider">Discipline</th>
                      <th className="px-4 py-2 text-center text-[8px] font-black text-amber-600 uppercase tracking-wider">→ Reviewing</th>
                      <th className="px-4 py-2 text-center text-[8px] font-black text-blue-600 uppercase tracking-wider">→ Waiting</th>
                      <th className="px-4 py-2 text-center text-[8px] font-black text-emerald-600 uppercase tracking-wider">→ Approved</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {eventData.transitionTable.map(r => (
                      <tr key={r.name}>
                        <td className="px-4 py-1.5 text-[9px] font-bold text-slate-700">{r.name}</td>
                        <td className="px-4 py-1.5 text-center">{r.toReview > 0 ? <span className="px-2 py-0.5 rounded text-[9px] font-black bg-amber-100 text-amber-700">+{r.toReview}</span> : <span className="text-[9px] text-slate-300">-</span>}</td>
                        <td className="px-4 py-1.5 text-center">{r.toWaiting > 0 ? <span className="px-2 py-0.5 rounded text-[9px] font-black bg-blue-100 text-blue-700">+{r.toWaiting}</span> : <span className="text-[9px] text-slate-300">-</span>}</td>
                        <td className="px-4 py-1.5 text-center">{r.toApproved > 0 ? <span className="px-2 py-0.5 rounded text-[9px] font-black bg-emerald-100 text-emerald-700">+{r.toApproved}</span> : <span className="text-[9px] text-slate-300">-</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* 柱状图 */}
            <div className="flex flex-col gap-2">
              <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest px-4">Daily Status Transitions</span>
              <div className="h-[200px] bg-slate-50/50 rounded-2xl p-4 border border-slate-100 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={eventData.timeline} margin={{ top: 20, right: 10, left: -30, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="2 2" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 8, fontWeight: 900, fill: '#94a3b8' }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 8, fill: '#94a3b8' }} />
                    <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '10px', fontWeight: 700 }} cursor={{ fill: '#f8fafc' }} />
                    <Bar dataKey="To Reviewing" stackId="a" fill="#eab308" radius={[0, 0, 2, 2]} maxBarSize={30} />
                    <Bar dataKey="To Waiting" stackId="a" fill="#3b82f6" maxBarSize={30} />
                    <Bar dataKey="To Approved" stackId="a" fill="#10b981" maxBarSize={30} />
                    <Bar dataKey="Other" stackId="a" fill="#cbd5e1" radius={[2, 2, 0, 0]} maxBarSize={30} />
                    <Legend verticalAlign="top" height={30} iconType="circle" wrapperStyle={{ fontSize: '8px', fontWeight: 900, textTransform: 'uppercase' }} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Workload Hotspots */}
            <div className="bg-slate-50 rounded-2xl border border-slate-200 p-4 shadow-sm shrink-0">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-[9px] font-[1000] text-slate-800 uppercase tracking-widest">Most Active Disciplines</h3>
                <span className="text-[7px] font-bold text-slate-400 uppercase tracking-wider">By Event Count in Period</span>
              </div>
              <div className="grid grid-cols-3 gap-4">
                {eventData.disciplineRank.slice(0, 9).map((disc, idx) => (
                  <div key={disc.name} className="flex items-center gap-2">
                    <div className={`w-5 h-5 rounded-md flex items-center justify-center text-[7px] font-black shrink-0 ${idx === 0 ? 'bg-red-500 text-white' : idx === 1 ? 'bg-orange-400 text-white' : idx === 2 ? 'bg-amber-400 text-white' : 'bg-slate-200 text-slate-600'}`}>{idx + 1}</div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[7px] font-black text-slate-700 uppercase truncate">{disc.name}</div>
                      <div className="flex items-center gap-1 mt-0.5">
                        <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-teal-500 to-cyan-400 rounded-full" style={{ width: `${(disc.value / Math.max(eventData.disciplineRank[0]?.value || 1, 1)) * 100}%` }} />
                        </div>
                        <span className="text-[7px] font-black text-teal-600 w-6 text-right">{disc.value}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </ReportPage>

        {/* ===== PAGE 3: COMMENTS + STALE ===== */}
        <ReportPage pageNumber={3} totalPages={totalPages} projectName={projectName}>
          <div className="flex flex-col gap-6">
            {/* Discipline Comments 条形图 */}
            <div className="flex flex-col gap-4 shrink-0">
              <h3 className="text-[10px] font-[1000] text-slate-800 uppercase tracking-widest border-l-4 border-indigo-500 pl-4">Discipline Comments Status</h3>
              <div className="h-[280px] bg-slate-50/50 rounded-2xl p-6 border border-slate-100">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={disciplineMainData} layout="vertical" margin={{ top: 0, right: 40, left: 10, bottom: 0 }} barGap={2}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                    <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#94a3b8', fontWeight: 600 }} />
                    <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} width={120} tick={{ fontSize: 9, fill: '#475569', fontWeight: 800 }} />
                    <Tooltip cursor={{ fill: '#f1f5f9', radius: 4 }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0/0.1)', padding: '10px' }} itemStyle={{ fontSize: '10px', fontWeight: 700 }} />
                    <Legend verticalAlign="top" align="right" iconType="circle" wrapperStyle={{ fontSize: '9px', fontWeight: 900, textTransform: 'uppercase', paddingBottom: '15px' }} />
                    <Bar dataKey="totalComments" name="Total Comments" fill="#cbd5e1" radius={[0, 4, 4, 0]} barSize={10} />
                    <Bar dataKey="openComments" name="Open Comments" fill="#ef4444" radius={[0, 4, 4, 0]} barSize={10}>
                      <LabelList dataKey="openComments" position="right" style={{ fill: '#ef4444', fontSize: 9, fontWeight: 900 }} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Stale Drawings */}
            <div className="flex flex-col gap-3 shrink-0">
              <div className="flex items-center justify-between border-l-4 border-red-400 pl-4">
                <h3 className="text-[10px] font-[1000] text-slate-800 uppercase tracking-widest">Stale Drawings (&gt;14 Days)</h3>
                <span className="text-[8px] font-bold text-slate-400">{staleDrawings.length} items</span>
              </div>
              {staleDrawings.length > 0 ? (
                <div className="bg-white rounded-xl border border-red-100 overflow-hidden">
                  <table className="w-full">
                    <thead><tr className="bg-red-50/50 border-b border-red-100">
                      <th className="px-3 py-1.5 text-left text-[7px] font-black text-slate-500 uppercase">ID</th>
                      <th className="px-3 py-1.5 text-left text-[7px] font-black text-slate-500 uppercase">Drawing No</th>
                      <th className="px-3 py-1.5 text-left text-[7px] font-black text-slate-500 uppercase">Title</th>
                      <th className="px-3 py-1.5 text-center text-[7px] font-black text-slate-500 uppercase">Status</th>
                      <th className="px-3 py-1.5 text-center text-[7px] font-black text-slate-500 uppercase">Days Since</th>
                    </tr></thead>
                    <tbody className="divide-y divide-slate-50">
                      {staleDrawings.map(d => {
                        const last = d.statusHistory?.length ? new Date(d.statusHistory[d.statusHistory.length - 1].createdAt) : now;
                        const days = Math.floor((now.getTime() - last.getTime()) / 86400000);
                        return (
                          <tr key={d.id}>
                            <td className="px-3 py-1 text-[8px] font-bold text-slate-700">{d.customId}</td>
                            <td className="px-3 py-1 text-[8px] font-mono text-teal-700">{d.drawingNo}</td>
                            <td className="px-3 py-1 text-[8px] text-slate-600 truncate max-w-[200px]">{d.title}</td>
                            <td className="px-3 py-1 text-center"><span className={`px-1.5 py-0.5 rounded text-[7px] font-black uppercase ${d.status === 'Reviewing' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>{d.status}</span></td>
                            <td className="px-3 py-1 text-center text-[8px] font-black text-red-600">{days}d</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-center text-[9px] font-bold text-emerald-600 uppercase tracking-widest">All drawings are up to date ✓</div>
              )}
            </div>
          </div>
        </ReportPage>

        {/* ===== HEALTH PAGES ===== */}
        {Array.from({ length: healthPages }).map((_, hpIdx) => (
          <ReportPage key={`health-${hpIdx}`} pageNumber={4 + hpIdx} totalPages={totalPages} projectName={projectName}>
            <div className="flex flex-col gap-6">
              <div className="flex items-center justify-between border-l-4 border-emerald-500 pl-4">
                <h3 className="text-[10px] font-[1000] text-slate-800 uppercase tracking-widest">Health Snapshot {healthPages > 1 ? `(${hpIdx + 1}/${healthPages})` : ''}</h3>
                <div className="flex gap-3">
                  {HEALTH_LABELS.map((l, i) => <LegendItem key={l} color={HEALTH_COLORS[i]} label={l} />)}
                </div>
              </div>
              <div className="flex flex-wrap gap-4 shrink-0">
                {derivedDisciplines.slice(hpIdx * 8, hpIdx * 8 + 8).map(disc => {
                  const discDrawings = drawings.filter(d => d.discipline.trim().toLowerCase() === disc.toLowerCase());
                  const pieData = [
                    { name: 'Approved', value: discDrawings.filter(d => d.status === 'Approved').length },
                    { name: 'Reviewing', value: discDrawings.filter(d => d.status === 'Reviewing').length },
                    { name: 'Waiting Reply', value: discDrawings.filter(d => d.status === 'Waiting Reply').length },
                    { name: 'Pending', value: discDrawings.filter(d => d.status === 'Pending').length },
                  ].filter(p => p.value > 0);
                  return (
                    <div key={disc} className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex items-center justify-between gap-4 shadow-sm" style={{ width: 'calc((100% - 1rem) / 2)' }}>
                      <div className="flex-1 min-w-0">
                        <div className="text-[10px] font-[1000] text-slate-900 uppercase mb-2 tracking-widest border-b border-slate-200 pb-2 truncate">{disc}</div>
                        <div className="space-y-1">
                          {HEALTH_LABELS.map(label => {
                            const count = discDrawings.filter(d => d.status === (label as any)).length;
                            const cc = label === 'Approved' ? 'text-emerald-500' : label === 'Reviewing' ? 'text-amber-500' : label === 'Waiting Reply' ? 'text-blue-500' : 'text-slate-400';
                            return (
                              <div key={label} className="flex items-center justify-between text-[8px] font-black uppercase tracking-tight">
                                <span className={count > 0 ? 'text-slate-600' : 'text-slate-300'}>{label}</span>
                                <span className={count > 0 ? cc : 'text-slate-100'}>{count}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                      <div className="h-24 w-24 shrink-0 bg-white rounded-xl border border-slate-100 flex items-center justify-center">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart><Pie data={pieData} cx="50%" cy="50%" innerRadius={22} outerRadius={32} paddingAngle={2} dataKey="value" stroke="none">
                            {pieData.map((p, i) => <Cell key={i} fill={HEALTH_COLORS[HEALTH_LABELS.indexOf(p.name)]} />)}
                          </Pie></PieChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </ReportPage>
        ))}

        {/* ===== TREND PAGES ===== */}
        {Array.from({ length: trendPages }).map((_, tpIdx) => (
          <ReportPage key={`trend-${tpIdx}`} pageNumber={4 + healthPages + tpIdx} totalPages={totalPages} projectName={projectName}>
            <div className="flex flex-col gap-10">
              <div className="flex items-center justify-between border-l-4 border-indigo-600 pl-4">
                <h3 className="text-[10px] font-[1000] text-slate-800 uppercase tracking-widest">Activity Trends</h3>
              </div>
              <div className="flex flex-col gap-10">
                {weeklyTrends.slice(tpIdx * 2, tpIdx * 2 + 2).map(trend => (
                  <div key={trend.discipline} className="bg-white rounded-[2rem] border border-slate-200 p-6 flex flex-col gap-4 shadow-sm shrink-0">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="text-[11px] font-[1000] text-slate-900 uppercase tracking-widest">{trend.discipline} TREND</h4>
                        <p className="text-[8px] font-bold text-slate-300 uppercase mt-1">Weekly activity in report period</p>
                      </div>
                      <div className="flex gap-4 bg-slate-50 border border-slate-100 px-4 py-2 rounded-xl">
                        <MiniMetric label="Approved" value={trend.latest.approved} color="text-emerald-500" />
                        <MiniMetric label="Reviewing" value={trend.latest.reviewing} color="text-amber-500" />
                        <MiniMetric label="Waiting" value={trend.latest.waiting} color="text-blue-500" />
                        <MiniMetric label="Open Cmt" value={trend.latest.openComments} color="text-red-500" />
                      </div>
                    </div>
                    <div className="h-[200px] w-full bg-slate-50/20 rounded-2xl p-2 border border-slate-100/50 shrink-0">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={trend.weekData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                          <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 8, fontWeight: 900, fill: '#94a3b8' }} />
                          <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fontSize: 8, fontWeight: 900, fill: '#ef4444' }} />
                          <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fontSize: 8, fontWeight: 900, fill: '#64748b' }} />
                          <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0/0.1)', fontSize: '9px' }} itemStyle={{ padding: 0 }} />
                          <Area yAxisId="right" type="monotone" dataKey="approvedCount" name="Approved" stroke="#10b981" strokeWidth={2} fill="#10b981" fillOpacity={0.05} />
                          <Area yAxisId="right" type="monotone" dataKey="reviewingCount" name="Reviewing" stroke="#eab308" strokeWidth={2} fill="#eab308" fillOpacity={0.1} />
                          <Area yAxisId="right" type="monotone" dataKey="waitingCount" name="Waiting Reply" stroke="#3b82f6" strokeWidth={2} fill="#3b82f6" fillOpacity={0.05} />
                          <Area yAxisId="left" type="monotone" dataKey="openComments" name="Open Comments" stroke="#ef4444" strokeWidth={2} strokeDasharray="4 4" fill="transparent" />
                          <Legend iconType="circle" wrapperStyle={{ fontSize: '8px', fontWeight: 900, textTransform: 'uppercase' }} />
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
    </div>
  );
};

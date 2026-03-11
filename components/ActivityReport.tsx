import React, { useState, useMemo } from 'react';
import { useStore } from '../store';
import { format, subDays, isWithinInterval, startOfDay, endOfDay, parseISO } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';
import { Activity, Clock, Filter, Calendar as CalendarIcon, FilterX } from 'lucide-react';

export const ActivityReport: React.FC = () => {
    const { data, activeProjectId } = useStore();
    const activeProject = data.projects.find(p => p.id === activeProjectId);

    // --- State ---
    const [timeRange, setTimeRange] = useState<number>(14); // Default: Last 14 days
    const [customRange, setCustomRange] = useState<{ start: string; end: string } | null>(null);
    const [selectedDiscipline, setSelectedDiscipline] = useState<string>('All');

    // --- Data Processing Engine ---
    const reportData = useMemo(() => {
        if (!activeProject) return { timeline: [], flowSummary: {}, disciplineData: [], totalEvents: 0 };

        const now = new Date();
        const endDate = customRange?.end ? endOfDay(parseISO(customRange.end)) : endOfDay(now);
        const startDate = customRange?.start 
            ? startOfDay(parseISO(customRange.start)) 
            : startOfDay(subDays(now, timeRange - 1)); // -1 to include today

        const interval = { start: startDate, end: endDate };

        // 1. Raw Events List
        const events: Array<{
            dateStr: string;
            dateObj: Date;
            type: 'Status' | 'Comment' | 'Round' | 'Version' | 'Other';
            toStatus: string | null;
            discipline: string;
        }> = [];

        activeProject.drawings.forEach(drawing => {
            if (selectedDiscipline !== 'All' && drawing.discipline !== selectedDiscipline) return;

            (drawing.statusHistory || []).forEach(history => {
                const historyDate = parseISO(history.createdAt);
                if (isWithinInterval(historyDate, interval)) {
                    
                    let type: typeof events[0]['type'] = 'Other';
                    let toStatus: string | null = null;

                    if (history.content.includes('Status:')) {
                        type = 'Status';
                        const match = history.content.match(/Status: .* -> (.*)/);
                        if (match) toStatus = match[1].trim();
                    } else if (history.content.includes('Comments:')) {
                        type = 'Comment';
                    } else if (history.content.includes('Round:')) {
                        type = 'Round';
                    } else if (history.content.includes('Version:')) {
                        type = 'Version';
                    }

                    events.push({
                        dateStr: format(historyDate, 'MM/dd'),
                        dateObj: historyDate,
                        type,
                        toStatus,
                        discipline: drawing.discipline
                    });
                }
            });
        });

        // 2. Timeline Aggregation (Group by Date)
        // Ensure all days in range are present, even if empty
        const daysMap = new Map<string, any>();
        for (let i = 0; i <= (customRange ? 0 : timeRange - 1) /* fix later */; i++) {
            // A more robust way: generate dates from startDate to endDate
        }
        
        let currDate = new Date(startDate);
        while (currDate <= endDate) {
            daysMap.set(format(currDate, 'MM/dd'), {
                date: format(currDate, 'MM/dd'),
                'To Reviewing': 0,
                'To Waiting': 0,
                'To Approved': 0,
                'Other Events': 0,
                total: 0
            });
            currDate.setDate(currDate.getDate() + 1);
        }

        const flowSummary = { reviewing: 0, waiting: 0, approved: 0 };
        const disciplineStats = new Map<string, number>();

        events.forEach(event => {
            const dayEntry = daysMap.get(event.dateStr);
            if (dayEntry) {
                dayEntry.total += 1;
                
                if (event.type === 'Status' && event.toStatus) {
                    if (event.toStatus === 'Reviewing' || event.toStatus.includes('Review')) {
                        dayEntry['To Reviewing'] += 1;
                        flowSummary.reviewing += 1;
                    } else if (event.toStatus === 'Waiting Reply' || event.toStatus.includes('Waiting')) {
                        dayEntry['To Waiting'] += 1;
                        flowSummary.waiting += 1;
                    } else if (event.toStatus === 'Approved') {
                        dayEntry['To Approved'] += 1;
                        flowSummary.approved += 1;
                    } else {
                        dayEntry['Other Events'] += 1;
                    }
                } else {
                    dayEntry['Other Events'] += 1;
                }
            }

            // Discipline stats
            const currentDiscCount = disciplineStats.get(event.discipline) || 0;
            disciplineStats.set(event.discipline, currentDiscCount + 1);
        });

        const timeline = Array.from(daysMap.values());
        
        // Discipline breakdown sorting
        const disciplineData = Array.from(disciplineStats.entries())
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 10); // Top 10

        return {
            timeline,
            flowSummary,
            disciplineData,
            totalEvents: events.length
        };

    }, [activeProject, timeRange, customRange, selectedDiscipline]);


    if (!activeProject) return <div className="p-8 text-center text-slate-400">Loading...</div>;

    // Derived list of disciplines for the filter dropdown
    const disciplines = Array.from(new Set(activeProject.drawings.map(d => d.discipline))).sort();

    return (
        <div className="h-full flex flex-col bg-slate-50/50 overflow-hidden">
            {/* Header & Controls */}
            <div className="px-6 py-5 border-b border-slate-200 bg-white shrink-0">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
                            <Activity className="text-teal-600" size={20} />
                            Activity Analytics
                        </h2>
                        <p className="text-xs font-bold text-slate-500 mt-1 uppercase tracking-widest">
                            Real-time Event Tracking via Status History
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        {/* Discipline Filter */}
                        <div className="flex items-center gap-2 bg-slate-100 rounded-lg px-3 py-1.5 border border-slate-200">
                            <Filter size={14} className="text-slate-400" />
                            <select 
                                value={selectedDiscipline}
                                onChange={(e) => setSelectedDiscipline(e.target.value)}
                                className="bg-transparent text-sm font-bold text-slate-700 focus:outline-none"
                            >
                                <option value="All">All Disciplines</option>
                                {disciplines.map(d => <option key={d} value={d}>{d}</option>)}
                            </select>
                        </div>

                        {/* Preset Time Ranges */}
                        <div className="flex items-center bg-slate-100 rounded-lg p-1 border border-slate-200">
                            {[7, 14, 30].map(days => (
                                <button
                                    key={days}
                                    onClick={() => { setTimeRange(days); setCustomRange(null); }}
                                    className={`px-3 py-1 rounded-md text-xs font-black uppercase tracking-wider transition-all ${
                                        timeRange === days && !customRange
                                            ? 'bg-white text-teal-700 shadow-sm'
                                            : 'text-slate-500 hover:text-slate-800'
                                    }`}
                                >
                                    {days}d
                                </button>
                            ))}
                        </div>

                        {/* Custom Date Range (Simple toggle for now) */}
                        <button 
                            className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider border transition-all flex items-center gap-1.5 ${
                                customRange 
                                ? 'bg-indigo-50 border-indigo-200 text-indigo-700' 
                                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                            }`}
                            onClick={() => {
                                if (customRange) {
                                    setCustomRange(null);
                                } else {
                                    // Set a default custom range to today
                                    const today = format(new Date(), 'yyyy-MM-dd');
                                    setCustomRange({ start: today, end: today });
                                }
                            }}
                        >
                            <CalendarIcon size={14} />
                            Custom
                        </button>
                    </div>
                </div>

                {/* Custom Date Inputs */}
                {customRange && (
                    <div className="mt-4 p-3 bg-indigo-50/50 rounded-xl border border-indigo-100 flex items-center justify-end gap-3 animate-in slide-in-from-top-2">
                        <span className="text-xs font-black text-indigo-400 uppercase tracking-widest">Select Range:</span>
                        <input
                            type="date"
                            value={customRange.start}
                            onChange={(e) => setCustomRange({ ...customRange, start: e.target.value })}
                            className="text-sm font-bold px-3 py-1.5 rounded-md border border-indigo-200 text-indigo-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                        <span className="text-slate-400 font-bold">-</span>
                        <input
                            type="date"
                            value={customRange.end}
                            onChange={(e) => setCustomRange({ ...customRange, end: e.target.value })}
                            className="text-sm font-bold px-3 py-1.5 rounded-md border border-indigo-200 text-indigo-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                    </div>
                )}
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
                
                {/* Executive Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-center">
                        <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Total Events recorded</p>
                        <p className="text-3xl font-[1000] text-slate-800">{reportData.totalEvents}</p>
                        <p className="text-xs font-bold text-slate-400 mt-2">In selected time range</p>
                    </div>
                    
                    <div className="bg-gradient-to-br from-amber-50 to-orange-50 p-4 rounded-2xl border border-amber-200 shadow-sm flex flex-col justify-center">
                        <p className="text-[10px] font-black uppercase text-amber-600/70 tracking-widest mb-1">Moved to Reviewing</p>
                        <p className="text-3xl font-[1000] text-amber-700">{reportData.flowSummary.reviewing}</p>
                        <p className="text-xs font-bold text-amber-600/60 mt-2">Drawings submitted</p>
                    </div>

                    <div className="bg-gradient-to-br from-purple-50 to-fuchsia-50 p-4 rounded-2xl border border-purple-200 shadow-sm flex flex-col justify-center">
                        <p className="text-[10px] font-black uppercase text-purple-600/70 tracking-widest mb-1">Moved to Waiting</p>
                        <p className="text-3xl font-[1000] text-purple-700">{reportData.flowSummary.waiting}</p>
                        <p className="text-xs font-bold text-purple-600/60 mt-2">Requiring client action</p>
                    </div>

                    <div className="bg-gradient-to-br from-emerald-50 to-teal-50 p-4 rounded-2xl border border-emerald-200 shadow-sm flex flex-col justify-center">
                        <p className="text-[10px] font-black uppercase text-emerald-600/70 tracking-widest mb-1">Moved to Approved</p>
                        <p className="text-3xl font-[1000] text-emerald-700">{reportData.flowSummary.approved}</p>
                        <p className="text-xs font-bold text-emerald-600/60 mt-2">Successful completions</p>
                    </div>
                </div>

                {/* Main Charts Row */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    
                    {/* Activity Flow Timeline */}
                    <div className="lg:col-span-2 bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex flex-col h-[400px]">
                        <div className="mb-4 flex items-center justify-between">
                            <h3 className="text-sm font-black text-slate-700 uppercase tracking-widest">Daily Status Transitions</h3>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1"><Clock size={12}/> Event Count</span>
                        </div>
                        <div className="flex-1 w-full min-h-0">
                            {reportData.timeline.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={reportData.timeline} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                        <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} dy={10} />
                                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} />
                                        <Tooltip 
                                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontWeight: 700, fontSize: '12px' }}
                                            cursor={{ fill: '#f8fafc' }}
                                        />
                                        <Legend wrapperStyle={{ fontSize: '10px', fontWeight: 800, textTransform: 'uppercase' }} iconType="circle" />
                                        
                                        <Bar dataKey="To Reviewing" stackId="a" fill="#f59e0b" radius={[0, 0, 4, 4]} maxBarSize={40} />
                                        <Bar dataKey="To Waiting" stackId="a" fill="#a855f7" maxBarSize={40} />
                                        <Bar dataKey="To Approved" stackId="a" fill="#10b981" maxBarSize={40} />
                                        <Bar dataKey="Other Events" stackId="a" fill="#cbd5e1" radius={[4, 4, 0, 0]} maxBarSize={40} />
                                    </BarChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center text-slate-400">
                                    <FilterX size={32} className="opacity-20 mb-2"/>
                                    <p className="text-xs font-bold uppercase tracking-widest">No Activity</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Discipline Breakdown */}
                    <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex flex-col h-[400px]">
                        <h3 className="text-sm font-black text-slate-700 uppercase tracking-widest mb-4">Most Active Disciplines</h3>
                        <div className="flex-1 overflow-y-auto pr-2">
                            {reportData.disciplineData.length > 0 ? (
                                <div className="space-y-4">
                                    {reportData.disciplineData.map((disc, idx) => {
                                        const max = reportData.disciplineData[0].value;
                                        const pct = Math.round((disc.value / max) * 100);
                                        return (
                                            <div key={disc.name} className="flex flex-col gap-1">
                                                <div className="flex justify-between items-end">
                                                    <span className="text-xs font-bold text-slate-700 line-clamp-1 flex-1 pr-2 leading-none">{disc.name}</span>
                                                    <span className="text-xs font-[1000] text-teal-700 leading-none">{disc.value}</span>
                                                </div>
                                                <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                                    <div 
                                                        className="h-full bg-teal-500 rounded-full transition-all duration-1000"
                                                        style={{ width: `${pct}%` }}
                                                    />
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center text-slate-400">
                                    <FilterX size={32} className="opacity-20 mb-2"/>
                                    <p className="text-xs font-bold uppercase tracking-widest">No Activity</p>
                                </div>
                            )}
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
};

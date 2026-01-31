import React from 'react';
import {
    TrendingUp, CheckCircle, MessageSquare, Clock
} from 'lucide-react';
import {
    PieChart, Pie, Cell, ResponsiveContainer
} from 'recharts';
import { Drawing } from '../types';

interface ProjectDashboardProps {
    drawings: Drawing[];
    stats: {
        total: number;
        reviewing: number;
        approved: number;
        totalComments: number;
        openComments: number;
        progressPercent: number;
    };
    disciplineMainData: Array<{ name: string; totalComments: number; openComments: number }>;
}

export const ProjectDashboard: React.FC<ProjectDashboardProps> = ({ drawings, stats, disciplineMainData }) => {
    const now = new Date();

    // Calculate stale drawings (no activity > 14 days, excluding Pending and Approved)
    const staleDrawings = drawings
        .filter(d => d.status !== 'Pending' && d.status !== 'Approved')
        .filter(d => {
            const lastUpdate = d.statusHistory && d.statusHistory.length > 0
                ? new Date(d.statusHistory[d.statusHistory.length - 1].createdAt)
                : new Date(d.logs[0]?.receivedDate || now);
            const daysSince = Math.floor((now.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60 * 24));
            return daysSince > 14;
        })
        .sort((a, b) => {
            const aDate = a.statusHistory && a.statusHistory.length > 0
                ? new Date(a.statusHistory[a.statusHistory.length - 1].createdAt)
                : new Date(a.logs[0]?.receivedDate || now);
            const bDate = b.statusHistory && b.statusHistory.length > 0
                ? new Date(b.statusHistory[b.statusHistory.length - 1].createdAt)
                : new Date(b.logs[0]?.receivedDate || now);
            return aDate.getTime() - bDate.getTime();
        });

    return (
        <div className="mx-auto my-6 max-w-[210mm] no-print">
            <div className="bg-gradient-to-br from-white via-slate-50 to-white rounded-3xl border-2 border-slate-200 shadow-2xl p-8">
                {/* Header */}
                <div className="flex items-center justify-between mb-6 pb-4 border-b-2 border-slate-200">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-gradient-to-br from-teal-500 to-teal-600 rounded-2xl shadow-lg">
                            <TrendingUp size={24} className="text-white" strokeWidth={2.5} />
                        </div>
                        <div>
                            <h2 className="text-[14px] font-[1000] text-slate-900 uppercase tracking-wider leading-none">Project Intelligence Dashboard</h2>
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1.5">Real-time Analytics & Insights</p>
                        </div>
                    </div>
                    <div className="text-right">
                        <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Total Drawings</div>
                        <div className="text-3xl font-[1000] text-teal-600 leading-none mt-1">{stats.total}</div>
                    </div>
                </div>

                {/* Status Distribution & Comments */}
                <div className="grid grid-cols-2 gap-6 mb-6">
                    {/* Status Pie Chart */}
                    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-[10px] font-[1000] text-slate-800 uppercase tracking-widest">Status Distribution</h3>
                            <div className="flex gap-2">
                                <div className="flex items-center gap-1.5">
                                    <div className="w-2 h-2 rounded-full bg-emerald-500" />
                                    <span className="text-[7px] font-black text-slate-400 uppercase">Approved</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <div className="w-2 h-2 rounded-full bg-amber-500" />
                                    <span className="text-[7px] font-black text-slate-400 uppercase">Reviewing</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <div className="w-2 h-2 rounded-full bg-blue-500" />
                                    <span className="text-[7px] font-black text-slate-400 uppercase">Waiting</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <div className="w-2 h-2 rounded-full bg-slate-300" />
                                    <span className="text-[7px] font-black text-slate-400 uppercase">Pending</span>
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center justify-center h-[180px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={[
                                            { name: 'Approved', value: stats.approved },
                                            { name: 'Reviewing', value: stats.reviewing },
                                            { name: 'Waiting Reply', value: drawings.filter(d => d.status === 'Waiting Reply').length },
                                            { name: 'Pending', value: drawings.filter(d => d.status === 'Pending').length },
                                        ].filter(d => d.value > 0)}
                                        cx="50%" cy="50%"
                                        innerRadius={50} outerRadius={70}
                                        paddingAngle={3} dataKey="value"
                                        label={({ value, percent }) => `${value} (${(percent * 100).toFixed(0)}%)`}
                                        labelLine={{ stroke: '#94a3b8', strokeWidth: 1 }}
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
                    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                        <h3 className="text-[10px] font-[1000] text-slate-800 uppercase tracking-widest mb-4">Comments Intelligence</h3>
                        <div className="space-y-3">
                            <div className="flex items-center justify-between p-3 bg-red-50 border border-red-100 rounded-xl">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-red-500 rounded-lg">
                                        <MessageSquare size={16} className="text-white" />
                                    </div>
                                    <div>
                                        <div className="text-[8px] font-black text-red-600 uppercase tracking-widest">Open Comments</div>
                                        <div className="text-xl font-[1000] text-red-700 leading-none mt-1">{stats.openComments}</div>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="text-[7px] font-black text-red-400 uppercase">Critical</div>
                                    <div className="text-[10px] font-bold text-red-600">{stats.totalComments > 0 ? ((stats.openComments / stats.totalComments) * 100).toFixed(0) : 0}%</div>
                                </div>
                            </div>
                            <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-100 rounded-xl">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-slate-600 rounded-lg">
                                        <MessageSquare size={16} className="text-white" />
                                    </div>
                                    <div>
                                        <div className="text-[8px] font-black text-slate-600 uppercase tracking-widest">Total Comments</div>
                                        <div className="text-xl font-[1000] text-slate-700 leading-none mt-1">{stats.totalComments}</div>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="text-[7px] font-black text-slate-400 uppercase">Avg/Dwg</div>
                                    <div className="text-[10px] font-bold text-slate-600">{stats.total > 0 ? (stats.totalComments / stats.total).toFixed(1) : 0}</div>
                                </div>
                            </div>
                            <div className="flex items-center justify-between p-3 bg-emerald-50 border border-emerald-100 rounded-xl">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-emerald-500 rounded-lg">
                                        <CheckCircle size={16} className="text-white" />
                                    </div>
                                    <div>
                                        <div className="text-[8px] font-black text-emerald-600 uppercase tracking-widest">Resolved</div>
                                        <div className="text-xl font-[1000] text-emerald-700 leading-none mt-1">{stats.totalComments - stats.openComments}</div>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="text-[7px] font-black text-emerald-400 uppercase">Rate</div>
                                    <div className="text-[10px] font-bold text-emerald-600">{stats.totalComments > 0 ? (((stats.totalComments - stats.openComments) / stats.totalComments) * 100).toFixed(0) : 0}%</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Workload & Stale Drawings Alert */}
                <div className="grid grid-cols-3 gap-6">
                    {/* Workload by Discipline (Top 5) */}
                    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                        <h3 className="text-[10px] font-[1000] text-slate-800 uppercase tracking-widest mb-3">Workload Hotspots</h3>
                        <div className="space-y-2">
                            {disciplineMainData
                                .sort((a, b) => b.openComments - a.openComments)
                                .slice(0, 5)
                                .map((disc, idx) => (
                                    <div key={disc.name} className="flex items-center gap-2">
                                        <div className={`w-5 h-5 rounded-md flex items-center justify-center text-[8px] font-black ${idx === 0 ? 'bg-red-500 text-white' : idx === 1 ? 'bg-orange-400 text-white' : 'bg-slate-200 text-slate-600'}`}>
                                            {idx + 1}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="text-[8px] font-black text-slate-700 uppercase truncate">{disc.name}</div>
                                            <div className="flex items-center gap-1 mt-0.5">
                                                <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
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

                    {/* Stale Drawings Alert */}
                    <div className="col-span-2 bg-gradient-to-br from-red-50 to-orange-50 rounded-2xl border-2 border-red-200 p-5 shadow-sm">
                        <div className="flex items-center gap-2 mb-3">
                            <div className="p-1.5 bg-red-500 rounded-lg animate-pulse">
                                <Clock size={14} className="text-white" />
                            </div>
                            <h3 className="text-[10px] font-[1000] text-red-700 uppercase tracking-widest">Stagnant Drawings Alert</h3>
                            <div className="text-[7px] font-black text-red-400 uppercase tracking-wider">(No activity &gt; 14 days)</div>
                        </div>
                        <div className="max-h-[140px] overflow-y-auto scrollbar-thin scrollbar-thumb-red-300 bg-white/50 rounded-xl p-2">
                            {staleDrawings.length === 0 ? (
                                <div className="py-6 text-center">
                                    <CheckCircle size={24} className="text-emerald-500 mx-auto mb-2" />
                                    <div className="text-[9px] font-black text-emerald-600 uppercase">All Clear!</div>
                                    <div className="text-[7px] font-bold text-slate-400 uppercase mt-1">No stagnant drawings detected</div>
                                </div>
                            ) : (
                                <div className="space-y-1">
                                    {staleDrawings.map(d => {
                                        const lastUpdate = d.statusHistory && d.statusHistory.length > 0
                                            ? new Date(d.statusHistory[d.statusHistory.length - 1].createdAt)
                                            : new Date(d.logs[0]?.receivedDate || now);
                                        const daysSince = Math.floor((now.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60 * 24));
                                        return (
                                            <div key={d.id} className="flex items-center justify-between p-2 bg-white border border-red-100 rounded-lg hover:bg-red-50 transition-all">
                                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                                    <div className={`px-2 py-0.5 rounded-md text-[7px] font-black uppercase ${d.status === 'Reviewing' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>
                                                        {d.status}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="text-[8px] font-black text-slate-800 truncate">{d.drawingNo}</div>
                                                        <div className="text-[7px] font-bold text-slate-400 uppercase truncate">{d.discipline}</div>
                                                    </div>
                                                </div>
                                                <div className="text-right shrink-0">
                                                    <div className="text-[9px] font-black text-red-600">{daysSince}d</div>
                                                    <div className="text-[6px] font-bold text-red-400 uppercase">stale</div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

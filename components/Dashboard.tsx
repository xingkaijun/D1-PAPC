
import React from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, LabelList
} from 'recharts';
import { useStore } from '../store';
import {
  CheckCircle, Clock, AlertCircle, FileText
} from 'lucide-react';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

export const Dashboard: React.FC = () => {
  const { activeProjectId, data } = useStore();
  const project = data.projects.find(p => p.id === activeProjectId);

  if (!project) return <div>Select a project</div>;

  const drawings = project.drawings;
  const stats = {
    total: drawings.length,
    pending: drawings.filter(d => d.status === 'Pending').length,
    reviewing: drawings.filter(d => d.status === 'Reviewing').length,
    waiting: drawings.filter(d => d.status === 'Waiting Reply').length,
    approved: drawings.filter(d => d.status === 'Approved').length,
  };

  // Prepare data for stacked bar chart by discipline
  const disciplineMap = new Map();
  drawings.forEach(d => {
    const entry = disciplineMap.get(d.discipline) || { name: d.discipline, Approved: 0, Pending: 0, Reviewing: 0, 'Waiting Reply': 0 };
    entry[d.status] = (entry[d.status] || 0) + 1;
    disciplineMap.set(d.discipline, entry);
  });
  const disciplineData = Array.from(disciplineMap.values());

  // Prepare data for workload per person (multi-assignee aware)
  const workloadMap = new Map();
  drawings.forEach(d => {
    (d.assignees || []).forEach(a => {
      workloadMap.set(a, (workloadMap.get(a) || 0) + 1);
    });
  });
  const workloadData = Array.from(workloadMap.entries()).map(([name, value]) => ({ name, value }));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard icon={<FileText className="text-blue-500" />} label="Total Drawings" value={stats.total} />
        <StatCard icon={<Clock className="text-amber-500" />} label="Pending" value={stats.pending} />
        <StatCard icon={<AlertCircle className="text-orange-500" />} label="Reviewing" value={stats.reviewing} />
        <StatCard icon={<Clock className="text-blue-400" />} label="Waiting Reply" value={stats.waiting} />
        <StatCard icon={<CheckCircle className="text-emerald-500" />} label="Approved" value={stats.approved} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="text-lg font-semibold mb-6 uppercase tracking-tight font-black">Status by Discipline</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={disciplineData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} style={{ fontSize: '10px', fontWeight: 'bold' }} />
                <YAxis axisLine={false} tickLine={false} style={{ fontSize: '10px' }} />
                <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '10px' }} />
                <Bar dataKey="Approved" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]}>
                  <LabelList dataKey="Approved" position="center" style={{ fill: '#fff', fontSize: 10, fontWeight: 900 }} />
                </Bar>
                <Bar dataKey="Reviewing" stackId="a" fill="#eab308">
                  <LabelList dataKey="Reviewing" position="center" style={{ fill: '#fff', fontSize: 10, fontWeight: 900 }} />
                </Bar>
                <Bar dataKey="Waiting Reply" stackId="a" fill="#3b82f6">
                  <LabelList dataKey="Waiting Reply" position="center" style={{ fill: '#fff', fontSize: 10, fontWeight: 900 }} />
                </Bar>
                <Bar dataKey="Pending" stackId="a" fill="#94a3b8" radius={[4, 4, 0, 0]}>
                  <LabelList dataKey="Pending" position="center" style={{ fill: '#fff', fontSize: 10, fontWeight: 900 }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="text-lg font-semibold mb-6 uppercase tracking-tight font-black">Workload Allocation</h3>
          <div className="h-[300px] flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={workloadData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                  label={({ name, value }) => `${name}: ${value}`}
                >
                  {workloadData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

const StatCard = ({ icon, label, value }: { icon: React.ReactNode, label: string, value: number }) => (
  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center space-x-4">
    <div className="p-3 bg-slate-50 rounded-lg">{icon}</div>
    <div>
      <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{label}</p>
      <p className="text-2xl font-bold text-slate-900">{value}</p>
    </div>
  </div>
);

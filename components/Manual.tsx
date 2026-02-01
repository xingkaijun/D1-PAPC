import React from 'react';
import {
  BookOpen, Terminal, Cloud, FileText, Settings,
  HelpCircle, ChevronRight, Info, AlertCircle, Send,
  MousePointer2, Command, Shield, Sparkles, CheckCircle, RefreshCw, Camera
} from 'lucide-react';

// Move helper components to top to avoid hoisting issues and fix children prop type errors
const Section = ({ icon, title, children }: { icon: React.ReactNode, title: string, children?: React.ReactNode }) => (
  <section className="space-y-4">
    <div className="flex items-center gap-3">
      <div className="p-2 bg-slate-50 rounded-xl text-slate-900 border border-slate-100 shadow-sm">{icon}</div>
      <h3 className="text-[12px] font-black uppercase text-slate-900 tracking-widest">{title}</h3>
    </div>
    <div className="pl-2 border-l border-slate-100">
      {children}
    </div>
  </section>
);

const CommandItem = ({ code, desc }: { code: string, desc: string }) => (
  <div className="flex items-center justify-between group">
    <code className="text-[10px] font-black text-teal-600 bg-teal-50 px-2 py-0.5 rounded-lg border border-teal-100/50">{code}</code>
    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight group-hover:text-slate-600 transition-colors">{desc}</span>
  </div>
);

const TipBadge = ({ label }: { label: string }) => (
  <div className="flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-white/10 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-white/10 transition-colors cursor-default">
    <CheckCircle size={10} className="text-teal-400" />
    <span>{label}</span>
  </div>
);

export const Manual: React.FC = () => {
  return (
    <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-200 bg-white p-8">
      <div className="max-w-6xl mx-auto space-y-12 pb-20">

        {/* Header Section */}
        <div className="border-b-2 border-slate-900 pb-8 flex justify-between items-end">
          <div>
            <h2 className="text-3xl font-[1000] text-slate-900 uppercase tracking-tighter leading-none mb-4">Operation Manual & Tips</h2>
            <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.3em]">Plan Approval Intelligence Platform User Guide</p>
          </div>
          <div className="text-right hidden md:block">
            <div className="text-[10px] font-black text-teal-600 bg-teal-50 px-3 py-1 rounded-full uppercase tracking-widest inline-block">Version 4.0-Cloud</div>
          </div>
        </div>

        {/* Content Split: English / Chinese */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">

          {/* English Version */}
          <div className="space-y-10">
            <header className="flex items-center gap-3 border-l-4 border-slate-900 pl-4">
              <span className="text-lg font-black text-slate-900 uppercase tracking-tight">English Manual</span>
            </header>

            <Section icon={<Cloud size={18} />} title="1. Server-First Sync & Auto-Save">
              <ul className="space-y-3 text-[11px] font-medium text-slate-600 leading-relaxed">
                <li className="flex gap-2"><ChevronRight size={12} className="shrink-0 mt-0.5 text-teal-500" /> <strong>Server-First Loading:</strong> Projects are always loaded from the WebDAV server to ensure you have the latest data. Local cache is used only as a fallback or in Offline Mode.</li>
                <li className="flex gap-2"><ChevronRight size={12} className="shrink-0 mt-0.5 text-teal-500" /> <strong>Auto-Save:</strong> Your work is automatically synced to the server every <strong>3 minutes</strong> (configurable in Settings).</li>
                <li className="flex gap-2"><ChevronRight size={12} className="shrink-0 mt-0.5 text-teal-500" /> <strong>Manual Sync:</strong> Use the <RefreshCw size={10} className="inline mx-1" /> button in the top bar to force an immediate push/pull synchronization.</li>
              </ul>
            </Section>

            <Section icon={<Terminal size={18} />} title="2. Intelligence Command Bar">
              <div className="bg-slate-50 p-4 rounded-2xl space-y-3">
                <p className="text-[10px] font-bold text-slate-500 uppercase mb-2 italic tracking-tight">Powerful shortcuts for fast logging:</p>
                <div className="space-y-2">
                  <CommandItem code="@001 Content" desc="Add an internal note to drawing with ID 001." />
                  <CommandItem code="@001 c:12/3" desc="Set comments to 12 total, 3 open." />
                  <CommandItem code="@R 001, 002" desc="Batch update status to 'Reviewing'." />
                </div>
              </div>
            </Section>

            <Section icon={<MousePointer2 size={18} />} title="3. Workflow & Analysis">
              <ul className="space-y-3 text-[11px] font-medium text-slate-600 leading-relaxed">
                <li className="flex gap-2"><ChevronRight size={12} className="shrink-0 mt-0.5 text-teal-500" /> <strong>Status Logic:</strong> Toggle statuses (Pending → Reviewing → Approved) by clicking the badge. Overdue items are flagged automatically.</li>
                <li className="flex gap-2"><ChevronRight size={12} className="shrink-0 mt-0.5 text-teal-500" /> <strong>Log Stream:</strong> Expand any row to view the full audit trail of changes, ensuring accountability.</li>
              </ul>
            </Section>

            <Section icon={<FileText size={18} />} title="4. Reporting & Snapshots">
              <ul className="space-y-3 text-[11px] font-medium text-slate-600 leading-relaxed">
                <li className="flex gap-2"><ChevronRight size={12} className="shrink-0 mt-0.5 text-teal-500" /> <strong>Snapshots:</strong> Click <Camera size={10} className="inline mx-1" /> to freeze current progress. Reports compare the <strong>Newest</strong> snapshot against the <strong>Previous</strong> one to calculate weekly progress.</li>
                <li className="flex gap-2"><ChevronRight size={12} className="shrink-0 mt-0.5 text-teal-500" /> <strong>Chronological Charts:</strong> Timelines are displayed from Left (Oldest) to Right (Newest).</li>
                <li className="flex gap-2"><ChevronRight size={12} className="shrink-0 mt-0.5 text-teal-500" /> <strong>PDF Export:</strong> Optimized for A4. Enable "Background Graphics" in print settings for accurate color rendering.</li>
              </ul>
            </Section>
          </div>

          {/* Chinese Version */}
          <div className="space-y-10">
            <header className="flex items-center gap-3 border-l-4 border-teal-600 pl-4">
              <span className="text-lg font-black text-slate-900 uppercase tracking-tight">中文说明书</span>
            </header>

            <Section icon={<Cloud size={18} />} title="1. 服务器优先与自动同步">
              <ul className="space-y-3 text-[11px] font-medium text-slate-600 leading-relaxed">
                <li className="flex gap-2"><ChevronRight size={12} className="shrink-0 mt-0.5 text-teal-600" /> <strong>服务器优先加载：</strong> 打开项目时始终优先从 WebDAV 服务器读取数据，确保多人协作数据一致。本地缓存仅作为离线备份。</li>
                <li className="flex gap-2"><ChevronRight size={12} className="shrink-0 mt-0.5 text-teal-600" /> <strong>自动保存：</strong> 系统每 <strong>3分钟</strong>（可在设置中调整）自动将更改同步到服务器。</li>
                <li className="flex gap-2"><ChevronRight size={12} className="shrink-0 mt-0.5 text-teal-600" /> <strong>手动同步：</strong> 点击顶部栏的 <RefreshCw size={10} className="inline mx-1" /> 按钮可强制触发一次完整的上传与下载同步。</li>
              </ul>
            </Section>

            <Section icon={<Terminal size={18} />} title="2. 智能指令栏 (Command Bar)">
              <div className="bg-slate-50 p-4 rounded-2xl space-y-3">
                <p className="text-[10px] font-bold text-slate-500 uppercase mb-2 italic tracking-tight">快速录入的强大指令：</p>
                <div className="space-y-2">
                  <CommandItem code="@001 意见内容" desc="为 ID 为 001 的图纸添加内部备注。" />
                  <CommandItem code="@001 c:12/3" desc="设置意见总数为 12，待关闭为 3。" />
                  <CommandItem code="@R 001, 002" desc="一键批量将状态改为 'Reviewing'。" />
                </div>
              </div>
            </Section>

            <Section icon={<MousePointer2 size={18} />} title="3. 流程管理与状态">
              <ul className="space-y-3 text-[11px] font-medium text-slate-600 leading-relaxed">
                <li className="flex gap-2"><ChevronRight size={12} className="shrink-0 mt-0.5 text-teal-600" /> <strong>状态逻辑：</strong> 点击状态标签切换流程（Pending → Reviewing → Approved）。超期项目会自动红色高亮。</li>
                <li className="flex gap-2"><ChevronRight size={12} className="shrink-0 mt-0.5 text-teal-600" /> <strong>审计日志 (Log Stream)：</strong> 展开任意行即可查看详细的操作记录，确保修改可追溯。</li>
              </ul>
            </Section>

            <Section icon={<FileText size={18} />} title="4. 报表与快照系统">
              <ul className="space-y-3 text-[11px] font-medium text-slate-600 leading-relaxed">
                <li className="flex gap-2"><ChevronRight size={12} className="shrink-0 mt-0.5 text-teal-600" /> <strong>快照 (Snapshot)：</strong> 点击 <Camera size={10} className="inline mx-1" /> 记录当前进度。周报会自动对比 <strong>最新快照</strong> 与 <strong>上一期快照</strong> 之间的数据变化。</li>
                <li className="flex gap-2"><ChevronRight size={12} className="shrink-0 mt-0.5 text-teal-600" /> <strong>时间轴图表：</strong> 所有趋势图已调整为从左（旧）到右（新）的时间正序排列。</li>
                <li className="flex gap-2"><ChevronRight size={12} className="shrink-0 mt-0.5 text-teal-600" /> <strong>PDF 导出：</strong> 请在打印设置中勾选“背景图形”以保留报表的颜色与样式。</li>
              </ul>
            </Section>
          </div>

        </div>

        {/* Footer Pro Tips */}
        <div className="bg-slate-900 rounded-[2.5rem] p-10 text-white relative overflow-hidden">
          <div className="relative z-10 flex flex-col md:flex-row gap-12 items-center">
            <div className="shrink-0">
              <div className="w-20 h-20 bg-teal-500 rounded-3xl flex items-center justify-center shadow-xl shadow-teal-500/20">
                <Shield size={40} />
              </div>
            </div>
            <div className="flex-1 space-y-4 text-center md:text-left">
              <h3 className="text-xl font-black uppercase tracking-widest">Platform Safety & Best Practices</h3>
              <p className="text-slate-400 text-[11px] font-bold leading-relaxed uppercase tracking-widest">
                Configure your <strong>Project Settings</strong> to customize auto-sync intervals. Ideally, one team member should act as the <strong>Administrator</strong> to manage snapshots and bulk imports to avoid conflicts.
              </p>
              <div className="pt-4 flex flex-wrap gap-4 justify-center md:justify-start">
                <TipBadge label="Auto-Sync Enabled" />
                <TipBadge label="Snapshot Weekly" />
                <TipBadge label="Project Specific Config" />
                <TipBadge label="Secure Cloud" />
              </div>
            </div>
          </div>

          {/* Abstract BG Decorations */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-teal-500/10 rounded-full -mr-32 -mt-32 blur-3xl" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-teal-500/10 rounded-full -ml-24 -mb-24 blur-3xl" />
        </div>
      </div>
    </div>
  );
};

import React from 'react';
import { 
  BookOpen, Terminal, Cloud, FileText, Settings, 
  HelpCircle, ChevronRight, Info, AlertCircle, Send,
  MousePointer2, Command, Shield, Sparkles, CheckCircle
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
            <div className="text-[10px] font-black text-teal-600 bg-teal-50 px-3 py-1 rounded-full uppercase tracking-widest inline-block">Version 3.1-LTD</div>
          </div>
        </div>

        {/* Content Split: English / Chinese */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          
          {/* English Version */}
          <div className="space-y-10">
            <header className="flex items-center gap-3 border-l-4 border-slate-900 pl-4">
              <span className="text-lg font-black text-slate-900 uppercase tracking-tight">English Manual</span>
            </header>

            <Section icon={<Cloud size={18}/>} title="1. Project Registry & Cloud">
              <ul className="space-y-3 text-[11px] font-medium text-slate-600 leading-relaxed">
                <li className="flex gap-2"><ChevronRight size={12} className="shrink-0 mt-0.5 text-teal-500"/> Use the <strong>Cloud Registry</strong> dropdown to switch ships or add a new hull number.</li>
                <li className="flex gap-2"><ChevronRight size={12} className="shrink-0 mt-0.5 text-teal-500"/> <strong>WebDAV Sync:</strong> Uploads local project data to the server, overwriting the remote file.</li>
                <li className="flex gap-2"><ChevronRight size={12} className="shrink-0 mt-0.5 text-teal-500"/> <strong>WebDAV Fetch:</strong> Pulls the latest version from the server to your local browser.</li>
              </ul>
            </Section>

            <Section icon={<Terminal size={18}/>} title="2. Intelligence Command Bar">
              <div className="bg-slate-50 p-4 rounded-2xl space-y-3">
                <p className="text-[10px] font-bold text-slate-500 uppercase mb-2 italic tracking-tight">Powerful shortcuts for fast logging:</p>
                <div className="space-y-2">
                  <CommandItem code="@001 Content" desc="Add an internal note to drawing with ID 001." />
                  <CommandItem code="@001 c:12/3" desc="Set comments to 12 total, 3 open." />
                  <CommandItem code="@R 001, 002" desc="Batch update status to 'Reviewing'." />
                </div>
              </div>
            </Section>

            <Section icon={<MousePointer2 size={18}/>} title="3. Inventory Navigation">
              <ul className="space-y-3 text-[11px] font-medium text-slate-600 leading-relaxed">
                <li className="flex gap-2"><ChevronRight size={12} className="shrink-0 mt-0.5 text-teal-500"/> Click <strong>Status</strong> badges to cycle through Pending, Reviewing, Waiting, and Approved.</li>
                <li className="flex gap-2"><ChevronRight size={12} className="shrink-0 mt-0.5 text-teal-500"/> Red <strong>OVERDUE</strong> markers appear automatically when 'Reviewing' exceeds the deadline.</li>
                <li className="flex gap-2"><ChevronRight size={12} className="shrink-0 mt-0.5 text-teal-500"/> Expand a row to see the <strong>Log Stream</strong> (Audit trail) and <strong>Internal Notes</strong>.</li>
              </ul>
            </Section>

            <Section icon={<FileText size={18}/>} title="4. Pro Reporting">
              <ul className="space-y-3 text-[11px] font-medium text-slate-600 leading-relaxed">
                <li className="flex gap-2"><ChevronRight size={12} className="shrink-0 mt-0.5 text-teal-500"/> Take a <strong>Snapshot</strong> to record current progress for the 'Progress Trends' area chart.</li>
                <li className="flex gap-2"><ChevronRight size={12} className="shrink-0 mt-0.5 text-teal-500"/> <strong>PDF Export:</strong> Optimized for A4. Ensure "Background Graphics" is enabled in your print settings.</li>
              </ul>
            </Section>
          </div>

          {/* Chinese Version */}
          <div className="space-y-10">
            <header className="flex items-center gap-3 border-l-4 border-teal-600 pl-4">
              <span className="text-lg font-black text-slate-900 uppercase tracking-tight">中文说明书</span>
            </header>

            <Section icon={<Cloud size={18}/>} title="1. 项目注册与云端同步">
              <ul className="space-y-3 text-[11px] font-medium text-slate-600 leading-relaxed">
                <li className="flex gap-2"><ChevronRight size={12} className="shrink-0 mt-0.5 text-teal-600"/> 使用右上角的 <strong>Cloud Registry</strong> 下拉菜单切换船舶或添加新船号。</li>
                <li className="flex gap-2"><ChevronRight size={12} className="shrink-0 mt-0.5 text-teal-600"/> <strong>WebDAV Sync:</strong> 将本地项目数据上传至服务器，覆盖远程文件。</li>
                <li className="flex gap-2"><ChevronRight size={12} className="shrink-0 mt-0.5 text-teal-600"/> <strong>WebDAV Fetch:</strong> 从服务器抓取最新版本并同步到本地浏览器。</li>
              </ul>
            </Section>

            <Section icon={<Terminal size={18}/>} title="2. 智能指令栏 (Command Bar)">
              <div className="bg-slate-50 p-4 rounded-2xl space-y-3">
                <p className="text-[10px] font-bold text-slate-500 uppercase mb-2 italic tracking-tight">快速录入的强大指令：</p>
                <div className="space-y-2">
                  <CommandItem code="@001 意见内容" desc="为 ID 为 001 的图纸添加内部备注。" />
                  <CommandItem code="@001 c:12/3" desc="设置意见总数为 12，待关闭为 3。" />
                  <CommandItem code="@R 001, 002" desc="一键批量将状态改为 'Reviewing'。" />
                </div>
              </div>
            </Section>

            <Section icon={<MousePointer2 size={18}/>} title="3. 清单操作技巧">
              <ul className="space-y-3 text-[11px] font-medium text-slate-600 leading-relaxed">
                <li className="flex gap-2"><ChevronRight size={12} className="shrink-0 mt-0.5 text-teal-600"/> 点击 <strong>Status</strong> 标签可快速切换审批状态。</li>
                <li className="flex gap-2"><ChevronRight size={12} className="shrink-0 mt-0.5 text-teal-600"/> 当状态为 'Reviewing' 且超过截止日期时，系统会自动显示红色的 <strong>OVERDUE</strong> 警告。</li>
                <li className="flex gap-2"><ChevronRight size={12} className="shrink-0 mt-0.5 text-teal-600"/> 展开行可查看 <strong>Log Stream</strong> (操作日志) 和 <strong>Internal Notes</strong> (内部备注)。</li>
              </ul>
            </Section>

            <Section icon={<FileText size={18}/>} title="4. 专业报表导出">
              <ul className="space-y-3 text-[11px] font-medium text-slate-600 leading-relaxed">
                <li className="flex gap-2"><ChevronRight size={12} className="shrink-0 mt-0.5 text-teal-600"/> 点击 <strong>Snapshot</strong> 记录当前进度，用于生成“历史趋势图”。</li>
                <li className="flex gap-2"><ChevronRight size={12} className="shrink-0 mt-0.5 text-teal-600"/> <strong>PDF 导出：</strong> 针对 A4 纸张优化。打印时请务必勾选“背景图形”。</li>
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
              <h3 className="text-xl font-black uppercase tracking-widest">Platform Safety & Health</h3>
              <p className="text-slate-400 text-[11px] font-bold leading-relaxed uppercase tracking-widest">
                Configure your <strong>Security Key</strong> in settings to prevent unauthorized WebDAV overwrites. Always ensure your <strong>Discipline Defaults</strong> are set for automatic assignee allocation during bulk imports.
              </p>
              <div className="pt-4 flex flex-wrap gap-4 justify-center md:justify-start">
                 <TipBadge label="Always Fetch Before Edit" />
                 <TipBadge label="Log Snapshots Weekly" />
                 <TipBadge label="Set Master Security Key" />
                 <TipBadge label="Enable Print Backgrounds" />
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

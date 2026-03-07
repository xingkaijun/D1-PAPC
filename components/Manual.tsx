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
                <li className="flex gap-2"><ChevronRight size={12} className="shrink-0 mt-0.5 text-teal-500" /> <strong>Pure Real-time Cloud:</strong> Our system is entirely cloud-based. Every action is saved instantly to the database. There is no manual "save" button.</li>
                <li className="flex gap-2"><ChevronRight size={12} className="shrink-0 mt-0.5 text-teal-500" /> <strong>Collaboration Protection:</strong> If another team member is actively editing the project, you will see an <strong>Admin Online 🟢</strong> indicator at the top. Read-only usage is recommended when the admin is active to prevent conflicts.</li>
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

            <Section icon={<MousePointer2 size={18} />} title="3. Workflow & Tracker">
              <ul className="space-y-3 text-[11px] font-medium text-slate-600 leading-relaxed">
                <li className="flex gap-2"><ChevronRight size={12} className="shrink-0 mt-0.5 text-teal-500" /> <strong>Status Logic:</strong> Toggle statuses (Pending → Reviewing → Approved) by clicking the badge. Overdue items are flagged automatically.</li>
                <li className="flex gap-2"><ChevronRight size={12} className="shrink-0 mt-0.5 text-teal-500" /> <strong>Review Tracker:</strong> Cross-check assignee completion status. Use the APR (Approve) button to quickly finalize fully reviewed items. All tracker states are persistent.</li>
              </ul>
            </Section>

            <Section icon={<FileText size={18} />} title="4. Reporting & Snapshots">
              <ul className="space-y-3 text-[11px] font-medium text-slate-600 leading-relaxed">
                <li className="flex gap-2"><ChevronRight size={12} className="shrink-0 mt-0.5 text-teal-500" /> <strong>Data Strictness:</strong> Chart calculations explicitly depend solely on the manual Total/Open comments values you log, guaranteeing accurate, transparent trend visualizations.</li>
                <li className="flex gap-2"><ChevronRight size={12} className="shrink-0 mt-0.5 text-teal-500" /> <strong>Snapshots:</strong> Click <Camera size={10} className="inline mx-1" /> to freeze current progress. Reports compare the <strong>Newest</strong> snapshot against the <strong>Previous</strong> one to calculate weekly progress.</li>
              </ul>
            </Section>
          </div>

          {/* Chinese Version */}
          <div className="space-y-10">
            <header className="flex items-center gap-3 border-l-4 border-teal-600 pl-4">
              <span className="text-lg font-black text-slate-900 uppercase tracking-tight">中文操作规范</span>
            </header>

            <Section icon={<Cloud size={18} />} title="1. 完全云端与防冲突机制">
              <ul className="space-y-3 text-[11px] font-medium text-slate-600 leading-relaxed">
                <li className="flex gap-2"><ChevronRight size={12} className="shrink-0 mt-0.5 text-teal-600" /> <strong>实时存档：</strong> 系统基于云原生数据库驱动，我们在客户端所做的任何变更，都会被实时保存到云端服务器中。无需寻找或点击“保存”按钮。</li>
                <li className="flex gap-2"><ChevronRight size={12} className="shrink-0 mt-0.5 text-teal-600" /> <strong>在线指示灯：</strong> 当有其他同事解锁编辑并正在操作同一项目时，您将在页面顶部看到 <strong>Admin Online 🟢</strong> 的绿色指示灯。这表示目前有人正在修改项目，为避免覆盖风险，请尽量只阅不改。</li>
              </ul>
            </Section>

            <Section icon={<Terminal size={18} />} title="2. 智能指令栏 (Command Bar)">
              <div className="bg-slate-50 p-4 rounded-2xl space-y-6">
                <p className="text-[10px] font-bold text-slate-500 uppercase mb-2 italic tracking-tight">所有指令均以 <strong>@</strong> 开头（全局搜索除外），支持空格或逗号分隔多个图纸ID执行批量操作：</p>

                <div className="space-y-4">
                  <div>
                    <h4 className="text-[10px] font-black text-slate-700 uppercase mb-2 border-b border-slate-200 pb-1">1. 全局搜索/过滤 (无需 @)</h4>
                    <div className="space-y-1">
                      <CommandItem code="show : hull" desc="显示包含 'hull' 的图纸" />
                      <CommandItem code="ls : kevin" desc="显示分配给 'kevin' 的图纸" />
                      <CommandItem code="reset" desc="清除所有过滤条件" />
                    </div>
                  </div>

                  <div>
                    <h4 className="text-[10px] font-black text-slate-700 uppercase mb-2 border-b border-slate-200 pb-1">2. 批量状态更新</h4>
                    <div className="space-y-1">
                      <CommandItem code="@R 001, 002" desc="批量改为 Reviewing (R)" />
                      <CommandItem code="@W 001" desc="改为 Waiting Reply (W)" />
                      <CommandItem code="@A 001" desc="改为 Approved (A)" />
                    </div>
                  </div>

                  <div>
                    <h4 className="text-[10px] font-black text-slate-700 uppercase mb-2 border-b border-slate-200 pb-1">3. 内部备忘与意见总数</h4>
                    <div className="space-y-1">
                      <CommandItem code="@001 修改坐标" desc="添加纯内部备注 '修改坐标'" />
                      <CommandItem code="@001 c:10/2" desc="设置对外意见数: 总意见10条 / 未结2条" />
                    </div>
                  </div>

                  <div>
                    <h4 className="text-[10px] font-black text-slate-700 uppercase mb-2 border-b border-slate-200 pb-1">4. 版本与分配人员</h4>
                    <div className="space-y-1">
                      <CommandItem code="@001 v:C" desc="更新版本为 C" />
                      <CommandItem code="@001 to:Kevin" desc="指派给 Kevin (覆盖)" />
                    </div>
                  </div>
                </div>
              </div>
            </Section>

            <Section icon={<MousePointer2 size={18} />} title="3. 流程跟踪与审核">
              <ul className="space-y-3 text-[11px] font-medium text-slate-600 leading-relaxed">
                <li className="flex gap-2"><ChevronRight size={12} className="shrink-0 mt-0.5 text-teal-600" /> <strong>矩阵化 Tracker：</strong> Tracker 视图帮助统筹全员审图进度。使用底部的 APR (Approve) 按钮可以直接确认该份图纸的整体发行状态。</li>
                <li className="flex gap-2"><ChevronRight size={12} className="shrink-0 mt-0.5 text-teal-600" /> <strong>审计日志：</strong> 展开列表行可查看每个文件的详细流转操作记录。</li>
              </ul>
            </Section>

            <Section icon={<FileText size={18} />} title="4. 图表快照说明">
              <ul className="space-y-3 text-[11px] font-medium text-slate-600 leading-relaxed">
                <li className="flex gap-2"><ChevronRight size={12} className="shrink-0 mt-0.5 text-teal-600" /> <strong>报表严谨性：</strong> Reports 中的总意见生成，严格基于你在表单或命令行（c:5/1）中填写的具体计数执行，不计入日常打卡记录的内部备注文本，保证数据一致。</li>
                <li className="flex gap-2"><ChevronRight size={12} className="shrink-0 mt-0.5 text-teal-600" /> <strong>手动快照：</strong> 进度总结时，务必点击右上角 <Camera size={10} className="inline mx-1" /> 按钮，生成当期的数据快照，图表历史走势会立刻自动更新。</li>
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



import React, { useState, useEffect } from 'react';
import { useStore } from './store';
import { Reports } from './components/Reports';
import { DrawingList } from './components/DrawingList';
import { Settings } from './components/Settings';
import { CommandBar } from './components/CommandBar';
import { DailyLogReport } from './components/DailyLogReport';
import { ReviewTracker } from './components/ReviewTracker';
import { format } from 'date-fns';

const PROJECT_THEMES = [
  { bg: 'bg-white', border: 'border-slate-100', hover: 'hover:border-slate-300', iconBg: 'from-slate-100 to-slate-200', iconText: 'text-slate-500' }, // Classic
  { bg: 'bg-rose-50/50', border: 'border-rose-100', hover: 'hover:border-rose-400', iconBg: 'from-rose-100 to-rose-200', iconText: 'text-rose-500' },
  { bg: 'bg-orange-50/50', border: 'border-orange-100', hover: 'hover:border-orange-400', iconBg: 'from-orange-100 to-orange-200', iconText: 'text-orange-500' },
  { bg: 'bg-amber-50/50', border: 'border-amber-100', hover: 'hover:border-amber-400', iconBg: 'from-amber-100 to-amber-200', iconText: 'text-amber-500' },
  { bg: 'bg-emerald-50/50', border: 'border-emerald-100', hover: 'hover:border-emerald-400', iconBg: 'from-emerald-100 to-emerald-200', iconText: 'text-emerald-500' },
  { bg: 'bg-teal-50/50', border: 'border-teal-100', hover: 'hover:border-teal-400', iconBg: 'from-teal-100 to-teal-200', iconText: 'text-teal-500' },
  { bg: 'bg-cyan-50/50', border: 'border-cyan-100', hover: 'hover:border-cyan-400', iconBg: 'from-cyan-100 to-cyan-200', iconText: 'text-cyan-500' },
  { bg: 'bg-blue-50/50', border: 'border-blue-100', hover: 'hover:border-blue-400', iconBg: 'from-blue-100 to-blue-200', iconText: 'text-blue-500' },
  { bg: 'bg-indigo-50/50', border: 'border-indigo-100', hover: 'hover:border-indigo-400', iconBg: 'from-indigo-100 to-indigo-200', iconText: 'text-indigo-500' },
  { bg: 'bg-violet-50/50', border: 'border-violet-100', hover: 'hover:border-violet-400', iconBg: 'from-violet-100 to-violet-200', iconText: 'text-violet-500' },
  { bg: 'bg-fuchsia-50/50', border: 'border-fuchsia-100', hover: 'hover:border-fuchsia-400', iconBg: 'from-fuchsia-100 to-fuchsia-200', iconText: 'text-fuchsia-500' },
];

const getProjectTheme = (id: string, name: string) => {
  // Combine ID and Name for hash to handle cases where ID might be sequential or weird
  const seed = id + name;
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }
  return PROJECT_THEMES[Math.abs(hash) % PROJECT_THEMES.length];
};
import { Manual } from './components/Manual';
import { ErrorBoundary } from './components/ErrorBoundary';
import {
  FileStack,
  Settings as SettingsIcon,
  PlusCircle,
  ChevronDown,
  Layers,
  Code,
  Cloud,
  CloudOff,
  RefreshCw,
  LayoutDashboard,
  BookOpen,
  Lock,
  ChevronLeft,
  ChevronRight,
  Calendar,
  ClipboardCheck
} from 'lucide-react';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'drawings' | 'reports' | 'dailylog' | 'settings' | 'manual' | 'tracker'>('drawings');
  const {
    data,
    activeProjectId,
    setActiveProject,
    addProject,
    isLoading,
    fetchProjectList,
    loadProject,
    saveProject,
    fetchGlobalSettings,
    isEditMode,

  } = useStore();

  const currentProject = data.projects.find(p => p.id === activeProjectId);

  const [showProjectSelector, setShowProjectSelector] = useState(true);

  // 1. Startup Logic: Server First - FETCH LIST ONLY
  useEffect(() => {
    const initApp = async () => {
      // If we have an active project persisted, we might want to clear it or let user re-select?
      // Requirement: "Before loading project do not enter main page". So we force selection.
      // We don't wipe store, but we require selection.

      if (!true) {
        // No WebDAV, maybe go straight to Offline if we have projects? 
        // Or show selector with local projects?
        // Let's show selector regardless, listing local cache.
        useStore.setState({ isLoading: false });
        return;
      }

      useStore.setState({ isLoading: true });
      try {
        // Try to fetch Server List
        await fetchGlobalSettings();
        await fetchProjectList();
        console.log("Server list fetched. Ready for selection.");
      } catch (err) {
        console.error("Server connection failed", err);
        // Do not auto-offline. Let user choose in Selector (which will show emptiness + Offline button)
      } finally {
        useStore.setState({ isLoading: false });
      }
    };

    initApp();
  }, []);

  const handleSelectProject = async (projectId: string, passwordInput?: string) => {
    useStore.setState({ isLoading: true });
    try {
      if (true) {
        // Pass password if provided
        await loadProject(projectId, passwordInput);
      } else {
        // Local load (just set active)
        setActiveProject(projectId);
      }
      setShowProjectSelector(false);
      setActiveProject(projectId); // Ensure store knows active ID
    } catch (e: any) {
      if (e.message === 'PASSWORD_REQUIRED' || e.message === 'INVALID_PASSWORD') {
        useStore.setState({ isLoading: false }); // Hide spinner to show prompt
        // Simple prompt for now
        const msg = e.message === 'INVALID_PASSWORD' ? "Incorrect Password. Try again:" : "This Registry is Protected. Enter Password:";
        // Short delay to allow React render? PROMPT blocks immediately.
        // We use setTimeout to allow UI update (hide spinner) before blocking.
        setTimeout(() => {
          const pwd = prompt(msg);
          if (pwd !== null) {
            handleSelectProject(projectId, pwd);
          }
        }, 50);
        return;
      } else {
        alert("Failed to load project: " + e.message);
      }
    } finally {
      // If we are NOT recursing (i.e. error wasn't password related, or success), turn off loading.
      // If password related, we returned early.
      // But we need to make sure we don't leave spinner if we didn't return.
      // Actually `return ` above skips this finally?
      // No, `return ` inside catch executes finally.
      // We want to avoid turning off loading if we are about to recurse?
      // But the recursive call will set isLoading=true at start.
      // So turning it off here briefly is fine, or we can use a flag.
      // But wait: `setTimeout` makes it async.
      // So `finally` block runs BEFORE `setTimeout` callback.
      // So `isLoading` becomes false. Then prompt shows. Then recursive call sets true.
      // This is perfect! We want spinner to hide so user sees the app (or at least prompt).
      useStore.setState({ isLoading: false });
    }
  };

  const handleOfflineMode = () => {
    setShowProjectSelector(false);
  };

  // ... (handleProjectSwitch remains same)

  // 3. Auto-Save Logic (Configurable Interval)
  useEffect(() => {
    if (!true || !activeProjectId || showProjectSelector) return;

    const activeProject = data.projects.find(p => p.id === activeProjectId);
    const configInterval = activeProject?.conf?.autoSyncInterval;
    const globalInterval = data.settings.autoSyncInterval;
    const intervalMinutes = configInterval ?? globalInterval ?? 3;

    if (intervalMinutes <= 0) return; // Disable auto-sync if set to 0

    const interval = setInterval(async () => {
      // 只有拥有编辑权限 (isEditMode) 时，才将本地数据推送到服务端覆写
      if (isEditMode) {
        console.log(`[Edit Mode] Auto-saving current project to server (Interval: ${intervalMinutes}m)...`);
        await saveProject(activeProjectId);
      } else {
        // 全局只读模式下，不仅禁止推送（避免覆盖），同时从服务端静默拉取最新数据
        // 获取配置中的项目密码（如果该项目受密码保护）
        console.log(`[Read-Only Mode] Auto-fetching latest data from server (Interval: ${intervalMinutes}m)...`);
        const projectConfPw = activeProject?.conf?.password;
        await loadProject(activeProjectId, projectConfPw).catch(e => {
          console.warn('Auto-fetch in read-only mode failed:', e.message);
        });
      }
    }, intervalMinutes * 60 * 1000);

    return () => clearInterval(interval);
  }, [activeProjectId, true, showProjectSelector, data.settings.autoSyncInterval, data.projects, isEditMode]);


  const handleGlobalRefresh = async () => {
    useStore.setState({ isLoading: true });
    try {
      await fetchProjectList();
    } catch (e) {
      console.error(e);
    } finally {
      useStore.setState({ isLoading: false });
    }
  };

  const handleAddProject = () => {
    const name = prompt('Enter Hull Number or Project Name (e.g. PG-VLEC-H2684):');
    if (name) {
      addProject(name);
      // We assume addProject sets it as active? modify if needed
      // Actually addProject in store sets activeProjectId. 
      // We might want to auto-select it?
      // For new project, it's local first. 
      // We should probably just close selector?
      setShowProjectSelector(false);
    }
  };

  return (
    <div className="h-screen flex flex-col bg-[#F8FAFC] text-slate-900 selection:bg-teal-100 selection:text-teal-900 font-sans overflow-hidden">

      <style>{`
        @media print {
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}</style>

      {/* New Project Selector Overlay (Static Prototype) */}
      {showProjectSelector && !isLoading && (
        <div className="fixed inset-0 z-[10000] flex flex-col bg-[#F4F7F9] overflow-hidden">

          {/* Top Header */}
          <div className="bg-white/90 backdrop-blur-xl border-b border-slate-200/60 px-8 py-5 flex items-center justify-between shrink-0 shadow-sm z-10">
            <div className="flex items-center gap-6">
              {/* Refined Small Logo */}
              <div className="flex items-center gap-3">

                <div>
                  <h1 className="text-xl font-[1000] text-slate-800 tracking-tight uppercase leading-none">
                    Select <span className="text-teal-600">Project</span>
                  </h1>
                  <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mt-1">
                    Workspace Selection
                  </p>
                </div>
              </div>
            </div>

            {/* Storage Controls */}
            <div className="flex items-center gap-4">

              <button
                onClick={handleGlobalRefresh}
                className="p-2.5 bg-white hover:bg-teal-50 text-slate-500 hover:text-teal-600 rounded-full border border-slate-200 shadow-sm transition-all active:scale-95"
              >
                <RefreshCw size={16} />
              </button>
            </div>
          </div>

          {/* Grid Container (Scrollable Scroll Area) */}
          <div className="flex-1 overflow-y-auto px-8 py-10 w-full max-w-[1800px] mx-auto">

            {/* Grid Definition */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">

              {/* Company Logo Card (First Element) */}
              <div className="group relative flex flex-col items-center justify-center rounded-3xl border border-slate-100 bg-white shadow-lg shadow-slate-200/40 h-[260px] overflow-hidden">
                <div className="w-full h-full flex flex-col items-center justify-center p-4 bg-gradient-to-br from-white to-slate-50/50">
                  <img
                    src="https://i.postimg.cc/7LVr6n5m/PG-Logo.jpg"
                    alt="PG SHIPMANAGEMENT PTE. LTD. Logo"
                    className="w-[95%] sm:w-[85%] md:w-full max-w-xs h-auto object-contain drop-shadow-md opacity-95 transition-transform duration-700 hover:scale-[1.05]"
                  />
                </div>
              </div>

              {/* Project Items (Dynamic) */}
              {data.projects.map(p => {
                const theme = getProjectTheme(p.id, p.name);
                const total = p.drawings?.length || 0;
                const approved = p.drawings?.filter(d => d.status === 'Approved').length || 0;
                const completion = total > 0 ? Math.round((approved / total) * 100) : 0;

                return (
                  <button
                    key={p.id}
                    onClick={() => handleSelectProject(p.id)}
                    className={`group relative flex flex-col rounded-3xl border border-white shadow-lg shadow-slate-200/40 hover:shadow-2xl hover:-translate-y-1.5 transition-all duration-300 ease-out text-left h-[260px] overflow-hidden ${theme.bg}`}
                  >
                    {/* Top Color Banner */}
                    <div className={`h-2 w-full bg-gradient-to-r opacity-80 ${theme.iconBg}`} />

                    <div className="p-6 flex flex-col h-full w-full">
                      <div className="flex justify-between items-start mb-6 w-full gap-2">
                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl font-black shadow-inner shrink-0 ${theme.iconBg} ${theme.iconText} bg-opacity-20`}>
                          {p.name.substring(0, 2).toUpperCase()}
                        </div>
                        {total > 0 && (
                          <div className="bg-white/60 text-slate-500 text-[9px] font-black uppercase tracking-wider px-2 py-1 rounded-lg border border-slate-100 flex items-center gap-1.5 shadow-sm">
                            <div className={`w-1.5 h-1.5 rounded-full ${completion === 100 ? 'bg-emerald-500' : 'bg-amber-400 animate-pulse'}`} />
                            {completion === 100 ? 'Completed' : 'Active'}
                          </div>
                        )}
                      </div>

                      <h3 className={`text-xl font-[1000] uppercase tracking-tight mb-2 transition-colors line-clamp-2 ${theme.iconText}`}>
                        {p.name}
                      </h3>

                      {total > 0 ? (
                        <div className="mt-auto w-full">
                          <div className="flex justify-between items-end mb-1.5">
                            <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Progress</span>
                            <span className={`text-sm font-[1000] ${theme.iconText}`}>{completion}%</span>
                          </div>
                          <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden shadow-inner">
                            <div
                              className={`h-full rounded-full transition-all duration-1000 ease-out ${theme.iconBg} bg-opacity-80`}
                              style={{ width: `${completion}%` }}
                            />
                          </div>

                          <div className="flex justify-between items-center mt-4 pt-4 border-t border-slate-900/5">
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                              Assets: {total}
                            </span>
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                              {p.lastUpdated ? format(new Date(p.lastUpdated), 'MM/dd') : 'New'}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="mt-auto w-full">
                          <p className="text-xs font-black text-slate-400 uppercase tracking-widest mt-4 bg-white/50 p-3 rounded-xl inline-block border border-white/50">
                            Ready to Load
                          </p>
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}

              {/* Create New Project Card (Last Element) */}
              <button
                onClick={handleAddProject}
                className="group relative flex flex-col items-center justify-center gap-4 p-8 rounded-3xl border-2 border-dashed border-slate-300 hover:border-teal-400 bg-slate-50/50 hover:bg-teal-50/30 transition-all h-[260px]"
              >
                <div className="w-16 h-16 rounded-full bg-white shadow-sm border border-slate-100 group-hover:bg-teal-50 flex items-center justify-center text-slate-300 group-hover:text-teal-500 transition-colors">
                  <PlusCircle size={32} />
                </div>
                <span className="text-xs font-[1000] uppercase tracking-widest text-slate-400 group-hover:text-teal-600 text-center">Create<br />Workspace</span>
              </button>

            </div>

            {/* No Projects State Handled by New Project Card now */}

          </div>

          {/* Fixed Footer for Selector */}
          <div className="mt-auto pb-8 pt-4 w-full flex flex-col items-center justify-center gap-3 z-20 shrink-0 bg-gradient-to-t from-[#F4F7F9] to-transparent">
            <button onClick={handleOfflineMode} className="text-slate-400 hover:text-slate-600 text-[10px] font-black uppercase tracking-widest underline decoration-2 decoration-slate-200 underline-offset-4 hover:decoration-slate-400 transition-all">
              Skip / Enter Offline Mode (Local Cache)
            </button>
            {data.projects.length === 0 && (
              <span className="text-[9px] font-bold text-amber-500 bg-amber-50 px-3 py-1 rounded-full uppercase tracking-widest shadow-sm">
                Note: No projects found. Cloud sync might be required.
              </span>
            )}
          </div>
        </div>
      )}

      {/* Full Screen Loading Overlay */}
      {isLoading && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/20 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white rounded-3xl border-2 border-teal-200 shadow-2xl p-8 max-w-md mx-4">
            <div className="flex flex-col items-center gap-4">
              <div className="relative w-16 h-16">
                <div className="absolute inset-0 border-4 border-teal-100 rounded-full"></div>
                <div className="absolute inset-0 border-4 border-teal-600 rounded-full border-t-transparent animate-spin"></div>
                <Cloud className="absolute inset-0 m-auto text-teal-600 animate-pulse" size={28} />
              </div>
              <div className="text-center">
                <h3 className="text-lg font-[1000] text-slate-900 uppercase tracking-wider mb-2">Syncing Data</h3>
                <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">Synchronizing with Server...</p>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                <div className="h-full bg-gradient-to-r from-teal-500 to-teal-600 rounded-full animate-pulse w-full"></div>
              </div>
              <p className="text-xs text-slate-400 text-center mt-2">Uploading/Downloading latest project data</p>
            </div>
          </div>
        </div>
      )}

      {/* Navigation Header */}
      <header className="bg-white/80 backdrop-blur-2xl border-b border-slate-200/60 px-6 py-4 flex items-center justify-between z-[60] no-print shrink-0 shadow-sm">
        <div className="flex items-center space-x-10">
          {/* Logo Section */}
          <div className="flex items-center space-x-4 group cursor-pointer" onClick={() => setActiveTab('drawings')}>
            <div className="relative">
              <div className="bg-white p-1 rounded-xl shadow-md border border-slate-100 transition-transform group-hover:scale-105 active:scale-95 overflow-hidden">
                <img
                  src="https://i.postimg.cc/7LVr6n5m/PG-Logo.jpg"
                  alt="PG SHIPMANAGEMENT PTE. LTD. Logo"
                  className="h-8 w-auto object-contain"
                />
              </div>
              <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-teal-500 rounded-full border-2 border-white shadow-sm" />
            </div >
            <div className="flex flex-col">
              <h1 className="text-lg font-[1000] text-slate-900 tracking-tighter leading-none uppercase">
                PLAN APPROVAL <span className="text-teal-600">PLATFORM</span>
              </h1>
              <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-1">Technical Intelligence System</span>
            </div>
          </div >

          {/* Main Navigation Tabs */}
          < nav className="hidden md:flex items-center gap-1 bg-slate-100/50 backdrop-blur-sm p-1.5 rounded-full border border-slate-200/50" >
            <button
              onClick={() => setActiveTab('drawings')}
              className={`flex items-center space-x-2 px-6 py-2.5 rounded-full text-[10px] font-[1000] uppercase tracking-wider transition-all duration-300 ${activeTab === 'drawings' ? 'bg-white text-teal-700 shadow-sm ring-1 ring-slate-200/60' : 'text-slate-400 hover:text-slate-600 hover:bg-white/40'}`}
            >
              <FileStack size={14} strokeWidth={2.5} className={activeTab === 'drawings' ? 'text-teal-500' : 'text-slate-400'} />
              <span>Inventory</span>
            </button>
            <button
              onClick={() => isEditMode && setActiveTab('reports')}
              disabled={!isEditMode}
              className={`flex items-center space-x-2 px-6 py-2.5 rounded-full text-[10px] font-[1000] uppercase tracking-wider transition-all duration-300 ${activeTab === 'reports' ? 'bg-white text-teal-700 shadow-sm ring-1 ring-slate-200/60' : !isEditMode ? 'text-slate-300 cursor-not-allowed opacity-50' : 'text-slate-400 hover:text-slate-600 hover:bg-white/40'}`}
              title={!isEditMode ? "Unlock Edit Mode to Access" : "Intelligence Dashboard"}
            >
              {!isEditMode ? <Lock size={14} /> : <LayoutDashboard size={14} strokeWidth={2.5} className={activeTab === 'reports' ? 'text-teal-500' : 'text-slate-400'} />}
              <span>Intelligence</span>
            </button>
            <button
              onClick={() => isEditMode && setActiveTab('dailylog')}
              disabled={!isEditMode}
              className={`flex items-center space-x-2 px-6 py-2.5 rounded-full text-[10px] font-[1000] uppercase tracking-wider transition-all duration-300 ${activeTab === 'dailylog' ? 'bg-white text-teal-700 shadow-sm ring-1 ring-slate-200/60' : !isEditMode ? 'text-slate-300 cursor-not-allowed opacity-50' : 'text-slate-400 hover:text-slate-600 hover:bg-white/40'}`}
              title={!isEditMode ? "Unlock Edit Mode to Access" : "Daily Change Log"}
            >
              {!isEditMode ? <Lock size={14} /> : <Calendar size={14} strokeWidth={2.5} className={activeTab === 'dailylog' ? 'text-teal-500' : 'text-slate-400'} />}
              <span>Log</span>
            </button>
            <button
              onClick={() => setActiveTab('tracker')}
              className={`flex items-center space-x-2 px-6 py-2.5 rounded-full text-[10px] font-[1000] uppercase tracking-wider transition-all duration-300 ${activeTab === 'tracker' ? 'bg-white text-teal-700 shadow-sm ring-1 ring-slate-200/60' : 'text-slate-400 hover:text-slate-600 hover:bg-white/40'}`}
            >
              <ClipboardCheck size={14} strokeWidth={2.5} className={activeTab === 'tracker' ? 'text-teal-500' : 'text-slate-400'} />
              <span>Tracker</span>
            </button>
            <button
              onClick={() => isEditMode && setActiveTab('settings')}
              disabled={!isEditMode}
              className={`flex items-center space-x-2 px-6 py-2.5 rounded-full text-[10px] font-[1000] uppercase tracking-wider transition-all duration-300 ${activeTab === 'settings' ? 'bg-white text-teal-700 shadow-sm ring-1 ring-slate-200/60' : !isEditMode ? 'text-slate-300 cursor-not-allowed opacity-50' : 'text-slate-400 hover:text-slate-600 hover:bg-white/40'}`}
              title={!isEditMode ? "Unlock Edit Mode to Access" : "Configuration"}
            >
              {!isEditMode ? <Lock size={14} /> : <SettingsIcon size={14} strokeWidth={2.5} className={activeTab === 'settings' ? 'text-teal-500' : 'text-slate-400'} />}
              <span>Config</span>
            </button>
            <button
              onClick={() => setActiveTab('manual')}
              className={`flex items-center space-x-2 px-6 py-2.5 rounded-full text-[10px] font-[1000] uppercase tracking-wider transition-all duration-300 ${activeTab === 'manual' ? 'bg-white text-teal-700 shadow-sm ring-1 ring-slate-200/60' : 'text-slate-400 hover:text-slate-600 hover:bg-white/40'}`}
            >
              <BookOpen size={14} strokeWidth={2.5} className={activeTab === 'manual' ? 'text-teal-500' : 'text-slate-400'} />
              <span>Guide</span>
            </button>
          </nav >
        </div >

        <div className="flex items-center space-x-4">
          <div className="h-8 w-px bg-slate-200/80 mx-1"></div>

          <div className="relative group">
            <button
              onClick={() => setShowProjectSelector(true)}
              className="flex items-center space-x-4 pl-4 pr-3 py-2 bg-slate-900 rounded-2xl hover:bg-black transition-all shadow-xl shadow-slate-900/10 active:scale-[0.98]"
            >
              <div className="text-left min-w-[120px]">
                <div className="text-[8px] font-black text-slate-500 uppercase tracking-widest leading-none mb-1 flex items-center gap-1.5">
                  {<Cloud size={10} className="text-emerald-400" />}
                  Cloud Registry
                </div>
                <div className="text-[12px] font-[1000] text-white truncate max-w-[140px] tracking-tight">{currentProject?.name || 'SELECT SHIP'}</div>
              </div>
              <ChevronDown size={14} className="text-slate-500" />
            </button>
            {/* Dropdown Removed as requested */}
          </div>
        </div>
      </header >

      {/* Main Container */}
      < main className="flex-1 flex flex-col overflow-auto px-6 py-4" >
        <div className="max-w-[1800px] mx-auto w-full flex-1 flex flex-col gap-4">
          {activeTab === 'drawings' && <CommandBar />}

          <div className="flex-1 bg-white rounded-[2rem] border border-slate-200 shadow-2xl shadow-slate-200/40 overflow-hidden flex flex-col">
            {activeTab === 'drawings' && <DrawingList />}
            {activeTab === 'reports' && (
              <ErrorBoundary>
                <Reports />
              </ErrorBoundary>
            )}
            {activeTab === 'settings' && <Settings />}
            {activeTab === 'dailylog' && <DailyLogReport />}
            {activeTab === 'tracker' && <ReviewTracker />}
            {activeTab === 'manual' && <Manual />}
          </div>
        </div>
      </main >

      {/* Footer */}
      < footer className="bg-white/40 backdrop-blur-md border-t border-slate-200/50 px-8 py-3 text-[8px] font-[1000] uppercase tracking-[0.3em] text-slate-400 flex flex-col md:flex-row justify-between no-print items-center shrink-0" >
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-2">
            <span className="text-slate-300 font-bold tracking-normal">© 2025</span>
            <span className="text-slate-900 tracking-[0.4em]">PG SHIPMANAGEMENT</span>
          </div>
          <div className="hidden md:flex items-center gap-2">
            <Layers size={12} className="text-teal-500/30" />
            <span>Entities Logged: {currentProject?.drawings?.length || 0}</span>
          </div>
          <div className="text-slate-400 font-bold tracking-widest uppercase opacity-80 flex items-center gap-2">
            <div className="w-1 h-1 bg-teal-500 rounded-full" />
            Developped by Kevin @ Newbuilding
          </div>
        </div>

        <div className="flex items-center gap-8 mt-2 md:mt-0">

          <div className="flex items-center gap-1.5 text-slate-300 group">
            <Code size={12} className="group-hover:text-teal-500 transition-colors" />
            <span className="tracking-widest">PA-V3.1-LTD</span>
          </div>
        </div>
      </footer >
    </div >
  );
};

export default App;

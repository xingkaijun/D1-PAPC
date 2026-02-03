

import React, { useState, useEffect } from 'react';
import { useStore } from './store';
import { Reports } from './components/Reports';
import { DrawingList } from './components/DrawingList';
import { Settings } from './components/Settings';
import { CommandBar } from './components/CommandBar';
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
  ChevronRight
} from 'lucide-react';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'drawings' | 'reports' | 'settings' | 'manual'>('drawings');
  const {
    data,
    activeProjectId,
    setActiveProject,
    addProject,
    isLoading,
    fetchProjectListFromWebDAV,
    loadProjectFromWebDAV,
    pushProjectToWebDAV,
    fetchGlobalSettingsFromWebDAV,
    isEditMode,
    setStorageMode
  } = useStore();

  const currentProject = data.projects.find(p => p.id === activeProjectId);

  const [showProjectSelector, setShowProjectSelector] = useState(true);

  // Helper function to check Cloud configuration (WebDAV or OneDrive)
  const getWebDAVUrl = () => {
    const envUrl = import.meta.env.VITE_WEBDAV_URL;
    return (envUrl && envUrl.trim() !== '') ? envUrl : data.settings.webdavUrl;
  };

  const currentStorageType = data.settings.storage?.type || 'WEBDAV';
  // If OneDrive, we assume it's configured via Proxy/Env. If WebDAV, we need URL.
  const isWebDAVConfigured = currentStorageType === 'ONEDRIVE' ? true : !!getWebDAVUrl();

  const handleStorageToggle = async () => {
    const newType = currentStorageType === 'WEBDAV' ? 'ONEDRIVE' : 'WEBDAV';
    setStorageMode({ type: newType });

    // Trigger refresh to test connection/list
    useStore.setState({ isLoading: true });
    try {
      await fetchProjectListFromWebDAV();
    } catch (e) {
      console.warn("Switch refresh failed", e);
    } finally {
      useStore.setState({ isLoading: false });
    }
  };

  // 1. Startup Logic: Server First - FETCH LIST ONLY
  useEffect(() => {
    const initApp = async () => {
      // If we have an active project persisted, we might want to clear it or let user re-select?
      // Requirement: "Before loading project do not enter main page". So we force selection.
      // We don't wipe store, but we require selection.

      if (!isWebDAVConfigured) {
        // No WebDAV, maybe go straight to Offline if we have projects? 
        // Or show selector with local projects?
        // Let's show selector regardless, listing local cache.
        useStore.setState({ isLoading: false });
        return;
      }

      useStore.setState({ isLoading: true });
      try {
        // Try to fetch Server List
        await fetchGlobalSettingsFromWebDAV();
        await fetchProjectListFromWebDAV();
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
      if (isWebDAVConfigured) {
        // Pass password if provided
        await loadProjectFromWebDAV(projectId, passwordInput);
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
  // 3. Auto-Save Logic (Configurable Interval)
  useEffect(() => {
    if (!isWebDAVConfigured || !activeProjectId || showProjectSelector) return;

    const activeProject = data.projects.find(p => p.id === activeProjectId);
    const configInterval = activeProject?.conf?.autoSyncInterval;
    const globalInterval = data.settings.autoSyncInterval;
    const intervalMinutes = configInterval ?? globalInterval ?? 3;

    if (intervalMinutes <= 0) return; // Disable auto-sync if set to 0

    const interval = setInterval(async () => {
      console.log(`Auto-saving current project (Interval: ${intervalMinutes}m)...`);
      await pushProjectToWebDAV(activeProjectId);
    }, intervalMinutes * 60 * 1000);

    return () => clearInterval(interval);
  }, [activeProjectId, isWebDAVConfigured, showProjectSelector, data.settings.autoSyncInterval, data.projects]);


  const handleGlobalRefresh = async () => {
    useStore.setState({ isLoading: true });
    try {
      await fetchProjectListFromWebDAV();
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
      // Let's find the new ID or just wait for list refresh? 
      // For new project, it's local first. 
      // We should probably just close selector?
      setShowProjectSelector(false);
    }
  };

  const carouselRef = React.useRef<HTMLDivElement>(null);

  const scrollLeft = () => {
    if (carouselRef.current) {
      carouselRef.current.scrollBy({ left: -400, behavior: 'smooth' });
    }
  };

  const scrollRight = () => {
    if (carouselRef.current) {
      carouselRef.current.scrollBy({ left: 400, behavior: 'smooth' });
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

      {/* Project Selector Overlay (Blocking) */}
      {showProjectSelector && !isLoading && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-50 overflow-hidden">
          <div className="bg-white/90 backdrop-blur-2xl w-full max-w-[95vw] h-[90vh] rounded-[3rem] shadow-2xl border border-white/50 flex flex-col overflow-hidden animate-in zoom-in-95 duration-500">

            {/* Selector Header */}
            <div className="p-10 pb-6 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-5">
                <div className="bg-white p-4 rounded-3xl shadow-sm border border-slate-100 overflow-hidden shrink-0 w-32 h-32 flex items-center justify-center">
                  <img
                    src="https://i.postimg.cc/sf8Qvb1Q/PACIFIC-GAS-logo-(yuan-se-tou-ming-di-04.png"
                    alt="Pacific Gas Logo"
                    className="w-full h-auto object-contain"
                  />
                </div>
                <div>
                  <h1 className="text-2xl font-[1000] text-slate-900 tracking-tighter uppercase mb-2">Select Project</h1>
                  <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Choose a registry to load from {isWebDAVConfigured ? 'WebDAV Cloud' : 'Local Cache'}</p>
                </div>
              </div>
              <div className="flex gap-4">
                <button
                  onClick={handleStorageToggle}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl border border-slate-200 text-[10px] font-black uppercase tracking-widest transition-all"
                  title="Switch Cloud Provider"
                >
                  <div className={`w-2 h-2 rounded-full ${isWebDAVConfigured ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                  {currentStorageType} {isWebDAVConfigured ? 'Ready' : 'Offline'}
                </button>
                <button onClick={handleGlobalRefresh} className="p-4 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl transition-all active:scale-95">
                  <RefreshCw size={20} />
                </button>
              </div>
            </div>

            {/* Project Carousel Container */}
            <div className="flex-1 relative w-full overflow-hidden flex flex-col justify-center">

              {/* Left Arrow */}
              <button
                onClick={scrollLeft}
                className="absolute left-10 z-10 w-24 h-24 rounded-full bg-white/80 backdrop-blur-md shadow-2xl border border-slate-100 flex items-center justify-center text-slate-400 hover:text-teal-600 hover:scale-110 active:scale-95 transition-all"
              >
                <ChevronLeft size={48} strokeWidth={3} />
              </button>

              {/* Right Arrow */}
              <button
                onClick={scrollRight}
                className="absolute right-10 z-10 w-24 h-24 rounded-full bg-white/80 backdrop-blur-md shadow-2xl border border-slate-100 flex items-center justify-center text-slate-400 hover:text-teal-600 hover:scale-110 active:scale-95 transition-all"
              >
                <ChevronRight size={48} strokeWidth={3} />
              </button>

              {/* Carousel Scroll Area */}
              <div
                ref={carouselRef}
                className="flex items-center gap-12 overflow-x-auto px-40 py-10 scroll-smooth w-full h-full [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none']"
                style={{ scrollSnapType: 'x mandatory' }}
              >
                {/* Company Logo Card */}
                {/* Company Logo Card */}
                <div
                  className="group shrink-0 relative flex flex-col items-center justify-center rounded-[3rem] border border-slate-100 bg-slate-50 shadow-xl shadow-slate-200/50 w-[450px] h-[65vh] overflow-hidden"
                  style={{ scrollSnapAlign: 'center' }}
                >
                  <div className="w-full h-full flex items-center justify-center p-8">
                    <img
                      src="https://i.postimg.cc/sf8Qvb1Q/PACIFIC-GAS-logo-(yuan-se-tou-ming-di-04.png"
                      alt="Pacific Gas Logo"
                      className="w-full h-auto max-h-[80%] object-contain drop-shadow-md opacity-90 scale-[3]"
                    />
                    {/* Bottom Mask to hide cut-off text */}
                    <div className="absolute bottom-0 left-0 right-0 h-48 bg-slate-50" />
                  </div>
                </div>

                {/* Project Items */}
                {data.projects.map(p => {
                  const theme = getProjectTheme(p.id, p.name);
                  return (
                    <button
                      key={p.id}
                      onClick={() => handleSelectProject(p.id)}
                      className={`group shrink-0 relative flex flex-col p-12 rounded-[3rem] border shadow-2xl shadow-slate-200/50 hover:shadow-[0_20px_50px_-12px_rgba(0,0,0,0.1)] hover:scale-[1.02] transition-all text-left w-[450px] h-[65vh] ${theme.bg} ${theme.border}`}
                      style={{ scrollSnapAlign: 'center' }}
                    >
                      <div className="mb-auto w-full">
                        <div className={`w-28 h-28 rounded-3xl bg-gradient-to-br mb-10 flex items-center justify-center text-5xl font-black shadow-inner ${theme.iconBg} ${theme.iconText}`}>
                          {p.name.substring(0, 2).toUpperCase()}
                        </div>
                        <h3 className="text-3xl font-[1000] text-slate-800 uppercase tracking-tight mb-4 group-hover:text-teal-700 transition-colors leading-none break-words">{p.name}</h3>

                        {/* Stats Grid */}
                        {(p.drawings?.length || 0) > 0 ? (
                          <div className="mt-8 space-y-6">
                            {/* Progress Bar */}
                            <div>
                              <div className="flex justify-between items-end mb-2">
                                <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Completion</span>
                                <span className="text-2xl font-[1000] text-teal-600">
                                  {Math.round((p.drawings?.filter(d => d.status === 'Approved').length || 0) / (p.drawings?.length || 1) * 100)}%
                                </span>
                              </div>
                              <div className="w-full h-3 bg-white/50 rounded-full overflow-hidden border border-white/50">
                                <div
                                  className="h-full bg-teal-500 rounded-full transition-all duration-1000 ease-out shadow-sm"
                                  style={{ width: `${Math.round((p.drawings?.filter(d => d.status === 'Approved').length || 0) / (p.drawings?.length || 1) * 100)}%` }}
                                />
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                              <div className="bg-white/60 p-4 rounded-2xl border border-white/50">
                                <span className="block text-[9px] font-black uppercase text-slate-400 tracking-wider mb-1">Total Items</span>
                                <span className="block text-xl font-[1000] text-slate-700">{p.drawings?.length}</span>
                              </div>
                              <div className="bg-teal-50/80 p-4 rounded-2xl border border-teal-100/50">
                                <span className="block text-[9px] font-black uppercase text-teal-600/70 tracking-wider mb-1">Approved</span>
                                <span className="block text-xl font-[1000] text-teal-600">
                                  {p.drawings?.filter(d => d.status === 'Approved').length || 0}
                                </span>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <p className="text-xs font-black text-slate-400 uppercase tracking-widest mt-4 bg-white/50 p-3 rounded-xl inline-block border border-white/50">
                            Ready to Load
                          </p>
                        )}
                      </div>

                      <div className="mt-8 flex items-center justify-between border-t border-slate-900/5 pt-6">
                        <span className="text-[10px] font-bold text-slate-400/80 uppercase tracking-wider">
                          Updated: {p.lastUpdated ? format(new Date(p.lastUpdated), 'yyyy-MM-dd') : 'N/A'}
                        </span>
                        <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-slate-300 group-hover:bg-teal-600 group-hover:text-white transition-all shadow-sm">
                          <ChevronDown size={20} className="-rotate-90" />
                        </div>
                      </div>
                    </button>
                  );
                })}

                {/* New Project Card (Moved to End) */}
                <button
                  onClick={handleAddProject}
                  className="group shrink-0 relative flex flex-col items-center justify-center gap-6 p-10 rounded-[3rem] border-4 border-dashed border-slate-200 hover:border-teal-400 hover:bg-teal-50/50 transition-all w-[450px] h-[65vh]"
                  style={{ scrollSnapAlign: 'center' }}
                >
                  <div className="w-32 h-32 rounded-full bg-slate-100 group-hover:bg-teal-100 flex items-center justify-center text-slate-300 group-hover:text-teal-600 transition-colors">
                    <PlusCircle size={64} />
                  </div>
                  <span className="text-sm font-[1000] uppercase tracking-widest text-slate-400 group-hover:text-teal-600">Create New Registry</span>
                </button>

                {data.projects.length === 0 && (
                  <div className="shrink-0 w-[300px] flex items-center justify-center opacity-30 px-10">
                    <div className="text-center">
                      <h3 className="text-2xl font-[1000] text-slate-300 uppercase tracking-tighter mb-2">No Projects</h3>
                      <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Add one to start</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Footer Actions */}
            <div className="p-8 border-t border-slate-100 bg-slate-50/50 flex justify-center">
              <button onClick={handleOfflineMode} className="text-slate-400 hover:text-slate-600 text-[10px] font-black uppercase tracking-widest underline decoration-2 decoration-slate-200 underline-offset-4 hover:decoration-slate-400 transition-all">
                Enter Offline Mode (Use Cached Data)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Full Screen Loading Overlay */}
      {isLoading && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/20 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white rounded-3xl border-2 border-teal-200 shadow-2xl p-8 max-w-md mx-4">
            <div className="flex flex-col items-center gap-4">
              {/* Spinner */}
              <div className="relative w-16 h-16">
                <div className="absolute inset-0 border-4 border-teal-100 rounded-full"></div>
                <div className="absolute inset-0 border-4 border-teal-600 rounded-full border-t-transparent animate-spin"></div>
                <Cloud className="absolute inset-0 m-auto text-teal-600 animate-pulse" size={28} />
              </div>

              {/* Loading Text */}
              <div className="text-center">
                <h3 className="text-lg font-[1000] text-slate-900 uppercase tracking-wider mb-2">
                  Syncing Data
                </h3>
                <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">
                  Synchronizing with Server...
                </p>
              </div>

              {/* Progress Indicator */}
              <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                <div className="h-full bg-gradient-to-r from-teal-500 to-teal-600 rounded-full animate-pulse w-full"></div>
              </div>

              <p className="text-xs text-slate-400 text-center mt-2">
                Uploading/Downloading latest project data
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Navigation Header */}
      <header className="bg-white/80 backdrop-blur-2xl border-b border-slate-200/60 px-6 py-4 flex items-center justify-between sticky top-0 z-[60] no-print shrink-0 shadow-sm">
        <div className="flex items-center space-x-10">
          {/* Logo Section */}
          <div className="flex items-center space-x-4 group cursor-pointer" onClick={() => setActiveTab('drawings')}>
            <div className="relative">
              <div className="bg-white p-1 rounded-xl shadow-md border border-slate-100 transition-transform group-hover:scale-105 active:scale-95 overflow-hidden">
                <img
                  src="https://i.postimg.cc/sf8Qvb1Q/PACIFIC-GAS-logo-(yuan-se-tou-ming-di-04.png"
                  alt="Pacific Gas Logo"
                  className="h-8 w-auto object-contain"
                />
              </div>
              <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-teal-500 rounded-full border-2 border-white shadow-sm" />
            </div>
            <div className="flex flex-col">
              <h1 className="text-lg font-[1000] text-slate-900 tracking-tighter leading-none uppercase">
                PLAN APPROVAL <span className="text-teal-600">PLATFORM</span>
              </h1>
              <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-1">Technical Intelligence System</span>
            </div>
          </div>

          {/* Main Navigation Tabs */}
          <nav className="hidden md:flex items-center gap-1 bg-slate-100/50 backdrop-blur-sm p-1.5 rounded-full border border-slate-200/50">
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
          </nav>
        </div>

        <div className="flex items-center space-x-4">
          <div className="h-8 w-px bg-slate-200/80 mx-1"></div>

          <div className="relative group">
            <button
              onClick={() => setShowProjectSelector(true)}
              className="flex items-center space-x-4 pl-4 pr-3 py-2 bg-slate-900 rounded-2xl hover:bg-black transition-all shadow-xl shadow-slate-900/10 active:scale-[0.98]"
            >
              <div className="text-left min-w-[120px]">
                <div className="text-[8px] font-black text-slate-500 uppercase tracking-widest leading-none mb-1 flex items-center gap-1.5">
                  {isWebDAVConfigured ? <Cloud size={10} className="text-emerald-400" /> : <CloudOff size={10} className="text-slate-600" />}
                  Cloud Registry
                </div>
                <div className="text-[12px] font-[1000] text-white truncate max-w-[140px] tracking-tight">{currentProject?.name || 'SELECT SHIP'}</div>
              </div>
              <ChevronDown size={14} className="text-slate-500" />
            </button>
            {/* Dropdown Removed as requested */}
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 flex flex-col overflow-hidden px-6 py-4">
        <div className="max-w-[1800px] mx-auto w-full flex-1 flex flex-col gap-4 overflow-hidden">
          {activeTab === 'drawings' && <CommandBar />}

          <div className="flex-1 bg-white rounded-[2rem] border border-slate-200 shadow-2xl shadow-slate-200/40 overflow-hidden flex flex-col">
            {activeTab === 'drawings' && <DrawingList />}
            {activeTab === 'reports' && (
              <ErrorBoundary>
                <Reports />
              </ErrorBoundary>
            )}
            {activeTab === 'settings' && <Settings />}
            {activeTab === 'manual' && <Manual />}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white/40 backdrop-blur-md border-t border-slate-200/50 px-8 py-3 text-[8px] font-[1000] uppercase tracking-[0.3em] text-slate-400 flex flex-col md:flex-row justify-between no-print items-center shrink-0">
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-2">
            <span className="text-slate-300 font-bold tracking-normal">© 2025</span>
            <span className="text-slate-900 tracking-[0.4em]">PACIFIC GAS PTE. LTD.</span>
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
          <button
            onClick={handleStorageToggle}
            className="flex items-center gap-3 hover:bg-slate-100 rounded-lg px-2 py-1 transition-all cursor-pointer"
            title="Click to Switch Storage Provider"
          >
            <div className={`w-2 h-2 rounded-full transition-all duration-1000 ${isWebDAVConfigured ? 'bg-emerald-500 shadow-lg shadow-emerald-500/50' : 'bg-slate-300'} `} />
            <span className={isWebDAVConfigured ? 'text-emerald-600 font-black' : 'text-slate-400'}>
              Cloud Service: {isWebDAVConfigured ? `${currentStorageType} CONNECTED` : 'OFFLINE'}
            </span>
          </button>
          <div className="flex items-center gap-1.5 text-slate-300 group">
            <Code size={12} className="group-hover:text-teal-500 transition-colors" />
            <span className="tracking-widest">PA-V3.1-LTD</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;

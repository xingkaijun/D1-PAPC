
import React, { useState, useEffect } from 'react';
import { useStore } from './store';
import { Reports } from './components/Reports';
import { DrawingList } from './components/DrawingList';
import { Settings } from './components/Settings';
import { CommandBar } from './components/CommandBar';
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
  BookOpen
} from 'lucide-react';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'drawings' | 'reports' | 'settings' | 'manual'>('drawings');
  const { data, activeProjectId, setActiveProject, addProject, isLoading, fetchAllProjectsFromWebDAV, fetchGlobalSettingsFromWebDAV } = useStore();

  const currentProject = data.projects.find(p => p.id === activeProjectId);

  // Helper function to check WebDAV configuration (considers both env vars and store settings)
  const getWebDAVUrl = () => {
    const envUrl = import.meta.env.VITE_WEBDAV_URL;
    return (envUrl && envUrl.trim() !== '') ? envUrl : data.settings.webdavUrl;
  };

  const isWebDAVConfigured = !!getWebDAVUrl();

  // Auto-scan WebDAV projects on app startup
  useEffect(() => {
    const autoScanProjects = async () => {
      // Always show loading state on initial app load
      const startTime = Date.now();
      useStore.setState({ isLoading: true });

      try {
        // Only scan if WebDAV is configured
        if (!isWebDAVConfigured) {
          // Wait at least 300ms to show loading state
          const elapsed = Date.now() - startTime;
          if (elapsed < 300) {
            await new Promise(resolve => setTimeout(resolve, 300 - elapsed));
          }
          useStore.setState({ isLoading: false });
          return;
        }

        // Always try to fetch global settings (Roster, Leads, etc.)
        try {
          await data.settings.webdavUrl && useStore.getState().fetchGlobalSettingsFromWebDAV();
        } catch (err) {
          console.warn("Failed to auto-fetch settings", err);
        }

        // Skip if projects already exist (avoid redundant scans/overwrites)
        if (data.projects.length > 0) {
          console.log('Projects already loaded from cache');
          // Wait at least 500ms to show loading state
          const elapsed = Date.now() - startTime;
          if (elapsed < 500) {
            await new Promise(resolve => setTimeout(resolve, 500 - elapsed));
          }
          useStore.setState({ isLoading: false });
          return;
        }

        try {
          await fetchAllProjectsFromWebDAV();
          console.log('Auto-scan completed: Projects loaded from WebDAV');
        } catch (error) {
          console.error('Auto-scan failed:', error);
          // Fail silently - user can still manually scan via Settings
        }

        // Ensure minimum loading time
        const elapsed = Date.now() - startTime;
        if (elapsed < 500) {
          await new Promise(resolve => setTimeout(resolve, 500 - elapsed));
        }
      } finally {
        useStore.setState({ isLoading: false });
      }
    };

    autoScanProjects();
  }, []); // Only run once on component mount

  const handleAddProject = () => {
    const name = prompt('Enter Hull Number or Project Name (e.g. PG-VLEC-H2684):');
    if (name) addProject(name);
  };

  return (
    <div className="h-screen flex flex-col bg-[#F8FAFC] text-slate-900 selection:bg-teal-100 selection:text-teal-900 font-sans overflow-hidden">
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
                  Loading from WebDAV Server
                </p>
              </div>

              {/* Progress Indicator */}
              <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                <div className="h-full bg-gradient-to-r from-teal-500 to-teal-600 rounded-full animate-pulse w-full"></div>
              </div>

              <p className="text-xs text-slate-400 text-center mt-2">
                Please wait while we sync your projects and settings...
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
          <nav className="flex items-center bg-slate-100 p-1 rounded-2xl border border-slate-200/50 space-x-1">
            <button
              onClick={() => setActiveTab('drawings')}
              className={`flex items-center space-x-2 px-6 py-2 rounded-xl text-[9px] font-[1000] uppercase tracking-wider transition-all duration-300 ${activeTab === 'drawings' ? 'bg-white text-teal-600 shadow-xl shadow-slate-200/20 ring-1 ring-slate-200/50' : 'text-slate-500 hover:text-slate-800'}`}
            >
              <FileStack size={14} strokeWidth={2.5} />
              <span>Inventory</span>
            </button>
            <button
              onClick={() => setActiveTab('reports')}
              className={`flex items-center space-x-2 px-6 py-2 rounded-xl text-[9px] font-[1000] uppercase tracking-wider transition-all duration-300 ${activeTab === 'reports' ? 'bg-white text-teal-600 shadow-xl shadow-slate-200/20 ring-1 ring-slate-200/50' : 'text-slate-500 hover:text-slate-800'}`}
            >
              <LayoutDashboard size={14} strokeWidth={2.5} />
              <span>Intelligence</span>
            </button>
            <button
              onClick={() => setActiveTab('settings')}
              className={`flex items-center space-x-2 px-6 py-2 rounded-xl text-[9px] font-[1000] uppercase tracking-wider transition-all duration-300 ${activeTab === 'settings' ? 'bg-white text-teal-600 shadow-xl shadow-slate-200/20 ring-1 ring-slate-200/50' : 'text-slate-500 hover:text-slate-800'}`}
            >
              <SettingsIcon size={14} strokeWidth={2.5} />
              <span>Config</span>
            </button>
            <button
              onClick={() => setActiveTab('manual')}
              className={`flex items-center space-x-2 px-6 py-2 rounded-xl text-[9px] font-[1000] uppercase tracking-wider transition-all duration-300 ${activeTab === 'manual' ? 'bg-white text-teal-600 shadow-xl shadow-slate-200/20 ring-1 ring-slate-200/50' : 'text-slate-500 hover:text-slate-800'}`}
            >
              <BookOpen size={14} strokeWidth={2.5} />
              <span>Guide</span>
            </button>
          </nav>
        </div>

        <div className="flex items-center space-x-4">
          <div className="h-8 w-px bg-slate-200/80 mx-1"></div>

          <div className="relative group">
            <button className="flex items-center space-x-4 pl-4 pr-3 py-2 bg-slate-900 rounded-2xl hover:bg-black transition-all shadow-xl shadow-slate-900/10 active:scale-[0.98]">
              <div className="text-left min-w-[120px]">
                <div className="text-[8px] font-black text-slate-500 uppercase tracking-widest leading-none mb-1 flex items-center gap-1.5">
                  {isWebDAVConfigured ? <Cloud size={10} className="text-emerald-400" /> : <CloudOff size={10} className="text-slate-600" />}
                  Cloud Registry
                </div>
                <div className="text-[12px] font-[1000] text-white truncate max-w-[140px] tracking-tight">{currentProject?.name || 'SELECT SHIP'}</div>
              </div>
              <ChevronDown size={14} className="text-slate-500" />
            </button>

            <div className="absolute right-0 top-full mt-3 w-64 bg-white border border-slate-200 rounded-3xl shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-[100] p-3 animate-in fade-in slide-in-from-top-2">
              <div className="text-[8px] font-black text-slate-400 uppercase px-4 py-2 tracking-widest border-b border-slate-50 mb-2">Fleet Inventory</div>
              <div className="max-h-60 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-100 px-1">
                {data.projects.map(p => (
                  <button
                    key={p.id}
                    onClick={() => setActiveProject(p.id)}
                    className={`w-full text-left px-4 py-3 rounded-2xl text-[10px] font-black uppercase tracking-tight flex items-center justify-between mb-1 transition-all ${activeProjectId === p.id ? 'bg-teal-50 text-teal-700 shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}
                  >
                    <span className="truncate">{p.name}</span>
                    {activeProjectId === p.id && <div className="w-1.5 h-1.5 rounded-full bg-teal-600" />}
                  </button>
                ))}
                {data.projects.length === 0 && <div className="py-6 text-center text-[8px] font-black text-slate-300 uppercase italic">No Projects Found</div>}
              </div>
              <div className="h-px bg-slate-100 my-2"></div>
              <button
                onClick={handleAddProject}
                className="w-full text-left px-4 py-3 rounded-2xl text-[9px] font-black uppercase tracking-widest text-teal-600 hover:bg-teal-50 flex items-center space-x-3 transition-all active:scale-95"
              >
                <PlusCircle size={16} strokeWidth={2.5} />
                <span>New Project Registry</span>
              </button>
            </div>
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
            <span>Entities Logged: {currentProject?.drawings.length || 0}</span>
          </div>
          <div className="text-slate-400 font-bold tracking-widest uppercase opacity-80 flex items-center gap-2">
            <div className="w-1 h-1 bg-teal-500 rounded-full" />
            Developped by Kevin @ Newbuilding
          </div>
        </div>

        <div className="flex items-center gap-8 mt-2 md:mt-0">
          <div className="flex items-center gap-3">
            <div className={`w-2 h-2 rounded-full transition-all duration-1000 ${isWebDAVConfigured ? 'bg-emerald-500 shadow-lg shadow-emerald-500/50' : 'bg-slate-300'}`} />
            <span className={isWebDAVConfigured ? 'text-emerald-600 font-black' : 'text-slate-400'}>
              Cloud Service: {isWebDAVConfigured ? 'WEBDAV CONNECTED' : 'OFFLINE'}
            </span>
          </div>
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

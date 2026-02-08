import React, { useState, useEffect, useRef } from 'react';
import { useStore } from '../store';
import {
  Database, Users, Trash2,
  Plus, UserCheck, RefreshCw, Send, Download, Shield, Info, Lock, X, Eye, EyeOff, AlertCircle,
  Clock, CalendarDays, Save, Upload, Link as LinkIcon, CheckCircle, LayoutDashboard,
  User, Calendar, ShieldCheck, Activity, HeartPulse
} from 'lucide-react';
import { format } from 'date-fns';

export const Settings: React.FC = () => {
  const { data, updateSettings, updateProjectConfig, syncWithWebDAV, saveSettingsToWebDAV, loadProjectFromWebDAV, fetchAllProjectsFromWebDAV, testWebDAVConnection, isLoading, activeProjectId, error, clearError, restoreProject, setStorageMode } = useStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const project = data.projects.find(p => p.id === activeProjectId);

  // Use project config if available, otherwise global defaults (as template/fallback)
  const activeSettings = project?.conf || data.settings;
  const globalSettings = data.settings; // For WebDAV only

  const activeDisciplines = React.useMemo(() => {
    if (!project) return [];
    return Array.from(new Set(project.drawings.map(d => d.discipline))).filter(Boolean).sort();
  }, [project]);

  // Global Settings for WebDAV
  // Storage Settings
  const [storageType, setStorageType] = useState<'WEBDAV' | 'ONEDRIVE'>(globalSettings.storage?.type || 'WEBDAV');
  const [webdavUrl, setWebdavUrl] = useState(globalSettings.webdavUrl || globalSettings.storage?.webdav?.url || '');
  const [webdavUser, setWebdavUser] = useState(globalSettings.webdavUser || globalSettings.storage?.webdav?.username || '');
  const [webdavPass, setWebdavPass] = useState(globalSettings.webdavPass || globalSettings.storage?.webdav?.password || '');
  const defaultProxyUrl = import.meta.env.DEV ? 'http://localhost:3001/api/proxy' : '/api/proxy';
  const [onedriveProxyUrl, setOnedriveProxyUrl] = useState(globalSettings.storage?.onedrive?.proxyUrl || defaultProxyUrl);

  const [pushPass, setPushPass] = useState(globalSettings.pushPassword || '');

  // Local UI inputs
  const [newReviewer, setNewReviewer] = useState('');
  const [newHoliday, setNewHoliday] = useState('');

  // Test connection result state
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);



  const handleSaveStorage = async () => {
    // Save to Store
    setStorageMode({
      type: storageType,
      webdav: {
        url: webdavUrl,
        username: webdavUser,
        password: webdavPass
      },
      onedrive: {
        proxyUrl: onedriveProxyUrl
      }
    });

    // Also update legacy fields for backward compatibility if staying on WebDAV
    if (storageType === 'WEBDAV') {
      updateSettings({
        webdavUrl, webdavUser, webdavPass
      });
    }

    if (storageType === 'WEBDAV') {
      if (webdavUrl && webdavUser && webdavPass) {
        try {
          await fetchAllProjectsFromWebDAV(); // Or fetchProjectListFromWebDAV
          alert('WebDAV Configuration Saved & Server Scanned!');
        } catch (e: any) {
          alert(`Saved, but scan failed: ${e.message}`);
        }
      } else {
        alert('WebDAV Saved (Incomplete Credentials)');
      }
    } else {
      // OneDrive
      try {
        // Trigger a list fetch to test/scan
        await fetchAllProjectsFromWebDAV(); // This maps to fetchProjectList
        alert('OneDrive Configuration Saved & Connected!');
      } catch (e: any) {
        alert(`Saved, but connection failed: ${e.message}`);
      }
    }
  };

  const handleTestWebDAV = async () => {
    // Use environment variables if input fields are empty
    const envUrl = import.meta.env.VITE_WEBDAV_URL;
    const envUser = import.meta.env.VITE_WEBDAV_USER;
    const envPass = import.meta.env.VITE_WEBDAV_PASSWORD;

    const testUrl = webdavUrl || envUrl;
    const testUser = webdavUser || envUser;
    const testPass = webdavPass || envPass;

    if (storageType === 'WEBDAV') {
      if (!testUrl) {
        setTestResult({ success: false, message: 'Server URL is required' });
        return;
      }
    } else {
      if (!onedriveProxyUrl) {
        setTestResult({ success: false, message: 'Proxy URL is required' });
        return;
      }
    }

    const result = await testWebDAVConnection(testUrl, testUser, testPass, onedriveProxyUrl);
    setTestResult(result);

    // Auto-clear after 5 seconds
    setTimeout(() => setTestResult(null), 5000);
  };

  const handleExecutePush = async () => {
    // Pass empty string for compatibility or remove param in store if updated
    const success = await syncWithWebDAV('');
    // Attempt to save settings too
    // Deprecated per user request: await saveSettingsToWebDAV();

    if (success) {
      alert("Project & Global Config successfully synced to WebDAV.");
    }
  };

  const addItem = (type: 'reviewers' | 'holidays', value: string, setter: (v: string) => void) => {
    // Handling Reviewers (Objects) vs Holidays (Strings)
    if (type === 'reviewers') {
      const list = (activeSettings.reviewers || []) as any[];
      // Check duplication by name or ID
      const exists = list.some(r => (typeof r === 'string' ? r === value : r.name === value));
      if (value && !exists) {
        const newReviewer = { id: value.toLowerCase().replace(/\s+/g, '_'), name: value };
        const newList = [...list, newReviewer];
        if (project) {
          updateProjectConfig(project.id, { reviewers: newList });
        } else {
          updateSettings({ reviewers: newList });
        }
        setter('');
      }
    } else {
      // Holidays (Strings)
      const list = (activeSettings[type] || []) as string[];
      if (value && !list.includes(value)) {
        if (project) {
          updateProjectConfig(project.id, { [type]: [...list, value] });
        } else {
          updateSettings({ [type]: [...list, value] });
        }
        setter('');
      }
    }
  };

  const removeItem = (type: 'reviewers' | 'holidays', value: string) => {
    if (type === 'reviewers') {
      const list = (activeSettings.reviewers || []) as any[];
      // value passed might be ID or Name. In map loop we will pass ID if object.
      const newList = list.filter(r => {
        const rId = typeof r === 'string' ? r : r.id;
        const rName = typeof r === 'string' ? r : r.name;
        // We'll compare against both just to be safe if 'value' is ambiguous
        return rId !== value && rName !== value;
      });
      if (project) updateProjectConfig(project.id, { reviewers: newList });
      else updateSettings({ reviewers: newList });
    } else {
      const list = (activeSettings[type] || []) as string[];
      const newList = list.filter(v => v !== value);
      if (project) updateProjectConfig(project.id, { [type]: newList });
      else updateSettings({ [type]: newList });
    }
  };

  const updateDisciplineDefault = (discipline: string, reviewer: string) => {
    const next = { ...(activeSettings.disciplineDefaults || {}), [discipline]: reviewer };
    if (project) {
      updateProjectConfig(project.id, { disciplineDefaults: next });
    } else {
      updateSettings({ disciplineDefaults: next });
    }
  };

  const updatePolicy = (key: 'roundACycle' | 'otherRoundsCycle', val: number) => {
    if (project) {
      updateProjectConfig(project.id, { [key]: val });
    } else {
      updateSettings({ [key]: val });
    }
  };

  const handleLocalBackup = () => {
    if (!project) {
      alert("No active project to backup.");
      return;
    }
    const timestamp = format(new Date(), 'yyyyMMddHHmm');
    const hullName = project.name.replace(/[^a-z0-9]/gi, '_');
    const filename = `PA_${hullName}_${timestamp}.json`;

    const projectData = JSON.stringify(project, null, 2);
    const blob = new Blob([projectData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleLocalRestore = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const restoredProject = JSON.parse(content);
        if (!restoredProject.id || !restoredProject.name || !Array.isArray(restoredProject.drawings)) {
          throw new Error("Invalid project file structure.");
        }
        restoreProject(restoredProject);
        alert(`Project "${restoredProject.name}" has been restored locally.`);
      } catch (err) {
        alert("Restoration failed: " + (err instanceof Error ? err.message : "Malformed JSON file"));
      }
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsText(file);
  };

  // --- Platform Health Logic ---
  const healthStats = React.useMemo(() => {
    const totalReviewers = activeSettings.reviewers.length;
    const assignedDisciplines = activeDisciplines.filter(d => activeSettings.disciplineDefaults[d]);
    const assignmentCoverage = activeDisciplines.length > 0 ? (assignedDisciplines.length / activeDisciplines.length) * 100 : 0;
    const hasPassword = !!(activeSettings as any).password;
    const hasHolidays = activeSettings.holidays.length > 0;

    return {
      roster: totalReviewers > 0,
      coverage: assignmentCoverage === 100,
      security: hasPassword,
      holidays: hasHolidays,
      score: [totalReviewers > 0, assignmentCoverage === 100, hasPassword, hasHolidays].filter(Boolean).length
    };
  }, [activeSettings, globalSettings, activeDisciplines]);

  return (
    <div className="flex-1 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-slate-200 animate-in fade-in slide-in-from-bottom-2 duration-300 p-6">
      <div className="max-w-7xl mx-auto space-y-6 pb-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

          {/* Storage Configuration */}
          <section className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden flex flex-col hover:border-teal-400 transition-colors">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-3 bg-slate-50/50">
              <Database className="text-teal-600" size={16} />
              <h2 className="text-[10px] font-black uppercase tracking-widest text-slate-800">Storage Provider</h2>
            </div>
            <div className="p-5 flex-1 space-y-4">

              {/* Type Selector */}
              <div className="flex bg-slate-100 p-1 rounded-xl">
                <button
                  onClick={() => setStorageType('WEBDAV')}
                  className={`flex-1 py-2 rounded-lg text-[9px] font-black uppercase tracking-wide transition-all ${storageType === 'WEBDAV' ? 'bg-white shadow text-teal-700' : 'text-slate-400 hover:text-slate-600'}`}
                >WebDAV</button>
                <button
                  onClick={() => setStorageType('ONEDRIVE')}
                  className={`flex-1 py-2 rounded-lg text-[9px] font-black uppercase tracking-wide transition-all ${storageType === 'ONEDRIVE' ? 'bg-white shadow text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
                >OneDrive (Proxy)</button>
              </div>

              {storageType === 'WEBDAV' ? (
                <div className="space-y-2 animate-in fade-in slide-in-from-top-1">
                  <div>
                    <label className="text-[9px] font-black uppercase text-slate-400 mb-1 block ml-1 tracking-widest flex items-center gap-1">
                      <LinkIcon size={10} /> Server URL
                    </label>
                    <input
                      type="text" value={webdavUrl} onChange={(e) => setWebdavUrl(e.target.value)}
                      placeholder="https://your-webdav-server.com/dav/"
                      className="w-full p-2 mb-2 bg-slate-50 border border-slate-200 rounded-xl outline-none text-[9px] focus:bg-white transition-all"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text" value={webdavUser} onChange={(e) => setWebdavUser(e.target.value)}
                        placeholder="Username"
                        className="p-2 bg-slate-50 border border-slate-200 rounded-xl outline-none text-[9px] focus:bg-white transition-all"
                      />
                      <input
                        type="password" value={webdavPass} onChange={(e) => setWebdavPass(e.target.value)}
                        placeholder="Password"
                        className="p-2 bg-slate-50 border border-slate-200 rounded-xl outline-none text-[9px] focus:bg-white transition-all"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-2 animate-in fade-in slide-in-from-top-1">
                  <div>
                    <label className="text-[9px] font-black uppercase text-slate-400 mb-1 block ml-1 tracking-widest flex items-center gap-1">
                      <LinkIcon size={10} /> Proxy URL
                    </label>
                    <input
                      type="text" value={onedriveProxyUrl} onChange={(e) => setOnedriveProxyUrl(e.target.value)}
                      placeholder={import.meta.env.DEV ? 'http://localhost:3001/api/proxy' : '/api/proxy'}
                      className="w-full p-2 mb-2 bg-slate-50 border border-slate-200 rounded-xl outline-none text-[9px] focus:bg-white transition-all"
                    />
                    <p className="text-[8px] font-bold text-slate-400 pl-1">
                      Requires local authentication proxy running.
                    </p>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2 mt-2">
                <button onClick={handleSaveStorage} disabled={isLoading} className="w-full py-2 bg-slate-900 text-white rounded-xl text-[9px] font-black uppercase hover:bg-black transition-colors flex items-center justify-center gap-1.5">
                  {isLoading ? <RefreshCw className="animate-spin" size={10} /> : <Save size={10} />}
                  {isLoading ? 'Scanning...' : 'Save & Connect'}
                </button>
                <button onClick={handleTestWebDAV} disabled={isLoading} className="w-full py-2 bg-slate-100 text-slate-600 rounded-xl text-[9px] font-black uppercase hover:bg-slate-200 transition-colors flex items-center justify-center gap-1.5">
                  <RefreshCw className={isLoading ? "animate-spin" : ""} size={10} /> Test Connection
                </button>
              </div>

              {/* Test Result Display */}
              {testResult && (
                <div className={`mt-2 p-3 rounded-xl border animate-in fade-in slide-in-from-top-1 ${testResult.success
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                  : 'bg-red-50 border-red-200 text-red-700'
                  }`}>
                  <div className="flex items-center gap-2">
                    {testResult.success ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
                    <span className="text-[9px] font-black uppercase tracking-wide">{testResult.message}</span>
                  </div>
                </div>
              )}

              {/* Environment Variable Hint */}
              {storageType === 'WEBDAV' && !webdavUrl && import.meta.env.VITE_WEBDAV_URL && (
                <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded-xl">
                  <p className="text-[8px] font-bold text-blue-600 uppercase tracking-tight flex items-center gap-1.5">
                    <Info size={10} /> Using env: {import.meta.env.VITE_WEBDAV_URL}
                  </p>
                </div>
              )}

            </div>



            <div className="pt-2 space-y-3">
              <div className="text-[9px] font-black uppercase text-slate-400 ml-1">Hull: <span className="text-teal-600">{project?.name || 'Unset'}</span></div>



              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={handleExecutePush}
                  disabled={isLoading || !project}
                  className="p-3 bg-teal-600 text-white rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-teal-700 disabled:opacity-50 flex items-center justify-center gap-2 transition-all active:scale-95 shadow-md shadow-teal-500/10"
                >
                  <Send size={12} /> WebDAV Sync
                </button>
                <button
                  onClick={async () => {
                    if (!activeProjectId) return;
                    try {
                      await loadProjectFromWebDAV(activeProjectId, project?.conf?.password);
                      alert('项目数据已从服务器加载');
                    } catch (e: any) {
                      alert(`加载失败: ${e.message}`);
                    }
                  }}
                  disabled={isLoading || !project}
                  className="p-3 bg-cyan-600 text-white rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-cyan-700 disabled:opacity-50 flex items-center justify-center gap-2 transition-all active:scale-95 shadow-md shadow-cyan-500/10"
                >
                  <Download size={12} /> WebDAV Fetch
                </button>
              </div>

              <div className="h-px bg-slate-100 my-1" />

              {/* Visual Indicator of Config Scope */}
              {project ? (
                <div className="p-2 bg-indigo-50 border border-indigo-100 rounded-xl text-center">
                  <div className="text-[9px] font-black uppercase text-indigo-600 tracking-widest flex items-center justify-center gap-1">
                    <ShieldCheck size={10} /> Editing: {project.name} Config
                  </div>
                </div>
              ) : (
                <div className="p-2 bg-slate-50 border border-slate-100 rounded-xl text-center">
                  <div className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Global Default Config</div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={handleLocalBackup}
                  disabled={!project}
                  className="p-3 bg-white border border-slate-900 text-slate-900 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all active:scale-95 flex items-center justify-center gap-2"
                >
                  <Save size={12} /> Local Backup
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="p-3 bg-slate-900 text-white rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-black transition-all active:scale-95 flex items-center justify-center gap-2"
                >
                  <Upload size={12} /> Local Restore
                </button>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleLocalRestore}
                  accept=".json"
                  className="hidden"
                />
              </div>
            </div>
          </section>



          {/* Review Team */}
          <section className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden flex flex-col hover:border-teal-400 transition-colors">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-3 bg-slate-50/50">
              <Users className="text-teal-600" size={16} />
              <h2 className="text-[10px] font-black uppercase tracking-widest text-slate-800">Team Roster</h2>
            </div>
            <div className="p-3 flex-1 flex flex-col gap-2 min-h-0">
              <div className="flex gap-1.5 shrink-0">
                <input
                  type="text" value={newReviewer} onChange={(e) => setNewReviewer(e.target.value)}
                  placeholder="New Reviewer Name"
                  className="flex-1 p-1.5 bg-slate-50 border border-slate-200 rounded-lg text-[10px] font-black outline-none focus:bg-white transition-all uppercase"
                />
                <button onClick={() => addItem('reviewers', newReviewer, setNewReviewer)} className="p-1.5 bg-slate-900 text-white rounded-lg hover:bg-black active:scale-95 transition-all"><Plus size={14} /></button>
              </div>
              <div className="grid grid-cols-1 gap-1 overflow-y-auto pr-1 scrollbar-thin flex-1">
                {(activeSettings.reviewers || []).map(r => {
                  const rName = typeof r === 'string' ? r : r.name;
                  const rId = typeof r === 'string' ? r : r.id;
                  return (
                    <div key={rId} className="flex items-center justify-between p-1.5 bg-white border border-slate-100 rounded-lg group hover:border-teal-400 transition-all shrink-0">
                      <span className="text-[10px] font-black text-slate-700 uppercase">{rName}</span>
                      <button onClick={() => removeItem('reviewers', rId)} className="text-slate-200 hover:text-red-500 transition-colors"><Trash2 size={12} /></button>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          {/* Lead Assignees */}
          <section className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden flex flex-col hover:border-indigo-400 transition-colors">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-3 bg-slate-50/50">
              <UserCheck className="text-indigo-600" size={16} />
              <h2 className="text-[10px] font-black uppercase tracking-widest text-slate-800">Default Leads</h2>
            </div>
            <div className="p-3 flex-1 flex flex-col gap-2 min-h-0">
              <div className="grid grid-cols-1 gap-1 overflow-y-auto pr-1 scrollbar-thin flex-1">
                {activeDisciplines.map(d => (
                  <div key={d} className="flex items-center justify-between p-1 px-2 rounded-lg bg-slate-50/50 border border-slate-100 hover:border-indigo-200 transition-colors shrink-0">
                    <span className="text-[9px] font-black uppercase text-slate-500 tracking-widest flex-1 truncate py-1" title={d}>{d}</span>
                    <select
                      value={(activeSettings.disciplineDefaults || {})[d] || ''}
                      onChange={(e) => updateDisciplineDefault(d, e.target.value)}
                      className="w-24 p-1 py-0.5 bg-white border border-slate-200 rounded text-[10px] font-black outline-none uppercase tracking-tight ml-2 h-6"
                    >
                      <option value="">No Default</option>
                      {(activeSettings.reviewers || []).map(r => {
                        const rName = typeof r === 'string' ? r : r.name;
                        const rId = typeof r === 'string' ? r : r.id;
                        return <option key={rId} value={rName}>{rName}</option>;
                      })}
                    </select>
                  </div>
                ))}
                {activeDisciplines.length === 0 && (
                  <div className="text-center py-10 opacity-30 text-[9px] font-black uppercase tracking-widest">No Disciplines</div>
                )}
              </div>
            </div>
          </section>

          {/* Review Strategy Policy */}
          <section className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden flex flex-col hover:border-amber-400 transition-colors">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-3 bg-slate-50/50">
              <Clock className="text-amber-600" size={16} />
              <h2 className="text-[10px] font-black uppercase tracking-widest text-slate-800">Review Policy (WD)</h2>
            </div>
            <div className="p-6 flex-1 space-y-6">
              <div className="space-y-4">
                <div>
                  <label className="text-[9px] font-black uppercase text-slate-400 mb-2 block tracking-widest">Round A Cycle (Working Days)</label>
                  <div className="flex items-center gap-4">
                    <input
                      type="range" min="1" max="30" step="1"
                      value={activeSettings.roundACycle}
                      onChange={(e) => updatePolicy('roundACycle', parseInt(e.target.value))}
                      className="flex-1 h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-amber-500"
                    />
                    <span className="text-lg font-[1000] text-amber-600 w-10">{activeSettings.roundACycle}</span>
                  </div>
                </div>
                <div>
                  <label className="text-[9px] font-black uppercase text-slate-400 mb-2 block tracking-widest">Subsequent Rounds Cycle</label>
                  <div className="flex items-center gap-4">
                    <input
                      type="range" min="1" max="21" step="1"
                      value={activeSettings.otherRoundsCycle}
                      onChange={(e) => updatePolicy('otherRoundsCycle', parseInt(e.target.value))}
                      className="flex-1 h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-amber-500"
                    />
                    <span className="text-lg font-[1000] text-amber-600 w-10">{activeSettings.otherRoundsCycle}</span>
                  </div>
                </div>
              </div>
              <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100">
                <p className="text-[9px] font-bold text-amber-700 leading-relaxed uppercase tracking-tight">
                  <Info size={12} className="inline mr-1 -mt-0.5" /> Deadlines exclude weekends and configured public holidays.
                </p>
              </div>
            </div>
          </section>

          {/* Public Holidays */}
          <section className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden flex flex-col hover:border-red-400 transition-colors">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-3 bg-slate-50/50">
              <CalendarDays className="text-red-600" size={16} />
              <h2 className="text-[10px] font-black uppercase tracking-widest text-slate-800">Public Holidays</h2>
            </div>
            <div className="p-5 flex-1 flex flex-col gap-4 min-h-0">
              <div className="flex gap-1.5 shrink-0">
                <input
                  type="date" value={newHoliday} onChange={(e) => setNewHoliday(e.target.value)}
                  className="flex-1 p-2 bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-black outline-none focus:bg-white transition-all uppercase"
                />
                <button onClick={() => addItem('holidays', newHoliday, setNewHoliday)} className="p-2 bg-slate-900 text-white rounded-xl hover:bg-black active:scale-95 transition-all"><Plus size={16} /></button>
              </div>
              <div className="grid grid-cols-1 gap-1.5 overflow-y-auto pr-1 scrollbar-thin flex-1">
                {(activeSettings.holidays || []).sort().map(h => (
                  <div key={h} className="flex items-center justify-between p-2.5 bg-white border border-slate-100 rounded-xl group hover:border-red-400 transition-all shrink-0">
                    <span className="text-[10px] font-black text-slate-700">{format(new Date(h), 'yyyy-MM-dd')}</span>
                    <button onClick={() => removeItem('holidays', h)} className="text-slate-200 hover:text-red-500 transition-colors"><Trash2 size={12} /></button>
                  </div>
                ))}
                {(activeSettings.holidays || []).length === 0 && (
                  <div className="text-center py-10 opacity-30 text-[9px] font-black uppercase tracking-widest">No Holidays Logged</div>
                )}
              </div>
            </div>
          </section>

          {/* Platform Health Diagnostic */}
          <section className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden flex flex-col hover:border-indigo-400 transition-colors">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-3 bg-slate-50/50">
              <HeartPulse className="text-indigo-600" size={16} />
              <h2 className="text-[10px] font-black uppercase tracking-widest text-slate-800">Platform Health</h2>
            </div>
            <div className="p-6 flex-1 space-y-4">
              <div className="flex flex-col gap-3">
                <HealthItem label="Team Roster" active={healthStats.roster} subText={`${activeSettings.reviewers.length} Reviewers Loaded`} />
                <HealthItem label="Discipline Defaults" active={healthStats.coverage} subText={healthStats.coverage ? 'Full Assignment Coverage' : 'Missing Default Leads'} />
                <HealthItem label="Project Protection" active={healthStats.security} subText={(healthStats as any).security ? 'Secure Access Enabled' : 'Public Access Mode'} />
                <HealthItem label="Holiday Policy" active={healthStats.holidays} subText={healthStats.holidays ? `${activeSettings.holidays.length} Dates Configured` : 'Using Standard Calendar'} />
              </div>

              <div className="mt-4 pt-4 border-t border-slate-100">
                <div className="text-[9px] font-black uppercase text-slate-400 mb-2 tracking-widest">Config Integrity Score</div>
                <div className="flex gap-1.5">
                  {[1, 2, 3, 4].map(i => (
                    <div key={i} className={`flex-1 h-2 rounded-full transition-all duration-1000 ${i <= healthStats.score ? 'bg-indigo-500 shadow-lg shadow-indigo-500/20' : 'bg-slate-100'}`} />
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* Project Configuration (Merged: Name, Password, Sync) */}
          <section className="bg-white rounded-[2rem] border border-indigo-100 shadow-sm overflow-hidden flex flex-col hover:border-indigo-400 transition-colors group relative">
            <div className="px-5 py-4 border-b border-indigo-50 flex items-center gap-3 bg-indigo-50/30">
              <LayoutDashboard className="text-indigo-400 group-hover:text-indigo-600 transition-colors" size={16} />
              <h2 className="text-[10px] font-black uppercase tracking-widest text-indigo-900/70 group-hover:text-indigo-900">Project Configuration</h2>
            </div>
            <div className="p-5 flex-1 space-y-5 relative z-10">

              {/* Project Name */}
              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider ml-1">Project Report Name</label>
                <input
                  type="text"
                  value={activeSettings.displayName || ''}
                  onChange={(e) => project && updateProjectConfig(project.id, { displayName: e.target.value })}
                  placeholder="CUSTOM DISPLAY TITLE"
                  disabled={!project}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder:text-slate-300 group-hover/input:bg-white"
                />
              </div>

              {/* Password */}
              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider ml-1">Project Password (Optional)</label>
                <div className="relative group/input">
                  <input
                    type="text"
                    value={(activeSettings as any).password || ''}
                    onChange={(e) => {
                      if (project) {
                        updateProjectConfig(project.id, { password: e.target.value });
                      }
                    }}
                    placeholder="NO PASSWORD SET"
                    disabled={!project}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all placeholder:text-slate-300 group-hover/input:bg-white"
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 opacity-0 group-hover/input:opacity-100 transition-opacity">
                    {(activeSettings as any).password ? <Lock size={14} className="text-red-400" /> : <CheckCircle size={14} className="text-slate-300" />}
                  </div>
                </div>
                <p className="text-[9px] font-bold text-slate-300 leading-relaxed pl-1 max-w-md">
                  Requires password entry when loading from Server.
                </p>
              </div>

              {/* Auto Sync - Visual Divider */}
              <div className="h-px bg-indigo-50" />

              {/* Auto Sync */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[9px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-1">
                    <Clock size={10} /> Auto-Sync Interval
                  </label>
                  <span className="text-[9px] font-[1000] text-teal-600 bg-teal-50 px-2 py-1 rounded-md">
                    {project?.conf?.autoSyncInterval ?? data.settings.autoSyncInterval ?? 3} min
                  </span>
                </div>
                <input
                  type="range" min="0" max="60" step="1"
                  value={project?.conf?.autoSyncInterval ?? data.settings.autoSyncInterval ?? 3}
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    if (project) {
                      updateProjectConfig(project.id, { autoSyncInterval: val });
                    } else {
                      updateSettings({ autoSyncInterval: val });
                    }
                  }}
                  className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-teal-500"
                />
                <p className="text-[8px] font-bold text-slate-300 uppercase tracking-tight text-center">
                  0 = Disabled (Manual Only)
                </p>
              </div>
            </div>
          </section>

        </div>
      </div>
    </div>
  );
};

const HealthItem = ({ label, active, subText }: { label: string, active: boolean, subText: string }) => (
  <div className="flex items-center gap-4 group">
    <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border transition-all ${active ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-slate-50 text-slate-300 border-slate-100'}`}>
      {active ? <CheckCircle size={16} /> : <Activity size={16} />}
    </div>
    <div className="flex flex-col">
      <span className={`text-[10px] font-black uppercase tracking-widest ${active ? 'text-slate-900' : 'text-slate-400'}`}>{label}</span>
      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tight">{subText}</span>
    </div>
  </div>
);

import React, { useState, useEffect, useRef } from 'react';
import { useStore } from '../store';
import {
  Database, Users, Trash2,
  Plus, UserCheck, RefreshCw, Send, Download, Shield, Info, Lock, X, Eye, EyeOff, AlertCircle,
  Clock, CalendarDays, Save, Upload, Link as LinkIcon, CheckCircle, Activity, ShieldCheck, HeartPulse
} from 'lucide-react';
import { format } from 'date-fns';

export const Settings: React.FC = () => {
  const { data, setSettings, updateProjectConfig, syncWithWebDAV, saveSettingsToWebDAV, loadFromWebDAV, fetchAllProjectsFromWebDAV, testWebDAVConnection, isLoading, activeProjectId, error, clearError, restoreProject } = useStore();
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
  const [webdavUrl, setWebdavUrl] = useState(globalSettings.webdavUrl || '');
  const [webdavUser, setWebdavUser] = useState(globalSettings.webdavUser || '');
  const [webdavPass, setWebdavPass] = useState(globalSettings.webdavPass || '');
  const [pushPass, setPushPass] = useState(globalSettings.pushPassword || '');

  // Local UI inputs
  const [newReviewer, setNewReviewer] = useState('');
  const [newHoliday, setNewHoliday] = useState('');

  // Test connection result state
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // --- Verification Modal State ---
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [verificationInput, setVerificationInput] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [shaking, setShaking] = useState(false);

  useEffect(() => {
    if (error === 'AUTHENTICATION_FAILED') {
      setShaking(true);
      const timer = setTimeout(() => setShaking(false), 500);
      return () => clearTimeout(timer);
    }
  }, [error]);

  const handleSaveWebDAV = async () => {
    setSettings({
      webdavUrl: webdavUrl,
      webdavUser: webdavUser,
      webdavPass: webdavPass
    });

    if (webdavUrl && webdavUser && webdavPass) {
      try {
        await fetchAllProjectsFromWebDAV();
        alert('WebDAV Configuration Saved & Server Scanned Successfully!\nAll matching projects have been loaded into the dropdown.');
      } catch (e: any) {
        alert(`Configuration Saved, but auto-scan failed: ${e.message}`);
      }
    } else {
      alert('WebDAV Configuration Saved (Incomplete credentials - Scan skipped)');
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

    if (!testUrl) {
      setTestResult({ success: false, message: 'Server URL is required' });
      return;
    }

    const result = await testWebDAVConnection(testUrl, testUser, testPass);
    setTestResult(result);

    // Auto-clear after 5 seconds
    setTimeout(() => setTestResult(null), 5000);
  };

  const handleSavePushPassword = () => {
    setSettings({ pushPassword: pushPass });
    alert('Push Authentication Password Updated!');
  };

  const handleExecutePush = async () => {
    const success = await syncWithWebDAV(verificationInput);
    // Attempt to save settings too
    await saveSettingsToWebDAV();

    if (success) {
      setShowVerifyModal(false);
      setVerificationInput('');
      alert("Project & Global Config successfully synced to WebDAV.");
    }
  };

  const openPushModal = () => {
    clearError();
    setVerificationInput('');
    setShowVerifyModal(true);
  };

  const addItem = (type: 'reviewers' | 'holidays', value: string, setter: (v: string) => void) => {
    const list = activeSettings[type] || [];
    if (value && !list.includes(value)) {
      if (project) {
        updateProjectConfig(project.id, { [type]: [...list, value] });
      } else {
        setSettings({ [type]: [...list, value] }); // Fallback
      }
      setter('');
    }
  };

  const removeItem = (type: 'reviewers' | 'holidays', value: string) => {
    const list = activeSettings[type] || [];
    if (project) {
      updateProjectConfig(project.id, { [type]: list.filter(v => v !== value) });
    } else {
      setSettings({ [type]: list.filter(v => v !== value) });
    }
  };

  const updateDisciplineDefault = (discipline: string, reviewer: string) => {
    const next = { ...(activeSettings.disciplineDefaults || {}), [discipline]: reviewer };
    if (project) {
      updateProjectConfig(project.id, { disciplineDefaults: next });
    } else {
      setSettings({ disciplineDefaults: next });
    }
  };

  const updatePolicy = (key: 'roundACycle' | 'otherRoundsCycle', val: number) => {
    if (project) {
      updateProjectConfig(project.id, { [key]: val });
    } else {
      setSettings({ [key]: val });
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
    const hasWebDAV = !!globalSettings.webdavUrl;
    const hasHolidays = activeSettings.holidays.length > 0;

    return {
      roster: totalReviewers > 0,
      coverage: assignmentCoverage === 100,
      cloud: hasWebDAV,
      holidays: hasHolidays,
      score: [totalReviewers > 0, assignmentCoverage === 100, hasWebDAV].filter(Boolean).length
    };
  }, [activeSettings, globalSettings, activeDisciplines]);

  return (
    <div className="flex-1 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-slate-200 animate-in fade-in slide-in-from-bottom-2 duration-300 p-6">
      <div className="max-w-7xl mx-auto space-y-6 pb-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

          {/* WebDAV & Local Persistence */}
          <section className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden flex flex-col hover:border-teal-400 transition-colors">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-3 bg-slate-50/50">
              <Database className="text-teal-600" size={16} />
              <h2 className="text-[10px] font-black uppercase tracking-widest text-slate-800">WebDAV Cloud & Local</h2>
            </div>
            <div className="p-5 flex-1 space-y-4">
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
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <button onClick={handleSaveWebDAV} disabled={isLoading} className="w-full py-2 bg-slate-900 text-white rounded-xl text-[9px] font-black uppercase hover:bg-black transition-colors flex items-center justify-center gap-1.5">
                    {isLoading ? <RefreshCw className="animate-spin" size={10} /> : <Save size={10} />}
                    {isLoading ? 'Scanning...' : 'Save & Scan'}
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
                {!webdavUrl && import.meta.env.VITE_WEBDAV_URL && (
                  <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded-xl">
                    <p className="text-[8px] font-bold text-blue-600 uppercase tracking-tight flex items-center gap-1.5">
                      <Info size={10} /> Using env: {import.meta.env.VITE_WEBDAV_URL}
                    </p>
                  </div>
                )}
              </div>

              <div>
                <label className="text-[9px] font-black uppercase text-slate-400 mb-1 block ml-1 tracking-widest flex items-center gap-1.5">
                  <Shield size={10} className="text-teal-500" /> Auth Password
                </label>
                <div className="flex gap-1.5">
                  <input
                    type="password" value={pushPass} onChange={(e) => setPushPass(e.target.value)}
                    placeholder="Security Key"
                    className="flex-1 p-2 bg-slate-50 border border-slate-200 rounded-xl outline-none font-mono text-[9px] focus:bg-white transition-all"
                  />
                  <button onClick={handleSavePushPassword} className="px-3 bg-slate-900 text-white rounded-xl text-[9px] font-black uppercase hover:bg-black transition-colors">Set</button>
                </div>
              </div>

              <div className="pt-2 space-y-3">
                <div className="text-[9px] font-black uppercase text-slate-400 ml-1">Hull: <span className="text-teal-600">{project?.name || 'Unset'}</span></div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={openPushModal}
                    disabled={isLoading || !project}
                    className="p-3 bg-teal-600 text-white rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-teal-700 disabled:opacity-50 flex items-center justify-center gap-2 transition-all active:scale-95 shadow-md shadow-teal-500/10"
                  >
                    <Send size={12} /> WebDAV Sync
                  </button>
                  <button
                    onClick={loadFromWebDAV}
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
            </div>
          </section>

          {/* Review Team */}
          <section className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden flex flex-col hover:border-teal-400 transition-colors">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-3 bg-slate-50/50">
              <Users className="text-teal-600" size={16} />
              <h2 className="text-[10px] font-black uppercase tracking-widest text-slate-800">Team Roster</h2>
            </div>
            <div className="p-5 flex-1 space-y-4">
              <div className="flex gap-1.5">
                <input
                  type="text" value={newReviewer} onChange={(e) => setNewReviewer(e.target.value)}
                  placeholder="New Reviewer Name"
                  className="flex-1 p-2 bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-black outline-none focus:bg-white transition-all uppercase"
                />
                <button onClick={() => addItem('reviewers', newReviewer, setNewReviewer)} className="p-2 bg-slate-900 text-white rounded-xl hover:bg-black active:scale-95 transition-all"><Plus size={16} /></button>
              </div>
              <div className="grid grid-cols-1 gap-1.5 max-h-48 overflow-y-auto pr-1 scrollbar-thin">
                {(activeSettings.reviewers || []).map(r => (
                  <div key={r} className="flex items-center justify-between p-2.5 bg-white border border-slate-100 rounded-xl group hover:border-teal-400 transition-all">
                    <span className="text-[10px] font-black text-slate-700 uppercase">{r}</span>
                    <button onClick={() => removeItem('reviewers', r)} className="text-slate-200 hover:text-red-500 transition-colors"><Trash2 size={12} /></button>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Lead Assignees */}
          <section className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden flex flex-col hover:border-indigo-400 transition-colors">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-3 bg-slate-50/50">
              <UserCheck className="text-indigo-600" size={16} />
              <h2 className="text-[10px] font-black uppercase tracking-widest text-slate-800">Default Leads</h2>
            </div>
            <div className="p-5 flex-1 space-y-3">
              <div className="grid grid-cols-1 gap-2 max-h-64 overflow-y-auto pr-1 scrollbar-thin">
                {activeDisciplines.map(d => (
                  <div key={d} className="flex flex-col gap-1 p-2 rounded-xl bg-slate-50/50 border border-slate-100">
                    <span className="text-[8px] font-black uppercase text-slate-400 ml-1 tracking-widest">{d}</span>
                    <select
                      value={(activeSettings.disciplineDefaults || {})[d] || ''}
                      onChange={(e) => updateDisciplineDefault(d, e.target.value)}
                      className="w-full p-1.5 bg-white border border-slate-200 rounded-lg text-[10px] font-black outline-none uppercase tracking-tight"
                    >
                      <option value="">No Default</option>
                      {(activeSettings.reviewers || []).map(r => <option key={r} value={r}>{r}</option>)}
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
            <div className="p-5 flex-1 space-y-4">
              <div className="flex gap-1.5">
                <input
                  type="date" value={newHoliday} onChange={(e) => setNewHoliday(e.target.value)}
                  className="flex-1 p-2 bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-black outline-none focus:bg-white transition-all uppercase"
                />
                <button onClick={() => addItem('holidays', newHoliday, setNewHoliday)} className="p-2 bg-slate-900 text-white rounded-xl hover:bg-black active:scale-95 transition-all"><Plus size={16} /></button>
              </div>
              <div className="grid grid-cols-1 gap-1.5 max-h-48 overflow-y-auto pr-1 scrollbar-thin">
                {(activeSettings.holidays || []).sort().map(h => (
                  <div key={h} className="flex items-center justify-between p-2.5 bg-white border border-slate-100 rounded-xl group hover:border-red-400 transition-all">
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
                <HealthItem label="WebDAV Registry" active={healthStats.cloud} subText={healthStats.cloud ? 'Cloud Services Active' : 'Offline Persistence Only'} />
                <HealthItem label="Holiday Policy" active={healthStats.holidays} subText={healthStats.holidays ? `${activeSettings.holidays.length} Dates Configured` : 'Using Standard Calendar'} />
              </div>

              <div className="mt-4 pt-4 border-t border-slate-100">
                <div className="text-[9px] font-black uppercase text-slate-400 mb-2 tracking-widest">Config Integrity Score</div>
                <div className="flex gap-1.5">
                  {[1, 2, 3, 4].map(i => (
                    <div key={i} className={`flex-1 h-2 rounded-full transition-all duration-1000 ${i <= healthStats.score + (healthStats.holidays ? 1 : 0) ? 'bg-indigo-500 shadow-lg shadow-indigo-500/20' : 'bg-slate-100'}`} />
                  ))}
                </div>
              </div>
            </div>
          </section>

        </div>
      </div>

      {/* Verification Modal */}
      {showVerifyModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-200">
          <div className={`bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md border border-slate-200 overflow-hidden flex flex-col p-8 transition-transform duration-100 ${shaking ? 'animate-shake' : ''}`}>

            <div className="flex items-center justify-between mb-10">
              <div className="w-14 h-14 bg-teal-50 rounded-[1.25rem] flex items-center justify-center text-teal-600 shadow-sm border border-teal-100">
                <Lock size={28} strokeWidth={2.5} />
              </div>
              <button onClick={() => setShowVerifyModal(false)} className="p-2 text-slate-300 hover:text-slate-600 transition-colors rounded-full hover:bg-slate-50">
                <X size={28} />
              </button>
            </div>

            <div className="mb-10 text-center">
              <h3 className="text-2xl font-[1000] text-slate-900 tracking-tight leading-none mb-4 uppercase">Authorize WebDAV Sync</h3>
              <p className="text-slate-500 text-[11px] font-black uppercase tracking-[0.2em] leading-relaxed">Security key required for <span className="text-teal-600 underline">"{project?.name}"</span></p>
            </div>

            <div className="space-y-6">
              <div className="relative">
                <label className="text-[10px] font-black uppercase text-slate-400 mb-2 block ml-1 tracking-[0.25em]">Master Access Key</label>
                <div className="relative">
                  <input
                    autoFocus
                    type={showPass ? "text" : "password"}
                    value={verificationInput}
                    onChange={(e) => setVerificationInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleExecutePush()}
                    placeholder="••••••••"
                    className={`w-full p-5 pr-14 bg-slate-50 border-2 rounded-[1.5rem] outline-none text-xl font-bold tracking-widest transition-all ${error === 'AUTHENTICATION_FAILED' ? 'border-red-200 bg-red-50 text-red-600' : 'border-slate-100 focus:border-teal-500 focus:bg-white'}`}
                  />
                  <button
                    onClick={() => setShowPass(!showPass)}
                    className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-300 hover:text-teal-600 transition-colors"
                  >
                    {showPass ? <EyeOff size={22} /> : <Eye size={22} />}
                  </button>
                </div>
              </div>
              {error === 'AUTHENTICATION_FAILED' && (
                <div className="flex items-center gap-3 text-red-600 p-5 bg-red-100/50 rounded-2xl border border-red-100 animate-in slide-in-from-top-2">
                  <AlertCircle size={18} className="shrink-0" />
                  <span className="text-[10px] font-black uppercase tracking-widest leading-none">Security Access Denied</span>
                </div>
              )}
            </div>

            <div className="mt-12 flex flex-col gap-4">
              <button
                onClick={handleExecutePush}
                disabled={isLoading || verificationInput.trim() === ''}
                className="w-full py-5 bg-teal-600 text-white rounded-[1.5rem] text-[11px] font-black uppercase tracking-[0.3em] shadow-xl shadow-teal-500/20 hover:bg-teal-700 disabled:opacity-50 transition-all active:scale-[0.98] flex items-center justify-center gap-4"
              >
                {isLoading ? <RefreshCw className="animate-spin" size={20} /> : <Shield size={20} />}
                {isLoading ? 'Processing...' : 'Authorize Sync'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-8px); }
          75% { transform: translateX(8px); }
        }
        .animate-shake {
          animation: shake 0.4s cubic-bezier(.36,.07,.19,.97) both;
        }
      `}</style>
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

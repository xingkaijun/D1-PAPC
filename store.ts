
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { AppData, Project, Drawing, DrawingStatus, Remark, AppSettings, ProjectSnapshot, DisciplineSnapshot, ProjectConfig } from './types';
// Fix: Removed missing isWeekend from date-fns imports
import { addDays, format, isSameDay } from 'date-fns';

// Fix: Local implementation of isWeekend to resolve missing export error from date-fns
const isWeekend = (date: Date) => {
  const day = date.getDay();
  return day === 0 || day === 6; // 0 is Sunday, 6 is Saturday
};

// Helper to normalize strings (trim and Title Case for disciplines)
const normalizeDisc = (val: string) => {
  if (!val) return '';
  return val.trim().split(/\s+/).map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');
};

interface AppState {
  data: AppData;
  activeProjectId: string | null;
  isLoading: boolean;
  error: string | null;

  setSettings: (settings: Partial<AppSettings>) => void;
  updateProjectConfig: (projectId: string, config: Partial<ProjectConfig>) => void; // New action
  addProject: (name: string) => void;
  deleteProject: (id: string) => void;
  setActiveProject: (id: string) => void;
  restoreProject: (project: Project) => void;

  addDrawing: (projectId: string, drawing: Partial<Drawing>) => void;
  bulkImportDrawings: (projectId: string, drawings: Omit<Drawing, 'id' | 'logs' | 'remarks' | 'statusHistory' | 'currentRound'>[]) => void;
  updateDrawing: (projectId: string, drawingId: string, updates: Partial<Drawing>) => void;
  deleteDrawing: (projectId: string, drawingId: string) => void;
  addRemark: (projectId: string, drawingId: string, content: string) => void;
  toggleRemarkStatus: (projectId: string, drawingId: string, remarkId: string) => void;
  updateReviewer: (oldName: string, newName: string) => void;
  resetAllAssignees: (projectId: string) => void;
  takeSnapshot: (projectId: string) => void;
  deleteSnapshot: (projectId: string, snapshotId: string) => void;

  syncWithWebDAV: (password: string) => Promise<boolean>; // Deprecated but kept for compatibility
  pushProjectToWebDAV: (projectId: string) => Promise<boolean>;
  saveSettingsToWebDAV: () => Promise<boolean>;
  fetchGlobalSettingsFromWebDAV: () => Promise<void>;
  fetchProjectListFromWebDAV: () => Promise<void>;
  loadProjectFromWebDAV: (projectId: string, passwordInput?: string) => Promise<void>;
  refreshSnapshots: (projectId: string) => Promise<void>;
  // Deprecated methods kept for interface compatibility
  loadFromWebDAV: () => Promise<void>;
  fetchAllProjectsFromWebDAV: () => Promise<void>;
  testWebDAVConnection: (url: string, user: string, pass: string) => Promise<{ success: boolean; message: string }>;
  clearError: () => void;
}

const calculateDeadline = (startDate: Date, workingDays: number, holidays: string[]) => {
  let currentDate = startDate;
  let addedDays = 0;
  while (addedDays < workingDays) {
    currentDate = addDays(currentDate, 1);
    const isHoliday = holidays.some(h => isSameDay(new Date(h), currentDate));
    if (!isWeekend(currentDate) && !isHoliday) {
      addedDays++;
    }
  }
  return currentDate.toISOString();
};

const getNextRound = (current: string) => {
  if (!current) return 'A';
  const charCode = current.charCodeAt(0);
  return String.fromCharCode(charCode + 1);
};

const DEFAULT_DATA: AppData = {
  lastUpdated: new Date().toISOString(),
  settings: {
    reviewers: [
      { id: 'kevin', name: 'Kevin' },
      { id: 'david', name: 'David' },
      { id: 'alice', name: 'Alice' },
      { id: 'john', name: 'John' },
      { id: 'sarah', name: 'Sarah' }
    ],
    disciplineDefaults: {
      'Hull': 'Kevin', 'Machinery': 'David', 'Outfitting': 'Alice', 'Electric': 'John', 'Piping': 'Sarah'
    },
    holidays: [],
    roundACycle: 14,
    otherRoundsCycle: 7,
    webdavUrl: '',
    webdavUser: '',
    webdavPass: '',
    pushPassword: '',
  },
  projects: []
};

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      data: DEFAULT_DATA,
      activeProjectId: null,
      isLoading: false,
      error: null,

      clearError: () => set({ error: null }),

      setSettings: (newSettings) => set((state) => ({
        data: { ...state.data, settings: { ...state.data.settings, ...newSettings } }
      })),

      addProject: (name) => set((state) => {
        const newProject: Project = {
          id: Math.random().toString(36).substr(2, 9),
          name,
          drawings: [],
          snapshots: [],
          conf: { // Initialize with current global settings as template
            reviewers: [...state.data.settings.reviewers],
            disciplineDefaults: { ...state.data.settings.disciplineDefaults },
            holidays: [...state.data.settings.holidays],
            roundACycle: state.data.settings.roundACycle,
            otherRoundsCycle: state.data.settings.otherRoundsCycle
          }
        };
        return {
          data: { ...state.data, projects: [...state.data.projects, newProject] },
          activeProjectId: newProject.id
        };
      }),

      updateProjectConfig: (projectId, config) => set((state) => ({
        data: {
          ...state.data,
          projects: state.data.projects.map(p => {
            if (p.id !== projectId) return p;
            // Ensure conf exists (migration fallback)
            const currentConf = p.conf || {
              reviewers: state.data.settings.reviewers,
              disciplineDefaults: state.data.settings.disciplineDefaults,
              holidays: state.data.settings.holidays,
              roundACycle: state.data.settings.roundACycle,
              otherRoundsCycle: state.data.settings.otherRoundsCycle
            };
            return { ...p, conf: { ...currentConf, ...config, lastUpdated: new Date().toISOString() }, lastUpdated: new Date().toISOString() };
          })
        }
      })),

      deleteProject: (id) => set((state) => ({
        data: { ...state.data, projects: state.data.projects.filter(p => p.id !== id) },
        activeProjectId: state.activeProjectId === id ? (state.data.projects[0]?.id || null) : state.activeProjectId
      })),

      setActiveProject: (id) => set({ activeProjectId: id }),

      restoreProject: (restoredProject) => set((state) => {
        const existingIndex = state.data.projects.findIndex(p => p.id === restoredProject.id);
        let nextProjects;
        if (existingIndex > -1) {
          nextProjects = state.data.projects.map((p, idx) =>
            idx === existingIndex ? restoredProject : p
          );
        } else {
          nextProjects = [...state.data.projects, restoredProject];
        }
        return {
          data: { ...state.data, projects: nextProjects },
          activeProjectId: restoredProject.id
        };
      }),

      addDrawing: (projectId, drawing) => set((state) => {
        const project = state.data.projects.find(p => p.id === projectId);
        if (!project) return state;

        // Fallback to global if conf missing
        const conf = project.conf || state.data.settings;

        const normalizedDiscipline = normalizeDisc(drawing.discipline || 'Hull');
        const defaultReviewer = conf.disciplineDefaults[normalizedDiscipline];

        // Uniqueness check
        const isDuplicate = project.drawings.some(d =>
          d.customId.toLowerCase() === drawing.customId?.toLowerCase() ||
          d.drawingNo.toLowerCase() === drawing.drawingNo?.toLowerCase()
        );

        if (isDuplicate) {
          alert(`Conflict Detected: A drawing with ID ${drawing.customId} or No. ${drawing.drawingNo} already exists.`);
          return state;
        }

        return {
          data: {
            ...state.data,
            projects: state.data.projects.map(p =>
              p.id === projectId
                ? {
                  ...p, drawings: [...p.drawings, {
                    id: Math.random().toString(36).substr(2, 9),
                    customId: drawing.customId || '000',
                    drawingNo: drawing.drawingNo || '',
                    title: drawing.title || '',
                    discipline: normalizedDiscipline,
                    assignees: drawing.assignees || (defaultReviewer ? [defaultReviewer] : []),
                    status: drawing.status || 'Pending',
                    version: drawing.version || '0',
                    manualCommentsCount: 0,
                    manualOpenCommentsCount: 0,
                    currentRound: 'A',
                    logs: [], remarks: [], statusHistory: []
                  }]
                  , lastUpdated: new Date().toISOString(),
                  conf: { ...p.conf!, lastUpdated: new Date().toISOString() }
                }
                : p
            )
          }
        };
      }),

      bulkImportDrawings: (projectId, newDrawings) => set((state) => {
        const project = state.data.projects.find(p => p.id === projectId);
        if (!project) return state;

        const validDrawings: any[] = [];
        const skippedDrawings: string[] = [];

        newDrawings.forEach(d => {
          const normalizedDiscipline = normalizeDisc(d.discipline);
          const isDuplicateInExisting = project.drawings.some(ex =>
            ex.customId.toLowerCase() === d.customId.toLowerCase() ||
            ex.drawingNo.toLowerCase() === d.drawingNo.toLowerCase()
          );
          const isDuplicateInImport = validDrawings.some(v =>
            v.customId.toLowerCase() === d.customId.toLowerCase() ||
            v.drawingNo.toLowerCase() === d.drawingNo.toLowerCase()
          );

          if (isDuplicateInExisting || isDuplicateInImport) {
            skippedDrawings.push(d.customId);
          } else {
            // Fallback to global if conf missing
            const conf = project.conf || state.data.settings;
            validDrawings.push({
              ...d,
              id: Math.random().toString(36).substr(2, 9),
              discipline: normalizedDiscipline,
              assignees: d.assignees && d.assignees.length > 0 ? d.assignees : (conf.disciplineDefaults[normalizedDiscipline] ? [conf.disciplineDefaults[normalizedDiscipline]] : []),
              logs: [], remarks: [], statusHistory: [], currentRound: 'A', version: d.version || '0',
              manualCommentsCount: 0, manualOpenCommentsCount: 0
            });
          }
        });

        if (skippedDrawings.length > 0) {
          alert(`Import Partial Success: ${skippedDrawings.length} items skipped due to unique ID/No. conflicts: ${skippedDrawings.slice(0, 5).join(', ')}${skippedDrawings.length > 5 ? '...' : ''}`);
        }

        return {
          data: {
            ...state.data,
            projects: state.data.projects.map(p =>
              p.id === projectId
                ? { ...p, drawings: [...p.drawings, ...validDrawings], lastUpdated: new Date().toISOString(), conf: { ...p.conf!, lastUpdated: new Date().toISOString() } } : p
            )
          }
        };
      }),

      updateDrawing: (projectId, drawingId, updates) => set((state) => {
        const project = state.data.projects.find(p => p.id === projectId);
        if (!project) return state;

        // Check uniqueness if ID or No. is changing
        if (updates.customId || updates.drawingNo) {
          const isDuplicate = project.drawings.some(d =>
            d.id !== drawingId && (
              (updates.customId && d.customId.toLowerCase() === updates.customId.toLowerCase()) ||
              (updates.drawingNo && d.drawingNo.toLowerCase() === updates.drawingNo.toLowerCase())
            )
          );
          if (isDuplicate) {
            alert("Conflict: Another drawing already uses this ID or No.");
            return state;
          }
        }

        const updatedDrawings = project.drawings.map(d => {
          if (d.id !== drawingId) return d;
          let newUpdates = { ...updates };
          const timestamp = new Date().toISOString();

          if (updates.discipline !== undefined) {
            newUpdates.discipline = normalizeDisc(updates.discipline);
          }

          if (updates.version !== undefined && updates.version !== d.version) {
            newUpdates.statusHistory = [...(d.statusHistory || []), { id: Math.random().toString(36).substr(2, 9), content: `Version: ${d.version} -> ${updates.version}`, createdAt: timestamp }];
          }

          if (updates.status && updates.status !== d.status) {
            newUpdates.statusHistory = [...(newUpdates.statusHistory || d.statusHistory), { id: Math.random().toString(36).substr(2, 9), content: `Status: ${updates.status}`, createdAt: timestamp }];
            if (updates.status === 'Reviewing') {
              // Fallback to global if conf missing
              const conf = project.conf || state.data.settings;
              const days = d.currentRound === 'A' ? conf.roundACycle : conf.otherRoundsCycle;
              newUpdates.reviewDeadline = calculateDeadline(new Date(), days, conf.holidays);
            } else {
              newUpdates.reviewDeadline = undefined;
            }
            if (d.status === 'Reviewing' && updates.status === 'Waiting Reply') {
              newUpdates.currentRound = getNextRound(d.currentRound);
            }
          }
          return { ...d, ...newUpdates };
        });
        const timestamp = new Date().toISOString();
        return { data: { ...state.data, projects: state.data.projects.map(p => p.id === projectId ? { ...p, drawings: updatedDrawings, lastUpdated: timestamp, conf: { ...p.conf!, lastUpdated: timestamp } } : p) } };
      }),

      deleteDrawing: (projectId, drawingId) => set((state) => ({
        data: { ...state.data, projects: state.data.projects.map(p => p.id === projectId ? { ...p, drawings: p.drawings.filter(d => d.id !== drawingId), lastUpdated: new Date().toISOString(), conf: { ...p.conf!, lastUpdated: new Date().toISOString() } } : p) }
      })),

      resetAllAssignees: (projectId) => set((state) => ({
        data: {
          ...state.data, projects: state.data.projects.map(p => {
            if (p.id !== projectId) return p;
            const conf = p.conf || state.data.settings;
            return {
              ...p, drawings: p.drawings.map(d => ({ ...d, assignees: conf.disciplineDefaults[normalizeDisc(d.discipline)] ? [conf.disciplineDefaults[normalizeDisc(d.discipline)]] : d.assignees }))
            };
          })
        }
      })),

      takeSnapshot: async (projectId: string) => {
        const { data } = get();
        const p = data.projects.find(x => x.id === projectId);
        if (!p) return;

        // Calculate time window from local state for diff logic
        // Snapshots are stored Newest First [0]. So reference is [0].
        const lastSnapshot = p.snapshots && p.snapshots.length > 0 ? p.snapshots[0] : null;
        const lastSnapshotTime = lastSnapshot ? new Date(lastSnapshot.timestamp).getTime() : 0;
        const now = new Date();
        const timestamp = now.toISOString();

        // --- Logic to build snapshot stats (same as before) ---
        const discStatsMap = new Map<string, DisciplineSnapshot>();
        p.drawings.forEach(d => {
          const discKey = normalizeDisc(d.discipline);
          const currentStat = discStatsMap.get(discKey) || {
            discipline: discKey,
            approved: 0, reviewing: 0, waitingReply: 0, pending: 0, totalComments: 0, openComments: 0,
            flowToReview: 0, flowToWaiting: 0, flowToApproved: 0
          };
          if (d.status === 'Approved') currentStat.approved++;
          else if (d.status === 'Reviewing') currentStat.reviewing++;
          else if (d.status === 'Waiting Reply') currentStat.waitingReply++;
          else if (d.status === 'Pending') currentStat.pending++;
          currentStat.totalComments += (d.manualCommentsCount || 0);
          currentStat.openComments += (d.manualOpenCommentsCount || 0);

          if (d.statusHistory) {
            d.statusHistory.forEach(h => {
              const hTime = new Date(h.createdAt).getTime();
              if (hTime > lastSnapshotTime) {
                if (h.content.includes('Status: Reviewing')) currentStat.flowToReview = (currentStat.flowToReview || 0) + 1;
                if (h.content.includes('Status: Waiting Reply')) currentStat.flowToWaiting = (currentStat.flowToWaiting || 0) + 1;
                if (h.content.includes('Status: Approved')) currentStat.flowToApproved = (currentStat.flowToApproved || 0) + 1;
              }
            });
          }
          discStatsMap.set(discKey, currentStat);
        });

        const snap: ProjectSnapshot = {
          id: Math.random().toString(36).substr(2, 9),
          timestamp: timestamp,
          stats: Array.from(discStatsMap.values())
        };

        // Update Local State Optimistically
        set(state => ({
          data: { ...state.data, projects: state.data.projects.map(pj => pj.id === projectId ? { ...pj, snapshots: [snap, ...(pj.snapshots || [])] } : pj) }
        }));

        // --- WebDAV Save Logic ---
        const { webdavUrl, webdavUser, webdavPass } = data.settings;
        const targetUrl = (import.meta.env.VITE_WEBDAV_URL && import.meta.env.VITE_WEBDAV_URL.trim() !== '') ? import.meta.env.VITE_WEBDAV_URL : webdavUrl;
        const targetUser = (import.meta.env.VITE_WEBDAV_USER && import.meta.env.VITE_WEBDAV_USER.trim() !== '') ? import.meta.env.VITE_WEBDAV_USER : webdavUser;
        const targetPass = (import.meta.env.VITE_WEBDAV_PASSWORD && import.meta.env.VITE_WEBDAV_PASSWORD.trim() !== '') ? import.meta.env.VITE_WEBDAV_PASSWORD : webdavPass;

        if (targetUrl) {
          (async () => {
            try {
              const auth = btoa(`${targetUser}:${targetPass}`);
              const headers = { 'Authorization': `Basic ${auth}` };
              const baseUrl = targetUrl.endsWith('/') ? targetUrl : `${targetUrl}/`;
              const folderUrl = `${baseUrl}${p.name}/`;
              const snapshotsUrl = `${folderUrl}snapshots/`;

              // Create folders if missing (Safeguard)
              await fetch(folderUrl, { method: 'MKCOL', headers }).catch(() => { });
              await fetch(snapshotsUrl, { method: 'MKCOL', headers }).catch(() => { });

              // Upload Snapshot File: timestamp filename for sorting
              // File name friendly time format: YYYYMMDD_HHmm
              const timeStr = format(now, 'yyyyMMdd_HHmm');
              await fetch(`${snapshotsUrl}${timeStr}_${snap.id}.json`, {
                method: 'PUT',
                headers: { ...headers, 'Content-Type': 'application/json' },
                body: JSON.stringify(snap, null, 2)
              });

              // Cleanup: Prune older files
              const listRes = await fetch(snapshotsUrl, { method: 'PROPFIND', headers: { ...headers, 'Depth': '1' } });
              if (listRes.ok) {
                // Parse and list files
                const text = await listRes.text();
                const parser = new DOMParser();
                const doc = parser.parseFromString(text, 'text/xml');
                const hrefs = Array.from(doc.getElementsByTagName("d:href") || doc.getElementsByTagName("href"))
                  .map(n => n.textContent || "")
                  .filter(h => h.endsWith('.json') && decodeURIComponent(h).includes(p.name));

                // Sort newest first
                hrefs.sort((a, b) => b.localeCompare(a));

                // Keep top 10, delete rest
                if (hrefs.length > 10) {
                  const toDelete = hrefs.slice(10);
                  toDelete.forEach(h => fetch(h, { method: 'DELETE', headers }));
                }
              }

            } catch (e) { console.warn("Background snapshot save failed", e); }
          })();
        }
      },

      deleteSnapshot: (projectId, snapshotId) => set((state) => ({
        data: {
          ...state.data,
          projects: state.data.projects.map(p =>
            p.id === projectId
              ? { ...p, snapshots: (p.snapshots || []).filter(s => s.id !== snapshotId) }
              : p
          )
        }
      })),

      addRemark: (projectId, drawingId, content) => set((state) => ({
        data: {
          ...state.data,
          projects: state.data.projects.map(p => p.id === projectId ? {
            ...p,
            drawings: p.drawings.map(d => {
              if (d.id !== drawingId) return d;
              const newRemarks = [...(d.remarks || []), { id: Math.random().toString(36).substr(2, 9), content, createdAt: new Date().toISOString(), resolved: false }];
              return {
                ...d,
                remarks: newRemarks
              };
            })
          } : p)
        }
      })),

      toggleRemarkStatus: (projectId, drawingId, remarkId) => set((state) => ({
        data: {
          ...state.data,
          projects: state.data.projects.map(p => p.id === projectId ? {
            ...p,
            drawings: p.drawings.map(d => {
              if (d.id !== drawingId) return d;
              const newRemarks = (d.remarks || []).map(r => r.id === remarkId ? { ...r, resolved: !r.resolved } : r);
              return {
                ...d,
                remarks: newRemarks
              };
            })
          } : p)
        }
      })),

      updateReviewer: (old, next) => set((state) => ({
        data: {
          ...state.data,
          settings: { ...state.data.settings, reviewers: state.data.settings.reviewers.map(r => r === old ? next : r) },
          projects: state.data.projects.map(p => ({ ...p, drawings: p.drawings.map(d => ({ ...d, assignees: d.assignees.map(a => a === old ? next : a) })) }))
        }
      })),

      syncWithWebDAV: async (password: string) => {
        const { activeProjectId } = get();
        if (!activeProjectId) return false;
        // Password check logic if necessary, or just delegate
        // For compatibility, we ignore password check here relies on pushProjectToWebDAV using store settings
        return get().pushProjectToWebDAV(activeProjectId);
      },

      pushProjectToWebDAV: async (projectId: string) => {
        const { data } = get();
        const project = data.projects.find(p => p.id === projectId);
        if (!project) return false;

        const { webdavUrl, webdavUser, webdavPass } = data.settings;
        const targetUrl = (import.meta.env.VITE_WEBDAV_URL && import.meta.env.VITE_WEBDAV_URL.trim() !== '') ? import.meta.env.VITE_WEBDAV_URL : webdavUrl;
        const targetUser = (import.meta.env.VITE_WEBDAV_USER && import.meta.env.VITE_WEBDAV_USER.trim() !== '') ? import.meta.env.VITE_WEBDAV_USER : webdavUser;
        const targetPass = (import.meta.env.VITE_WEBDAV_PASSWORD && import.meta.env.VITE_WEBDAV_PASSWORD.trim() !== '') ? import.meta.env.VITE_WEBDAV_PASSWORD : webdavPass;

        if (!targetUrl) return false;

        set({ isLoading: true, error: null });
        try {
          const auth = btoa(`${targetUser}:${targetPass}`);
          const projectFolderName = project.name;
          // Ensure URL ends with / if needed before appending folder
          const baseUrl = targetUrl.endsWith('/') ? targetUrl : `${targetUrl}/`;
          const folderUrl = `${baseUrl}${projectFolderName}/`;
          const snapshotsUrl = `${folderUrl}snapshots/`;

          const headers = { 'Authorization': `Basic ${auth}` };

          // 1. Create Project Folder if missing
          const checkFolder = await fetch(folderUrl, { method: 'PROPFIND', headers: { ...headers, 'Depth': '0' } });
          if (checkFolder.status === 404) {
            await fetch(folderUrl, { method: 'MKCOL', headers });
          }

          // 2. Create Snapshots Folder if missing
          const checkSnap = await fetch(snapshotsUrl, { method: 'PROPFIND', headers: { ...headers, 'Depth': '0' } });
          if (checkSnap.status === 404) {
            await fetch(snapshotsUrl, { method: 'MKCOL', headers });
          }

          // 3. Save Settings (settings.json)
          const settingsPayload = project.conf || {
            reviewers: data.settings.reviewers,
            disciplineDefaults: data.settings.disciplineDefaults,
            holidays: data.settings.holidays,
            roundACycle: data.settings.roundACycle, // Fix: restored missing properties
            otherRoundsCycle: data.settings.otherRoundsCycle,
            lastUpdated: project.lastUpdated || new Date().toISOString()
          };
          await fetch(`${folderUrl}settings.json`, {
            method: 'PUT',
            headers: { ...headers, 'Content-Type': 'application/json' },
            body: JSON.stringify(settingsPayload, null, 2)
          });

          // 4. Save Main Data (PA_ProjectName.json) - Strip conf and snapshots
          const { conf, snapshots, ...mainData } = project;
          await fetch(`${folderUrl}PA_${project.name}.json`, {
            method: 'PUT',
            headers: { ...headers, 'Content-Type': 'application/json' },
            body: JSON.stringify(mainData, null, 2)
          });

          // 5. Save Snapshots specifically (if any exist in local state which haven't been synced?)
          // For now, takeSnapshot handles individual snapshot pushes. 
          // If we are migrating, we might want to push existing snapshots? 
          // Let's assume takeSnapshot handles new ones. 
          // However, for migration safety, if local has snapshots, we should try to save them?
          // To keep it simple and safe: We rely on takeSnapshot for new snaps. 
          // Existing snapshots in legacy monolithic file are preserved in the backup (legacy file).
          // We don't necessarily need to explode them all right now unless requested.

          set({ isLoading: false, error: null });
          return true;
        } catch (err: any) {
          console.error("Push failed", err);
          set({ isLoading: false, error: err.message });
          return false;
        }
      },

      saveSettingsToWebDAV: async () => {
        // Deprecated: Settings are now part of the project file (project.conf)
        // const { data } = get();
        // ... (legacy logic commented out)
        return true;
      },

      fetchGlobalSettingsFromWebDAV: async () => {
        const { data } = get();
        const { webdavUrl, webdavUser, webdavPass } = data.settings;
        const targetUrl = (import.meta.env.VITE_WEBDAV_URL && import.meta.env.VITE_WEBDAV_URL.trim() !== '') ? import.meta.env.VITE_WEBDAV_URL : webdavUrl;
        const targetUser = (import.meta.env.VITE_WEBDAV_USER && import.meta.env.VITE_WEBDAV_USER.trim() !== '') ? import.meta.env.VITE_WEBDAV_USER : webdavUser;
        const targetPass = (import.meta.env.VITE_WEBDAV_PASSWORD && import.meta.env.VITE_WEBDAV_PASSWORD.trim() !== '') ? import.meta.env.VITE_WEBDAV_PASSWORD : webdavPass;

        if (!targetUrl) return;

        try {
          const auth = btoa(`${targetUser}:${targetPass}`);
          const url = targetUrl.endsWith('/') ? `${targetUrl}PA_Settings.json` : `${targetUrl}/PA_Settings.json`;

          const res = await fetch(url, { headers: { 'Authorization': `Basic ${auth}` } });
          if (res.ok) {
            const json = await res.json();
            set(state => ({
              data: {
                ...state.data,
                settings: {
                  ...state.data.settings,
                  reviewers: json.reviewers || state.data.settings.reviewers,
                  disciplineDefaults: json.disciplineDefaults || state.data.settings.disciplineDefaults,
                  holidays: json.holidays || state.data.settings.holidays
                }
              }
            }));
          }
        } catch (e) { console.warn("Settings fetch failed", e); }
      },

      fetchProjectListFromWebDAV: async () => {
        const { data } = get();
        const { webdavUrl, webdavUser, webdavPass } = data.settings;
        const targetUrl = (import.meta.env.VITE_WEBDAV_URL && import.meta.env.VITE_WEBDAV_URL.trim() !== '') ? import.meta.env.VITE_WEBDAV_URL : webdavUrl;
        const targetUser = (import.meta.env.VITE_WEBDAV_USER && import.meta.env.VITE_WEBDAV_USER.trim() !== '') ? import.meta.env.VITE_WEBDAV_USER : webdavUser;
        const targetPass = (import.meta.env.VITE_WEBDAV_PASSWORD && import.meta.env.VITE_WEBDAV_PASSWORD.trim() !== '') ? import.meta.env.VITE_WEBDAV_PASSWORD : webdavPass;

        if (!targetUrl) throw new Error("WebDAV URL not configured");

        set({ isLoading: true, error: null });
        try {
          const auth = btoa(`${targetUser}:${targetPass}`);
          console.log(`[WebDAV] Fetching list from: ${targetUrl}`);

          const listResponse = await fetch(targetUrl, {
            method: 'PROPFIND',
            headers: { 'Authorization': `Basic ${auth}`, 'Depth': '1' }
          });

          if (!listResponse.ok) throw new Error(`List failed: ${listResponse.status}`);

          const text = await listResponse.text();
          // console.log("[WebDAV] XML Raw:", text);

          const parser = new DOMParser();
          const xmlDoc = parser.parseFromString(text, "text/xml");

          // Namespace-agnostic parsing: find all 'response' tags regardless of prefix (d:, D:, etc.)
          const allNodes = xmlDoc.getElementsByTagName("*");
          const responses: Element[] = [];
          for (let i = 0; i < allNodes.length; i++) {
            if (allNodes[i].localName === "response") {
              responses.push(allNodes[i]);
            }
          }

          console.log(`[WebDAV] Found ${responses.length} items (Namespace Agnostic)`);

          const projectsMap = new Map<string, Project>();

          // Normalize Target Root URL for comparison
          const rootUrlObj = new URL(targetUrl);
          if (!rootUrlObj.pathname.endsWith('/')) rootUrlObj.pathname += '/';
          const rootUrlStr = rootUrlObj.href;

          for (const resp of responses) {
            // Find href child (Generic)
            let hrefNode: Element | null = null;
            let propstatNodes: Element[] = [];

            // Scan direct children for href and propstat
            for (let k = 0; k < resp.children.length; k++) {
              const child = resp.children[k];
              if (child.localName === "href") hrefNode = child;
              if (child.localName === "propstat") propstatNodes.push(child);
            }

            if (!hrefNode) continue;

            let rawHref = hrefNode.textContent || "";

            // Resolve to Full Absolute URL
            const itemUrlObj = new URL(rawHref, rootUrlStr);
            itemUrlObj.pathname = decodeURIComponent(itemUrlObj.pathname);

            const fullItemUrl = itemUrlObj.href;
            const isRoot = (fullItemUrl === rootUrlStr) || (fullItemUrl === rootUrlStr.slice(0, -1));

            if (isRoot) continue;

            const pathSegments = itemUrlObj.pathname.replace(/\/$/, '').split('/');
            const name = pathSegments[pathSegments.length - 1];
            if (!name) continue;

            // Determine Resource Type (look inside propstat -> prop -> resourcetype)
            // Short circuit: Just look for 'collection' tag anywhere inside the response? 
            // risky if it appears in metadata.
            // Better: Traverse properly: response -> propstat -> prop -> resourcetype -> collection

            let isCollection = false;
            // Helper to find deep localName
            const findLocal = (parent: Element, localName: string): Element | null => {
              for (let k = 0; k < parent.children.length; k++) {
                if (parent.children[k].localName === localName) return parent.children[k];
              }
              return null;
            };

            for (const pstat of propstatNodes) {
              const prop = findLocal(pstat, "prop");
              if (prop) {
                const rtype = findLocal(prop, "resourcetype");
                if (rtype) {
                  if (findLocal(rtype, "collection")) {
                    isCollection = true;
                    break;
                  }
                }
              }
            }

            // Fallback logic for weird servers: if URI ends in slash, assume collection if type unknown?
            // AList normally returns correct types.

            if (isCollection) {

              // Folder Found
              console.log(`[WebDAV] Folder found: ${name}`);
              if (!projectsMap.has(name)) {
                projectsMap.set(name, {
                  id: Math.random().toString(36).substr(2, 9),
                  name: name,
                  drawings: [], conf: undefined, snapshots: [],
                  webdavPath: rawHref
                } as Project);
              }
            } else {
              // File Found (Check Legacy)
              if (name.startsWith('PA_') && name.endsWith('.json')) {
                // Legacy Support
                const cleanName = name.replace(/^PA_/, '').replace(/\.json$/, '');
                // console.log(`[WebDAV] Legacy file found: ${cleanName}`);
                if (cleanName && !projectsMap.has(cleanName)) {
                  projectsMap.set(cleanName, {
                    id: Math.random().toString(36).substr(2, 9),
                    name: cleanName,
                    drawings: [], conf: undefined, snapshots: [],
                    webdavPath: rawHref
                  } as Project);
                }
              }
            }
          }

          // Update store with discovered projects
          set(state => ({
            data: { ...state.data, projects: Array.from(projectsMap.values()) },
            isLoading: false
          }));

        } catch (err: any) {
          console.error("List failed", err);
          set({ isLoading: false, error: err.message });
          throw err;
        }
      },

      refreshSnapshots: async (projectId: string) => {
        const { data } = get();
        const project = data.projects.find(p => p.id === projectId);
        if (!project) return;

        const { webdavUrl, webdavUser, webdavPass } = data.settings;
        const targetUrl = (import.meta.env.VITE_WEBDAV_URL && import.meta.env.VITE_WEBDAV_URL.trim() !== '') ? import.meta.env.VITE_WEBDAV_URL : webdavUrl;
        const targetUser = (import.meta.env.VITE_WEBDAV_USER && import.meta.env.VITE_WEBDAV_USER.trim() !== '') ? import.meta.env.VITE_WEBDAV_USER : webdavUser;
        const targetPass = (import.meta.env.VITE_WEBDAV_PASSWORD && import.meta.env.VITE_WEBDAV_PASSWORD.trim() !== '') ? import.meta.env.VITE_WEBDAV_PASSWORD : webdavPass;

        if (!targetUrl) return;

        set({ isLoading: true, error: null });
        try {
          const auth = btoa(`${targetUser}:${targetPass}`);
          const headers = { 'Authorization': `Basic ${auth}` };

          // Construct Snapshots URL
          const baseUrl = targetUrl.endsWith('/') ? targetUrl : `${targetUrl}/`;
          const projectFolderUrl = `${baseUrl}${project.name}/`;

          // List Snapshots
          const snapListRes = await fetch(`${projectFolderUrl}snapshots/`, { method: 'PROPFIND', headers: { ...headers, 'Depth': '1' } });
          if (!snapListRes.ok) throw new Error("Failed to list snapshots");

          const text = await snapListRes.text();
          const parser = new DOMParser();
          const xmlDoc = parser.parseFromString(text, "text/xml");

          const nodes = xmlDoc.getElementsByTagName("*");
          const snapFiles: { href: string }[] = [];
          for (let i = 0; i < nodes.length; i++) {
            if (nodes[i].localName === "href") {
              const href = nodes[i].textContent;
              if (href && href.endsWith('.json') && !href.endsWith('/')) {
                snapFiles.push({ href });
              }
            }
          }

          // Sort descending (newest first)
          snapFiles.sort((a, b) => b.href.localeCompare(a.href));

          // Take ALL for refresh (User Request: List all on refresh)
          const recentSnaps = snapFiles;

          const snapPromises = recentSnaps.map(s => {
            // Robust URL construction
            const itemUrlObj = new URL(s.href, targetUrl); // Resolve against root URL
            return fetch(itemUrlObj.href, { headers }).then(r => r.json());
          });
          const snapshots = await Promise.all(snapPromises);

          set(state => ({
            isLoading: false,
            data: {
              ...state.data,
              projects: state.data.projects.map(p => p.id === projectId ? { ...p, snapshots } : p)
            }
          }));
        } catch (err: any) {
          console.error("Snapshot refresh failed", err);
          set({ isLoading: false, error: err.message });
        }
      },

      loadProjectFromWebDAV: async (projectId: string, passwordInput?: string) => {
        const { data } = get();
        const projectStub = data.projects.find(p => p.id === projectId);
        if (!projectStub) return;

        const { webdavUrl, webdavUser, webdavPass } = data.settings;
        const targetUrl = (import.meta.env.VITE_WEBDAV_URL && import.meta.env.VITE_WEBDAV_URL.trim() !== '') ? import.meta.env.VITE_WEBDAV_URL : webdavUrl;
        const targetUser = (import.meta.env.VITE_WEBDAV_USER && import.meta.env.VITE_WEBDAV_USER.trim() !== '') ? import.meta.env.VITE_WEBDAV_USER : webdavUser;
        const targetPass = (import.meta.env.VITE_WEBDAV_PASSWORD && import.meta.env.VITE_WEBDAV_PASSWORD.trim() !== '') ? import.meta.env.VITE_WEBDAV_PASSWORD : webdavPass;

        set({ isLoading: true });
        try {
          const auth = btoa(`${targetUser}:${targetPass}`);
          const headers = { 'Authorization': `Basic ${auth}` };

          let fullProject: Project;

          // Determine Path Strategy: Folder or Legacy File?
          const baseUrl = targetUrl.endsWith('/') ? targetUrl : `${targetUrl}/`;
          const projectFolderUrl = `${baseUrl}${projectStub.name}/`;

          // Check for settings.json as a canary
          const settingsRes = await fetch(`${projectFolderUrl}settings.json`, { headers });

          if (settingsRes.ok) {
            // === NEW FOLDER STRUCTURE ===
            const settings = await settingsRes.json();

            // --- PASSWORD CHECK ---
            if (settings.password && settings.password.trim() !== '') {
              if (!passwordInput) {
                throw new Error("PASSWORD_REQUIRED");
              }
              if (passwordInput !== settings.password) {
                throw new Error("INVALID_PASSWORD");
              }
            }
            // ---------------------

            // Fetch Main Data
            const mainRes = await fetch(`${projectFolderUrl}PA_${projectStub.name}.json`, { headers });
            if (!mainRes.ok) throw new Error("Found settings but missing main project file");
            const mainData = await mainRes.json();

            // Fetch Snapshots (Last 10)
            let snapshots: ProjectSnapshot[] = [];
            try {
              const snapListRes = await fetch(`${projectFolderUrl}snapshots/`, { method: 'PROPFIND', headers: { ...headers, 'Depth': '1' } });
              if (snapListRes.ok) {
                const text = await snapListRes.text();
                const parser = new DOMParser();
                const xmlDoc = parser.parseFromString(text, "text/xml");

                const nodes = xmlDoc.getElementsByTagName("*");
                const snapFiles: { href: string }[] = [];
                for (let i = 0; i < nodes.length; i++) {
                  if (nodes[i].localName === "href") {
                    const href = nodes[i].textContent;
                    if (href && href.endsWith('.json') && !href.endsWith('/')) {
                      snapFiles.push({ href });
                    }
                  }
                }

                // Sort descending (newest first)
                snapFiles.sort((a, b) => b.href.localeCompare(a.href));

                // Take top 10
                const recentSnaps = snapFiles.slice(0, 10);

                const snapPromises = recentSnaps.map(s => {
                  const itemUrlObj = new URL(s.href, targetUrl);
                  return fetch(itemUrlObj.href, { headers }).then(r => r.json());
                });
                snapshots = await Promise.all(snapPromises);
              }
            } catch (e) { console.warn("Snapshot fetch warning", e); } // Non-critical

            fullProject = {
              ...mainData,
              conf: settings,
              snapshots: snapshots,
              lastUpdated: settings.lastUpdated
            };

          } else {
            // === LEGACY MONOLITHIC FILE ===
            const legacyFileUrl = `${baseUrl}PA_${projectStub.name}.json`;
            const res = await fetch(legacyFileUrl, { headers });
            if (!res.ok) throw new Error(`Project not found in Folder or Legacy File: ${res.status}`);
            fullProject = await res.json();
          }

          // Inject critical configs if missing (Legacy safety)
          set(state => {
            const globalSettings = state.data.settings;
            if (!fullProject.drawings) fullProject.drawings = [];
            if (!fullProject.conf) {
              fullProject.conf = {
                reviewers: globalSettings.reviewers,
                disciplineDefaults: globalSettings.disciplineDefaults,
                holidays: globalSettings.holidays,
                roundACycle: globalSettings.roundACycle,
                otherRoundsCycle: globalSettings.otherRoundsCycle
              };
            }

            return {
              data: {
                ...state.data,
                projects: state.data.projects.map(p => p.id === projectId ? { ...fullProject, id: projectId } : p)
              },
              isLoading: false
            };
          });

        } catch (err: any) {
          set({ isLoading: false, error: err.message });
          throw err;
        }
      },

      // Legacy or internal helper - removed or kept minimal if needed
      loadFromWebDAV: async () => { },
      fetchAllProjectsFromWebDAV: async () => { }, // Deprecated

      testWebDAVConnection: async (url, user, pass) => {
        if (!url) return { success: false, message: 'Server URL is required.' };
        set({ isLoading: true, error: null });
        try {
          const auth = btoa(`${user}:${pass}`);
          const response = await fetch(url, {
            method: 'OPTIONS', // Standard check for WebDAV capabilities
            headers: { 'Authorization': `Basic ${auth}` }
          });

          if (response.ok) {
            set({ isLoading: false });
            return { success: true, message: 'Connection successful!' };
          } else {
            throw new Error(`Connection failed: ${response.status} ${response.statusText}`);
          }
        } catch (err: any) {
          set({ isLoading: false, error: err.message });
          return { success: false, message: err.message };
        }
      }
    }),
    {
      name: 'marine-drawings-v3-storage-webdav',
      partialize: (state) => ({ data: state.data, activeProjectId: state.activeProjectId }),
    }
  )
);

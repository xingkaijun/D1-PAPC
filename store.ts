
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { AppData, Project, Drawing, DrawingStatus, Remark, AppSettings, ProjectSnapshot, DisciplineSnapshot } from './types';
// Fix: Removed missing isWeekend from date-fns imports
import { addDays, format, isSameDay } from 'date-fns';

// Fix: Local implementation of isWeekend to resolve missing export error from date-fns
const isWeekend = (date: Date) => {
  const day = date.getDay();
  return day === 0 || day === 6; // 0 is Sunday, 6 is Saturday
};

// Helper to normalize strings (trim and Title Case for disciplines)
const normalizeDisc = (val: string) => val.trim().split(/\s+/).map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');

interface AppState {
  data: AppData;
  activeProjectId: string | null;
  isLoading: boolean;
  error: string | null;

  setSettings: (settings: Partial<AppSettings>) => void;
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

  syncWithWebDAV: (password: string) => Promise<boolean>;
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
    reviewers: ['Kevin', 'David', 'Alice', 'John', 'Sarah'],
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
          snapshots: []
        };
        return {
          data: { ...state.data, projects: [...state.data.projects, newProject] },
          activeProjectId: newProject.id
        };
      }),

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

        const normalizedDiscipline = normalizeDisc(drawing.discipline || 'Hull');
        const defaultReviewer = state.data.settings.disciplineDefaults[normalizedDiscipline];

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
            validDrawings.push({
              ...d,
              id: Math.random().toString(36).substr(2, 9),
              discipline: normalizedDiscipline,
              assignees: d.assignees && d.assignees.length > 0 ? d.assignees : (state.data.settings.disciplineDefaults[normalizedDiscipline] ? [state.data.settings.disciplineDefaults[normalizedDiscipline]] : []),
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
                ? { ...p, drawings: [...p.drawings, ...validDrawings] } : p
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
              const days = d.currentRound === 'A' ? state.data.settings.roundACycle : state.data.settings.otherRoundsCycle;
              newUpdates.reviewDeadline = calculateDeadline(new Date(), days, state.data.settings.holidays);
            } else {
              newUpdates.reviewDeadline = undefined;
            }
            if (d.status === 'Reviewing' && updates.status === 'Waiting Reply') {
              newUpdates.currentRound = getNextRound(d.currentRound);
            }
          }
          return { ...d, ...newUpdates };
        });
        return { data: { ...state.data, projects: state.data.projects.map(p => p.id === projectId ? { ...p, drawings: updatedDrawings } : p) } };
      }),

      deleteDrawing: (projectId, drawingId) => set((state) => ({
        data: { ...state.data, projects: state.data.projects.map(p => p.id === projectId ? { ...p, drawings: p.drawings.filter(d => d.id !== drawingId) } : p) }
      })),

      resetAllAssignees: (projectId) => set((state) => ({
        data: {
          ...state.data, projects: state.data.projects.map(p => p.id === projectId ? {
            ...p, drawings: p.drawings.map(d => ({ ...d, assignees: state.data.settings.disciplineDefaults[normalizeDisc(d.discipline)] ? [state.data.settings.disciplineDefaults[normalizeDisc(d.discipline)]] : d.assignees }))
          } : p)
        }
      })),

      takeSnapshot: (projectId) => set((state) => {
        const p = state.data.projects.find(x => x.id === projectId);
        if (!p) return state;

        // Aggregate by normalized discipline to ensure no duplicates in snapshot stats
        const discStatsMap = new Map<string, DisciplineSnapshot>();

        p.drawings.forEach(d => {
          const discKey = normalizeDisc(d.discipline);
          const currentStat = discStatsMap.get(discKey) || {
            discipline: discKey,
            approved: 0, reviewing: 0, waitingReply: 0, pending: 0, totalComments: 0, openComments: 0
          };

          if (d.status === 'Approved') currentStat.approved++;
          else if (d.status === 'Reviewing') currentStat.reviewing++;
          else if (d.status === 'Waiting Reply') currentStat.waitingReply++;
          else if (d.status === 'Pending') currentStat.pending++;

          currentStat.totalComments += (d.manualCommentsCount || 0);
          currentStat.openComments += (d.manualOpenCommentsCount || 0);

          discStatsMap.set(discKey, currentStat);
        });

        const snap = {
          id: Math.random().toString(36).substr(2, 9),
          timestamp: new Date().toISOString(),
          stats: Array.from(discStatsMap.values())
        };

        return { data: { ...state.data, projects: state.data.projects.map(pj => pj.id === projectId ? { ...pj, snapshots: [...(pj.snapshots || []), snap] } : pj) } };
      }),

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
        const { data, activeProjectId } = get();
        const { webdavUrl, webdavUser, webdavPass, pushPassword } = data.settings;

        // Prioritize Environment Variables
        const targetUrl = (import.meta.env.VITE_WEBDAV_URL && import.meta.env.VITE_WEBDAV_URL.trim() !== '') ? import.meta.env.VITE_WEBDAV_URL : webdavUrl;
        const targetUser = (import.meta.env.VITE_WEBDAV_USER && import.meta.env.VITE_WEBDAV_USER.trim() !== '') ? import.meta.env.VITE_WEBDAV_USER : webdavUser;
        const targetPass = (import.meta.env.VITE_WEBDAV_PASSWORD && import.meta.env.VITE_WEBDAV_PASSWORD.trim() !== '') ? import.meta.env.VITE_WEBDAV_PASSWORD : webdavPass;

        const project = data.projects.find(p => p.id === activeProjectId);


        const envPass = import.meta.env.VITE_PUSH_PASSWORD;
        const targetPushPass = (envPass && envPass.trim() !== '') ? envPass : pushPassword;
        if (targetPushPass && targetPushPass.trim() !== '' && password !== targetPushPass) {
          set({ error: 'AUTHENTICATION_FAILED' });
          return false;
        }

        if (!targetUrl || !project) {
          set({ error: 'MISSING_WEBDAV_CONFIG' });
          return false;
        }

        set({ isLoading: true, error: null });
        try {
          const fileName = `PA_${project.name}.json`;
          const url = targetUrl.endsWith('/') ? `${targetUrl}${fileName}` : `${targetUrl}/${fileName}`;

          const auth = btoa(`${targetUser}:${targetPass}`);
          const response = await fetch(url, {
            method: 'PUT',
            headers: {
              'Authorization': `Basic ${auth}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(project, null, 2)
          });

          if (!response.ok) throw new Error(`WebDAV Error: ${response.status}`);

          set({ isLoading: false, error: null });
          return true;
        } catch (err: any) {
          set({ isLoading: false, error: err.message });
          return false;
        }
      },

      loadFromWebDAV: async () => {
        const { data, activeProjectId } = get();
        const { webdavUrl, webdavUser, webdavPass } = data.settings;

        const targetUrl = (import.meta.env.VITE_WEBDAV_URL && import.meta.env.VITE_WEBDAV_URL.trim() !== '') ? import.meta.env.VITE_WEBDAV_URL : webdavUrl;
        const targetUser = (import.meta.env.VITE_WEBDAV_USER && import.meta.env.VITE_WEBDAV_USER.trim() !== '') ? import.meta.env.VITE_WEBDAV_USER : webdavUser;
        const targetPass = (import.meta.env.VITE_WEBDAV_PASSWORD && import.meta.env.VITE_WEBDAV_PASSWORD.trim() !== '') ? import.meta.env.VITE_WEBDAV_PASSWORD : webdavPass;

        const project = data.projects.find(p => p.id === activeProjectId);

        if (!targetUrl || !project) return;

        set({ isLoading: true, error: null });
        try {
          const fileName = `PA_${project.name}.json`;
          const url = targetUrl.endsWith('/') ? `${targetUrl}${fileName}` : `${targetUrl}/${fileName}`;

          const auth = btoa(`${targetUser}:${targetPass}`);
          const response = await fetch(url, {
            headers: { 'Authorization': `Basic ${auth}` }
          });

          if (!response.ok) throw new Error(`Fetch failed: ${response.status}`);

          const updatedProject = await response.json();
          set(state => ({
            data: {
              ...state.data,
              projects: state.data.projects.map(p => p.id === project.id ? { ...updatedProject, id: project.id } : p)
            },
            isLoading: false
          }));
        } catch (err: any) {
          set({ isLoading: false, error: err.message });
        }
      },

      fetchAllProjectsFromWebDAV: async () => {
        const { data } = get();
        const { webdavUrl, webdavUser, webdavPass } = data.settings;

        const targetUrl = (import.meta.env.VITE_WEBDAV_URL && import.meta.env.VITE_WEBDAV_URL.trim() !== '') ? import.meta.env.VITE_WEBDAV_URL : webdavUrl;
        const targetUser = (import.meta.env.VITE_WEBDAV_USER && import.meta.env.VITE_WEBDAV_USER.trim() !== '') ? import.meta.env.VITE_WEBDAV_USER : webdavUser;
        const targetPass = (import.meta.env.VITE_WEBDAV_PASSWORD && import.meta.env.VITE_WEBDAV_PASSWORD.trim() !== '') ? import.meta.env.VITE_WEBDAV_PASSWORD : webdavPass;

        if (!targetUrl) return;

        set({ isLoading: true, error: null });

        try {
          const auth = btoa(`${targetUser}:${targetPass}`);

          // 1. List files using PROPFIND
          const listResponse = await fetch(targetUrl, {
            method: 'PROPFIND',
            headers: {
              'Authorization': `Basic ${auth}`,
              'Depth': '1'
            }
          });

          if (!listResponse.ok) throw new Error(`Failed to list files: ${listResponse.status}`);

          const text = await listResponse.text();
          const parser = new DOMParser();
          const xmlDoc = parser.parseFromString(text, "text/xml");

          const hrefs: string[] = [];
          const nodes = xmlDoc.getElementsByTagName("*");
          for (let i = 0; i < nodes.length; i++) {
            if (nodes[i].localName === "href") {
              hrefs.push(nodes[i].textContent || "");
            }
          }

          const projectFiles = hrefs.filter(href => {
            const decoded = decodeURIComponent(href);
            return decoded.includes('PA_') && decoded.endsWith('.json');
          });

          if (projectFiles.length === 0) {
            set({ isLoading: false });
            return;
          }

          // 2. Fetch each project file
          const fetchedProjects: Project[] = [];

          // Use a unique set to handle duplicates if PROPFIND returns collection roots + files
          const uniqueUrls = new Set(projectFiles.map(h => {
            try {
              return new URL(h, targetUrl).toString();
            } catch {
              return h;
            }
          }));

          for (const url of uniqueUrls) {
            try {
              const fileRes = await fetch(url, {
                headers: { 'Authorization': `Basic ${auth}` }
              });
              if (fileRes.ok) {
                const projectData = await fileRes.json();
                if (projectData && (projectData.id || projectData.name) && Array.isArray(projectData.drawings)) {
                  fetchedProjects.push({
                    ...projectData,
                    id: projectData.id || Math.random().toString(36).substr(2, 9), // Ensure ID exists
                    name: projectData.name || "Unknown Project"
                  });
                }
              }
            } catch (e) {
              console.error(`Failed to load project from ${url}`, e);
            }
          }

          // 3. Merge into state
          if (fetchedProjects.length > 0) {
            set((state) => {
              const currentProjects = [...state.data.projects];

              fetchedProjects.forEach(fp => {
                const idx = currentProjects.findIndex(p => p.name === fp.name); // Match by name usually safer for cross-device
                if (idx > -1) {
                  // Merge/Update: For now, we overwrite to sync from server
                  // Preserve ID if matching by name to keep local selection state if possible
                  currentProjects[idx] = { ...fp, id: currentProjects[idx].id };
                } else {
                  currentProjects.push(fp);
                }
              });

              const activeId = state.activeProjectId || (currentProjects.length > 0 ? currentProjects[0].id : null);

              return {
                data: { ...state.data, projects: currentProjects },
                activeProjectId: activeId,
                isLoading: false
              };
            });
            // Don't alert here to avoid spamming if called automatically, caller can alert
          } else {
            set({ isLoading: false });
          }

        } catch (err: any) {
          set({ isLoading: false, error: err.message });
          // Caller handles alert
          throw err;
        }
      },

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

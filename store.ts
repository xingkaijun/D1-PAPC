import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { AppData, Project, Drawing, DrawingStatus, Remark, AppSettings, ProjectSnapshot, DisciplineSnapshot, ProjectConfig } from './types';
// Fix: Removed missing isWeekend from date-fns imports
import { addDays, format, isSameDay } from 'date-fns';
import { IStorageProvider } from './services/storage/IStorageProvider';
import { WebDAVProvider } from './services/storage/WebDAVProvider';
import { OneDriveProxyProvider } from './services/storage/OneDriveProxyProvider';

let _storageProvider: IStorageProvider | null = null;
const getProvider = (settings: AppSettings): IStorageProvider => {
  const type = settings.storage?.type || 'WEBDAV';
  if (!_storageProvider ||
    (type === 'WEBDAV' && !(_storageProvider instanceof WebDAVProvider)) ||
    (type === 'ONEDRIVE' && !(_storageProvider instanceof OneDriveProxyProvider))) {

    if (type === 'ONEDRIVE') _storageProvider = new OneDriveProxyProvider();
    else _storageProvider = new WebDAVProvider();
  }
  _storageProvider.configure(settings);
  return _storageProvider;
};

// Fix: Local implementation of isWeekend to resolve missing export error from date-fns
const isWeekend = (date: Date) => {
  const day = date.getDay();
  return day === 0 || day === 6;
};

interface AppState {
  data: AppData;
  isLoading: boolean;
  error: string | null;
  activeProjectId: string | null;

  // Actions
  addProject: (name: string) => void;
  deleteProject: (projectId: string) => void;
  setActiveProject: (projectId: string) => void;
  updateSettings: (settings: Partial<AppSettings>) => void;
  addDrawing: (drawing: Drawing) => void;
  updateDrawing: (id: string, updates: Partial<Drawing>) => void;
  deleteDrawing: (id: string) => void;
  bulkImportDrawings: (drawings: Drawing[]) => void;
  syncWithWebDAV: (password: string) => Promise<boolean>;
  loadFromWebDAV: () => Promise<void>;
  pushProjectToWebDAV: (projectId: string) => Promise<boolean>;
  saveSettingsToWebDAV: () => Promise<boolean>;
  fetchGlobalSettingsFromWebDAV: () => Promise<void>;
  fetchAllProjectsFromWebDAV: () => Promise<void>;
  fetchProjectListFromWebDAV: () => Promise<void>;
  loadProjectFromWebDAV: (projectId: string, passwordInput?: string) => Promise<void>;
  refreshSnapshots: (projectId: string) => Promise<void>;
  testWebDAVConnection: (url: string, user: string, pass: string, proxyUrl?: string) => Promise<{ success: boolean; message: string }>;
  takeSnapshot: (projectId: string) => Promise<void>;
  deleteSnapshot: (projectId: string, snapshotId: string) => Promise<void>;
  restoreSnapshot: (snapshotId: string) => Promise<boolean>;

  // UI State
  viewMode: 'list' | 'board';
  setViewMode: (mode: 'list' | 'board') => void;
  filterQuery: string;
  setFilterQuery: (query: string) => void;
  isEditMode: boolean;
  toggleEditMode: (password?: string) => boolean;
  setStorageMode: (config: AppSettings['storage']) => void;
  updateProjectConfig: (projectId: string, updates: Partial<ProjectConfig>) => void;
  clearError: () => void;
  restoreProject: (project: Project) => void;
  toggleRemarkStatus: (drawingId: string, remarkId: string) => void;
}

const calculateDeadline = (startDate: Date, workingDays: number, holidays: string[]) => {
  let count = 0;
  let currentDate = startDate;

  // Safety break
  let loops = 0;
  while (count < workingDays && loops < 365) {
    loops++;
    currentDate = addDays(currentDate, 1);
    if (!isWeekend(currentDate)) {
      // Check holiday string match (simplified YYYY-MM-DD)
      const dateStr = format(currentDate, 'yyyy-MM-dd');
      if (!holidays.includes(dateStr)) {
        count++;
      }
    }
  }
  return currentDate;
};

const DEFAULT_DATA: AppData = {
  lastUpdated: new Date().toISOString(),
  projects: [],
  settings: {
    webdavUrl: '', // Legacy
    webdavUser: '', // Legacy
    webdavPass: '', // Legacy
    reviewers: [
      { id: 'engineer_a', name: 'Engineer A' },
      { id: 'engineer_b', name: 'Engineer B' },
      { id: 'senior_eng_c', name: 'Senior Eng C' }
    ],
    disciplineDefaults: {}, // Map discipline -> reviewer ID
    holidays: [], // YYYY-MM-DD strings
    roundACycle: 10,
    otherRoundsCycle: 5,
    storage: {
      type: 'WEBDAV'
    }
  }
};

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      data: DEFAULT_DATA,
      isLoading: false,
      error: null,
      activeProjectId: null,
      viewMode: 'list',
      filterQuery: '',
      isEditMode: false,

      setViewMode: (mode) => set({ viewMode: mode }),
      setFilterQuery: (query) => set({ filterQuery: query }),

      toggleEditMode: (password) => {
        const envPass = import.meta.env.VITE_WEBDAV_PASSWORD; // Reuse for edit lock if set
        if (!get().isEditMode) {
          // Entering Edit Mode
          if (envPass && envPass.trim() !== '') {
            if (password === envPass) {
              set({ isEditMode: true });
              return true;
            }
            return false;
          } else {
            set({ isEditMode: true });
            return true;
          }
        } else {
          set({ isEditMode: false });
          return true;
        }
      },

      setActiveProject: (projectId) => set({ activeProjectId: projectId }),

      addProject: (name) => set((state) => ({
        data: {
          ...state.data,
          projects: [
            ...state.data.projects,
            {
              id: Math.random().toString(36).substr(2, 9),
              name,
              drawings: [],
              conf: { // Default Project Config from Global Settings
                reviewers: state.data.settings.reviewers,
                disciplineDefaults: state.data.settings.disciplineDefaults,
                holidays: state.data.settings.holidays,
                roundACycle: state.data.settings.roundACycle,
                otherRoundsCycle: state.data.settings.otherRoundsCycle
              },
              snapshots: []
            },
          ],
        },
      })),

      deleteProject: (projectId) => set((state) => ({
        data: {
          ...state.data,
          projects: state.data.projects.filter((p) => p.id !== projectId),
        },
        activeProjectId: state.activeProjectId === projectId ? null : state.activeProjectId,
      })),

      updateSettings: (newSettings) => set((state) => ({
        data: { ...state.data, settings: { ...state.data.settings, ...newSettings } },
      })),

      addDrawing: (drawing) => set((state) => {
        const { activeProjectId, data } = state;
        if (!activeProjectId) return state;

        return {
          data: {
            ...data,
            projects: data.projects.map((p) => {
              if (p.id !== activeProjectId) return p;

              const updatedDrawings = [...p.drawings, drawing];

              // Auto-calculate deadline if new drawing has receivedDate
              if (drawing.receivedDate && p.conf) {
                const disc = drawing.discipline;
                const defaults = p.conf.disciplineDefaults[disc];
                if (defaults && drawing.category) {
                  // Simple calculation
                  const startDate = new Date(drawing.receivedDate);
                  const days = drawing.category === 'A' ? p.conf.roundACycle : p.conf.otherRoundsCycle;
                  const deadline = calculateDeadline(startDate, days, p.conf.holidays);
                  drawing.deadline = format(deadline, 'yyyy-MM-dd');
                }
              }

              return { ...p, drawings: updatedDrawings };
            }),
          },
        };
      }),

      updateDrawing: (id, updates) => set((state) => {
        const { activeProjectId } = state;
        if (!activeProjectId) return state;

        return {
          data: {
            ...state.data,
            projects: state.data.projects.map(p => {
              if (p.id !== activeProjectId) return p;
              return {
                ...p,
                drawings: p.drawings.map(d => d.id === id ? { ...d, ...updates } : d)
              };
            })
          }
        };
      }),

      deleteDrawing: (id) => set((state) => {
        const { activeProjectId } = state;
        if (!activeProjectId) return state;
        return {
          data: {
            ...state.data,
            projects: state.data.projects.map(p => p.id === activeProjectId ? { ...p, drawings: p.drawings.filter(d => d.id !== id) } : p)
          }
        };
      }),

      bulkImportDrawings: (drawings) => set((state) => {
        const { activeProjectId } = state;
        if (!activeProjectId) return state;
        return {
          data: {
            ...state.data,
            projects: state.data.projects.map(p => p.id === activeProjectId ? { ...p, drawings: [...p.drawings, ...drawings] } : p)
          }
        };
      }),

      setStorageMode: (config) => set((state) => ({
        data: { ...state.data, settings: { ...state.data.settings, storage: { ...state.data.settings.storage, ...config } } }
      })),

      syncWithWebDAV: async (password: string) => {
        const { activeProjectId } = get();
        if (!activeProjectId) return false;
        return get().pushProjectToWebDAV(activeProjectId);
      },

      pushProjectToWebDAV: async (projectId: string) => {
        const { data } = get();
        const project = data.projects.find(p => p.id === projectId);
        if (!project) return false;

        set({ isLoading: true, error: null });
        try {
          const provider = getProvider(data.settings);
          const success = await provider.saveProject(project);
          set({ isLoading: false });
          return success;
        } catch (err: any) {
          console.error("Push failed", err);
          set({ isLoading: false, error: err.message });
          return false;
        }
      },

      saveSettingsToWebDAV: async () => { return true; },

      fetchGlobalSettingsFromWebDAV: async () => {
        const { data } = get();
        try {
          const provider = getProvider(data.settings);
          const settings = await provider.fetchGlobalSettings();
          if (settings) {
            set(state => ({
              data: {
                ...state.data,
                settings: {
                  ...state.data.settings,
                  ...settings
                }
              }
            }));
          }
        } catch (e) { console.warn("Settings fetch failed", e); }
      },

      fetchProjectListFromWebDAV: async () => {
        const { data } = get();
        set({ isLoading: true, error: null });
        try {
          const provider = getProvider(data.settings);
          const remoteProjects = await provider.fetchProjectList();

          set(state => {
            const currentProjects = state.data.projects;
            const mergedProjects = [...currentProjects];

            remoteProjects.forEach(rp => {
              const existingIndex = mergedProjects.findIndex(p => p.name === rp.name);
              if (existingIndex > -1) {
                mergedProjects[existingIndex] = { ...mergedProjects[existingIndex], webdavPath: rp.webdavPath };
              } else {
                mergedProjects.push(rp);
              }
            });

            return {
              data: { ...state.data, projects: mergedProjects },
              isLoading: false
            };
          });
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

        // No loading state for background refresh usually, but let's keep silent or localized
        try {
          const provider = getProvider(data.settings);
          const snapshots = await provider.loadSnapshots(project);

          set(state => ({
            data: {
              ...state.data,
              projects: state.data.projects.map(p => p.id === projectId ? { ...p, snapshots } : p)
            }
          }));
        } catch (err: any) {
          console.warn("Snapshot refresh failed", err);
        }
      },

      takeSnapshot: async (projectId: string) => {
        const { data } = get();
        const project = data.projects.find(p => p.id === projectId);
        if (!project) return;

        set({ isLoading: true });
        try {
          const provider = getProvider(data.settings);
          // Auto-generate note via prompt or default
          const note = prompt("Snapshot Note (Optional):") || "Manual Snapshot";

          await provider.createSnapshot(project, note);

          // Refresh list immediately
          const snapshots = await provider.loadSnapshots(project);

          set(state => ({
            isLoading: false,
            data: {
              ...state.data,
              projects: state.data.projects.map(p => p.id === projectId ? { ...p, snapshots } : p)
            }
          }));
        } catch (e: any) {
          set({ isLoading: false, error: e.message });
        }
      },

      deleteSnapshot: async (projectId: string, snapshotId: string) => {
        const { data } = get();
        const project = data.projects.find(p => p.id === projectId);
        if (!project) return;

        set({ isLoading: true });
        try {
          const provider = getProvider(data.settings);
          await provider.deleteSnapshot(project, snapshotId);

          // Refresh list
          const snapshots = await provider.loadSnapshots(project);

          set(state => ({
            isLoading: false,
            data: {
              ...state.data,
              projects: state.data.projects.map(p => p.id === projectId ? { ...p, snapshots } : p)
            }
          }));
        } catch (e: any) {
          set({ isLoading: false, error: e.message });
        }
      },

      restoreSnapshot: async (snapshotId: string) => {
        const { data, activeProjectId } = get();
        if (!activeProjectId) return false;
        const project = data.projects.find(p => p.id === activeProjectId);
        if (!project) return false;

        const snapshot = project.snapshots?.find(s => s.id === snapshotId);
        if (!snapshot) return false;

        if (!window.confirm(`Are you sure you want to restore snapshot "${snapshot.note}"? Data since ${new Date(snapshot.createdAt).toLocaleString()} will be lost.`)) {
          return false;
        }

        set({ isLoading: true });
        try {
          const provider = getProvider(data.settings);
          await provider.restoreSnapshot(project, snapshot);

          // Reload project data fully
          await get().loadProjectFromWebDAV(activeProjectId, project.conf?.password);

          set({ isLoading: false });
          return true;
        } catch (e: any) {
          set({ isLoading: false, error: e.message });
          return false;
        }
      },

      loadProjectFromWebDAV: async (projectId: string, passwordInput?: string) => {
        const { data } = get();
        const projectStub = data.projects.find(p => p.id === projectId);
        if (!projectStub) return;

        set({ isLoading: true });
        try {
          const provider = getProvider(data.settings);
          const fullProject = await provider.loadProjectData(projectStub, passwordInput);

          // Inject defaults
          const globalSettings = data.settings;
          if (!fullProject.conf) {
            fullProject.conf = {
              reviewers: globalSettings.reviewers,
              disciplineDefaults: globalSettings.disciplineDefaults,
              holidays: globalSettings.holidays,
              roundACycle: globalSettings.roundACycle,
              otherRoundsCycle: globalSettings.otherRoundsCycle
            };
          }

          set(state => ({
            data: {
              ...state.data,
              projects: state.data.projects.map(p => p.id === projectId ? { ...fullProject, id: projectId } : p)
            },
            isLoading: false
          }));
        } catch (err: any) {
          set({ isLoading: false, error: err.message });
          throw err;
        }
      },

      loadFromWebDAV: async () => { },
      fetchAllProjectsFromWebDAV: async () => { },

      testWebDAVConnection: async (url, user, pass, proxyUrl) => {
        const { data } = get();
        // 优先根据是否传入了 proxyUrl 或者当前的 storageType 来判断
        const isOneDrive = (proxyUrl && proxyUrl.trim() !== '') || data.settings.storage?.type === 'ONEDRIVE';
        const type = isOneDrive ? 'ONEDRIVE' : 'WEBDAV';

        let testSettings = { ...data.settings };
        if (type === 'WEBDAV') {
          testSettings = { ...testSettings, storage: { type, webdav: { url, username: user, password: pass } }, webdavUrl: url, webdavUser: user, webdavPass: pass };
        } else {
          testSettings = { ...testSettings, storage: { type, onedrive: { proxyUrl: proxyUrl || '' } } };
        }

        let provider: IStorageProvider;
        if (type === 'ONEDRIVE') provider = new OneDriveProxyProvider();
        else provider = new WebDAVProvider();

        provider.configure(testSettings);
        return provider.testConnection();
      },

      updateProjectConfig: (projectId, updates) => set((state) => ({
        data: {
          ...state.data,
          projects: state.data.projects.map(p => p.id === projectId ? {
            ...p,
            conf: { ...(p.conf || state.data.settings), ...updates }
          } : p)
        }
      })),

      clearError: () => set({ error: null }),

      restoreProject: (project) => set((state) => ({
        data: {
          ...state.data,
          projects: [...state.data.projects.filter(p => p.name !== project.name), project]
        }
      })),

      toggleRemarkStatus: (drawingId, remarkId) => set((state) => {
        const { activeProjectId } = state;
        if (!activeProjectId) return state;

        return {
          data: {
            ...state.data,
            projects: state.data.projects.map(p => {
              if (p.id !== activeProjectId) return p;
              return {
                ...p,
                drawings: p.drawings.map(d => {
                  if (d.id !== drawingId) return d;
                  return {
                    ...d,
                    remarks: d.remarks.map(r => r.id === remarkId ? { ...r, resolved: !r.resolved } : r)
                  };
                })
              };
            })
          }
        };
      }),
    }),
    {
      name: 'marine-drawings-v3-storage-webdav',
      partialize: (state) => ({ data: state.data, activeProjectId: state.activeProjectId }),
    }
  )
);

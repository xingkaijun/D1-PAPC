import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { AppData, Project, Drawing, DrawingStatus, Remark, AppSettings, ProjectSnapshot, DisciplineSnapshot, ProjectConfig, ReviewTrackerData } from './types';
// Fix: Removed missing isWeekend from date-fns imports
import { addDays, format, isSameDay } from 'date-fns';
import { IStorageProvider } from './services/storage/IStorageProvider';
import { WebDAVProvider } from './services/storage/WebDAVProvider';
import { OneDriveProxyProvider } from './services/storage/OneDriveProxyProvider';

let _storageProvider: IStorageProvider | null = null;
const generateId = () => Math.random().toString(36).substr(2, 9);

const ensureDrawingHasId = (drawing: Drawing): Drawing => {
  if (drawing.id && String(drawing.id).trim() !== '') return drawing;
  return { ...drawing, id: generateId() };
};

const normalizeProjectDrawingIds = (project: Project): Project => ({
  ...project,
  drawings: (project.drawings || []).map(ensureDrawingHasId),
});

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
  addRemark: (drawingId: string, content: string) => void;
  deleteRemark: (drawingId: string, content: string) => void;
  batchUpdateDrawings: (updates: { id: string; changes: Partial<Drawing> }[]) => void;
  resetAllAssignees: () => void;
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
  refreshAllSnapshots: (projectId: string) => Promise<void>;
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

  // 审核追踪
  reviewTracker: ReviewTrackerData;
  loadReviewTracker: (projectId: string) => Promise<void>;
  toggleAssigneeDone: (drawingId: string, assignee: string) => void;
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
      type: 'ONEDRIVE'
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
      reviewTracker: {},

      setViewMode: (mode) => set({ viewMode: mode }),
      setFilterQuery: (query) => set({ filterQuery: query }),

      toggleEditMode: (password) => {
        const envPass = import.meta.env.VITE_EDIT_PASSWORD; // 使用专用的编辑密码环境变量
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
        const drawingWithId = ensureDrawingHasId(drawing);

        return {
          data: {
            ...data,
            projects: data.projects.map((p) => {
              if (p.id !== activeProjectId) return p;

              const updatedDrawings = [...p.drawings, drawingWithId];

              // Auto-calculate deadline if new drawing has receivedDate
              if (drawingWithId.receivedDate && p.conf) {
                const disc = drawingWithId.discipline;
                const defaults = p.conf.disciplineDefaults[disc];
                if (defaults && drawingWithId.category) {
                  // Simple calculation
                  const startDate = new Date(drawingWithId.receivedDate);
                  const days = drawingWithId.category === 'A' ? p.conf.roundACycle : p.conf.otherRoundsCycle;
                  const deadline = calculateDeadline(startDate, days, p.conf.holidays);
                  drawingWithId.deadline = format(deadline, 'yyyy-MM-dd');
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
                drawings: p.drawings.map(d => {
                  if (d.id !== id) return d;

                  // Change Detection: Track important field changes
                  const changedDrawing = { ...d, ...updates };
                  const changeLogs: string[] = [];

                  // Detect Status Change
                  if (updates.status && d.status !== updates.status) {
                    changeLogs.push(`Status: ${d.status} -> ${updates.status}`);

                    // 状态变为 Reviewing 时自动生成 Deadline
                    if (updates.status === 'Reviewing' && d.status !== 'Reviewing') {
                      const round = changedDrawing.currentRound || 'A';
                      const isRoundA = round.toUpperCase() === 'A';
                      const cycleDays = isRoundA
                        ? (p.conf?.roundACycle || 14)
                        : (p.conf?.otherRoundsCycle || 7);
                      const holidays = p.conf?.holidays || [];
                      changedDrawing.reviewDeadline = calculateDeadline(new Date(), cycleDays, holidays).toISOString();
                    }
                    // 状态从 Reviewing 变为 Waiting Reply 或 Approved 时，轮次+1 并清除 Deadline
                    else if (d.status === 'Reviewing' && (updates.status === 'Waiting Reply' || updates.status === 'Approved')) {
                      // 轮次自动递增: A -> B -> C -> ... -> Z -> AA -> AB -> ...
                      const currentRound = changedDrawing.currentRound || 'A';
                      const nextRound = currentRound.length === 1 && currentRound < 'Z'
                        ? String.fromCharCode(currentRound.charCodeAt(0) + 1)
                        : currentRound === 'Z' ? 'AA' : currentRound + 'A';
                      changedDrawing.currentRound = nextRound;
                      changeLogs.push(`Round: ${currentRound} -> ${nextRound}`);
                      changedDrawing.reviewDeadline = undefined;
                    }
                    // 状态从 Reviewing 变为 Pending 时，仅清除 Deadline（不递增轮次）
                    else if (d.status === 'Reviewing' && updates.status === 'Pending') {
                      changedDrawing.reviewDeadline = undefined;
                    }
                  }

                  // Detect Version Change
                  if (updates.version && d.version !== updates.version) {
                    changeLogs.push(`Version: ${d.version} -> ${updates.version}`);
                  }

                  // Detect Round Change
                  if (updates.currentRound && d.currentRound !== updates.currentRound) {
                    changeLogs.push(`Round: ${d.currentRound} -> ${updates.currentRound}`);
                  }

                  // Detect Comments Count Change
                  if (
                    (updates.manualCommentsCount !== undefined && d.manualCommentsCount !== updates.manualCommentsCount) ||
                    (updates.manualOpenCommentsCount !== undefined && d.manualOpenCommentsCount !== updates.manualOpenCommentsCount)
                  ) {
                    const oldTotal = d.manualCommentsCount || 0;
                    const oldOpen = d.manualOpenCommentsCount || 0;
                    const newTotal = updates.manualCommentsCount !== undefined ? updates.manualCommentsCount : oldTotal;
                    const newOpen = updates.manualOpenCommentsCount !== undefined ? updates.manualOpenCommentsCount : oldOpen;

                    if (oldTotal !== newTotal || oldOpen !== newOpen) {
                      changeLogs.push(`Comments: ${oldTotal}/${oldOpen} -> ${newTotal}/${newOpen}`);
                    }
                  }

                  // Write to statusHistory if there are changes
                  if (changeLogs.length > 0) {
                    const newHistoryEntry = {
                      id: Math.random().toString(36).substr(2, 9),
                      content: changeLogs.join(' | '),
                      createdAt: new Date().toISOString()
                    };
                    changedDrawing.statusHistory = [...(d.statusHistory || []), newHistoryEntry];
                  }

                  return changedDrawing;
                })
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

      addRemark: (drawingId, content) => set((state) => {
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
                  const newRemark = {
                    id: Math.random().toString(36).substr(2, 9),
                    content,
                    createdAt: new Date().toISOString()
                  };
                  return { ...d, remarks: [...(d.remarks || []), newRemark] };
                })
              };
            })
          }
        };
      }),

      deleteRemark: (drawingId, content) => set((state) => {
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
                  return { ...d, remarks: (d.remarks || []).filter(r => r.content !== content) };
                })
              };
            })
          }
        };
      }),

      batchUpdateDrawings: (updates) => set((state) => {
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
                  const update = updates.find(u => u.id === d.id);
                  if (!update) return d;
                  return { ...d, ...update.changes };
                })
              };
            })
          }
        };
      }),

      resetAllAssignees: () => set((state) => {
        const { activeProjectId, data } = state;
        if (!activeProjectId) return state;
        const project = data.projects.find(p => p.id === activeProjectId);
        if (!project) return state;
        const defaultAssignees = project.conf?.defaultAssignees || {};
        return {
          data: {
            ...state.data,
            projects: state.data.projects.map(p => {
              if (p.id !== activeProjectId) return p;
              return {
                ...p,
                drawings: p.drawings.map(d => ({
                  ...d,
                  assignees: defaultAssignees[d.discipline] || []
                }))
              };
            })
          }
        };
      }),

      bulkImportDrawings: (drawings) => set((state) => {
        const { activeProjectId } = state;
        if (!activeProjectId) return state;
        const normalizedDrawings = drawings.map(ensureDrawingHasId);
        return {
          data: {
            ...state.data,
            projects: state.data.projects.map(p => p.id === activeProjectId ? { ...p, drawings: [...p.drawings, ...normalizedDrawings] } : p)
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
        const { data, reviewTracker } = get();
        const project = data.projects.find(p => p.id === projectId);
        if (!project) return false;

        set({ isLoading: true, error: null });
        try {
          const provider = getProvider(data.settings);
          const success = await provider.saveProject(project);
          // 同时保存 reviewTracker 数据
          if (Object.keys(reviewTracker).length > 0) {
            await provider.saveReviewTracker(project, reviewTracker);
          }
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

      refreshAllSnapshots: async (projectId: string) => {
        const { data } = get();
        const project = data.projects.find(p => p.id === projectId);
        if (!project) return;

        try {
          const provider = getProvider(data.settings);
          const snapshots = await provider.loadAllSnapshots(project);

          set(state => ({
            data: {
              ...state.data,
              projects: state.data.projects.map(p => p.id === projectId ? { ...p, snapshots } : p)
            }
          }));
        } catch (err: any) {
          console.warn("Snapshot refresh all failed", err);
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
          const fullProject = normalizeProjectDrawingIds(await provider.loadProjectData(projectStub, passwordInput));

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

      // === 审核追踪 ===
      loadReviewTracker: async (projectId: string) => {
        const { data, reviewTracker: localTracker } = get();
        const project = data.projects.find(p => p.id === projectId);
        if (!project) return;
        try {
          const provider = getProvider(data.settings);
          const remote = await provider.loadReviewTracker(project);
          // 合并：本地优先，确保未同步的本地标记不被覆盖
          const merged: ReviewTrackerData = {};
          const allIds = new Set([...Object.keys(remote || {}), ...Object.keys(localTracker)]);
          for (const id of allIds) {
            merged[id] = { ...(remote?.[id] || {}), ...(localTracker[id] || {}) };
          }
          set({ reviewTracker: merged });
        } catch (e) { console.warn('loadReviewTracker failed', e); }
      },

      toggleAssigneeDone: (drawingId: string, assignee: string) => {
        // 纯本地更新，同步交给手动 Sync 或定时 auto-sync
        const current = get().reviewTracker[drawingId]?.[assignee];
        const newDone = !current?.done;

        set(state => ({
          reviewTracker: {
            ...state.reviewTracker,
            [drawingId]: {
              ...(state.reviewTracker[drawingId] || {}),
              [assignee]: { done: newDone, doneAt: newDone ? new Date().toISOString() : undefined }
            }
          }
        }));
      },
    }),
    {
      name: 'marine-drawings-v3-storage-webdav',
      partialize: (state) => ({ data: state.data, activeProjectId: state.activeProjectId }),
      version: 1,
      migrate: (persistedState: any) => {
        if (!persistedState?.data?.projects) return persistedState;
        return {
          ...persistedState,
          data: {
            ...persistedState.data,
            projects: persistedState.data.projects.map((p: Project) => normalizeProjectDrawingIds(p)),
          },
        };
      },
    }
  )
);

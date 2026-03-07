import { AppSettings, Project, ProjectSnapshot, ReviewTrackerData } from '../../types';
import { CloudflareApiRepository } from './CloudflareApiRepository';
import { ProjectListItem } from './types';

const apiBaseUrl = import.meta.env.VITE_DATA_API_BASE_URL?.trim() || '';
const apiToken = import.meta.env.VITE_DATA_API_TOKEN?.trim() || '';

const apiRepository = new CloudflareApiRepository(apiBaseUrl, apiToken);

export const appRepository = {
  isCloudflareApiConfigured(): boolean {
    return Boolean(apiBaseUrl);
  },

  fetchGlobalSettings(settings: AppSettings): Promise<Partial<AppSettings> | null> {
    return apiRepository.fetchGlobalSettings(settings);
  },

  fetchProjectList(settings: AppSettings): Promise<ProjectListItem[]> {
    return apiRepository.fetchProjectList(settings);
  },

  loadProject(settings: AppSettings, project: Project, passwordInput?: string): Promise<Project> {
    return apiRepository.loadProject(settings, project, passwordInput);
  },

  saveProject(settings: AppSettings, project: Project, reviewTracker: ReviewTrackerData): Promise<boolean> {
    return apiRepository.saveProject(settings, project, reviewTracker);
  },

  loadSnapshots(settings: AppSettings, project: Project, includeAll = false): Promise<ProjectSnapshot[]> {
    return apiRepository.loadSnapshots(settings, project, includeAll);
  },

  createSnapshot(settings: AppSettings, project: Project, note: string): Promise<boolean> {
    return apiRepository.createSnapshot(settings, project, note);
  },

  restoreSnapshot(settings: AppSettings, project: Project, snapshot: ProjectSnapshot): Promise<boolean> {
    return apiRepository.restoreSnapshot(settings, project, snapshot);
  },

  deleteSnapshot(settings: AppSettings, project: Project, snapshotId: string): Promise<boolean> {
    return apiRepository.deleteSnapshot(settings, project, snapshotId);
  },

  loadReviewTracker(settings: AppSettings, project: Project): Promise<ReviewTrackerData> {
    return apiRepository.loadReviewTracker(settings, project);
  },

  saveReviewTracker(settings: AppSettings, project: Project, data: ReviewTrackerData): Promise<boolean> {
    return apiRepository.saveReviewTracker(settings, project, data);
  },

  testConnection(settings: AppSettings, options?: { url?: string; user?: string; pass?: string; proxyUrl?: string }): Promise<{ success: boolean; message: string }> {
    return apiRepository.testConnection(settings);
  },
};

import { AppSettings, Project, ProjectSnapshot, ReviewTrackerData } from '../../types';

export interface ProjectListItem {
  id: string;
  name: string;
  webdavPath?: string;
}

export interface DataRepository {
  fetchGlobalSettings(settings: AppSettings): Promise<Partial<AppSettings> | null>;
  fetchProjectList(settings: AppSettings): Promise<ProjectListItem[]>;
  loadProject(settings: AppSettings, project: Project, passwordInput?: string): Promise<Project>;
  saveProject(settings: AppSettings, project: Project, reviewTracker: ReviewTrackerData): Promise<boolean>;
  loadSnapshots(settings: AppSettings, project: Project, includeAll?: boolean): Promise<ProjectSnapshot[]>;
  createSnapshot(settings: AppSettings, project: Project, note: string): Promise<boolean>;
  restoreSnapshot(settings: AppSettings, project: Project, snapshot: ProjectSnapshot): Promise<boolean>;
  deleteSnapshot(settings: AppSettings, project: Project, snapshotId: string): Promise<boolean>;
  loadReviewTracker(settings: AppSettings, project: Project): Promise<ReviewTrackerData>;
  saveReviewTracker(settings: AppSettings, project: Project, data: ReviewTrackerData): Promise<boolean>;
  testConnection(settings: AppSettings, options?: { url?: string; user?: string; pass?: string; proxyUrl?: string }): Promise<{ success: boolean; message: string }>;
}

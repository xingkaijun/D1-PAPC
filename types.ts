
export type DrawingStatus = 'Pending' | 'Reviewing' | 'Waiting Reply' | 'Approved';

export interface Remark {
  id: string;
  content: string;
  createdAt: string; // ISO Date
  resolved?: boolean;
}

export interface DrawingLog {
  id: string;
  version: string;
  receivedDate: string;
  dueDate: string;
  sentDate?: string;
  commentCount: number;
}

export interface Drawing {
  id: string;
  customId: string;
  drawingNo: string;
  title: string;
  discipline: string;
  assignees: string[];
  status: DrawingStatus;
  currentRound: string;
  version: string;
  manualCommentsCount: number;
  manualOpenCommentsCount: number;
  reviewDeadline?: string;
  receivedDate?: string;
  category?: 'A' | 'B' | 'C';
  deadline?: string;
  logs: DrawingLog[];
  remarks: Remark[];
  statusHistory: Remark[];
}

export interface DisciplineSnapshot {
  discipline: string;
  approved: number;
  reviewing: number;
  waitingReply: number;
  pending: number;
  totalComments: number;
  openComments: number;
  flowToReview: number;
  flowToWaiting: number;
  flowToApproved: number;
}

export interface ProjectSnapshot {
  id: string;
  timestamp: string;
  stats: DisciplineSnapshot[];
}

export interface Reviewer {
  id: string;
  name: string;
}

export interface ProjectConfig {
  reviewers: Reviewer[];
  disciplineDefaults: { [key: string]: string }; // Map discipline -> default reviewer ID
  holidays: string[]; // ISO Date strings YYYY-MM-DD
  roundACycle: number; // Days
  otherRoundsCycle: number; // Days
  password?: string; // Optional Project Password
  displayName?: string; // Custom Project Display Name for Reports
  autoSyncInterval?: number; // Project-specific auto-sync interval
  lastUpdated?: string; // Last modification timestamp
}

export interface Project {
  id: string;
  name: string;
  drawings: Drawing[];
  snapshots?: ProjectSnapshot[];
  webdavPath?: string;
  conf: ProjectConfig;
  lastUpdated?: string;
}

export type StorageType = 'WEBDAV' | 'ONEDRIVE';

export interface StorageConfig {
  type: StorageType;
  webdav?: {
    url: string;
    username: string;
    password?: string;
  };
  onedrive?: {
    proxyUrl: string; // e.g., http://localhost:3001/api/proxy
  };
}

export interface AppSettings {
  reviewers: Reviewer[];
  disciplineDefaults: Record<string, string>;
  holidays: string[];
  roundACycle: number;
  otherRoundsCycle: number;
  // New Storage Config
  storage?: StorageConfig;
  // Legacy WebDAV config (kept for backward compatibility during migration)
  webdavUrl?: string;
  webdavUser?: string;
  webdavPass?: string;
  pushPassword?: string; // Verification password for local sync UI
  displayName?: string; // Global default display name pattern (optional)
  autoSyncInterval?: number; // Auto-sync interval in minutes (default: 3)
}

export interface AppData {
  lastUpdated: string;
  settings: AppSettings;
  projects: Project[];
}


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
  checked?: boolean;
  checkedSynced?: boolean; // 标记 checked 状态是否已同步到服务器
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
  id: string; // Filename usually
  timestamp: string; // ISO Date
  note?: string;
  createdAt?: string; // Duplicate for compatibility
  stats?: DisciplineSnapshot[]; // For reports
  data?: any; // Full data if needed
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
  defaultAssignees?: Record<string, string[]>; // Map discipline -> default assignee names
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



export interface AppSettings {
  reviewers: Reviewer[];
  disciplineDefaults: Record<string, string>;
  holidays: string[];
  roundACycle: number;
  otherRoundsCycle: number;
  pushPassword?: string; // Verification password for local sync UI
  displayName?: string; // Global default display name pattern (optional)
  autoSyncInterval?: number; // Auto-sync interval in minutes (default: 3)
}

export interface AppData {
  lastUpdated: string;
  settings: AppSettings;
  projects: Project[];
}

// 审核追踪：每个 assignee 的完成状态
export interface ReviewTrackerEntry {
  done: boolean;
  doneAt?: string; // ISO timestamp
}

// key = drawingId, value = { assigneeName: ReviewTrackerEntry }
export type ReviewTrackerData = Record<string, Record<string, ReviewTrackerEntry>>;

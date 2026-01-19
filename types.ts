
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
}

export interface ProjectSnapshot {
  id: string;
  timestamp: string;
  stats: DisciplineSnapshot[];
}

export interface Project {
  id: string;
  name: string;
  drawings: Drawing[];
  snapshots?: ProjectSnapshot[];
  webdavPath?: string; // Path or filename on WebDAV server
}

export interface AppSettings {
  reviewers: string[];
  disciplineDefaults: Record<string, string>; 
  holidays: string[];
  roundACycle: number; 
  otherRoundsCycle: number;
  webdavUrl?: string;
  webdavUser?: string;
  webdavPass?: string;
  pushPassword?: string; // Verification password for local sync UI
}

export interface AppData {
  lastUpdated: string;
  settings: AppSettings;
  projects: Project[];
}

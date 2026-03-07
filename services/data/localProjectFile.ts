import { Project, ReviewTrackerData } from '../../types';

export interface ProjectBackupPayload {
  project: Project;
  reviewTracker?: ReviewTrackerData;
  _backupVersion?: number; // 用于未来兼容性检测
}

export const downloadProjectBackup = (project: Project, reviewTracker?: ReviewTrackerData) => {
  const timestamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 12);
  const hullName = project.name.replace(/[^a-z0-9]/gi, '_');
  const filename = `PA_${hullName}_${timestamp}.json`;

  const payload: ProjectBackupPayload = {
    project,
    reviewTracker: reviewTracker || {},
    _backupVersion: 2,
  };

  const projectData = JSON.stringify(payload, null, 2);
  const blob = new Blob([projectData], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};

export const parseProjectBackup = (content: string): ProjectBackupPayload => {
  const raw = JSON.parse(content);

  // 兼容旧版导出（直接就是 Project 对象，没有 wrapper）
  if (raw.drawings && Array.isArray(raw.drawings) && !raw.project) {
    const project = raw as Project;
    if (!project.id || !project.name) {
      throw new Error('Invalid project file structure.');
    }
    return { project, reviewTracker: {}, _backupVersion: 1 };
  }

  // 新版导出（带 wrapper）
  const payload = raw as ProjectBackupPayload;
  if (!payload.project?.id || !payload.project?.name || !Array.isArray(payload.project.drawings)) {
    throw new Error('Invalid project file structure.');
  }
  return payload;
};

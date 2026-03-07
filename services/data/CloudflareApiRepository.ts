import { AppSettings, Project, ProjectSnapshot, ReviewTrackerData, DeltaPayload } from '../../types';
import { DataRepository, ProjectListItem } from './types';

interface RequestOptions {
  method?: string;
  body?: unknown;
}

export class CloudflareApiRepository implements DataRepository {
  constructor(private readonly baseUrl: string, private readonly authToken?: string) { }

  private async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const url = new URL(path, this.baseUrl.endsWith('/') ? this.baseUrl : `${this.baseUrl}/`);
    const res = await fetch(url.toString(), {
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(this.authToken ? { Authorization: `Bearer ${this.authToken}` } : {}),
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });

    if (!res.ok) {
      const message = await res.text();
      const error = new Error(message || `API request failed: ${res.status}`);
      (error as any).status = res.status;
      throw error;
    }

    if (res.status === 204) {
      return undefined as T;
    }

    return res.json() as Promise<T>;
  }

  fetchGlobalSettings(_settings: AppSettings): Promise<Partial<AppSettings> | null> {
    return this.request<Partial<AppSettings> | null>('settings');
  }

  fetchProjectList(_settings: AppSettings): Promise<ProjectListItem[]> {
    return this.request<ProjectListItem[]>('projects');
  }

  async loadProject(_settings: AppSettings, project: Project, passwordInput?: string): Promise<Project> {
    try {
      const data = await this.request<Project>(`projects/${encodeURIComponent(project.id)}`, {
        method: 'POST',
        body: { password: passwordInput || null },
      });
      return data;
    } catch (error: any) {
      // If the project doesn't exist on the server yet (new local project), return the stub project
      if (error && error.status === 404) {
        return project;
      }
      throw error;
    }
  }

  async saveProject(_settings: AppSettings, project: Project, reviewTracker: ReviewTrackerData): Promise<boolean> {
    await this.request(`projects/${encodeURIComponent(project.id)}`, {
      method: 'PUT',
      body: { project, reviewTracker },
    });
    return true;
  }

  async saveDelta(_settings: AppSettings, projectId: string, payload: DeltaPayload): Promise<boolean> {
    await this.request(`projects/${encodeURIComponent(projectId)}`, {
      method: 'PATCH',
      body: payload,
    });
    return true;
  }

  loadSnapshots(_settings: AppSettings, project: Project, includeAll = false): Promise<ProjectSnapshot[]> {
    const suffix = includeAll ? '?all=1' : '';
    return this.request<ProjectSnapshot[]>(`projects/${encodeURIComponent(project.id)}/snapshots${suffix}`);
  }

  async createSnapshot(_settings: AppSettings, project: Project, note: string): Promise<boolean> {
    await this.request(`projects/${encodeURIComponent(project.id)}/snapshots`, {
      method: 'POST',
      body: { note },
    });
    return true;
  }

  async restoreSnapshot(_settings: AppSettings, project: Project, snapshot: ProjectSnapshot): Promise<boolean> {
    await this.request(`projects/${encodeURIComponent(project.id)}/snapshots/${encodeURIComponent(snapshot.id)}/restore`, {
      method: 'POST',
    });
    return true;
  }

  async deleteSnapshot(_settings: AppSettings, project: Project, snapshotId: string): Promise<boolean> {
    await this.request(`projects/${encodeURIComponent(project.id)}/snapshots/${encodeURIComponent(snapshotId)}`, {
      method: 'DELETE',
    });
    return true;
  }

  loadReviewTracker(_settings: AppSettings, project: Project): Promise<ReviewTrackerData> {
    return this.request<ReviewTrackerData>(`projects/${encodeURIComponent(project.id)}/review-tracker`);
  }

  async saveReviewTracker(_settings: AppSettings, project: Project, data: ReviewTrackerData): Promise<boolean> {
    await this.request(`projects/${encodeURIComponent(project.id)}/review-tracker`, {
      method: 'PUT',
      body: data,
    });
    return true;
  }

  async testConnection(_settings: AppSettings): Promise<{ success: boolean; message: string }> {
    await this.request('health');
    return { success: true, message: 'Connected to Cloudflare API' };
  }
}

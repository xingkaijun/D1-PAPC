import { IStorageProvider } from './IStorageProvider';
import { AppSettings, Project, ProjectSnapshot } from '../../types';

export class OneDriveProxyProvider implements IStorageProvider {
    private settings: AppSettings | null = null;

    configure(settings: AppSettings) {
        this.settings = settings;
    }

    private getProxyUrl() {
        // Default to localhost:3001 if not configured (Development convenience), otherwise relative path for prod
        if (!this.settings?.storage?.onedrive?.proxyUrl) {
            return import.meta.env.DEV ? 'http://localhost:3001/api/proxy' : '/api/proxy';
        }
        return this.settings.storage.onedrive.proxyUrl;
    }

    // Helper to standardise Proxy Calls
    private async callProxy(path: string, options: { method?: string; body?: any; action?: string } = {}) {
        const proxyBase = this.getProxyUrl();
        const cleanPath = path.startsWith('/') ? path.slice(1) : path;

        const url = new URL(`${proxyBase}/${cleanPath}`);
        if (options.action) url.searchParams.append('action', options.action);

        const fetchOpts: RequestInit = {
            method: options.method || 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        };

        if (options.body) {
            fetchOpts.body = JSON.stringify(options.body);
        }

        const res = await fetch(url.toString(), fetchOpts);
        if (!res.ok) throw new Error(`Proxy Call Failed: ${res.status} ${res.statusText}`);
        return res;
    }

    async testConnection(): Promise<{ success: boolean; message: string }> {
        try {
            // Test root access
            const res = await this.callProxy('', { action: 'metadata' });
            const json = await res.json();
            if (json.id || json.webUrl || Array.isArray(json.value)) return { success: true, message: "Connected to OneDrive" };
            console.warn("Invalid Root Response:", json);
            return { success: false, message: "Connected but invalid root response" };
        } catch (e: any) {
            return { success: false, message: e.message };
        }
    }

    async fetchGlobalSettings(): Promise<Partial<AppSettings> | null> {
        try {
            const res = await this.callProxy('PA_Settings.json', { action: 'content' });
            const json = await res.json();
            return json as Partial<AppSettings>;
        } catch (e) {
            return null;
        }
    }

    async fetchProjectList(): Promise<Project[]> {
        console.log("[OneDrive] Fetching project list...");
        const res = await this.callProxy('', { action: 'children' });
        const data = await res.json();

        if (!data.value || !Array.isArray(data.value)) throw new Error("Invalid Graph API response");

        const projects: Project[] = [];

        for (const item of data.value) {
            if (item.folder) {
                projects.push({
                    id: Math.random().toString(36).substr(2, 9),
                    name: item.name,
                    drawings: [],
                    webdavPath: item.webUrl,
                    conf: { reviewers: [], disciplineDefaults: {}, holidays: [], roundACycle: 0, otherRoundsCycle: 0 }
                });
            }
        }
        return projects;
    }

    async loadProject(projectId: string): Promise<Project | null> {
        throw new Error("Use loadProjectData(project)");
    }

    async loadProjectData(project: Project, passwordInput?: string): Promise<Project> {
        const folderName = project.name;

        // 1. Load Settings
        let conf = { ...project.conf };
        try {
            const res = await this.callProxy(`${folderName}/settings.json`, { action: 'content' });
            const json = await res.json();
            conf = { ...conf, ...json };
        } catch (e) { console.warn("Settings load failed", e); }

        // Password Check
        if (conf.password && conf.password.trim() !== '') {
            if (!passwordInput) throw new Error("PASSWORD_REQUIRED");
            if (passwordInput !== conf.password) throw new Error("INVALID_PASSWORD");
        }

        // 2. Load Main Data
        const mainRes = await this.callProxy(`${folderName}/PA_${folderName}.json`, { action: 'content' });
        const mainData = await mainRes.json();

        return {
            ...project,
            ...mainData,
            conf,
            lastUpdated: new Date().toISOString()
        };
    }

    async saveProject(project: Project): Promise<boolean> {
        const folderName = project.name;

        // 1. Create Folder
        let folderExists = false;
        try {
            await this.callProxy(folderName, { action: 'metadata' });
            folderExists = true;
        } catch (e) { }

        if (!folderExists) {
            await this.callProxy('', {
                method: 'POST',
                action: 'children',
                body: { name: folderName, folder: {}, "@microsoft.graph.conflictBehavior": "fail" }
            });

            await this.callProxy(folderName, {
                method: 'POST',
                action: 'children',
                body: { name: 'snapshots', folder: {}, "@microsoft.graph.conflictBehavior": "fail" }
            });
        }

        // 2. Save Settings
        const settingsPayload = project.conf;
        await this.callProxy(`${folderName}/settings.json`, {
            method: 'PUT',
            action: 'content',
            body: settingsPayload
        });

        // 3. Save Main Data
        const { conf, snapshots, ...mainData } = project;
        await this.callProxy(`${folderName}/PA_${folderName}.json`, {
            method: 'PUT',
            action: 'content',
            body: mainData
        });

        return true;
    }

    async loadSnapshots(project: Project): Promise<ProjectSnapshot[]> {
        // Mock implementation as we don't have snapshots endpoint on proxy logic yet
        // Ideally we would LIST children of 'snapshots' folder.
        // Call Proxy: action=children on snapshots folder
        console.warn("loadSnapshots not implemented fully for OneDrive");
        return [];
    }
}

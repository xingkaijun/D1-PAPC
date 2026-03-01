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

    private calculateStats(drawings: any[], previousDrawings?: any[]): any[] {
        const statsMap = new Map<string, any>();
        const prevMap = new Map<string, any>();

        if (previousDrawings) {
            previousDrawings.forEach(d => prevMap.set(d.id, d));
        }

        drawings.forEach(d => {
            // Normalize discipline
            const disc = d.discipline ? d.discipline.trim().split(/\s+/).map((w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ') : 'General';

            if (!statsMap.has(disc)) {
                statsMap.set(disc, {
                    discipline: disc,
                    approved: 0,
                    reviewing: 0,
                    waitingReply: 0,
                    pending: 0,
                    totalComments: 0,
                    openComments: 0,
                    flowToReview: 0,
                    flowToWaiting: 0,
                    flowToApproved: 0
                });
            }

            const entry = statsMap.get(disc);

            if (d.status === 'Approved') entry.approved++;
            else if (d.status === 'Reviewing') entry.reviewing++;
            else if (d.status === 'Waiting Reply') entry.waitingReply++;
            else entry.pending++;

            entry.totalComments += (d.manualCommentsCount || 0);
            entry.openComments += (d.manualOpenCommentsCount || 0);

            // Flow Calculation
            if (previousDrawings) {
                const prev = prevMap.get(d.id);
                // Check if status CHANGED to target state

                // Flow To Reviewing
                if (d.status === 'Reviewing' && (!prev || prev.status !== 'Reviewing')) {
                    entry.flowToReview++;
                }

                // Flow To Waiting Reply
                if (d.status === 'Waiting Reply' && (!prev || prev.status !== 'Waiting Reply')) {
                    entry.flowToWaiting++;
                }

                // Flow To Approved
                if (d.status === 'Approved' && (!prev || prev.status !== 'Approved')) {
                    entry.flowToApproved++;
                }
            }
        });

        return Array.from(statsMap.values());
    }

    // ── 唯一修改的地方：把 path 从 URL 路径改成 query param ──
    // 之前: /api/proxy/ProjectA/settings.json?action=content  (Vercel 匹配不到)
    // 现在: /api/proxy?action=content&path=ProjectA/settings.json  (正确)
    private async callProxy(path: string, options: { method?: string; body?: any; action?: string } = {}) {
        const proxyBase = this.getProxyUrl();
        const cleanPath = path.startsWith('/') ? path.slice(1) : path;

        // 解析 base URL
        const baseUrl = proxyBase.startsWith('http')
            ? proxyBase
            : `${window.location.origin}${proxyBase}`;

        const url = new URL(baseUrl);

        // action 和 path 都放进 query param
        if (options.action) url.searchParams.append('action', options.action);
        if (cleanPath) url.searchParams.append('path', cleanPath);

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
        let mainData: any = {};
        try {
            const mainRes = await this.callProxy(`${folderName}/PA_${folderName}.json`, { action: 'content' });
            mainData = await mainRes.json();
        } catch (e: any) {
            // New project may not have main data file yet.
            if (!String(e?.message || '').includes('404')) throw e;
        }

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
        console.log("[OneDrive] Loading snapshots...");
        const folderName = project.name;
        try {
            // List children of 'snapshots' folder
            const res = await this.callProxy(`${folderName}/snapshots`, { action: 'children' });
            const data = await res.json();

            if (!data.value || !Array.isArray(data.value)) return [];

            // Filter and Sort Files First
            const files = data.value
                .filter((item: any) => item.name.endsWith('.json'))
                .sort((a: any, b: any) => new Date(b.lastModifiedDateTime).getTime() - new Date(a.lastModifiedDateTime).getTime());

            // Take top 10
            const recentFiles = files.slice(0, 10);

            // Fetch content for top 10 to get stats/meta
            const snapshots: ProjectSnapshot[] = await Promise.all(recentFiles.map(async (item: any) => {
                // Parse name for note backup
                const nameParts = item.name.replace('.json', '').split('_');
                const nameNote = nameParts.length > 1 ? nameParts.slice(1).join('_') : 'Snapshot';

                try {
                    // Fetch Content
                    const contentRes = await this.callProxy(`${folderName}/snapshots/${item.name}`, { action: 'content' });
                    const content = await contentRes.json();

                    // Extract Info
                    const meta = content.snapshotMeta || {};
                    const note = meta.note || nameNote;
                    const timestamp = meta.createdAt || item.lastModifiedDateTime;

                    // Get or Calculate Stats
                    let stats = meta.stats;
                    if (!stats && content.drawings) {
                        stats = this.calculateStats(content.drawings);
                    }

                    return {
                        id: item.name, // Use filename as ID explicitly as expected by delete/restore
                        timestamp: timestamp,
                        createdAt: timestamp,
                        note: note,
                        stats: stats,
                        data: null // Omit full data to save memory, it's in content if needed but we don't return it to list
                    };
                } catch (err) {
                    console.warn(`Failed to load snapshot content ${item.name}`, err);
                    // Return minimal info on failure
                    return {
                        id: item.name,
                        timestamp: item.lastModifiedDateTime,
                        createdAt: item.lastModifiedDateTime,
                        note: nameNote,
                        stats: [],
                        data: null
                    };
                }
            }));

            return snapshots;
        } catch (e) {
            console.warn("Failed to load snapshots", e);
            return [];
        }
    }



    async loadAllSnapshots(project: Project): Promise<ProjectSnapshot[]> {
        console.log("[OneDrive] Loading ALL snapshots...");
        const folderName = project.name;
        try {
            // List children of 'snapshots' folder
            const res = await this.callProxy(`${folderName}/snapshots`, { action: 'children' });
            const data = await res.json();

            if (!data.value || !Array.isArray(data.value)) return [];

            // Filter and Sort Files First
            const files = data.value
                .filter((item: any) => item.name.endsWith('.json'))
                .sort((a: any, b: any) => new Date(b.lastModifiedDateTime).getTime() - new Date(a.lastModifiedDateTime).getTime());

            // Load ALL files (no limit)
            console.log(`[OneDrive] Loading ${files.length} snapshots`);

            // Fetch content for all files
            const snapshots: ProjectSnapshot[] = await Promise.all(files.map(async (item: any) => {
                // Parse name for note backup
                const nameParts = item.name.replace('.json', '').split('_');
                const nameNote = nameParts.length > 1 ? nameParts.slice(1).join('_') : 'Snapshot';

                try {
                    // Fetch Content
                    const contentRes = await this.callProxy(`${folderName}/snapshots/${item.name}`, { action: 'content' });
                    const content = await contentRes.json();

                    // Extract Info
                    const meta = content.snapshotMeta || {};
                    const note = meta.note || nameNote;
                    const timestamp = meta.createdAt || item.lastModifiedDateTime;

                    // Get or Calculate Stats
                    let stats = meta.stats;
                    if (!stats && content.drawings) {
                        stats = this.calculateStats(content.drawings);
                    }

                    return {
                        id: item.name,
                        timestamp: timestamp,
                        createdAt: timestamp,
                        note: note,
                        stats: stats,
                        data: null
                    };
                } catch (err) {
                    console.warn(`Failed to load snapshot content ${item.name}`, err);
                    // Return minimal info on failure
                    return {
                        id: item.name,
                        timestamp: item.lastModifiedDateTime,
                        createdAt: item.lastModifiedDateTime,
                        note: nameNote,
                        stats: [],
                        data: null
                    };
                }
            }));

            return snapshots;
        } catch (e) {
            console.warn("Failed to load all snapshots", e);
            return [];
        }
    }

    async createSnapshot(project: Project, note: string): Promise<boolean> {
        const folderName = project.name;
        const now = new Date();
        const timestamp = now.toISOString();
        const fileTimestamp = timestamp.replace(/[:.]/g, '-');
        const safeNote = note.replace(/[^a-zA-Z0-9]/g, '-');
        const fileName = `${fileTimestamp}_${safeNote}.json`;

        // 1. Fetch Previous Snapshot for Flow Calculation
        let previousDrawings: any[] | undefined = undefined;
        try {
            // Re-use logic to list snapshots (lightweight)
            const res = await this.callProxy(`${folderName}/snapshots`, { action: 'children' });
            const data = await res.json();
            if (data.value && Array.isArray(data.value)) {
                const files = data.value
                    .filter((item: any) => item.name.endsWith('.json'))
                    .sort((a: any, b: any) => new Date(b.lastModifiedDateTime).getTime() - new Date(a.lastModifiedDateTime).getTime());

                if (files.length > 0) {
                    const latest = files[0];
                    console.log(`[Flow] Comparing with latest snapshot: ${latest.name}`);
                    const contentRes = await this.callProxy(`${folderName}/snapshots/${latest.name}`, { action: 'content' });
                    const content = await contentRes.json();
                    if (content.drawings) {
                        previousDrawings = content.drawings;
                    }
                }
            }
        } catch (e) {
            console.warn("[Flow] Failed to load previous snapshot for comparison", e);
        }

        // 2. Calculate Stats with Flow
        const stats = this.calculateStats(project.drawings || [], previousDrawings);

        // We save the WHOLE project as snapshot + Meta + Stats
        const { conf, snapshots, webdavPath, ...mainData } = project;

        const snapshotContent = {
            ...mainData,
            conf: project.conf,
            snapshotMeta: {
                createdAt: timestamp,
                note,
                stats
            }
        };

        try {
            await this.callProxy(`${folderName}/snapshots/${fileName}`, {
                method: 'PUT',
                action: 'content',
                body: snapshotContent
            });
            return true;
        } catch (e) {
            console.error("Snapshot creation failed", e);
            throw e;
        }
    }

    async restoreSnapshot(project: Project, snapshot: ProjectSnapshot): Promise<boolean> {
        const fileName = snapshot.id; // We will ensure loadSnapshots sets this
        const folderName = project.name;

        try {
            const res = await this.callProxy(`${folderName}/snapshots/${fileName}`, { action: 'content' });
            const snapshotData = await res.json();

            // 2. Restore to main file
            const restoredProject: Project = {
                ...project,
                ...snapshotData
            };

            return this.saveProject(restoredProject);
        } catch (e) {
            console.error("Restore failed", e);
            throw e;
        }
    }

    async deleteSnapshot(project: Project, snapshotId: string): Promise<boolean> {
        const folderName = project.name;
        // snapshotId is the filename
        try {
            await this.callProxy(`${folderName}/snapshots/${snapshotId}`, { method: 'DELETE' });
            return true;
        } catch (e) {
            console.error("Delete snapshot failed", e);
            throw e;
        }
    }
}

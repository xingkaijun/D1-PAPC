import { IStorageProvider } from './IStorageProvider';
import { AppSettings, Project, ProjectSnapshot } from '../../types';

// Helper to normalize strings (trim and Title Case for disciplines)
const normalizeDisc = (val: string) => {
    if (!val) return '';
    return val.trim().split(/\s+/).map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');
};

export class WebDAVProvider implements IStorageProvider {
    private settings: AppSettings | null = null;

    configure(settings: AppSettings) {
        this.settings = settings;
    }

    private getEffectiveConfig() {
        if (!this.settings) throw new Error("Provider not configured");
        const { webdavUrl, webdavUser, webdavPass } = this.settings;

        // Legacy support: Check storage config if available, else fallback to flat fields
        let configUrl = webdavUrl;
        let configUser = webdavUser;
        let configPass = webdavPass;

        if (this.settings.storage?.type === 'WEBDAV' && this.settings.storage.webdav) {
            configUrl = this.settings.storage.webdav.url;
            configUser = this.settings.storage.webdav.username;
            configPass = this.settings.storage.webdav.password;
        }

        // Env Var Overrides (Highest Priority)
        const targetUrl = (import.meta.env.VITE_WEBDAV_URL && import.meta.env.VITE_WEBDAV_URL.trim() !== '') ? import.meta.env.VITE_WEBDAV_URL : configUrl;
        const targetUser = (import.meta.env.VITE_WEBDAV_USER && import.meta.env.VITE_WEBDAV_USER.trim() !== '') ? import.meta.env.VITE_WEBDAV_USER : configUser;
        const targetPass = (import.meta.env.VITE_WEBDAV_PASSWORD && import.meta.env.VITE_WEBDAV_PASSWORD.trim() !== '') ? import.meta.env.VITE_WEBDAV_PASSWORD : configPass;

        return { targetUrl, targetUser, targetPass };
    }

    private getAuthHeaders(user?: string, pass?: string) {
        const { targetUser, targetPass } = this.getEffectiveConfig();
        const u = user || targetUser;
        const p = pass || targetPass;
        const auth = btoa(`${u}:${p}`);
        return { 'Authorization': `Basic ${auth}` };
    }

    async testConnection(): Promise<{ success: boolean; message: string }> {
        const { targetUrl } = this.getEffectiveConfig();
        if (!targetUrl) return { success: false, message: "No URL configured" };
        try {
            const res = await fetch(targetUrl, {
                method: 'PROPFIND', // Standard WebDAV check
                headers: { ...this.getAuthHeaders(), 'Depth': '0' }
            });
            if (res.ok) return { success: true, message: "Connected" };

            // Fallback: Some servers block PROPFIND on root or return 405. Try OPTIONS.
            const optRes = await fetch(targetUrl, {
                method: 'OPTIONS',
                headers: { ...this.getAuthHeaders() }
            });
            if (optRes.ok) return { success: true, message: "Connected (OPTIONS)" };

            return { success: false, message: `Status: ${res.status} ${res.statusText}` };
        } catch (e: any) {
            return { success: false, message: e.message };
        }
    }

    async fetchGlobalSettings(): Promise<Partial<AppSettings> | null> {
        const { targetUrl } = this.getEffectiveConfig();
        if (!targetUrl) return null;

        try {
            const url = targetUrl.endsWith('/') ? `${targetUrl}PA_Settings.json` : `${targetUrl}/PA_Settings.json`;
            const res = await fetch(url, { headers: this.getAuthHeaders() });
            if (res.ok) {
                const json = await res.json();
                return json as Partial<AppSettings>;
            }
        } catch (e) { console.warn("Settings fetch failed", e); }
        return null;
    }

    async fetchProjectList(): Promise<Project[]> {
        const { targetUrl } = this.getEffectiveConfig();
        if (!targetUrl) throw new Error("WebDAV URL not configured");

        console.log(`[WebDAV] Fetching list from: ${targetUrl}`);

        const listResponse = await fetch(targetUrl, {
            method: 'PROPFIND',
            headers: { ...this.getAuthHeaders(), 'Depth': '1' }
        });

        if (!listResponse.ok) throw new Error(`List failed: ${listResponse.status}`);

        const text = await listResponse.text();
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(text, "text/xml");

        const allNodes = xmlDoc.getElementsByTagName("*");
        const responses: Element[] = [];
        for (let i = 0; i < allNodes.length; i++) {
            if (allNodes[i].localName === "response") responses.push(allNodes[i]);
        }

        const projects: Project[] = [];
        const rootUrlObj = new URL(targetUrl);
        if (!rootUrlObj.pathname.endsWith('/')) rootUrlObj.pathname += '/';
        const rootUrlStr = rootUrlObj.href;

        // Helper to find deep localName
        const findLocal = (parent: Element, localName: string): Element | null => {
            for (let k = 0; k < parent.children.length; k++) {
                if (parent.children[k].localName === localName) return parent.children[k];
            }
            return null;
        };

        for (const resp of responses) {
            let hrefNode: Element | null = null;
            let propstatNodes: Element[] = [];

            for (let k = 0; k < resp.children.length; k++) {
                const child = resp.children[k];
                if (child.localName === "href") hrefNode = child;
                if (child.localName === "propstat") propstatNodes.push(child);
            }

            if (!hrefNode) continue;
            const rawHref = hrefNode.textContent || "";
            const itemUrlObj = new URL(rawHref, rootUrlStr);
            itemUrlObj.pathname = decodeURIComponent(itemUrlObj.pathname);
            const fullItemUrl = itemUrlObj.href;

            const isRoot = (fullItemUrl === rootUrlStr) || (fullItemUrl === rootUrlStr.slice(0, -1));
            if (isRoot) continue;

            const pathSegments = itemUrlObj.pathname.replace(/\/$/, '').split('/');
            const name = pathSegments[pathSegments.length - 1];
            if (!name) continue;

            let isCollection = false;
            for (const pstat of propstatNodes) {
                const prop = findLocal(pstat, "prop");
                if (prop) {
                    const rtype = findLocal(prop, "resourcetype");
                    if (rtype && findLocal(rtype, "collection")) {
                        isCollection = true;
                        break;
                    }
                }
            }

            if (isCollection) {
                projects.push({
                    id: Math.random().toString(36).substr(2, 9),
                    name: name,
                    drawings: [],
                    webdavPath: fullItemUrl,
                    conf: { reviewers: [], disciplineDefaults: {}, holidays: [], roundACycle: 0, otherRoundsCycle: 0 }
                });
            } else {
                // File Found (Check Legacy)
                if (name.startsWith('PA_') && name.endsWith('.json')) {
                    const cleanName = name.replace(/^PA_/, '').replace(/\.json$/, '');
                    // Check duplicate (folder vs file)?
                    if (!projects.find(p => p.name === cleanName)) {
                        projects.push({
                            id: Math.random().toString(36).substr(2, 9),
                            name: cleanName,
                            drawings: [],
                            webdavPath: fullItemUrl,
                            conf: { reviewers: [], disciplineDefaults: {}, holidays: [], roundACycle: 0, otherRoundsCycle: 0 }
                        });
                    }
                }
            }
        }
        return projects;
    }

    async loadProject(projectId: string): Promise<Project | null> {
        throw new Error("Method requires project instance, please use loadProjectData(project)");
    }

    // Custom method for WebDAV specific flow
    async loadProjectData(project: Project, passwordInput?: string): Promise<Project> {
        const { targetUrl } = this.getEffectiveConfig();
        if (!targetUrl) throw new Error("No URL");

        const baseUrl = targetUrl.endsWith('/') ? targetUrl : `${targetUrl}/`;
        const projectFolderName = project.name;
        const folderUrl = `${baseUrl}${projectFolderName}/`;

        let fullProject: Project | null = null;
        let loadedFrom = '';

        // 1. Try Loading from Folder Structure
        try {
            const settingsRes = await fetch(`${folderUrl}settings.json`, { headers: this.getAuthHeaders() });

            if (settingsRes.ok) {
                const settings = await settingsRes.json();
                // Password Check
                if (settings.password && settings.password.trim() !== '') {
                    if (!passwordInput) throw new Error("PASSWORD_REQUIRED");
                    if (passwordInput !== settings.password) throw new Error("INVALID_PASSWORD");
                }

                // Load Main Data
                const mainRes = await fetch(`${folderUrl}PA_${project.name}.json`, { headers: this.getAuthHeaders() });
                if (!mainRes.ok) throw new Error("Found settings but missing main project file");
                const mainData = await mainRes.json();

                // Load Snapshots (Top 10)
                let snapshots: ProjectSnapshot[] = [];
                try {
                    const snapFolderUrl = `${folderUrl}snapshots/`;
                    const listRes = await fetch(snapFolderUrl, { method: 'PROPFIND', headers: { ...this.getAuthHeaders(), 'Depth': '1' } });
                    if (listRes.ok) {
                        const text = await listRes.text();
                        const parser = new DOMParser();
                        const doc = parser.parseFromString(text, 'text/xml');
                        const nodes = doc.getElementsByTagName("*");
                        const snapFiles: { href: string }[] = [];
                        for (let i = 0; i < nodes.length; i++) {
                            if (nodes[i].localName === "href") {
                                const href = nodes[i].textContent;
                                if (href && href.endsWith('.json') && !href.endsWith('/')) {
                                    snapFiles.push({ href });
                                }
                            }
                        }
                        snapFiles.sort((a, b) => b.href.localeCompare(a.href));
                        const recentSnaps = snapFiles.slice(0, 10);

                        const snapPromises = recentSnaps.map(s => {
                            const itemUrlObj = new URL(s.href, targetUrl); // Resolve
                            return fetch(itemUrlObj.href, { headers: this.getAuthHeaders() }).then(r => r.json());
                        });
                        snapshots = await Promise.all(snapPromises);
                    }
                } catch (e) { console.warn("Snapshot fetch warning", e); }

                fullProject = {
                    ...mainData,
                    conf: settings,
                    snapshots,
                    lastUpdated: settings.lastUpdated
                };
                loadedFrom = 'folder';
            }
        } catch (e: any) {
            if (e.message === "PASSWORD_REQUIRED" || e.message === "INVALID_PASSWORD") throw e;
            // Ignore other errors and try legacy
        }

        // 2. Fallback to Legacy Monolithic File
        if (!fullProject) {
            const legacyFileUrl = `${baseUrl}PA_${project.name}.json`;
            const res = await fetch(legacyFileUrl, { headers: this.getAuthHeaders() });

            if (res.ok) {
                fullProject = await res.json();
                loadedFrom = 'legacy';
            }
        }

        if (!fullProject) throw new Error("Project not found (checked Folder and Legacy File)");

        return {
            ...project,
            ...fullProject,
            lastUpdated: fullProject.lastUpdated || new Date().toISOString()
        };
    }

    async saveProject(project: Project): Promise<boolean> {
        const { targetUrl } = this.getEffectiveConfig();
        if (!targetUrl) return false;

        const authHeaders = this.getAuthHeaders();
        const projectFolderName = project.name;
        const baseUrl = targetUrl.endsWith('/') ? targetUrl : `${targetUrl}/`;
        const folderUrl = `${baseUrl}${projectFolderName}/`;
        const snapshotsUrl = `${folderUrl}snapshots/`;

        // 1. Create Folders
        const checkFolder = await fetch(folderUrl, { method: 'PROPFIND', headers: { ...authHeaders, 'Depth': '0' } });
        if (checkFolder.status === 404) await fetch(folderUrl, { method: 'MKCOL', headers: authHeaders });

        const checkSnap = await fetch(snapshotsUrl, { method: 'PROPFIND', headers: { ...authHeaders, 'Depth': '0' } });
        if (checkSnap.status === 404) await fetch(snapshotsUrl, { method: 'MKCOL', headers: authHeaders });

        // 2. Save Settings
        const settingsPayload = project.conf;
        await fetch(`${folderUrl}settings.json`, {
            method: 'PUT',
            headers: { ...authHeaders, 'Content-Type': 'application/json' },
            body: JSON.stringify(settingsPayload, null, 2)
        });

        // 3. Save Main Data
        const { conf, snapshots, ...mainData } = project;
        await fetch(`${folderUrl}PA_${project.name}.json`, {
            method: 'PUT',
            headers: { ...authHeaders, 'Content-Type': 'application/json' },
            body: JSON.stringify(mainData, null, 2)
        });

        return true;
    }

    async loadSnapshots(project: Project): Promise<ProjectSnapshot[]> {
        const { targetUrl } = this.getEffectiveConfig();
        if (!targetUrl) return [];

        try {
            const baseUrl = targetUrl.endsWith('/') ? targetUrl : `${targetUrl}/`;
            const snapFolderUrl = `${baseUrl}${project.name}/snapshots/`;

            const listRes = await fetch(snapFolderUrl, { method: 'PROPFIND', headers: { ...this.getAuthHeaders(), 'Depth': '1' } });
            if (!listRes.ok) return [];

            const text = await listRes.text();
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(text, "text/xml");
            const nodes = xmlDoc.getElementsByTagName("*");
            const snapFiles: { href: string }[] = [];
            for (let i = 0; i < nodes.length; i++) {
                if (nodes[i].localName === "href") {
                    const href = nodes[i].textContent;
                    if (href && href.endsWith('.json') && !href.endsWith('/')) {
                        snapFiles.push({ href });
                    }
                }
            }
            snapFiles.sort((a, b) => b.href.localeCompare(a.href));

            // Should loading all be parallel? Might be heavy. Store.ts did Promise.all. 
            // We follow store.ts behavior.
            const snapPromises = snapFiles.map(s => {
                const itemUrlObj = new URL(s.href, targetUrl);
                return fetch(itemUrlObj.href, { headers: this.getAuthHeaders() }).then(r => r.json());
            });
            return Promise.all(snapPromises);
        } catch (e) { console.warn("Load snapshots failed", e); return []; }
    }

    async createSnapshot(project: Project, note: string): Promise<boolean> {
        console.warn("createSnapshot not supported in WebDAV");
        return false;
    }

    async restoreSnapshot(project: Project, snapshot: ProjectSnapshot): Promise<boolean> {
        console.warn("restoreSnapshot not supported in WebDAV");
        return false;
    }

    async deleteSnapshot(project: Project, snapshotId: string): Promise<boolean> {
        console.warn("deleteSnapshot not supported in WebDAV");
        return false;
    }
}

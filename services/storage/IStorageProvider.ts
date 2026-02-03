import { Project, AppSettings, ProjectSnapshot } from '../../types';

export interface IStorageProvider {
    /**
     * Initialize provider with settings
     */
    configure(settings: AppSettings): void;

    /**
     * Fetch list of available projects from remote storage
     */
    fetchProjectList(): Promise<Project[]>;

    /**
     * Load full project data
     */
    loadProject(projectId: string): Promise<Project | null>;

    /**
     * Load with specific WebDAV/Legacy logic or Provider specific logic
     */
    loadProjectData(project: Project, passwordInput?: string): Promise<Project>;

    /**
     * Save project data
     */
    saveProject(project: Project): Promise<boolean>;

    /**
     * Fetch global settings
     */
    fetchGlobalSettings(): Promise<Partial<AppSettings> | null>;

    /**
     * Test connection
     */
    testConnection(): Promise<{ success: boolean; message: string }>;

    /**
     * Load all snapshots for a project
     */
    loadSnapshots(project: Project): Promise<ProjectSnapshot[]>;

    /**
     * Create a new snapshot
     */
    createSnapshot(project: Project, note: string): Promise<boolean>;

    /**
     * Restore a snapshot
     */
    restoreSnapshot(project: Project, snapshot: ProjectSnapshot): Promise<boolean>;

    /**
     * Delete a snapshot
     */
    deleteSnapshot(project: Project, snapshotId: string): Promise<boolean>;
}

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
}

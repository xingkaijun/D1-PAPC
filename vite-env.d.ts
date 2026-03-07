/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_WEBDAV_URL: string;
    readonly VITE_WEBDAV_USER: string;
    readonly VITE_WEBDAV_PASSWORD: string;
    readonly VITE_PUSH_PASSWORD: string;
    readonly VITE_DATA_API_BASE_URL?: string;
    readonly VITE_DATA_API_TOKEN?: string;
    readonly VITE_DATA_API_FALLBACK?: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}

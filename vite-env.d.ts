/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_WEBDAV_URL: string;
    readonly VITE_WEBDAV_USER: string;
    readonly VITE_WEBDAV_PASSWORD: string;
    readonly VITE_PUSH_PASSWORD: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}

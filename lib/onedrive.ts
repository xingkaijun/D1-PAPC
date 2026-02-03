import { PublicClientApplication, AccountInfo, InteractionRequiredAuthError, AuthenticationResult } from '@azure/msal-browser';

const CLIENT_ID = import.meta.env.VITE_MSAL_CLIENT_ID;
const SCOPES = ['User.Read', 'Files.ReadWrite.AppFolder'];

export const msalConfig = {
    auth: {
        clientId: CLIENT_ID,
        redirectUri: window.location.origin,
        navigateToLoginRequestUrl: false,
        authority: 'https://login.microsoftonline.com/common'
    },
    cache: {
        cacheLocation: 'localStorage',
        storeAuthStateInCookie: false,
    }
};

export const msalInstance = new PublicClientApplication(msalConfig);

let isInitialized = false;

export const initMsal = async (): Promise<AuthenticationResult | null> => {
    if (!isInitialized) {
        await msalInstance.initialize();

        // Handle redirect result - this is CRITICAL
        try {
            const response = await msalInstance.handleRedirectPromise();

            if (response) {
                console.log("✅ Auth Success (Redirect)!");
                // Clear URL hash to clean up
                window.history.replaceState({}, document.title, window.location.pathname);
                isInitialized = true;
                return response;
            }
        } catch (error: any) {
            if (error.errorCode !== 'no_token_request_cache_error') {
                console.error("❌ MSAL Redirect Error:", error);
            } else {
                console.warn("⚠️ Expired Auth Cache Ignored");
            }
        }

        isInitialized = true;
    }
    return null;
};

export const oneDrive = {
    // --- Auth ---
    login: async (): Promise<AccountInfo | null> => {
        await initMsal();
        try {
            const response = await msalInstance.loginPopup({ scopes: SCOPES });
            console.log("🔐 Login Success:", response.account);
            return response.account;
        } catch (error) {
            console.error("❌ Login Failed", error);
            return null;
        }
    },

    logout: async (): Promise<void> => {
        await initMsal();
        const account = msalInstance.getAllAccounts()[0];
        if (account) {
            await msalInstance.logoutPopup({ account });
        }
    },

    getActiveAccount: async (): Promise<AccountInfo | null> => {
        await initMsal();
        const accounts = msalInstance.getAllAccounts();
        return accounts.length > 0 ? accounts[0] : null;
    },

    getToken: async (): Promise<string | null> => {
        await initMsal();
        const account = await oneDrive.getActiveAccount();
        if (!account) return null;

        try {
            const response = await msalInstance.acquireTokenSilent({
                account,
                scopes: SCOPES
            });
            return response.accessToken;
        } catch (error) {
            if (error instanceof InteractionRequiredAuthError) {
                try {
                    const response = await msalInstance.acquireTokenPopup({ scopes: SCOPES });
                    return response.accessToken;
                } catch (e) {
                    console.error("Popup Auth Failed", e);
                    return null;
                }
            }
            console.error("Token Acquire Failed", error);
            return null;
        }
    },

    // --- Graph API Helper ---
    graphEndpoint: "https://graph.microsoft.com/v1.0",

    callGraph: async (path: string, options: RequestInit = {}) => {
        const token = await oneDrive.getToken();
        if (!token) throw new Error("No Access Token");

        const headers = new Headers(options.headers);
        headers.append("Authorization", `Bearer ${token}`);

        const res = await fetch(`${oneDrive.graphEndpoint}${path}`, {
            ...options,
            headers
        });

        if (!res.ok) {
            const errBody = await res.text();
            throw new Error(`Graph API Error ${res.status}: ${errBody}`);
        }
        return res;
    },

    // --- File Ops (Preserving Store Compatibility) ---

    listProjects: async () => {
        // Compatibility wrapper: returns children of AppRoot
        try {
            const res = await oneDrive.callGraph('/me/drive/special/approot/children');
            const data = await res.json();
            return data.value;
        } catch (e: any) {
            if (e.message.includes('404')) return [];
            throw e;
        }
    },

    loadProjectFile: async (projectName: string, fileName: string) => {
        // Read file content: /AppRoot/ProjectName/FileName
        const res = await oneDrive.callGraph(`/me/drive/special/approot:/${projectName}/${fileName}:/content`);
        return res.json();
    },

    ensureFolder: async (folderName: string) => {
        const body = {
            "name": folderName,
            "folder": {},
            "@microsoft.graph.conflictBehavior": "fail"
        };
        try {
            await oneDrive.callGraph('/me/drive/special/approot/children', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
        } catch (e: any) {
            if (!e.message.includes('nameAlreadyExists')) {
                // ignore
            }
        }
    },

    saveProjectFile: async (projectName: string, fileName: string, content: any) => {
        await oneDrive.ensureFolder(projectName);
        await oneDrive.callGraph(`/me/drive/special/approot:/${projectName}/${fileName}:/content`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(content, null, 2)
        });
    }
};

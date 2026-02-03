import axios from 'axios';

// Vercel Serverless Function
export default async function handler(req, res) {
    // CORS configuration
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    // Environment Variables Check
    const { CLIENT_ID, CLIENT_SECRET, TENANT_ID, TARGET_USER_ID } = process.env;
    if (!CLIENT_ID || !CLIENT_SECRET || !TENANT_ID || !TARGET_USER_ID) {
        return res.status(500).json({
            error: "Missing Azure credentials. Please configure CLIENT_ID, CLIENT_SECRET, TENANT_ID, and TARGET_USER_ID in Vercel Environment Variables."
        });
    }

    // Token Helper
    const getAccessToken = async () => {
        const tokenUrl = `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`;
        const params = new URLSearchParams();
        params.append('client_id', CLIENT_ID);
        params.append('scope', 'https://graph.microsoft.com/.default');
        params.append('client_secret', CLIENT_SECRET);
        params.append('grant_type', 'client_credentials');

        try {
            const response = await axios.post(tokenUrl, params);
            return response.data.access_token;
        } catch (error) {
            console.error("[Auth] Failed to get token", error?.response?.data || error.message);
            throw error;
        }
    };

    try {
        const token = await getAccessToken();
        const action = req.query.action || 'metadata';

        // Path parsing
        // Vercel rewrites or typical usage: /api/proxy?path=... or /api/proxy/path..
        // BUT Vercel dynamic routes mapping is usually `api/proxy.js` -> `/api/proxy`.
        // If we want subpaths, we might need `api/proxy/[...path].js`.
        // However, to keep it simple and consistent with our "local" logic which might use query params or path params...
        // Let's rely on `req.query` if available, or just generic URL parsing.

        // Express `req.params[0]` logic in `server/index.js` relied on `app.all('/api/proxy/*', ...)`.
        // In Vercel `req.url` will be the full URL.
        // Let's assume standard usage: Client requests `/api/proxy` with `action` query, 
        // AND optionally a path suffix?
        // Our local proxy logic was: `/api/proxy/MyPath/File` -> `subPath = MyPath/File`.

        // In Vercel, if we deploy as `api/proxy.js`, it only matches `/api/proxy`. 
        // Subpaths won't match unless we use `api/proxy/[...args].js`.
        // BUT, we can simplify: Just use query parameter `path` if we want?
        // OR, check `req.url`.

        // Let's try to extract subpath from req.url manually.
        // req.url starts with /api/proxy
        let subPath = req.url.replace(/^\/api\/proxy/, '').split('?')[0];
        const cleanPath = subPath ? subPath.replace(/^\//, '') : '';

        // Logic from server/index.js
        let pathPart = `:/${cleanPath}`;
        if (cleanPath === '') pathPart = ''; // Root

        let resourceUrl = `https://graph.microsoft.com/v1.0/users/${TARGET_USER_ID}/drive/root${pathPart}`;

        if (cleanPath === '') {
            resourceUrl = `https://graph.microsoft.com/v1.0/users/${TARGET_USER_ID}/drive/root`;
        }

        if (action === 'children') {
            if (cleanPath !== '') resourceUrl += ':/children';
            else resourceUrl += '/children';
        } else if (action === 'content') {
            resourceUrl += ':/content';
        } else if (action === 'create_upload_session') {
            resourceUrl += ':/createUploadSession';
        }

        const graphUrl = resourceUrl;

        const axiosConfig = {
            method: req.method,
            url: graphUrl,
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': req.headers['content-type'] || 'application/json'
            },
            data: req.body,
            responseType: 'arraybuffer',
            validateStatus: () => true
        };

        const graphRes = await axios(axiosConfig);

        res.status(graphRes.status);
        res.setHeader('Content-Type', graphRes.headers['content-type']);
        res.send(graphRes.data);

    } catch (error) {
        console.error("[Proxy] Error:", error.message);
        res.status(500).json({ error: error.message });
    }
}

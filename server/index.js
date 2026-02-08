const path = require('path');
// 优先加载 .env.local (本地私有配置)
require('dotenv').config({ path: path.resolve(__dirname, '.env.local') });
// 补充加载 .env (默认配置)，不会覆盖已存在的变量
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
const PORT = 3001; // 强制使用 3001 端口以解决环境冲突

app.use(cors());
app.use(express.json({ limit: '50mb' })); // Allow large payloads for file uploads
app.use(express.text({ limit: '50mb' })); // Support XML/JSON/Text bodies

// In-memory token cache
let tokenCache = {
  accessToken: null,
  expiresAt: 0
};

// Helper: Get Token
const getAccessToken = async () => {
  const now = Date.now();
  if (tokenCache.accessToken && tokenCache.expiresAt > now + 30000) {
    return tokenCache.accessToken;
  }

  const { CLIENT_ID, CLIENT_SECRET, TENANT_ID } = process.env;
  if (!CLIENT_ID || !CLIENT_SECRET || !TENANT_ID) {
    throw new Error("Missing Azure credentials in .env");
  }

  const tokenUrl = `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`;
  const params = new URLSearchParams();
  params.append('client_id', CLIENT_ID);
  params.append('scope', 'https://graph.microsoft.com/.default');
  params.append('client_secret', CLIENT_SECRET);
  params.append('grant_type', 'client_credentials');

  try {
    const response = await axios.post(tokenUrl, params);
    const { access_token, expires_in } = response.data;

    tokenCache.accessToken = access_token;
    tokenCache.expiresAt = now + (expires_in * 1000);
    console.log("[Auth] Token refreshed successfully");
    return access_token;
  } catch (error) {
    console.error("[Auth] Failed to get token", error?.response?.data || error.message);
    throw error;
  }
};

// Root endpoint test
app.get('/', (req, res) => {
  res.send('Anti-PAPC Storage Proxy is Running');
});

// Proxy Middleware
const proxyHandler = async (req, res) => {
  const targetUserId = process.env.TARGET_USER_ID;
  if (!targetUserId) {
    return res.status(500).json({ error: "TARGET_USER_ID not configured on server" });
  }

  const subPath = req.query.path || req.params[0] || ''; // 优先从 query param 读取，兼容 URL 路径

  try {
    const token = await getAccessToken();

    // Determine Graph API Endpoint
    // Determine Graph API Endpoint
    const basePath = process.env.ONEDRIVE_BASE_PATH || '';

    // Normalize subpath
    const cleanPath = subPath ? subPath.replace(/^\//, '') : '';

    // Combine base and clean path
    let effectivePath = '';
    if (basePath && cleanPath) {
      effectivePath = `${basePath}/${cleanPath}`;
    } else if (basePath) {
      effectivePath = basePath;
    } else {
      effectivePath = cleanPath;
    }

    // Ensure no leading or trailing slash for Graph API path syntax (root:/path)
    effectivePath = effectivePath.replace(/^\/+|\/+$/g, '');

    // Logic from server/index.js
    let pathPart = effectivePath ? `:/${effectivePath}` : '';

    // Base Resource URL
    let resourceUrl = `https://graph.microsoft.com/v1.0/users/${targetUserId}/drive/root${pathPart}`;

    const action = req.query.action || 'metadata';


    if (action === 'children') {
      if (effectivePath !== '') resourceUrl += ':/children'; // for folder (base path or subpath)
      else resourceUrl += '/children'; // for true root
    } else if (action === 'content') {
      resourceUrl += ':/content';
    } else if (action === 'create_upload_session') {
      resourceUrl += ':/createUploadSession';
    }
    // metadata action stays as is (GET ...)

    graphUrl = resourceUrl;

    // console.log(`[Proxy] Request: ${req.method} /${cleanPath} Action=${req.query.action}`);

    console.log(`[Proxy] Debug - Base: "${basePath}", cleanPath: "${cleanPath}", effective: "${effectivePath}", action: "${action}"`);

    // Logic already applied above, no need to repeat

    graphUrl = resourceUrl;

    console.log(`[Proxy] ${req.method} ${subPath} -> ${graphUrl}`);

    const axiosConfig = {
      method: req.method,
      url: graphUrl,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': req.headers['content-type'] || 'application/json'
      },
      data: req.body,
      responseType: 'arraybuffer', // Handle binary files correctly
      validateStatus: () => true // Pass through all status codes
    };

    const graphRes = await axios(axiosConfig);

    // Pass back headers (filtered)
    res.status(graphRes.status);
    res.set('Content-Type', graphRes.headers['content-type']);

    // Send Data
    res.send(graphRes.data);

  } catch (error) {
    console.error("[Proxy] Error:", error.message);
    res.status(500).json({ error: error.message });
  }
};

app.all('/api/proxy', proxyHandler);
app.all('/api/proxy/*', proxyHandler);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

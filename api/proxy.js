import axios from 'axios';

// ─── Token Cache（模块级别，Serverless Function 冷启动间可复用）───
let tokenCache = {
  accessToken: null,
  expiresAt: 0,
};

const getAccessToken = async ({ CLIENT_ID, CLIENT_SECRET, TENANT_ID }) => {
  const now = Date.now();
  // token 还有 30s 以上有效期就直接复用
  if (tokenCache.accessToken && tokenCache.expiresAt > now + 30000) {
    return tokenCache.accessToken;
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
    tokenCache.expiresAt = now + expires_in * 1000;
    console.log('[Auth] Token refreshed successfully');
    return access_token;
  } catch (error) {
    console.error('[Auth] Failed to get token', error?.response?.data || error.message);
    throw error;
  }
};

// ─── 构建 Graph API URL ────────────────────────────────────────────
// Graph API 路径规则:
//   根目录子文件列表:        /drive/root/children
//   指定路径 metadata:       /drive/root:/PAPC/subfolder
//   指定路径子文件列表:      /drive/root:/PAPC/subfolder:/children
//   指定路径文件内容:        /drive/root:/PAPC/subfolder/file.txt:/content
//   指定路径创建上传会话:    /drive/root:/PAPC/subfolder/file.txt:/createUploadSession
const buildGraphUrl = (targetUserId, basePath, subPath, action) => {
  // 拼接 basePath + subPath -> effectivePath
  const parts = [basePath, subPath].filter(Boolean);
  const effectivePath = parts.join('/');

  const base = `https://graph.microsoft.com/v1.0/users/${targetUserId}/drive/root`;

  // 没有任何路径 -> 访问真正的 root
  if (!effectivePath) {
    if (action === 'children') return `${base}/children`;
    return base; // metadata
  }

  // 有路径的情况
  const pathPrefix = `${base}:/${effectivePath}`;

  switch (action) {
    case 'children':
      return `${pathPrefix}:/children`;
    case 'content':
      return `${pathPrefix}:/content`;
    case 'create_upload_session':
      return `${pathPrefix}:/createUploadSession`;
    default: // metadata
      return pathPrefix;
  }
};

// ─── Main Handler ──────────────────────────────────────────────────
export default async function handler(req, res) {
  // ── CORS ──
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

  // ── 环境变量 ──
  const { CLIENT_ID, CLIENT_SECRET, TENANT_ID, TARGET_USER_ID, ONEDRIVE_BASE_PATH } = process.env;

  if (!CLIENT_ID || !CLIENT_SECRET || !TENANT_ID || !TARGET_USER_ID) {
    return res.status(500).json({
      error: 'Missing Azure credentials. Please configure CLIENT_ID, CLIENT_SECRET, TENANT_ID, and TARGET_USER_ID in Vercel Environment Variables.',
    });
  }

  try {
    const token = await getAccessToken({ CLIENT_ID, CLIENT_SECRET, TENANT_ID });

    // ── 解析 query 参数 ──
    // action: metadata | children | content | create_upload_session
    // path:   子路径, 相对于 ONEDRIVE_BASE_PATH, 如 "subfolder" 或 "subfolder/file.txt"
    const action = req.query.action || 'metadata';
    const subPath = (req.query.path || '').replace(/^\/+|\/+$/g, ''); // 去掉首尾斜杠
    const basePath = (ONEDRIVE_BASE_PATH || '').replace(/^\/+|\/+$/g, '');

    // ── 构建 URL ──
    const graphUrl = buildGraphUrl(TARGET_USER_ID, basePath, subPath, action);

    console.log(`[Proxy] ${req.method} action=${action} path=${subPath || '(root)'} -> ${graphUrl}`);

    // ── 转发请求到 Graph API ──
    const graphRes = await axios({
      method: req.method,
      url: graphUrl,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': req.headers['content-type'] || 'application/json',
      },
      data: req.body,
      responseType: 'arraybuffer',
      validateStatus: () => true, // 不自动 throw，把 status 直接转发回前端
    });

    // ── 转发响应 ──
    res.status(graphRes.status);
    if (graphRes.headers['content-type']) {
      res.setHeader('Content-Type', graphRes.headers['content-type']);
    }
    res.send(graphRes.data);
  } catch (error) {
    console.error('[Proxy] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
}

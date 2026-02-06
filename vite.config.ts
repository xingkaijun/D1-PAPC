import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
      proxy: {
        '/api': {
          target: 'http://localhost:3001',
          changeOrigin: true,
          secure: false,
        }
      }
    },
    plugins: [react()],
    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      // Support both VITE_ prefixed (local) and non-prefixed (Vercel) env vars
      'import.meta.env.VITE_WEBDAV_URL': JSON.stringify(env.VITE_WEBDAV_URL || env.WEBDAV_URL),
      'import.meta.env.VITE_WEBDAV_USER': JSON.stringify(env.VITE_WEBDAV_USER || env.WEBDAV_USER),
      'import.meta.env.VITE_WEBDAV_PASSWORD': JSON.stringify(env.VITE_WEBDAV_PASSWORD || env.WEBDAV_PASSWORD),
      'import.meta.env.VITE_PUSH_PASSWORD': JSON.stringify(env.VITE_PUSH_PASSWORD || env.PUSH_PASSWORD)
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    }
  };
});

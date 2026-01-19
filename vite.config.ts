import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    plugins: [react()],
    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.WEBDAV_URL': JSON.stringify(env.WEBDAV_URL),
      'process.env.WEBDAV_USER': JSON.stringify(env.WEBDAV_USER),
      'process.env.WEBDAV_PASSWORD': JSON.stringify(env.WEBDAV_PASSWORD),
      'process.env.PUSH_PASSWORD': JSON.stringify(env.PUSH_PASSWORD)
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    }
  };
});

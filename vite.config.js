import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, loadEnv } from 'vite'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, projectRoot, '');
  let supabaseOrigin = '';
  try {
    supabaseOrigin = new URL(env.VITE_SUPABASE_URL).origin;
  } catch {
    // Keep local builds possible when Supabase is not configured.
  }
  const connectSources = ["'self'", supabaseOrigin, 'https:', 'wss:'].filter(Boolean).join(' ');
  const mediaSources = ["'self'", 'data:', 'blob:', supabaseOrigin, 'https:'].filter(Boolean).join(' ');
  const contentSecurityPolicy = [
    "default-src 'self'",
    "script-src 'self' https://challenges.cloudflare.com",
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self'",
    `img-src ${mediaSources}`,
    `media-src ${mediaSources}`,
    `connect-src ${connectSources}`,
    'frame-src https://www.youtube-nocookie.com https://www.youtube.com https://challenges.cloudflare.com',
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    'upgrade-insecure-requests',
  ].join('; ');
  const cspPlugin = {
    name: 'moVeerAI-content-security-policy',
    apply: 'build',
    transformIndexHtml() {
      return [
        { tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: contentSecurityPolicy }, injectTo: 'head' },
        { tag: 'meta', attrs: { name: 'referrer', content: 'strict-origin-when-cross-origin' }, injectTo: 'head' },
      ];
    },
  };

  return {
    base: process.env.APP_BASE_PATH || '/',
    plugins: [react(), tailwindcss(), cspPlugin],
    resolve: {
      alias: [
        { find: '@', replacement: path.resolve(projectRoot, 'src') },
        {
          find: /^(html2canvas|canvg|dompurify)$/,
          replacement: path.resolve(projectRoot, 'src/lib/jspdfOptionalStub.js'),
        },
      ],
    },
    build: {
      outDir: process.env.APP_BUILD_OUT_DIR || 'dist',
      rollupOptions: {
        output: {
          // Stable vendor chunks stay cached across app deploys.
          manualChunks(id) {
            if (!id.includes('node_modules')) return undefined;
            if (id.includes('/@supabase/') || id.includes('/iceberg-js/')) return 'vendor-supabase';
            if (/\/node_modules\/(react|react-dom|scheduler|react-router|react-router-dom)\//.test(id)) return 'vendor-react';
            return undefined;
          },
        },
      },
    },
  };
});

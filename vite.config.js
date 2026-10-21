import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  base: process.env.APP_BASE_PATH || '/',
  plugins: [react(), tailwindcss()],
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
});

import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import { vditorAssetsPlugin } from './web/src/dev/vditorAssets/plugin'

function siteBase(value: string) {
  let result = value.trim() || '/SuperBoard/'
  if (!result.startsWith('/')) result = `/${result}`
  if (!result.endsWith('/')) result = `${result}/`
  return result
}

export default defineConfig(({ command, isPreview, mode }) => ({
  base: command === 'build' || isPreview
    ? siteBase(
        process.env.BASE_PATH ??
          process.env.SB_BASE ??
          (mode === 'editor' ? '/' : ''),
      )
    : '/',
  plugins: [react(), vditorAssetsPlugin()],
  resolve: {
    alias: [
      { find: '@repo/shared', replacement: resolve(process.cwd(), 'web/src/vendor/json-canvas-viewer/shared/index.ts') },
      {
        find: /^\$\//,
        replacement: resolve(process.cwd(), 'web/src/vendor/json-canvas-viewer/src/kernel') + '/',
      },
      {
        find: '$',
        replacement: resolve(process.cwd(), 'web/src/vendor/json-canvas-viewer/src/kernel'),
      },
      {
        find: /^@\//,
        replacement: resolve(process.cwd(), 'web/src/vendor/json-canvas-viewer/src') + '/',
      },
      {
        find: '@',
        replacement: resolve(process.cwd(), 'web/src/vendor/json-canvas-viewer/src'),
      },
    ],
  },
  optimizeDeps: {
    entries: ['index.html'],
    include: ['vditor'],
  },
  server: {
    port: Number(process.env.WAILS_VITE_PORT) || 5173,
    watch: {
      ignored: ['**/whiteboards/**', '**/public/mathjax/**', '**/参考/**'],
    },
  },
  build: {
    manifest: true,
    emptyOutDir: true,
    outDir: process.env.SB_OUT_DIR || 'dist',
    rollupOptions:
      command === 'build'
        ? {
            input: (mode === 'editor'
              ? { editor: resolve(process.cwd(), 'index.html') }
              : {
                  viewer: resolve(process.cwd(), 'web/src/viewer/main.tsx'),
                }) as Record<string, string>,
          }
        : undefined,
  },
}))

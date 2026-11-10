import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import { boardFsPlugin } from './web/src/dev/boardFs'

function siteBase(value: string) {
  let result = value.trim() || '/SuperBoard/'
  if (!result.startsWith('/')) result = `/${result}`
  if (!result.endsWith('/')) result = `${result}/`
  return result
}

export default defineConfig(({ command, isPreview }) => ({
  base: command === 'build' || isPreview ? siteBase(process.env.BASE_PATH || '') : '/',
  plugins: [react(), boardFsPlugin()],
  optimizeDeps: {
    entries: ['index.html'],
  },
  server: {
    watch: {
      ignored: ['**/whiteboards/**', '**/public/mathjax/**', '**/参考/**'],
    },
  },
  build: {
    manifest: true,
    emptyOutDir: true,
    rollupOptions:
      command === 'build'
        ? {
            input: {
              viewer: resolve(process.cwd(), 'web/src/viewer/main.tsx'),
            },
          }
        : undefined,
  },
}))

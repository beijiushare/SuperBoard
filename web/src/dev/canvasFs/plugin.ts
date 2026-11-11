import type { Plugin, ViteDevServer } from 'vite'
import { handleCanvasFsRequest } from './handle'

export function canvasFsPlugin(): Plugin {
  return {
    name: 'superboard-canvas-fs',
    configureServer(server: ViteDevServer) {
      const root = server.config.root
      server.middlewares.use((req, res, next) => {
        void handleCanvasFsRequest(root, req, res, next)
      })
    },
  }
}

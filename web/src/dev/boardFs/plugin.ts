import type { Plugin, ViteDevServer } from 'vite'
import { handleBoardFsRequest } from './handle'

export function boardFsPlugin(): Plugin {
  return {
    name: 'superboard-board-fs',
    configureServer(server: ViteDevServer) {
      const root = server.config.root
      server.middlewares.use((req, res, next) => {
        void handleBoardFsRequest(root, req, res, next)
      })
    },
  }
}

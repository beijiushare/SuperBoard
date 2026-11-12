import { promises as fs } from 'node:fs'
import path from 'node:path'
import type { Plugin, ViteDevServer } from 'vite'

const MIME: Record<string, string> = {
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
}

function serveVditor(root: string, server: ViteDevServer) {
  const base = path.resolve(root, 'node_modules', 'vditor')
  server.middlewares.use((req, res, next) => {
    const url = new URL(req.url || '/', 'http://superboard.local')
    if (!url.pathname.startsWith('/__vditor/')) {
      next()
      return
    }
    const relative = decodeURIComponent(url.pathname.slice('/__vditor/'.length))
    const file = path.resolve(base, relative)
    if (file !== base && !file.startsWith(`${base}${path.sep}`)) {
      res.statusCode = 403
      res.end('forbidden')
      return
    }
    void fs
      .readFile(file)
      .then((data) => {
        res.setHeader('Cache-Control', 'public, max-age=3600')
        res.setHeader('Content-Type', MIME[path.extname(file).toLowerCase()] ?? 'application/octet-stream')
        res.end(data)
      })
      .catch(() => next())
  })
}

export function vditorAssetsPlugin(): Plugin {
  return {
    name: 'superboard-vditor-assets',
    configureServer(server) {
      serveVditor(server.config.root, server)
    },
  }
}

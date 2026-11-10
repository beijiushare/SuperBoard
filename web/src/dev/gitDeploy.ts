import { spawn } from 'node:child_process'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Plugin } from 'vite'

function isLoopback(req: IncomingMessage) {
  const address = req.socket.remoteAddress
  return address === '127.0.0.1' || address === '::1' || address === '::ffff:127.0.0.1'
}

function runGit(cwd: string, args: string[]) {
  return new Promise<void>((resolve) => {
    const child = spawn('git', args, {
      cwd,
      stdio: 'ignore',
      windowsHide: true,
      shell: false,
    })
    const timer = setTimeout(() => child.kill(), 120_000)
    child.on('error', () => {
      clearTimeout(timer)
      resolve()
    })
    child.on('exit', () => {
      clearTimeout(timer)
      resolve()
    })
  })
}

async function commitAndPush(root: string) {
  await runGit(root, ['add', '-A'])
  await runGit(root, ['commit', '-m', 'chore: update boards'])
  await runGit(root, ['push'])
}

export function gitDeployPlugin(): Plugin {
  let running = false

  return {
    name: 'superboard-git-deploy',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use((req: IncomingMessage, res: ServerResponse, next: () => void) => {
        if (req.url?.split('?')[0] !== '/__deploy') {
          next()
          return
        }

        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end()
          return
        }

        if (!isLoopback(req)) {
          res.statusCode = 403
          res.end()
          return
        }

        res.statusCode = 202
        res.end()

        if (running) return
        running = true
        void commitAndPush(server.config.root).finally(() => {
          running = false
        })
      })
    },
  }
}

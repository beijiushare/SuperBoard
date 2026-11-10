import { spawn } from 'node:child_process'
import type { IncomingMessage, ServerResponse } from 'node:http'
import path from 'node:path'
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

function openWindowsTerminal(root: string) {
  const scriptPath = path.join(root, 'scripts', 'deploy.cmd')
  const child = spawn('cmd.exe', ['/c', 'start', 'SuperBoard Deploy', 'cmd.exe', '/k', scriptPath], {
    cwd: root,
    detached: true,
    stdio: 'ignore',
    windowsHide: false,
    shell: false,
  })
  child.unref()
}

function deploy(root: string) {
  if (process.platform === 'win32') {
    openWindowsTerminal(root)
    return
  }
  void commitAndPush(root)
}

export function gitDeployPlugin(): Plugin {
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
        deploy(server.config.root)
      })
    },
  }
}

// Bridges the Wails frontend lifecycle to the existing Vite project in the
// repository root. The desktop app does not own a second frontend code base:
// `build` reuses `npm run build:editor` and copies the result into
// `desktop/frontend/dist`, `dev` reuses the root Vite dev server.
import { spawnSync } from 'node:child_process'
import { cpSync, mkdirSync, rmSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const desktopDir = resolve(here, '..')
const rootDir = resolve(desktopDir, '..')
const mode = process.argv[2] ?? 'build'
const passthrough = process.argv.slice(3)

function run(args) {
  const result = spawnSync('npm', args, {
    cwd: rootDir,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  })
  if ((result.status ?? 1) !== 0) process.exit(result.status ?? 1)
}

if (mode === 'dev') {
  run(['run', 'dev', '--', ...passthrough])
} else {
  run(['run', 'build:editor'])
  const from = resolve(rootDir, 'dist')
  const to = resolve(desktopDir, 'frontend', 'dist')
  rmSync(to, { recursive: true, force: true })
  mkdirSync(to, { recursive: true })
  cpSync(from, to, { recursive: true })
  console.log(`desktop frontend: copied ${from} -> ${to}`)
}

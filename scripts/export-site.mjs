import { spawnSync } from 'node:child_process'
import path from 'node:path'
import process from 'node:process'

function argValue(name, fallback) {
  const index = process.argv.indexOf(name)
  if (index >= 0 && process.argv[index + 1]) return process.argv[index + 1]
  return fallback
}

const root = process.cwd()
const dataDir = path.resolve(argValue('--data', 'info/public'))
const outDir = path.resolve(argValue('--out', 'dist-site'))
const base = argValue('--base', process.env.BASE_PATH || process.env.SB_BASE || '/')
const cacheDir = path.resolve(
  argValue('--cache', 'node_modules/.cache/superboard/canvas'),
)

function run(command, args, env = {}) {
  console.log(`\n$ ${[command, ...args].join(' ')}`)
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, ...env },
  })
  if (result.status !== 0) process.exit(result.status ?? 1)
}

const tsx = path.join(root, 'node_modules', 'tsx', 'dist', 'cli.mjs')
const vite = path.join(root, 'node_modules', 'vite', 'bin', 'vite.js')

run(process.execPath, [
  tsx,
  'scripts/prepare-canvas.ts',
  '--data',
  dataDir,
  '--out',
  cacheDir,
])

run(process.execPath, [vite, 'build', '--mode', 'viewer'], {
  SB_OUT_DIR: outDir,
  SB_BASE: base,
})

run(process.execPath, [
  'web/build.js',
  '--out',
  outDir,
  '--canvas',
  cacheDir,
  '--base',
  base,
])

console.log(`\n站点已导出：${outDir}`)

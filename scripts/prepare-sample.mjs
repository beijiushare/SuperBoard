import { execFileSync } from 'node:child_process'
import { copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'

function argValue(name, fallback) {
  const index = process.argv.indexOf(name)
  if (index >= 0 && process.argv[index + 1]) return process.argv[index + 1]
  return fallback
}

const root = process.cwd()
const source = path.resolve(argValue('--data', 'info'))
const outRoot = path.resolve(argValue('--out', 'public'))
const target = path.join(outRoot, 'sample')
const version = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8')).version

const SCOPES = ['public', 'private']
const IGNORED_DIRS = new Set(['assets', '.superboard'])

function walk(dir, base = '') {
  const files = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue
    const relative = base ? `${base}/${entry.name}` : entry.name
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (IGNORED_DIRS.has(entry.name) && base === '') continue
      files.push(...walk(full, relative))
    } else {
      files.push(relative)
    }
  }
  return files
}

function foldersIn(dir, scope, prefix = '') {
  const folders = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.startsWith('.')) continue
    if (prefix === '' && IGNORED_DIRS.has(entry.name)) continue
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name
    folders.push({ path: relative, scope })
    folders.push(...foldersIn(path.join(dir, entry.name), scope, relative))
  }
  return folders
}

function boardsIn(dir, scope, prefix = '') {
  const boards = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (prefix === '' && IGNORED_DIRS.has(entry.name)) continue
      boards.push(...boardsIn(full, scope, prefix ? `${prefix}/${entry.name}` : entry.name))
      continue
    }
    if (!entry.name.endsWith('.canvas')) continue
    let meta = null
    try {
      const doc = JSON.parse(readFileSync(full, 'utf8'))
      meta = doc?.['x-superboard']?.meta ?? null
    } catch {
      meta = null
    }
    if (!meta?.slug) continue
    boards.push({
      slug: meta.slug,
      title: meta.title ?? meta.slug,
      summary: meta.summary,
      order: meta.order,
      updatedAt: meta.updatedAt,
      path: prefix,
      scope,
    })
  }
  return boards
}

function trackedFiles() {
  try {
    const relative = path.relative(root, source) || '.'
    const output = execFileSync('git', ['ls-files', '-z', '--', relative], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    })
    return output
      .split('\0')
      .filter(Boolean)
      .map((file) => path.relative(source, path.join(root, file)))
      .filter((file) => file && !file.startsWith('..'))
  } catch {
    return null
  }
}

if (!existsSync(source)) {
  console.error(`[sample] missing source ${source}`)
  process.exit(1)
}

rmSync(target, { recursive: true, force: true })
mkdirSync(target, { recursive: true })

// Only publish files that are actually committed. Local scratch boards inside
// info/ (for example an untracked test board) would otherwise leak into the
// sample build.
const tracked = trackedFiles()
if (tracked) {
  for (const file of tracked) {
    const destination = path.join(target, file)
    mkdirSync(path.dirname(destination), { recursive: true })
    copyFileSync(path.join(source, file), destination)
  }
} else {
  cpSync(source, target, { recursive: true })
}

const boards = []
const folders = []
for (const scope of SCOPES) {
  const scopeDir = path.join(target, scope)
  if (!existsSync(scopeDir) || !statSync(scopeDir).isDirectory()) continue
  boards.push(...boardsIn(scopeDir, scope))
  folders.push(...foldersIn(scopeDir, scope))
}

boards.sort((a, b) => {
  if (a.scope !== b.scope) return a.scope.localeCompare(b.scope)
  if (a.path !== b.path) return a.path.localeCompare(b.path, 'zh-CN')
  return String(b.updatedAt ?? '').localeCompare(String(a.updatedAt ?? ''))
})

const files = walk(target)
const manifest = { version, generatedAt: new Date().toISOString(), boards, folders, files }
writeFileSync(path.join(target, 'sample.json'), `${JSON.stringify(manifest, null, 2)}\n`)

console.log(`[sample] ${boards.length} board(s), ${folders.length} folder(s), ${files.length} file(s) -> ${target}`)

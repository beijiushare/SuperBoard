import { createHash } from 'node:crypto'
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { execFileSync, spawnSync } from 'node:child_process'
import path from 'node:path'
import process from 'node:process'

// Packages the Windows desktop build for GitHub Releases:
//   SuperBoard-<version>-windows-amd64.exe
//   SHA256SUMS
// The updater picks the asset by GOOS/GOARCH and verifies it against the
// checksum asset.
//
// Usage:
//   node scripts/release-desktop.mjs                 build + package
//   node scripts/release-desktop.mjs --skip-build    package the current bin
//   node scripts/release-desktop.mjs --publish       also create the release
//   --publish --notes-file notes.md                  attach release notes

const root = process.cwd()
const args = new Set(process.argv.slice(2))
const publish = args.has('--publish')
const skipBuild = args.has('--skip-build')
const notesIndex = process.argv.indexOf('--notes-file')
const notesFile = notesIndex >= 0 ? process.argv[notesIndex + 1] : ''

const version = JSON.parse(
  readFileSync(path.join(root, 'package.json'), 'utf8'),
).version
if (!version) {
  console.error('[release] package.json has no version')
  process.exit(1)
}

const exeName = `SuperBoard-${version}-windows-amd64.exe`
const outDir = path.join(root, 'dist', 'release')
const outExe = path.join(outDir, exeName)
const checksumFile = path.join(outDir, 'SHA256SUMS')
const sourceExe = path.join(root, 'desktop', 'bin', 'superboard.exe')

if (!skipBuild) {
  console.log('[release] building desktop app…')
  // npm is a .cmd shim on Windows; run it through the shell as one string so
  // Node does not have to spawn a .cmd directly (ENOENT) and does not warn
  // about passing an argument array with shell: true.
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm'
  const build = spawnSync(`${npm} run desktop:build`, {
    cwd: root,
    stdio: 'inherit',
    shell: true,
  })
  if (build.status !== 0) {
    console.error('[release] desktop build failed')
    process.exit(build.status ?? 1)
  }
}

// The updater compares the version inside the binary, not the asset name.
// A stale desktop/version.go would publish a release that keeps updating to
// itself, so refuse to package a mismatched build.
const versionGo = readFileSync(path.join(root, 'desktop', 'version.go'), 'utf8')
const builtVersion = /const appVersion = "([^"]+)"/.exec(versionGo)?.[1]
if (builtVersion !== version) {
  console.error(
    `[release] desktop/version.go is ${builtVersion ?? 'missing'}, package.json is ${version}`,
  )
  console.error('[release] run `npm run sync:version` or build without --skip-build')
  process.exit(1)
}

if (!existsSync(sourceExe)) {
  console.error(`[release] missing ${sourceExe}`)
  process.exit(1)
}

mkdirSync(outDir, { recursive: true })
copyFileSync(sourceExe, outExe)

const digest = createHash('sha256').update(readFileSync(outExe)).digest('hex')
writeFileSync(checksumFile, `${digest}  ${exeName}\n`, 'utf8')

console.log(`[release] ${outExe}`)
console.log(`[release] ${checksumFile}`)
console.log(`[release] sha256 ${digest}`)

if (!publish) {
  console.log('[release] packaged only; pass --publish to create the GitHub release')
  process.exit(0)
}

const tag = `v${version}`
const existing = spawnSync('gh', ['release', 'view', tag], { cwd: root })
if (existing.status === 0) {
  console.error(`[release] ${tag} already exists; bump package.json first`)
  process.exit(1)
}

const notes = notesFile
  ? readFileSync(path.join(root, notesFile), 'utf8')
  : `SuperBoard ${version}`

console.log(`[release] publishing ${tag}…`)
execFileSync(
  'gh',
  [
    'release',
    'create',
    tag,
    '--title',
    `SuperBoard ${version}`,
    '--notes',
    notes,
    outExe,
    checksumFile,
  ],
  { cwd: root, stdio: 'inherit' },
)
console.log(`[release] published https://github.com/beijiushare/SuperBoard/releases/tag/${tag}`)
process.exit(0)

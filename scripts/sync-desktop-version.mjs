import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const root = process.cwd()
const version = JSON.parse(
  readFileSync(path.join(root, 'package.json'), 'utf8'),
).version

if (!version) {
  console.error('[version] package.json has no version')
  process.exit(1)
}

function syncFile(relative, update) {
  const file = path.join(root, relative)
  const before = readFileSync(file, 'utf8')
  const after = update(before)
  if (after !== before) {
    writeFileSync(file, after)
    console.log(`[version] ${relative} -> ${version}`)
  }
}

syncFile('desktop/build/config.yml', (text) =>
  text.replace(/(\n\s{2}version:\s*")[^"]*(")/, `$1${version}$2`),
)

syncFile('desktop/build/windows/info.json', (text) => {
  const data = JSON.parse(text)
  data.fixed = { ...data.fixed, file_version: version }
  const info = data.info?.['0409'] ?? {}
  data.info = {
    ...data.info,
    '0409': { ...info, ProductVersion: version },
  }
  return `${JSON.stringify(data, null, '\t')}\n`
})

const versionGoPath = path.join(root, 'desktop/version.go')
const versionGo = `package main

// appVersion mirrors package.json. It is rewritten by
// scripts/sync-desktop-version.mjs before every desktop build.
const appVersion = ${JSON.stringify(version)}
`
if (readFileSync(versionGoPath, 'utf8') !== versionGo) {
  writeFileSync(versionGoPath, versionGo)
  console.log(`[version] desktop/version.go -> ${version}`)
}

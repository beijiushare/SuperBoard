import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const root = process.cwd()
const localesDir = path.join(root, 'web', 'src', 'i18n', 'locales')
const baseLocale = 'zh-CN'
const locales = readdirSync(localesDir).filter((name) =>
  statSync(path.join(localesDir, name)).isDirectory(),
)

function leaves(value, prefix = '') {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return new Set([prefix])
  }
  const result = new Set()
  for (const [key, child] of Object.entries(value)) {
    const next = prefix ? `${prefix}.${key}` : key
    for (const leaf of leaves(child, next)) result.add(leaf)
  }
  return result
}

function load(locale, namespace) {
  return JSON.parse(
    readFileSync(path.join(localesDir, locale, `${namespace}.json`), 'utf8'),
  )
}

const namespaces = readdirSync(path.join(localesDir, baseLocale))
  .filter((file) => file.endsWith('.json'))
  .map((file) => file.slice(0, -5))

let failed = false
for (const locale of locales) {
  if (locale === baseLocale) continue
  for (const namespace of namespaces) {
    let baseKeys
    let localeKeys
    try {
      baseKeys = leaves(load(baseLocale, namespace))
      localeKeys = leaves(load(locale, namespace))
    } catch (error) {
      console.error(`[i18n] ${locale}/${namespace}: ${error.message}`)
      failed = true
      continue
    }
    for (const key of baseKeys) {
      if (!localeKeys.has(key)) {
        console.error(`[i18n] missing ${locale}/${namespace}: ${key}`)
        failed = true
      }
    }
    for (const key of localeKeys) {
      if (!baseKeys.has(key)) {
        console.error(`[i18n] extra ${locale}/${namespace}: ${key}`)
        failed = true
      }
    }
  }
}

if (failed) {
  process.exit(1)
}
console.log(`[i18n] ${locales.length} locales, ${namespaces.length} namespaces OK`)

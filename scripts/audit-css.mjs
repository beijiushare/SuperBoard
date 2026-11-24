/**
 * Dead-CSS audit: every class used in a stylesheet should appear somewhere in
 * the source. Prints per-file totals and the classes nobody references.
 *
 *   npm run audit:css
 */
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const stylesDir = path.join(root, 'web/src/styles')
const sourceRoots = [path.join(root, 'web/src'), path.join(root, 'index.html'), path.join(root, 'editor.html')]

function collectFiles(target, extension) {
  if (!fs.existsSync(target)) return []
  const stat = fs.statSync(target)
  if (stat.isFile()) return target.endsWith(extension) ? [target] : []
  const out = []
  for (const entry of fs.readdirSync(target, { withFileTypes: true })) {
    const child = path.join(target, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue
      out.push(...collectFiles(child, extension))
    } else if (entry.name.endsWith(extension)) {
      out.push(child)
    }
  }
  return out
}

const styleFiles = fs
  .readdirSync(stylesDir)
  .filter((name) => name.endsWith('.css'))
  .map((name) => path.join(stylesDir, name))

const sourceText = sourceRoots
  .flatMap((target) => ['.ts', '.tsx', '.html'].flatMap((ext) => collectFiles(target, ext)))
  .filter((file) => !file.includes(`${path.sep}styles${path.sep}`))
  .map((file) => fs.readFileSync(file, 'utf8'))
  .join('\n')

const classPattern = /\.(-?[_a-zA-Z][\w-]*)/g
const dynamicPrefix = /^[a-z][\w-]*$/

let totalClasses = 0
const report = []

for (const file of styleFiles) {
  const css = fs.readFileSync(file, 'utf8')
  const classes = new Set()
  for (const match of css.matchAll(classPattern)) {
    const name = match[1]
    // Skip decimal numbers such as `.5em` (regex already needs a leading letter)
    if (!dynamicPrefix.test(name)) continue
    classes.add(name)
  }
  const unused = [...classes].filter((name) => !sourceText.includes(name))
  totalClasses += classes.size
  report.push({
    file: path.basename(file),
    lines: css.split('\n').length,
    classes: classes.size,
    unused: unused.length,
    unusedNames: unused.sort(),
  })
}

report.sort((a, b) => b.unused - a.unused)

console.log(`\nCSS audit — ${totalClasses} classes across ${styleFiles.length} files\n`)
console.log('file'.padEnd(24), 'lines'.padStart(6), 'classes'.padStart(8), 'unused'.padStart(7))
for (const item of report) {
  console.log(
    item.file.padEnd(24),
    String(item.lines).padStart(6),
    String(item.classes).padStart(8),
    String(item.unused).padStart(7),
  )
}

console.log('\nUnreferenced classes (verify before deleting; some are built at runtime):\n')
for (const item of report) {
  if (!item.unusedNames.length) continue
  console.log(`${item.file}:`)
  console.log(`  ${item.unusedNames.join(', ')}`)
}
console.log('')

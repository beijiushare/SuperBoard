import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'

// Vditor loads these from `cdn` at runtime. Everything else in dist/js is a
// lazy plugin for diagram code fences (mermaid, echarts, graphviz, katex,
// markmap, ...) which this app never renders: diagrams are Pele blocks.

const root = process.cwd()
const source = path.join(root, 'node_modules', 'vditor', 'dist')
const target = path.join(root, 'public', '__vditor', 'dist')

const assets = [
  'index.css',
  'js/icons',
  'js/i18n',
  'js/highlight.js',
  'js/lute',
]

rmSync(path.join(root, 'public', '__vditor'), { recursive: true, force: true })
mkdirSync(target, { recursive: true })
for (const asset of assets) {
  const to = path.join(target, asset)
  mkdirSync(path.dirname(to), { recursive: true })
  cpSync(path.join(source, asset), to, { recursive: true })
}

console.log('SuperBoard: 已复制 Vditor 运行时资源到 public/__vditor')

const required = [
  'index.css',
  'js/lute/lute.min.js',
  'js/highlight.js/highlight.min.js',
  'js/icons',
]
for (const relative of required) {
  if (!existsSync(path.join(target, relative))) {
    console.error(`SuperBoard: Vditor 白名单缺少 ${relative}`)
    process.exit(1)
  }
}

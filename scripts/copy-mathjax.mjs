import { access, cp, mkdir, rm } from 'node:fs/promises'
import path from 'node:path'

const root = process.cwd()
const source = path.join(root, 'node_modules', 'mathjax')
const fontSource = path.join(root, 'node_modules', '@mathjax', 'mathjax-newcm-font')
const target = path.join(root, 'public', 'mathjax')

try {
  await access(source)
  await access(fontSource)
} catch {
  console.error('找不到 node_modules/mathjax 或 @mathjax/mathjax-newcm-font，请先运行 npm install')
  process.exit(1)
}

const fontTarget = path.join(target, 'fonts', 'mathjax-newcm-font')

await mkdir(path.dirname(target), { recursive: true })
await rm(target, { recursive: true, force: true })
await cp(source, target, { recursive: true })
await mkdir(fontTarget, { recursive: true })
await cp(path.join(fontSource, 'svg.js'), path.join(fontTarget, 'svg.js'))
await cp(path.join(fontSource, 'svg'), path.join(fontTarget, 'svg'), { recursive: true })
console.log('SuperBoard: 已复制 MathJax 静态资源到 public/mathjax')

import { access, cp, mkdir, rm } from 'node:fs/promises'
import path from 'node:path'

// The app only loads MathJax through web/src/shared/markdown/mathjax.ts:
//   startup.js + loader.js + core.js, input/asciimath, output/svg and the
//   NewCM SVG font. Copying the whole npm package added ~18 MB of TeX/MathML
//   bundles, CHTML output, the speech engine and the menu UI that never load.

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

await mkdir(path.dirname(target), { recursive: true })
await rm(target, { recursive: true, force: true })
await mkdir(target, { recursive: true })

const files = [
  'startup.js',
  'loader.js',
  'core.js',
  'LICENSE',
  'input/asciimath.js',
  'output/svg.js',
]

for (const relative of files) {
  const from = path.join(source, relative)
  const to = path.join(target, relative)
  await mkdir(path.dirname(to), { recursive: true })
  await cp(from, to)
}

const fontTarget = path.join(target, 'fonts', 'mathjax-newcm-font')
await mkdir(fontTarget, { recursive: true })
await cp(path.join(fontSource, 'svg.js'), path.join(fontTarget, 'svg.js'))
await cp(path.join(fontSource, 'svg'), path.join(fontTarget, 'svg'), {
  recursive: true,
})

console.log('SuperBoard: 已复制 MathJax（AsciiMath + SVG + NewCM 字体）到 public/mathjax')

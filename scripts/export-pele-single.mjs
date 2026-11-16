import { promises as fs } from 'node:fs'
import path from 'node:path'
import { render } from 'pele'

const root = process.cwd()
const type = process.argv[2] ?? 'flowchart'
const groups = JSON.parse(
  await fs.readFile(
    path.join(root, 'web', 'src', 'shared', 'pele', 'officialExamples.json'),
    'utf8',
  ),
)
const group = groups.find((item) => item.type === type)
if (!group) throw new Error(`未知图表类型: ${type}`)
const example = group.examples[group.representativeIndex] ?? group.examples[0]
const result = render(example.source)

const colors = {
  'var(--_bg)': '#fff',
  'var(--_fg)': '#1f1f1f',
  'var(--_m)': '#6e6e6e',
  'var(--_l)': '#1f1f1f',
  'var(--_s)': '#f3f3f3',
  'var(--_a)': '#e6e6e6',
  'var(--_b)': '#8a8a8a',
  'var(--_c)': '#5b7bd5',
  'var(--_r)': '4',
  'var(--_fm)': 'ui-monospace,SFMono-Regular,Menlo,Consolas,monospace',
  'var(--pele-bg)': '#fff',
  'var(--pele-fg)': '#1f1f1f',
  'var(--pele-muted)': '#6e6e6e',
  'var(--pele-line)': '#1f1f1f',
  'var(--pele-surface)': '#f3f3f3',
  'var(--pele-surface-alt)': '#e6e6e6',
  'var(--pele-border)': '#8a8a8a',
  'var(--pele-accent)': '#5b7bd5',
  'var(--pele-radius)': '4',
  'var(--pele-font-mono)': 'ui-monospace,SFMono-Regular,Menlo,Consolas,monospace',
}

let inner = result.svg
  .replace(/^<svg[^>]*>/, '')
  .replace(/<\/svg>\s*$/, '')
  .replaceAll('style="rx:var(--_r)"', 'rx="4"')
for (const [from, to] of Object.entries(colors)) {
  inner = inner.replaceAll(from, to)
}
inner = inner.replace(/var\(--[\w-]+(?:,([^)]*))?\)/g, (_, fallback) => fallback ?? 'none')

const width = 360
const height = 260
const artHeight = 200
const scale = Math.min(width / result.width, artHeight / result.height)
const x = 0
const y = (artHeight - result.height * scale) / 2
const font = 'sans-serif'
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" data-sb-target="pele:type:${group.type}" data-sb-title="${group.label}">
  <g transform="translate(${x} ${y}) scale(${scale})" font-family="${font}" font-size="16">${inner}</g>
  <text x="0" y="236" fill="#1f1f1f" font-family="${font}" font-size="14" font-weight="600">${group.label}</text>
</svg>
`

const output = path.join(root, '参考', 'temp', 'level1', `${type}.svg`)
await fs.mkdir(path.dirname(output), { recursive: true })
await fs.writeFile(output, svg, 'utf8')
console.log(`SuperBoard: 已导出 ${path.relative(root, output)}`)

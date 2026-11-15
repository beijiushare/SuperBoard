import { promises as fs } from 'node:fs'
import path from 'node:path'
import { render } from 'pele'
import { stripDiagramTitle } from './strip-diagram-title.mjs'

const root = process.cwd()
const groups = JSON.parse(
  await fs.readFile(
    path.join(root, 'web', 'src', 'shared', 'pele', 'officialExamples.json'),
    'utf8',
  ),
)
const types = ['flowchart', 'sequence']
const theme = {
  bg: '#ffffff',
  fg: '#2e3338',
  muted: '#888888',
  line: '#2e3338',
  surface: '#f6f6f6',
  alt: '#f0f0f0',
  border: '#e0e0e0',
  accent: '#8a5cf5',
  critical: '#e93147',
  radius: 6,
  font: '-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif',
  mono: 'ui-monospace,SFMono-Regular,Menlo,Consolas,monospace',
  series: [
    '#086ddd',
    '#ec7500',
    '#08b94e',
    '#e93147',
    '#00bfbc',
    '#e0ac00',
    '#7852ee',
    '#d53984',
  ],
}

function flatten(svg) {
  const map = {
    'var(--_bg)': theme.bg,
    'var(--_fg)': theme.fg,
    'var(--_m)': theme.muted,
    'var(--_l)': theme.line,
    'var(--_s)': theme.surface,
    'var(--_a)': theme.alt,
    'var(--_b)': theme.border,
    'var(--_c)': theme.accent,
    'var(--_r)': String(theme.radius),
    'var(--_fm)': theme.mono,
    'var(--pele-bg)': theme.bg,
    'var(--pele-fg)': theme.fg,
    'var(--pele-muted)': theme.muted,
    'var(--pele-line)': theme.line,
    'var(--pele-surface)': theme.surface,
    'var(--pele-surface-alt)': theme.alt,
    'var(--pele-border)': theme.border,
    'var(--pele-accent)': theme.accent,
    'var(--pele-critical)': theme.critical,
    'var(--pele-radius)': String(theme.radius),
    'var(--pele-font-mono)': theme.mono,
  }
  theme.series.forEach((color, index) => {
    map[`var(--pele-series-${index + 1})`] = color
  })
  let inner = svg
    .replace(/^<svg[^>]*>/, '')
    .replace(/<\/svg>\s*$/, '')
    .replaceAll('style="rx:var(--_r)"', `rx="${theme.radius}"`)
  for (const [from, to] of Object.entries(map)) {
    inner = inner.replaceAll(from, to)
  }
  return inner.replace(/var\(--[\w-]+(?:,([^)]*))?\)/g, (_, fallback) => fallback ?? 'none')
}

const outputDir = path.join(root, '参考', 'temp', 'samples')
await fs.mkdir(outputDir, { recursive: true })

for (const type of types) {
  const group = groups.find((item) => item.type === type)
  const example = group.examples[group.representativeIndex] ?? group.examples[0]
  const result = render(stripDiagramTitle(example.source))
  const width = 360
  const height = 260
  const artHeight = 200
  const scale = Math.min(width / result.width, artHeight / result.height)
  const y = (artHeight - result.height * scale) / 2
  const inner = flatten(result.svg)
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" id="sb-pele-${type}" data-sb-key="pele:type:${type}" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" data-sb-target="pele:type:${type}" data-sb-title="${group.label}">
  <g transform="translate(0 ${y}) scale(${scale})" font-family="${theme.font}" font-size="16">${inner}</g>
  <text x="0" y="236" fill="${theme.fg}" font-family="${theme.font}" font-size="14" font-weight="600">${group.label}</text>
</svg>
`
  await fs.writeFile(path.join(outputDir, `${type}.svg`), svg, 'utf8')
  console.log(`SuperBoard: 已生成 ${path.relative(root, path.join(outputDir, `${type}.svg`))}`)
}

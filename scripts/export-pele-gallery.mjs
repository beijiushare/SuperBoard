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
const outputRoot = path.join(root, '参考', 'temp')
const level1Dir = path.join(outputRoot, '一级画廊')

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

function escapeXml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}

function singleLine(value, maxChars) {
  const chars = Array.from(String(value).replaceAll(/\s+/g, ' ').trim())
  if (chars.length <= maxChars) return chars.join('')
  return `${chars.slice(0, maxChars - 1).join('')}…`
}

function colorMap() {
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
  return map
}

function namespaceIds(svg, prefix) {
  return svg
    .replace(/\bid="([^"]+)"/g, (_, id) => `id="${prefix}-${id}"`)
    .replace(/url\(#([^)]+)\)/g, (_, id) => `url(#${prefix}-${id})`)
    .replace(/\bhref="#([^"]+)"/g, (_, id) => `href="#${prefix}-${id}"`)
    .replace(/\bxlink:href="#([^"]+)"/g, (_, id) => `xlink:href="#${prefix}-${id}"`)
}

function flatten(svg, prefix) {
  const colors = colorMap()
  let inner = namespaceIds(
    svg.replace(/^<svg[^>]*>/, '').replace(/<\/svg>\s*$/, ''),
    prefix,
  )
  inner = inner.replaceAll('style="rx:var(--_r)"', `rx="${theme.radius}"`)
  for (const [from, to] of Object.entries(colors)) {
    inner = inner.replaceAll(from, to)
  }
  return inner.replace(/var\(--[\w-]+(?:,([^)]*))?\)/g, (_, fallback) => fallback ?? 'none')
}

function cardSvg({ source, title, key, id, maxChars, fontSize }) {
  const result = render(stripDiagramTitle(source))
  const width = 360
  const height = 260
  const artHeight = 200
  const scale = Math.min(width / result.width, artHeight / result.height)
  const y = (artHeight - result.height * scale) / 2
  const inner = flatten(result.svg, id)
  return `<svg xmlns="http://www.w3.org/2000/svg" id="${id}" data-sb-key="${escapeXml(key)}" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" data-sb-title="${escapeXml(title)}">
  <g transform="translate(0 ${y}) scale(${scale})" font-family="${theme.font}" font-size="16">${inner}</g>
  <text x="0" y="236" fill="${theme.fg}" font-family="${theme.font}" font-size="${fontSize}" font-weight="600">${escapeXml(singleLine(title, maxChars))}</text>
</svg>
`
}

await fs.rm(level1Dir, { recursive: true, force: true })
for (const group of groups) {
  await fs.rm(path.join(outputRoot, group.label), { recursive: true, force: true })
}
await fs.mkdir(level1Dir, { recursive: true })

for (const group of groups) {
  const example = group.examples[group.representativeIndex] ?? group.examples[0]
  await fs.writeFile(
    path.join(level1Dir, `${group.label}.svg`),
    cardSvg({
      source: example.source,
      title: group.label,
      key: `pele:type:${group.type}`,
      id: `l1-${group.type}`,
      maxChars: 38,
      fontSize: 14,
    }),
    'utf8',
  )

  const level2Dir = path.join(outputRoot, group.label)
  await fs.mkdir(level2Dir, { recursive: true })
  for (let index = 0; index < group.examples.length; index++) {
    const item = group.examples[index]
    await fs.writeFile(
      path.join(level2Dir, `${String(index + 1).padStart(3, '0')}.svg`),
      cardSvg({
        source: item.source,
        title: item.label,
        key: `pele:example:${group.type}:${index}`,
        id: `l2-${group.type}-${index + 1}`,
        maxChars: 48,
        fontSize: 11,
      }),
      'utf8',
    )
  }
  console.log(`SuperBoard: ${group.label} (${group.examples.length})`)
}

console.log(`SuperBoard: 一级画廊已生成到 ${path.relative(root, level1Dir)}`)

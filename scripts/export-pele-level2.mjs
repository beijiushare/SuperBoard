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
const outputDir = path.join(root, '参考', 'temp', 'level2')
const WIDTH = 210
const GAP = 16

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
    .replace(/(^|\s)id="([^"]+)"/g, (_, lead, id) => `${lead}id="${prefix}-${id}"`)
    .replace(/\bdata-id="([^"]+)"/g, (_, id) => `data-id="${prefix}-${id}"`)
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

async function removeDir(dir) {
  try {
    await fs.rm(dir, { recursive: true, force: true })
  } catch {
    // The folder may be open in Explorer or an editor; overwrite files in place.
  }
}

await removeDir(outputDir)
await fs.mkdir(outputDir, { recursive: true })

for (const group of groups) {
  const items = []

  for (let index = 0; index < group.examples.length; index++) {
    const example = group.examples[index]
    const result = render(stripDiagramTitle(example.source))
    const prefix = `l2-${group.type}-${index + 1}`
    items.push({
      index,
      example,
      prefix,
      inner: flatten(result.svg, prefix),
      scale: WIDTH / result.width,
      height: result.height * (WIDTH / result.width),
    })
  }

  const height =
    items.reduce((sum, item) => sum + item.height, 0) +
    GAP * Math.max(0, items.length - 1)
  let y = 0
  const cards = items.map((item) => {
    const top = y
    y += item.height + GAP
    return `  <g id="${item.prefix}" data-sb-key="pele:example:${group.type}:${item.index}" data-sb-label="${escapeXml(item.example.label)}">
    <g transform="translate(0 ${top.toFixed(3)}) scale(${item.scale.toFixed(6)})" font-family="${theme.font}" font-size="16">${item.inner}</g>
  </g>`
  })

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" id="level2-${group.type}" width="${WIDTH}" height="${height.toFixed(3)}" viewBox="0 0 ${WIDTH} ${height.toFixed(3)}">
${cards.join('\n')}
</svg>
`
  await fs.writeFile(
    path.join(outputDir, `${group.type}.svg`),
    svg,
    'utf8',
  )
  console.log(`SuperBoard: level2/${group.type}.svg (${group.examples.length})`)
}

console.log(`SuperBoard: 二级画廊已生成到 ${path.relative(root, outputDir)}`)

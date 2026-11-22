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
  // Keep in sync with --pele-font in web/src/styles/pele.css.
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

function cardSvg({
  source,
  title,
  key,
  id,
  maxChars,
  fontSize,
  showLabel = true,
}) {
  const result = render(stripDiagramTitle(source))
  const width = 360
  const artHeight = 200
  const height = showLabel ? 260 : artHeight
  const scale = Math.min(width / result.width, artHeight / result.height)
  const y = (artHeight - result.height * scale) / 2
  const inner = flatten(result.svg, id)
  const label = showLabel
    ? `\n  <text x="0" y="236" fill="${theme.fg}" font-family="${theme.font}" font-size="${fontSize}" font-weight="600">${escapeXml(singleLine(title, maxChars))}</text>`
    : ''
  return `<svg xmlns="http://www.w3.org/2000/svg" id="${id}" data-sb-key="${escapeXml(key)}" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" data-sb-title="${escapeXml(title)}">
  <g transform="translate(0 ${y}) scale(${scale})" font-family="${theme.font}" font-size="16">${inner}</g>${label}
</svg>
`
}

const LEVEL1_SOURCE_OVERRIDES = {
  block: `block
  columns 3
  a:3
  block:group1:2
    columns 2
    h i j k
  end
  g
  block:group2:3
    %% columns auto (default)
    l m n o p q r
  end`,
  quadrant: `quadrantChart
    title Reach and engagement of campaigns
    x-axis Low Reach --> High Reach
    y-axis Low Engagement --> High Engagement
    quadrant-1 We should expand
    quadrant-2 Need to promote
    quadrant-3 Re-evaluate
    quadrant-4 May be improved
    Campaign A: [0.3, 0.6]
    Campaign B: [0.45, 0.23]
    Campaign C: [0.57, 0.69]
    Campaign D: [0.78, 0.34]
    Campaign E: [0.40, 0.34]
    Campaign F: [0.35, 0.78]`,
  sequence: `sequenceDiagram
  autonumber
  actor Customer
  participant Web as Web app
  participant API as API gateway
  participant Bank
  Customer->>Web: Place order
  Web->>API: POST /orders
  activate API
  API->>Bank: Authorise payment
  Bank-->>API: Approved
  API-->>Web: 201 Created
  deactivate API
  Web-->>Customer: Order confirmed
  Note over Customer,Bank: One order, one transaction`,
  wardley: `wardley-beta

anchor Business [0.95, 0.63]
component Cup of Tea [0.79, 0.61]
component Tea [0.63, 0.81]
component Hot Water [0.52, 0.80]
component Kettle [0.43, 0.35]
component Power [0.10, 0.70]

Business -> Cup of Tea
Cup of Tea -> Tea
Cup of Tea -> Hot Water
Hot Water -> Kettle
Kettle -> Power

evolve Kettle 0.62
evolve Power 0.89

note "Standardizing power allows Kettles to evolve faster" [0.30, 0.49]`,
}

async function removeDir(dir) {
  try {
    await fs.rm(dir, { recursive: true, force: true })
  } catch {
    // The folder may be open in Explorer or an editor; overwrite files in place.
  }
}

await removeDir(level1Dir)
for (const group of groups) {
  await removeDir(path.join(outputRoot, group.label))
}
await fs.mkdir(level1Dir, { recursive: true })

for (const group of groups) {
  const example = group.examples[group.representativeIndex] ?? group.examples[0]
  await fs.writeFile(
    path.join(level1Dir, `${group.label}.svg`),
    cardSvg({
      source: LEVEL1_SOURCE_OVERRIDES[group.type] ?? example.source,
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
        showLabel: false,
      }),
      'utf8',
    )
  }
  console.log(`SuperBoard: ${group.label} (${group.examples.length})`)
}

console.log(`SuperBoard: 一级画廊已生成到 ${path.relative(root, level1Dir)}`)

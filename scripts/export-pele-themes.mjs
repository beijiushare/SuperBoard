import { promises as fs } from 'node:fs'
import path from 'node:path'
import { render } from 'pele'

const root = process.cwd()
const groups = JSON.parse(
  await fs.readFile(
    path.join(root, 'web', 'src', 'shared', 'pele', 'officialExamples.json'),
    'utf8',
  ),
)
const outputRoot = path.join(root, '参考', 'temp', 'color')

const themes = {
  default: {
    bg: '#ffffff',
    fg: '#333333',
    muted: '#707070',
    line: '#666666',
    surface: '#eeeeee',
    alt: '#f4f4f4',
    border: '#999999',
    accent: '#5b7bd5',
    critical: '#dd4422',
    radius: 5,
    font: 'trebuchet ms,verdana,arial,sans-serif',
    mono: 'ui-monospace,SFMono-Regular,Menlo,Consolas,monospace',
    series: [
      '#555555',
      '#f4f4f4',
      '#555555',
      '#bbbbbb',
      '#777777',
      '#999999',
      '#dddddd',
      '#ffffff',
    ],
  },
  original: {
    bg: '#fffcf0',
    fg: '#100f0f',
    muted: '#6f6e69',
    line: '#100f0f',
    surface: '#f2f0e5',
    alt: '#e6e4d9',
    border: '#cecdc3',
    accent: '#205ea6',
    critical: '#af3029',
    radius: 6,
    font: '-apple-system,BlinkMacSystemFont,Segoe UI,Helvetica,Arial,sans-serif',
    mono: 'ui-monospace,SFMono-Regular,Menlo,Consolas,monospace',
    series: [
      '#af3029',
      '#bc5215',
      '#ad8301',
      '#66800b',
      '#24837b',
      '#205ea6',
      '#5e409d',
      '#a02f6f',
    ],
  },
  forest: {
    bg: '#ffffff',
    fg: '#333333',
    muted: '#6eaa49',
    line: '#008000',
    surface: '#cde498',
    alt: '#cdffb2',
    border: '#13540c',
    accent: '#13540c',
    critical: '#ff0000',
    radius: 5,
    font: 'trebuchet ms,verdana,arial,sans-serif',
    mono: 'ui-monospace,SFMono-Regular,Menlo,Consolas,monospace',
    series: [
      '#b8cf88',
      '#b8e69f',
      '#d0e0a8',
      '#9fd0a0',
      '#9fd0c4',
      '#9fb8d0',
      '#b0a0d0',
      '#d0a0c4',
    ],
  },
  base: {
    bg: '#ffffff',
    fg: '#333333',
    muted: '#666666',
    line: '#000000',
    surface: '#cccccc',
    alt: '#ffffff',
    border: '#000000',
    accent: '#0042eb',
    critical: '#ff0000',
    radius: 3,
    font: 'arial,sans-serif',
    mono: 'ui-monospace,SFMono-Regular,Menlo,Consolas,monospace',
    series: [
      '#cccccc',
      '#e6e6e6',
      '#ffffff',
      '#999999',
      '#777777',
      '#555555',
      '#333333',
      '#111111',
    ],
  },
  neo: {
    bg: '#ffffff',
    fg: '#28253D',
    muted: '#BDBCCC',
    line: '#28253D',
    surface: '#F9F9FB',
    alt: '#F9F9FB',
    border: '#BDBCCC',
    accent: '#A78BFA',
    critical: '#F87171',
    radius: 12,
    font: 'Recursive Variable,arial,sans-serif',
    mono: 'ui-monospace,SFMono-Regular,Menlo,Consolas,monospace',
    series: [
      '#f4a8ff',
      '#46ecd5',
      '#ffb86a',
      '#dab2ff',
      '#7bf1a8',
      '#c4b4ff',
      '#ffa2a2',
      '#ffdf20',
    ],
  },
  'neo-dark': {
    bg: '#1f1e2e',
    fg: '#eeeeee',
    muted: '#a8a3bf',
    line: '#eeeeee',
    surface: '#2b2940',
    alt: '#39364f',
    border: '#4a4666',
    accent: '#A78BFA',
    critical: '#F87171',
    radius: 12,
    font: 'Recursive Variable,arial,sans-serif',
    mono: 'ui-monospace,SFMono-Regular,Menlo,Consolas,monospace',
    series: [
      '#f4a8ff',
      '#46ecd5',
      '#ffb86a',
      '#dab2ff',
      '#7bf1a8',
      '#c4b4ff',
      '#ffa2a2',
      '#ffdf20',
    ],
  },
}

function colorMap(theme) {
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

function flatten(theme, svg) {
  const colors = colorMap(theme)
  let inner = svg
    .replace(/^<svg[^>]*>/, '')
    .replace(/<\/svg>\s*$/, '')
    .replaceAll(/style="rx:var\(--_r\)"/g, `rx="${theme.radius}"`)
  for (const [from, to] of Object.entries(colors)) {
    inner = inner.replaceAll(from, to)
  }
  inner = inner.replace(
    /var\(--[\w-]+(?:,([^)]*))?\)/g,
    (_, fallback) => fallback ?? 'none',
  )
  return inner
}

async function exportTheme(name, theme) {
  const dir = path.join(outputRoot, name)
  await fs.mkdir(dir, { recursive: true })
  const width = 360
  const height = 260
  const artHeight = 200
  for (const group of groups) {
    const example = group.examples[group.representativeIndex] ?? group.examples[0]
    const result = render(example.source)
    const inner = flatten(theme, result.svg)
    const scale = Math.min(width / result.width, artHeight / result.height)
    const y = (artHeight - result.height * scale) / 2
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" data-sb-target="pele:type:${group.type}" data-sb-title="${group.label}">
  <g transform="translate(0 ${y}) scale(${scale})" font-family="${theme.font}" font-size="16">${inner}</g>
  <text x="0" y="236" fill="${theme.fg}" font-family="${theme.font}" font-size="14" font-weight="600">${group.label}</text>
</svg>
`
    await fs.writeFile(path.join(dir, `${group.type}.svg`), svg, 'utf8')
  }
  await fs.writeFile(
    path.join(dir, 'theme.json'),
    `${JSON.stringify(theme, null, 2)}\n`,
    'utf8',
  )
  console.log(`SuperBoard: 已生成 ${name} 主题，共 ${groups.length} 张图`)
}

await fs.rm(outputRoot, { recursive: true, force: true })
for (const name of ['original']) {
  await exportTheme(name, themes[name])
}

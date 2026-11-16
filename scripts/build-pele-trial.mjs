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
const trialDir = path.join(root, '参考', 'temp', 'trial')

function escapeXml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}

function safeId(value) {
  return String(value).replaceAll(/[^a-zA-Z0-9_-]+/g, '-')
}

function singleLine(value, maxChars = 38) {
  const chars = Array.from(String(value))
  if (chars.length <= maxChars) return String(value)
  return `${chars.slice(0, maxChars - 1).join('')}…`
}

function cardSvg({ source, title, target, width = 360, height = 240 }) {
  const result = render(source)
  const rootTag = result.svg.match(/^<svg([^>]*)>/)
  const rootStyle = rootTag?.[1].match(/style="([^"]*)"/)?.[1] ?? ''
  const style = rootStyle
    .replaceAll('max-width:100%;', '')
    .replaceAll('height:auto;', '')
  const inner = result.svg
    .replace(/^<svg[^>]*>/, '')
    .replace(/<\/svg>\s*$/, '')
  const artHeight = 196
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" data-sb-target="${escapeXml(target)}" data-sb-title="${escapeXml(title)}">
  <svg x="0" y="0" width="${width}" height="${artHeight}" viewBox="0 0 ${result.width} ${result.height}" preserveAspectRatio="xMinYMid meet">
    <g class="pele" style="${escapeXml(style)}">${inner}</g>
  </svg>
  <text x="0" y="226" fill="#1f1e1c" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif" font-size="13" font-weight="600">${escapeXml(singleLine(title))}</text>
</svg>
`
}

function bigSvg(cards) {
  const width = 1180
  const height = 280
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  ${cards
    .map(
      (card, index) =>
        `<image href="${card.href}" x="${20 + index * 380}" y="20" width="360" height="240" data-sb-target="${card.target}" data-sb-title="${escapeXml(card.title)}"/>`,
    )
    .join('\n  ')}
</svg>
`
}

await fs.rm(trialDir, { recursive: true, force: true })
await fs.mkdir(path.join(trialDir, 'cards', 'level1'), { recursive: true })
await fs.mkdir(path.join(trialDir, 'cards', 'level2', 'flowchart'), {
  recursive: true,
})

const level1Types = ['flowchart', 'sequence', 'wardley']
const level1Cards = []
for (const type of level1Types) {
  const group = groups.find((item) => item.type === type)
  const example = group.examples[group.representativeIndex] ?? group.examples[0]
  const target = `pele:type:${type}`
  const file = path.join(trialDir, 'cards', 'level1', `${type}.svg`)
  await fs.writeFile(
    file,
    cardSvg({
      source: example.source,
      title: group.label,
      target,
    }),
    'utf8',
  )
  level1Cards.push({
    href: `cards/level1/${type}.svg`,
    target,
    title: group.label,
  })
}

const flowchart = groups.find((item) => item.type === 'flowchart')
const level2Cards = []
for (const index of [0, 6, 12]) {
  const example = flowchart.examples[index]
  const target = `pele:example:flowchart:${index}`
  const file = path.join(
    trialDir,
    'cards',
    'level2',
    'flowchart',
    `${String(index).padStart(3, '0')}.svg`,
  )
  await fs.writeFile(
    file,
    cardSvg({
      source: example.source,
      title: example.label,
      target,
    }),
    'utf8',
  )
  level2Cards.push({
    href: `cards/level2/flowchart/${String(index).padStart(3, '0')}.svg`,
    target,
    title: example.label,
  })
}

await fs.writeFile(
  path.join(trialDir, 'level1-sample.svg'),
  bigSvg(level1Cards),
  'utf8',
)
await fs.writeFile(
  path.join(trialDir, 'level2-sample.svg'),
  bigSvg(level2Cards),
  'utf8',
)

console.log(`SuperBoard: 已生成试作卡片到 ${path.relative(root, trialDir)}`)

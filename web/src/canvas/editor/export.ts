import { getStroke } from 'perfect-freehand'
import {
  resolveNodeStyle,
  type CanvasDocument,
  type CanvasEdge,
  type CanvasNode,
  type SuperBoardStyle,
} from '../model'
import { edgeGeometry } from './edges'
import { resolveFileUrl } from '../viewer/fileResolver'
import { getAppLanguage } from '../../i18n'
import i18n from '../../i18n'

const PADDING = 64

const COLOR_TOKENS: Record<string, string> = {
  '0': '#ffffff',
  '1': '#fecaca',
  '2': '#fed7aa',
  '3': '#fef08a',
  '4': '#bbf7d0',
  '5': '#bfdbfe',
  '6': '#e9d5ff',
}

function escapeXml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}

function svgColor(value: string | undefined, fallback: string) {
  if (!value) return fallback
  if (value === 'none' || value === 'transparent') return 'none'
  if (/^(#|rgb|hsl|oklch|color\()/i.test(value)) return value
  if (value in COLOR_TOKENS) return COLOR_TOKENS[value]
  return fallback
}

function rotationOf(node: CanvasNode) {
  return node['x-superboard']?.rotation ?? 0
}

function rotateAttr(node: CanvasNode) {
  const rotation = rotationOf(node)
  if (!rotation) return ''
  const cx = node.x + node.width / 2
  const cy = node.y + node.height / 2
  return ` transform="rotate(${rotation} ${cx} ${cy})"`
}

function wrapLine(line: string, maxChars: number) {
  if (maxChars <= 0) return [line]
  const chars = Array.from(line)
  if (chars.length <= maxChars) return [line]
  const lines: string[] = []
  for (let index = 0; index < chars.length; index += maxChars) {
    lines.push(chars.slice(index, index + maxChars).join(''))
  }
  return lines
}

function markdownToText(source: string) {
  return source
    .replace(/```[a-zA-Z]*\n?/g, '')
    .split('\n')
    .map((line) =>
      line
        .replace(/^#{1,6}\s+/, '')
        .replace(/^>\s?/, '')
        .replace(/^[-*]\s+/, '• '),
    )
    .join('\n')
}

interface TextBlock {
  text: string
  fontSize: number
  color: string
  align: 'left' | 'center' | 'right'
  fontFamily: string
  muted?: boolean
}

function textBlockFor(node: CanvasNode): TextBlock | null {
  const extension = node['x-superboard']
  const style: SuperBoardStyle = extension?.style ?? {}
  const kind = extension?.kind
  if (node.type === 'text') {
    if (kind === 'markdown') {
      return {
        text: markdownToText(node.text),
        fontSize: 15,
        color: '#3f3c35',
        align: style.textAlign ?? 'left',
        fontFamily: "'Inter', 'Noto Sans SC', sans-serif",
      }
    }
    if (kind === 'pele') {
      const code = typeof extension?.code === 'string' ? extension.code : node.text
      return {
        text: markdownToText(code),
        fontSize: 13,
        color: '#3f3c35',
        align: 'left',
        fontFamily: "'JetBrains Mono', 'Consolas', monospace",
        muted: true,
      }
    }
    return {
      text: node.text,
      fontSize: style.fontSize ?? 16,
      color: svgColor(style.color, '#1d1d1d'),
      align: style.textAlign ?? 'left',
      fontFamily: style.fontFamily ?? "'Inter', 'Noto Sans SC', sans-serif",
    }
  }
  if (node.type === 'link') {
    const media = extension?.media
    const url = media?.url ?? node.url
    const label = media
      ? i18n.t('editor:exportHtml.media', { kind: media.kind })
      : i18n.t('editor:exportHtml.link')
    return {
      text: `${label}\n${url}`,
      fontSize: 13,
      color: '#6b7280',
      align: 'left',
      fontFamily: "'JetBrains Mono', 'Consolas', monospace",
      muted: true,
    }
  }
  return null
}

function nodeHasSurface(node: CanvasNode) {
  const extension = node['x-superboard']
  if (node.type === 'file') return false
  if (node.type === 'link') return extension?.media?.kind !== 'file'
  return Boolean(extension?.kind && extension.kind !== 'text')
}

function textMarkup(node: CanvasNode) {
  const block = textBlockFor(node)
  if (!block) return ''
  const padding = 16
  const lineHeight = block.fontSize * 1.45
  const maxChars = Math.max(1, Math.floor((node.width - padding * 2) / (block.fontSize * 0.62)))
  const lines = block.text.split('\n').flatMap((line) => wrapLine(line, maxChars))
  const anchor =
    block.align === 'center' ? 'middle' : block.align === 'right' ? 'end' : 'start'
  const x =
    block.align === 'center'
      ? node.x + node.width / 2
      : block.align === 'right'
        ? node.x + node.width - padding
        : node.x + padding
  const startY = node.y + padding + block.fontSize * 0.9
  const tspans = lines
    .map(
      (line, index) =>
        `<tspan x="${x}" y="${startY + index * lineHeight}">${escapeXml(line) || ' '}</tspan>`,
    )
    .join('')
  const rotation = rotateAttr(node)
  const style = resolveNodeStyle(node['x-superboard']?.style)
  const fill =
    style.background ??
    COLOR_TOKENS[node.color ?? ''] ??
    (block.muted ? '#f6f5f1' : '#ffffff')
  const fillOpacity = style.opacity * style.backgroundOpacity
  const stroke = style.borderColor ?? '#dedbd2'
  const strokeWidth = style.borderWidth ?? 1
  const strokeOpacity = style.opacity * style.borderOpacity
  const radius = Math.min(
    8 + strokeWidth,
    node.width / 2,
    node.height / 2,
  )
  const background = nodeHasSurface(node)
    ? `<rect x="${node.x}" y="${node.y}" width="${node.width}" height="${node.height}" rx="${radius}" fill="${fill}" fill-opacity="${fillOpacity}" stroke="${stroke}" stroke-opacity="${strokeOpacity}" stroke-width="${strokeWidth}"${rotation}/>`
    : ''
  return `${background}<g${rotation}><text text-anchor="${anchor}" font-family="${block.fontFamily}" font-size="${block.fontSize}" fill="${block.color}">${tspans}</text></g>`
}

function shapeMarkup(node: CanvasNode) {
  const extension = node['x-superboard']
  if (extension?.kind !== 'shape') return ''
  const style = resolveNodeStyle(extension.style)
  const shape = extension.shape ?? 'rect'
  const fill = svgColor(style.background, shape === 'line' ? 'none' : '#ffffff')
  const stroke = svgColor(style.borderColor, '#1d1d1d')
  const strokeWidth = style.borderWidth ?? 2
  const dash = style.borderDash?.length
    ? ` stroke-dasharray="${style.borderDash.join(' ')}"`
    : ''
  const opacity = style.opacity
  const rotation = rotateAttr(node)
  if (shape === 'line') {
    const flip = extension.lineFlip
    const x1 = node.x + (flip?.x ? node.width : 0)
    const y1 = node.y + (flip?.y ? node.height : 0)
    const x2 = node.x + (flip?.x ? 0 : node.width)
    const y2 = node.y + (flip?.y ? 0 : node.height)
    return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${stroke}" stroke-opacity="${opacity * style.borderOpacity}" stroke-width="${strokeWidth}"${dash}${rotation}/>`
  }

  const fillPaint = `fill="${fill}" fill-opacity="${opacity * style.backgroundOpacity}" stroke="none"`
  const strokePaint = `fill="none" stroke="${stroke}" stroke-opacity="${opacity * style.borderOpacity}" stroke-width="${strokeWidth}"${dash}`
  const paint = (attributes: string) => {
    if (shape === 'ellipse') {
      return `<ellipse cx="${node.x + node.width / 2}" cy="${node.y + node.height / 2}" rx="${Math.abs(node.width / 2)}" ry="${Math.abs(node.height / 2)}" ${attributes}${rotation}/>`
    }
    if (shape === 'diamond') {
      const points = [
        `${node.x + node.width / 2},${node.y}`,
        `${node.x + node.width},${node.y + node.height / 2}`,
        `${node.x + node.width / 2},${node.y + node.height}`,
        `${node.x},${node.y + node.height / 2}`,
      ].join(' ')
      return `<polygon points="${points}" ${attributes}${rotation}/>`
    }
    const radius = style.cornerRadius ?? 0
    return `<rect x="${node.x}" y="${node.y}" width="${node.width}" height="${node.height}" rx="${radius}" ${attributes}${rotation}/>`
  }
  return paint(fillPaint) + paint(strokePaint)
}

function drawingMarkup(node: CanvasNode) {
  const extension = node['x-superboard']
  if (extension?.kind !== 'drawing') return ''
  const rotation = rotationOf(node)
  const inner = (extension.strokes ?? [])
    .map((stroke) => {
      const outline = getStroke(stroke.points as number[][], {
        size: stroke.size,
        thinning: stroke.thinning,
        smoothing: stroke.smoothing,
        streamline: stroke.streamline,
        simulatePressure: stroke.simulatePressure,
        start: stroke.start === undefined ? undefined : { taper: stroke.start },
        end: stroke.end === undefined ? undefined : { taper: stroke.end },
      })
      if (outline.length < 3) return ''
      const d = outline
        .map(([x, y], index) => `${index === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`)
        .join(' ')
      return `<path d="${d} Z" fill="${svgColor(stroke.color, '#1d1d1d')}"/>`
    })
    .join('')
  const centerX = node.width / 2
  const centerY = node.height / 2
  return `<g transform="translate(${node.x} ${node.y})${rotation ? ` rotate(${rotation} ${centerX} ${centerY})` : ''}">${inner}</g>`
}

function groupMarkup(node: CanvasNode) {
  const extension = node['x-superboard']
  if (extension?.kind !== 'group') return ''
  const style = resolveNodeStyle(extension.style)
  const fill =
    style.background ??
    (node.color ? COLOR_TOKENS[node.color] ?? '#ffffff' : 'none')
  const stroke = style.borderColor ?? '#d9d5ca'
  const strokeWidth = style.borderWidth ?? 1.5
  const radius = (style.cornerRadius ?? 12) + strokeWidth
  const dash = style.borderDash?.length
    ? ` stroke-dasharray="${style.borderDash.join(' ')}"`
    : ''
  const label = node.type === 'group' && node.label ? node.label : ''
  const rotation = rotateAttr(node)
  const rect = `<rect x="${node.x}" y="${node.y}" width="${node.width}" height="${node.height}" rx="${radius}" fill="${fill}" fill-opacity="${style.opacity * style.backgroundOpacity}" stroke="${stroke}" stroke-opacity="${style.opacity * style.borderOpacity}" stroke-width="${strokeWidth}"${dash}${rotation}/>`
  if (!label) return rect
  const bar = `<text x="${node.x + 8}" y="${node.y - 10}" font-family="'Inter', sans-serif" font-size="14" fill="#6b7280">${escapeXml(label)}</text>`
  return rect + bar
}

function nodeMarkup(node: CanvasNode) {
  const kind = node['x-superboard']?.kind
  if (kind === 'shape') return shapeMarkup(node)
  if (kind === 'drawing') return drawingMarkup(node)
  if (kind === 'group') return groupMarkup(node)
  return textMarkup(node)
}

function arrowHead(
  tip: { x: number; y: number },
  from: { x: number; y: number },
  color: string,
) {
  const angle = Math.atan2(tip.y - from.y, tip.x - from.x)
  const length = 12
  const width = 5
  const left = {
    x: tip.x - Math.cos(angle) * length - Math.sin(angle) * width,
    y: tip.y - Math.sin(angle) * length + Math.cos(angle) * width,
  }
  const right = {
    x: tip.x - Math.cos(angle) * length + Math.sin(angle) * width,
    y: tip.y - Math.sin(angle) * length - Math.cos(angle) * width,
  }
  return `<polygon points="${tip.x},${tip.y} ${left.x},${left.y} ${right.x},${right.y}" fill="${color}"/>`
}

function edgeMarkup(edge: CanvasEdge, nodes: Map<string, CanvasNode>) {
  const geometry = edgeGeometry(edge, nodes)
  if (!geometry) return ''
  const { start, end, controlA, controlB } = geometry
  const color = svgColor(edge.color, '#1d1d1d')
  const line = `<path d="M ${start.x} ${start.y} C ${controlA.x} ${controlA.y} ${controlB.x} ${controlB.y} ${end.x} ${end.y}" fill="none" stroke="${color}" stroke-width="1.8"/>`
  let markup = line
  if (edge.toEnd !== 'none') markup += arrowHead(end, controlB, color)
  if (edge.fromEnd === 'arrow') markup += arrowHead(start, controlA, color)
  if (edge.label) {
    const t = 0.5
    const inverse = 1 - t
    const midX =
      inverse ** 3 * start.x +
      3 * inverse ** 2 * t * controlA.x +
      3 * inverse * t ** 2 * controlB.x +
      t ** 3 * end.x
    const midY =
      inverse ** 3 * start.y +
      3 * inverse ** 2 * t * controlA.y +
      3 * inverse * t ** 2 * controlB.y +
      t ** 3 * end.y
    const text = edge.label.replace(/\n/g, ' ')
    const width = Math.max(24, Array.from(text).length * 8 + 16)
    const height = 20
    markup += `<rect x="${midX - width / 2}" y="${midY - height / 2}" width="${width}" height="${height}" rx="4" fill="${color}"/>`
    markup += `<text x="${midX}" y="${midY + 4}" text-anchor="middle" font-family="'Inter', 'Noto Sans SC', sans-serif" font-size="12" fill="#fff">${escapeXml(text)}</text>`
  }
  return markup
}

export function buildCanvasSvg(canvas: CanvasDocument) {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const node of canvas.nodes) {
    minX = Math.min(minX, node.x)
    minY = Math.min(minY, node.y)
    maxX = Math.max(maxX, node.x + node.width)
    maxY = Math.max(maxY, node.y + node.height)
  }
  if (!Number.isFinite(minX)) {
    minX = 0
    minY = 0
    maxX = 640
    maxY = 480
  }
  const width = Math.max(1, Math.ceil(maxX - minX + PADDING * 2))
  const height = Math.max(1, Math.ceil(maxY - minY + PADDING * 2))
  const offsetX = PADDING - minX
  const offsetY = PADDING - minY
  const nodes = new Map(canvas.nodes.map((node) => [node.id, node]))
  const body = [
    ...canvas.nodes.map(nodeMarkup),
    ...canvas.edges.map((edge) => edgeMarkup(edge, nodes)),
  ].join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="${width}" height="${height}" fill="#faf9f5"/><g transform="translate(${offsetX} ${offsetY})">${body}</g></svg>`
}

export function exportFilename(canvas: CanvasDocument, extension: string) {
  const slug = canvas['x-superboard']?.meta.slug || 'superboard'
  return `${slug}.${extension}`
}

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const anchorElement = document.createElement('a')
  anchorElement.href = url
  anchorElement.download = name
  anchorElement.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function buildCanvasHtml(canvas: CanvasDocument) {
  const svg = buildCanvasSvg(canvas)
  const title = escapeXml(canvas['x-superboard']?.meta.title || 'SuperBoard')
  return `<!doctype html>
<html lang="${getAppLanguage()}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title}</title>
<style>
html,body{margin:0;height:100%;background:#faf9f5;overflow:hidden;font-family:system-ui,sans-serif}
#viewport{position:fixed;inset:0;overflow:hidden;touch-action:none;cursor:grab}
#viewport:active{cursor:grabbing}
#stage{position:absolute;left:0;top:0;transform-origin:0 0;will-change:transform}
#stage svg{display:block}
#hint{position:fixed;left:12px;bottom:12px;padding:5px 9px;border-radius:7px;background:rgba(255,253,248,.92);color:#6f6d66;font-size:12px;pointer-events:none}
</style>
</head>
<body>
<div id="viewport"><div id="stage">${svg}</div></div>
<div id="hint">${i18n.t('editor:exportHtml.hint')}</div>
<script>
(function(){
  var viewport=document.getElementById('viewport');
  var stage=document.getElementById('stage');
  var svg=stage.querySelector('svg');
  var scale=1,tx=0,ty=0,drag=null;
  function apply(){stage.style.transform='translate('+tx+'px,'+ty+'px) scale('+scale+')';}
  function fit(){
    var w=svg.width.baseVal.value||svg.clientWidth||1;
    var h=svg.height.baseVal.value||svg.clientHeight||1;
    scale=Math.min(1,(window.innerWidth-80)/w,(window.innerHeight-80)/h);
    tx=(window.innerWidth-w*scale)/2;
    ty=(window.innerHeight-h*scale)/2;
    apply();
  }
  function zoom(factor,cx,cy){
    var next=Math.min(8,Math.max(0.05,scale*factor));
    var wx=(cx-tx)/scale, wy=(cy-ty)/scale;
    tx=cx-wx*next; ty=cy-wy*next; scale=next; apply();
  }
  viewport.addEventListener('wheel',function(e){
    e.preventDefault();
    zoom(e.deltaY<0?1.1:1/1.1,e.clientX,e.clientY);
  },{passive:false});
  viewport.addEventListener('pointerdown',function(e){
    if(e.button!==0)return;
    drag={x:e.clientX,y:e.clientY,tx:tx,ty:ty};
    viewport.setPointerCapture(e.pointerId);
  });
  viewport.addEventListener('pointermove',function(e){
    if(!drag)return;
    tx=drag.tx+e.clientX-drag.x; ty=drag.ty+e.clientY-drag.y; apply();
  });
  viewport.addEventListener('pointerup',function(){drag=null;});
  viewport.addEventListener('pointercancel',function(){drag=null;});
  viewport.addEventListener('dblclick',fit);
  fit();
  window.addEventListener('resize',fit);
})();
</script>
</body>
</html>`
}

export function downloadCanvasHtml(canvas: CanvasDocument) {
  const html = buildCanvasHtml(canvas)
  download(new Blob([html], { type: 'text/html;charset=utf-8' }), exportFilename(canvas, 'html'))
}

type ViewerLike = {
  container?: { get: (key: unknown) => unknown }
}

export type AttachmentAction = 'embed' | 'copy' | 'skip'

export interface ExportAttachment {
  source: string
  target: string
}

export interface ExportPayload {
  html: string
  attachments: ExportAttachment[]
}

async function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

function collectDocumentCss() {
  const chunks: string[] = []
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      for (const rule of Array.from(sheet.cssRules)) chunks.push(rule.cssText)
    } catch {
      // Cross-origin stylesheet; skip.
    }
  }
  return chunks.join('\n')
}

async function applyAttachmentActions(
  root: HTMLElement,
  canvas: CanvasDocument,
  actions: Map<string, AttachmentAction> | undefined,
  attachments: ExportAttachment[],
) {
  const sources = Array.from(
    root.querySelectorAll<HTMLElement>('img,video,source'),
  )
  const seen = new Set<string>()
  for (const node of canvas.nodes) {
    const media = node['x-superboard']?.media
    if (media?.kind !== 'file' || !media.file) continue
    const url = await resolveFileUrl(media.file)
    if (!url) continue
    const action = actions?.get(media.file) ?? (actions ? 'skip' : 'embed')
    const targets = sources.filter(
      (element) => element.getAttribute('src') === url,
    )
    if (action === 'embed') {
      try {
        const blob = await (await fetch(url)).blob()
        const data = await blobToDataUrl(blob)
        targets.forEach((element) => element.setAttribute('src', data))
      } catch {
        // Keep the original source.
      }
    } else if (action === 'copy') {
      const safe = (media.name || media.file.split('/').pop() || 'file').replace(
        /[^\w.\-]+/g,
        '_',
      )
      targets.forEach((element) => element.setAttribute('src', `files/${safe}`))
      if (!seen.has(media.file)) {
        seen.add(media.file)
        attachments.push({ source: media.file, target: safe })
      }
    } else if (action === 'skip') {
      targets.forEach((element) => {
        element.removeAttribute('src')
        element.setAttribute('data-missing-attachment', media.name ?? '')
      })
    }
  }
}

function snapshotRoot(root: HTMLElement) {
  const clone = root.cloneNode(true) as HTMLElement
  // The main canvas is no longer used for node content. Grids are rebuilt by
  // the exported page so they stay infinite while panning and zooming.
  clone
    .querySelectorAll('canvas, .sb-canvas-grid-layer')
    .forEach((element) => element.remove())
  clone
    .querySelectorAll('.JSON-Canvas-Viewer')
    .forEach((element) => {
      ;(element as HTMLElement).style.backgroundColor = 'transparent'
    })
  clone.style.background = 'transparent'
  clone
    .querySelectorAll(
      '.JCV-controls, .JCV-minimap-container, .JCV-debug-panel, .JCV-prevention-banner, .JCV-click-layer, .JCV-overlay-border',
    )
    .forEach((element) => element.remove())
  return clone
}

interface SnapshotOptions {
  grid: boolean
  background: string
  scale: number
  offsetX: number
  offsetY: number
}

function buildSnapshotHtml(
  clone: HTMLElement,
  title: string,
  options: SnapshotOptions,
) {
  const css = collectDocumentCss()
  return `<!doctype html>
<html lang="${getAppLanguage()}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeXml(title)}</title>
<style>${css}</style>
<style>
html,body{margin:0;height:100%;overflow:hidden;background:${options.background}}
#sb-export-grid{position:fixed;inset:0;z-index:0;pointer-events:none;background-image:linear-gradient(to right,rgba(0,0,0,0.10) 1px,transparent 1px),linear-gradient(to bottom,rgba(0,0,0,0.10) 1px,transparent 1px),linear-gradient(to right,rgba(0,0,0,0.16) 1px,transparent 1px),linear-gradient(to bottom,rgba(0,0,0,0.16) 1px,transparent 1px)}
#sb-export-stage{position:absolute;inset:0;z-index:1;transform-origin:0 0;cursor:default;touch-action:none}
#sb-export-stage.is-panning{cursor:grabbing}
#sb-export-stage .sb-export-selected{outline:2px solid #2f80ed;outline-offset:2px}
</style>
</head>
<body>
${options.grid ? '<div id="sb-export-grid"></div>' : ''}
<div id="sb-export-stage">${clone.outerHTML}</div>
<script>
(function(){
  var stage=document.getElementById('sb-export-stage');
  var grid=document.getElementById('sb-export-grid');
  var baseScale=${options.scale},baseOffsetX=${options.offsetX},baseOffsetY=${options.offsetY};
  var scale=1,tx=0,ty=0,drag=null,selected=null;
  function applyGrid(){
    if(!grid)return;
    var step=10*baseScale*scale;
    while(step<8)step*=2;
    var major=step*5;
    var ox=tx+scale*baseOffsetX;
    var oy=ty+scale*baseOffsetY;
    grid.style.backgroundSize=step+'px '+step+'px,'+step+'px '+step+'px,'+major+'px '+major+'px,'+major+'px '+major+'px';
    grid.style.backgroundPosition=ox+'px '+oy+'px,'+ox+'px '+oy+'px,'+ox+'px '+oy+'px,'+ox+'px '+oy+'px';
  }
  function apply(){stage.style.transform='translate('+tx+'px,'+ty+'px) scale('+scale+')';applyGrid();}
  function isScrollable(el){
    while(el&&el!==document.body){
      var style=getComputedStyle(el);
      if(/(auto|scroll)/.test(style.overflowY)&&el.scrollHeight>el.clientHeight+1)return true;
      el=el.parentElement;
    }
    return false;
  }
  window.addEventListener('wheel',function(e){
    if(e.ctrlKey||e.metaKey){
      e.preventDefault();
      var factor=e.deltaY<0?1.1:1/1.1;
      var next=Math.min(20,Math.max(0.05,scale*factor));
      var wx=(e.clientX-tx)/scale, wy=(e.clientY-ty)/scale;
      tx=e.clientX-wx*next; ty=e.clientY-wy*next; scale=next; apply();
      return;
    }
    if(isScrollable(e.target))return;
    e.preventDefault();
    tx-=e.deltaX; ty-=e.deltaY; apply();
  },{passive:false});
  window.addEventListener('pointerdown',function(e){
    if(e.button===1||e.button===2){
      e.preventDefault();
      e.stopPropagation();
      drag={x:e.clientX,y:e.clientY,tx:tx,ty:ty};
      stage.classList.add('is-panning');
      return;
    }
    if(e.button!==0)return;
    var block=e.target.closest('.JCV-overlay-container,[data-node-id]');
    if(selected)selected.classList.remove('sb-export-selected');
    selected=block||null;
    if(selected)selected.classList.add('sb-export-selected');
  },true);
  window.addEventListener('pointermove',function(e){
    if(!drag)return;
    tx=drag.tx+e.clientX-drag.x; ty=drag.ty+e.clientY-drag.y; apply();
  });
  window.addEventListener('pointerup',function(){
    drag=null;
    stage.classList.remove('is-panning');
  });
  window.addEventListener('contextmenu',function(e){e.preventDefault();});
  apply();
})();
</script>
</body>
</html>`
}

function frame() {
  return new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
}

export async function buildExportPayload(
  canvas: CanvasDocument,
  viewer: ViewerLike | undefined,
  actions?: Map<string, AttachmentAction>,
): Promise<ExportPayload> {
  if (!viewer?.container) throw new Error(i18n.t('editor:exportHtml.notReady'))
  const { internal } = await import(
    '../../vendor/json-canvas-viewer/src/index.ts'
  )
  const dm = viewer.container.get(internal.DataManager as never) as {
    data: {
      offsetX: number
      offsetY: number
      scale: number
      container: HTMLDivElement
    }
  }
  const controller = viewer.container.get(internal.Controller as never) as {
    refresh: () => void
  }
  const root = dm.data.container.closest<HTMLElement>('.canvas-viewer-wrap')
  if (!root) throw new Error(i18n.t('editor:exportHtml.noContainer'))
  const old = {
    offsetX: dm.data.offsetX,
    offsetY: dm.data.offsetY,
    scale: dm.data.scale,
  }
  const nodes = canvas.nodes
  const minX = nodes.length ? Math.min(...nodes.map((node) => node.x)) : 0
  const minY = nodes.length ? Math.min(...nodes.map((node) => node.y)) : 0
  const maxX = nodes.length
    ? Math.max(...nodes.map((node) => node.x + node.width))
    : 1
  const maxY = nodes.length
    ? Math.max(...nodes.map((node) => node.y + node.height))
    : 1
  const width = dm.data.container.clientWidth
  const height = dm.data.container.clientHeight
  const boardWidth = Math.max(1, maxX - minX)
  const boardHeight = Math.max(1, maxY - minY)
  const scale = Math.min(
    1,
    Math.max(0.05, (width - 80) / boardWidth),
    Math.max(0.05, (height - 80) / boardHeight),
  )
  try {
    dm.data.scale = scale
    dm.data.offsetX = (width - boardWidth * scale) / 2 - minX * scale
    dm.data.offsetY = (height - boardHeight * scale) / 2 - minY * scale
    controller.refresh()
    await frame()
    await frame()
    const clone = snapshotRoot(root)
    const attachments: ExportAttachment[] = []
    await applyAttachmentActions(clone, canvas, actions, attachments)
    const html = buildSnapshotHtml(
      clone,
      canvas['x-superboard']?.meta.title || 'SuperBoard',
      {
        grid: canvas['x-superboard']?.settings?.grid !== 'none',
        background:
          getComputedStyle(dm.data.container).backgroundColor || '#faf9f5',
        scale: dm.data.scale,
        offsetX: dm.data.offsetX,
        offsetY: dm.data.offsetY,
      },
    )
    return { html, attachments }
  } finally {
    dm.data.offsetX = old.offsetX
    dm.data.offsetY = old.offsetY
    dm.data.scale = old.scale
    controller.refresh()
  }
}

export async function downloadCanvasHtmlSnapshot(
  canvas: CanvasDocument,
  viewer: ViewerLike | undefined,
  actions?: Map<string, AttachmentAction>,
) {
  const payload = await buildExportPayload(canvas, viewer, actions)
  download(
    new Blob([payload.html], { type: 'text/html;charset=utf-8' }),
    exportFilename(canvas, 'html'),
  )
}

export async function exportCanvasFolder(
  canvas: CanvasDocument,
  viewer: ViewerLike | undefined,
  actions?: Map<string, AttachmentAction>,
) {
  const picker = (window as unknown as {
    showDirectoryPicker?: (options?: {
      mode?: string
    }) => Promise<FileSystemDirectoryHandle>
  }).showDirectoryPicker
  if (!picker) throw new Error(i18n.t('editor:exportHtml.folderUnsupported'))
  const payload = await buildExportPayload(canvas, viewer, actions)
  const directory = await picker({ mode: 'readwrite' })
  const filesDir = await directory.getDirectoryHandle('files', { create: true })
  for (const item of payload.attachments) {
    const url = await resolveFileUrl(item.source)
    if (!url) continue
    const blob = await (await fetch(url)).blob()
    const handle = await filesDir.getFileHandle(item.target, { create: true })
    const writable = await handle.createWritable()
    await writable.write(blob)
    await writable.close()
  }
  const handle = await directory.getFileHandle('index.html', { create: true })
  const writable = await handle.createWritable()
  await writable.write(payload.html)
  await writable.close()
}

export function downloadCanvasSvg(canvas: CanvasDocument) {
  const svg = buildCanvasSvg(canvas)
  download(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }), exportFilename(canvas, 'svg'))
}

export function downloadCanvasPng(canvas: CanvasDocument) {
  const svg = buildCanvasSvg(canvas)
  const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const image = new Image()
  image.onload = () => {
    const sourceWidth = image.naturalWidth || image.width
    const sourceHeight = image.naturalHeight || image.height
    const scale = Math.min(2, 6000 / Math.max(1, sourceWidth, sourceHeight))
    const canvasElement = document.createElement('canvas')
    canvasElement.width = Math.max(1, Math.round(sourceWidth * scale))
    canvasElement.height = Math.max(1, Math.round(sourceHeight * scale))
    const ctx = canvasElement.getContext('2d')
    if (ctx) {
      ctx.fillStyle = '#faf9f5'
      ctx.fillRect(0, 0, canvasElement.width, canvasElement.height)
      ctx.drawImage(image, 0, 0, canvasElement.width, canvasElement.height)
      canvasElement.toBlob((png) => {
        if (png) download(png, exportFilename(canvas, 'png'))
      }, 'image/png')
    }
    URL.revokeObjectURL(url)
  }
  image.onerror = () => URL.revokeObjectURL(url)
  image.src = url
}

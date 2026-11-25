import type { CanvasDocument } from '../model'
import { resolveFileUrl } from '../viewer/fileResolver'
import { getAppLanguage } from '../../i18n'
import i18n from '../../i18n'

function escapeXml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
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

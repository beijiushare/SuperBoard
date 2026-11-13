import { internal } from '../../vendor/json-canvas-viewer/src/index.ts'
import type { BoardListItem, BoardScope } from '../../shared/board/types'
import type { CanvasDocument, CanvasEdge, CanvasNode } from '../model'
import type { CanvasViewerHandle } from '../viewer/CanvasViewer'

export interface CanvasListItem extends BoardListItem {
  scope: BoardScope
}

export interface Viewport {
  offsetX: number
  offsetY: number
  scale: number
}

export interface Clipboard {
  nodes: CanvasNode[]
  edges: CanvasEdge[]
}

export type ViewerInternals = {
  container?: { get: (key: unknown) => unknown }
}

export type DataManagerLike = {
  data: Viewport & {
    container: HTMLDivElement
    nodeMap: Record<string, { ref: CanvasNode }>
  }
}

export type ControllerLike = {
  refresh: () => void
}

export const HISTORY_LIMIT = 100
export const PASTE_OFFSET = 24
export const AUTOSAVE_DELAY = 1200

export type SaveState = 'saved' | 'dirty' | 'saving' | 'error'

export type BoardDialogState =
  | { mode: 'create'; folder?: string }
  | { mode: 'rename'; board: BoardListItem }

export interface CanvasMenuState {
  x: number
  y: number
  worldX: number
  worldY: number
  nodeId: string | null
  edgeId?: string | null
}

export function readViewport(handle: CanvasViewerHandle | null): Viewport | null {
  try {
    const viewer = handle?.viewer as ViewerInternals | undefined
    if (!viewer?.container) return null
    const dm = viewer.container.get(internal.DataManager as never) as DataManagerLike
    return { offsetX: dm.data.offsetX, offsetY: dm.data.offsetY, scale: dm.data.scale }
  } catch {
    return null
  }
}

export function writeViewport(handle: CanvasViewerHandle | null, viewport: Viewport) {
  try {
    const viewer = handle?.viewer as ViewerInternals | undefined
    if (!viewer?.container) return
    const dm = viewer.container.get(internal.DataManager as never) as DataManagerLike
    const controller = viewer.container.get(internal.Controller as never) as ControllerLike
    dm.data.offsetX = viewport.offsetX
    dm.data.offsetY = viewport.offsetY
    dm.data.scale = viewport.scale
    controller.refresh()
  } catch {
    // 查看器尚未挂载，忽略
  }
}

export function updateEditorUrl(
  slug: string | null,
  scope: BoardScope,
  tree: boolean,
) {
  const params = new URLSearchParams(window.location.search)
  if (tree) params.set('tree', '1')
  else params.delete('tree')
  if (slug) params.set('board', slug)
  else params.delete('board')
  if (scope === 'private') params.set('scope', 'private')
  else params.delete('scope')
  const query = params.toString()
  window.history.replaceState(
    null,
    '',
    `${window.location.pathname}${query ? `?${query}` : ''}`,
  )
}

export function normalizeMarkdownLocks(document: CanvasDocument) {
  for (const node of document.nodes) {
    const extension = node['x-superboard']
    if (extension?.kind === 'markdown') extension.markdownLocked = true
  }
}

export function normalizeMediaUrl(input: string) {
  const iframe = input.match(/<iframe[^>]*\bsrc\s*=\s*["']([^"']+)["']/i)
  const raw = (iframe?.[1] ?? input).trim()
  return raw.replaceAll('&amp;', '&')
}

export function nextId(existing: Set<string>, base: string) {
  let id = `${base}-copy`
  let index = 1
  while (existing.has(id)) {
    index += 1
    id = `${base}-copy-${index}`
  }
  existing.add(id)
  return id
}

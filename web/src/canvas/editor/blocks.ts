import type { CanvasNode } from '../model'

export const BLOCK_KINDS = ['text', 'markdown', 'pele', 'schedule', 'media'] as const

export const DEFAULT_BLOCK_SIZES = {
  text: { width: 360, height: 220 },
  markdown: { width: 360, height: 220 },
  pele: { width: 580, height: 380 },
  schedule: { width: 900, height: 600 },
  media: { width: 480, height: 320 },
} as const

export function blockKind(node: CanvasNode) {
  const kind = node['x-superboard']?.kind
  if (
    kind === 'markdown' ||
    kind === 'pele' ||
    kind === 'schedule' ||
    kind === 'media'
  ) {
    return kind
  }
  if (node.type === 'text' && (!kind || kind === 'text')) return 'text'
  return null
}

export function isBlockNode(node: CanvasNode) {
  return blockKind(node) !== null
}

export function isRatioLocked(node: CanvasNode) {
  const kind = blockKind(node)
  if (!kind) return false
  const locked = node['x-superboard']?.ratioLocked
  if (locked !== undefined) return locked
  return kind !== 'text' && kind !== 'schedule'
}

export function contentScale(node: CanvasNode) {
  return node['x-superboard']?.contentScale ?? 1
}

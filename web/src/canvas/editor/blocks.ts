import type { CanvasNode } from '../model'

export const BLOCK_KINDS = ['text', 'markdown', 'pele', 'media'] as const

export function blockKind(node: CanvasNode) {
  const kind = node['x-superboard']?.kind
  if (kind === 'markdown' || kind === 'pele' || kind === 'media') return kind
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
  return kind !== 'text'
}

export function contentScale(node: CanvasNode) {
  return node['x-superboard']?.contentScale ?? 1
}

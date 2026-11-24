import type { CanvasNode } from '../model'
import { DEFAULT_PREFERENCES } from './preferences'

export const BLOCK_KINDS = ['text', 'markdown', 'pele', 'schedule', 'media', 'tree'] as const

export type BlockKind = (typeof BLOCK_KINDS)[number]
export type BlockEditor = 'text' | 'markdown' | 'pele' | 'schedule' | 'media' | 'tree'

export const DEFAULT_BLOCK_SIZES = {
  text: { width: 240, height: 36 },
  markdown: { width: 420, height: 220 },
  pele: { width: 580, height: 380 },
  schedule: { width: 900, height: 600 },
  media: { width: 480, height: 320 },
  tree: { width: 372, height: 128 },
} as const

export const SHAPE_DEFAULT_SIZE = { width: 160, height: 160 } as const

export interface BlockDefinition {
  kind: BlockKind
  defaultSize: { width: number; height: number }
  ratioLocked: boolean
  /** Whether the floating bar may toggle the ratio lock. */
  ratioLockable: boolean
  scalable: boolean
  editor: BlockEditor
  focusable: boolean
}

export const BLOCK_DEFINITIONS: Record<BlockKind, BlockDefinition> = {
  text: {
    kind: 'text',
    defaultSize: DEFAULT_BLOCK_SIZES.text,
    ratioLocked: false,
    ratioLockable: true,
    scalable: true,
    editor: 'text',
    focusable: false,
  },
  markdown: {
    kind: 'markdown',
    defaultSize: DEFAULT_BLOCK_SIZES.markdown,
    ratioLocked: true,
    ratioLockable: true,
    scalable: true,
    editor: 'markdown',
    focusable: true,
  },
  pele: {
    kind: 'pele',
    defaultSize: DEFAULT_BLOCK_SIZES.pele,
    ratioLocked: true,
    // A diagram's size follows its natural ratio, so there is nothing to unlock.
    ratioLockable: false,
    scalable: true,
    editor: 'pele',
    focusable: false,
  },
  schedule: {
    kind: 'schedule',
    defaultSize: DEFAULT_BLOCK_SIZES.schedule,
    ratioLocked: true,
    ratioLockable: true,
    scalable: true,
    editor: 'schedule',
    focusable: false,
  },
  media: {
    kind: 'media',
    defaultSize: DEFAULT_BLOCK_SIZES.media,
    ratioLocked: true,
    ratioLockable: true,
    scalable: true,
    editor: 'media',
    focusable: false,
  },
  tree: {
    kind: 'tree',
    defaultSize: DEFAULT_BLOCK_SIZES.tree,
    // The block is sized by its cards, so there is no ratio to lock or unlock.
    ratioLocked: true,
    ratioLockable: false,
    scalable: false,
    editor: 'tree',
    focusable: false,
  },
}

export function blockKind(node: CanvasNode): BlockKind | null {
  const kind = node['x-superboard']?.kind
  if (kind && BLOCK_KINDS.includes(kind as BlockKind)) return kind as BlockKind
  if (node.type === 'text' && (!kind || kind === 'text')) return 'text'
  return null
}

export function blockDefinition(node: CanvasNode) {
  const kind = blockKind(node)
  return kind ? BLOCK_DEFINITIONS[kind] : null
}

export function blockEditor(node: CanvasNode): BlockEditor | null {
  return blockDefinition(node)?.editor ?? null
}

export function isBlockNode(node: CanvasNode) {
  return blockKind(node) !== null
}

export function isShapeNode(node: CanvasNode) {
  return node['x-superboard']?.kind === 'shape'
}

export function isRoundedRect(node: CanvasNode) {
  const extension = node['x-superboard']
  if (extension?.kind !== 'shape' || extension.shape !== 'rect') return false
  return (
    extension.roundedRect === true ||
    (extension.style?.cornerRadius ?? 0) > 0 ||
    DEFAULT_PREFERENCES.shapeCornerRadius > 0
  )
}

export function isActionableNode(node: CanvasNode) {
  return isBlockNode(node) || isShapeNode(node)
}

/**
 * Blocks whose size is derived from their content. Their size is rewritten on
 * every layout pass, so resize handles and the rotate handle would be a lie.
 */
export function isAutoSizedBlock(node: CanvasNode) {
  return blockKind(node) === 'tree'
}

export function isRatioLocked(node: CanvasNode) {
  const definition = blockDefinition(node)
  const locked = node['x-superboard']?.ratioLocked
  if (isShapeNode(node)) return locked ?? false
  if (!definition) return false
  if (!definition.ratioLockable) return true
  return locked !== undefined ? locked : definition.ratioLocked
}

export function contentScale(node: CanvasNode) {
  return node['x-superboard']?.contentScale ?? 1
}

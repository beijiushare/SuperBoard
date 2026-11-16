import type { CanvasNode } from '../model'

export const BLOCK_KINDS = ['text', 'markdown', 'pele', 'schedule', 'media'] as const

export type BlockKind = (typeof BLOCK_KINDS)[number]
export type BlockEditor = 'text' | 'markdown' | 'pele' | 'schedule' | 'media'

export const DEFAULT_BLOCK_SIZES = {
  text: { width: 360, height: 220 },
  markdown: { width: 360, height: 220 },
  pele: { width: 580, height: 380 },
  schedule: { width: 900, height: 600 },
  media: { width: 480, height: 320 },
} as const

export interface BlockDefinition {
  kind: BlockKind
  label: string
  defaultSize: { width: number; height: number }
  ratioLocked: boolean
  scalable: boolean
  editor: BlockEditor
  focusable: boolean
}

export const BLOCK_DEFINITIONS: Record<BlockKind, BlockDefinition> = {
  text: {
    kind: 'text',
    label: '文本',
    defaultSize: DEFAULT_BLOCK_SIZES.text,
    ratioLocked: false,
    scalable: true,
    editor: 'text',
    focusable: false,
  },
  markdown: {
    kind: 'markdown',
    label: 'Markdown',
    defaultSize: DEFAULT_BLOCK_SIZES.markdown,
    ratioLocked: true,
    scalable: true,
    editor: 'markdown',
    focusable: true,
  },
  pele: {
    kind: 'pele',
    label: 'Pele 图表',
    defaultSize: DEFAULT_BLOCK_SIZES.pele,
    ratioLocked: true,
    scalable: true,
    editor: 'pele',
    focusable: false,
  },
  schedule: {
    kind: 'schedule',
    label: '日程',
    defaultSize: DEFAULT_BLOCK_SIZES.schedule,
    ratioLocked: true,
    scalable: true,
    editor: 'schedule',
    focusable: false,
  },
  media: {
    kind: 'media',
    label: '媒体',
    defaultSize: DEFAULT_BLOCK_SIZES.media,
    ratioLocked: true,
    scalable: true,
    editor: 'media',
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

export function isRatioLocked(node: CanvasNode) {
  const definition = blockDefinition(node)
  if (!definition) return false
  const locked = node['x-superboard']?.ratioLocked
  return locked !== undefined ? locked : definition.ratioLocked
}

export function contentScale(node: CanvasNode) {
  return node['x-superboard']?.contentScale ?? 1
}

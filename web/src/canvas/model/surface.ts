import type { CanvasNode } from './types'

/** Outer block radius used by the DOM surface and exported HTML. */
export const BLOCK_SURFACE_RADIUS = 8
/** Default group radius. */
export const GROUP_SURFACE_RADIUS = 12

/** Nodes that render their background and border through a shared surface. */
export function nodeSupportsSurface(node: CanvasNode) {
  const extension = node['x-superboard']
  if (extension?.kind === 'drawing') return false
  if (node.type === 'file') return false
  if (node.type === 'link' && extension?.media?.kind === 'file') return false
  return true
}

/** Surface nodes that can paint a background (lines have none). */
export function nodeSupportsBackground(node: CanvasNode) {
  if (!nodeSupportsSurface(node)) return false
  const extension = node['x-superboard']
  return !(extension?.kind === 'shape' && extension.shape === 'line')
}

/** CSS color with an alpha percentage, used by DOM surfaces. */
export function colorWithOpacity(color: string, opacity: number) {
  return `color-mix(in srgb, ${color} ${Math.max(0, Math.min(1, opacity)) * 100}%, transparent)`
}

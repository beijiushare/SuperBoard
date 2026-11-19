import type { CSSProperties } from 'react'
import type { CanvasNode } from '../model'

export interface Marquee {
  left: number
  top: number
  width: number
  height: number
}

export function hasIframeContent(node: CanvasNode) {
  if (node['x-superboard']?.kind === 'schedule') return true
  if (node['x-superboard']?.media?.kind === 'iframe') return true
  return node.type === 'text' && /<iframe\b/i.test(node.text)
}

export function isAdditiveSelection(event: {
  shiftKey: boolean
  metaKey: boolean
  ctrlKey: boolean
}) {
  return event.shiftKey || event.metaKey || event.ctrlKey
}

export function screenRect(
  node: CanvasNode,
  offsetX: number,
  offsetY: number,
  scale: number,
) {
  return {
    left: offsetX + node.x * scale,
    top: offsetY + node.y * scale,
    width: node.width * scale,
    height: node.height * scale,
  }
}

export function screenStyle(
  node: CanvasNode,
  offsetX: number,
  offsetY: number,
  scale: number,
): CSSProperties {
  const rect = screenRect(node, offsetX, offsetY, scale)
  const rotation = node['x-superboard']?.rotation
  return rotation
    ? {
        ...rect,
        transform: `rotate(${rotation}deg)`,
        transformOrigin: 'center center',
      }
    : rect
}

export function intersects(a: Marquee, b: Marquee) {
  return (
    a.left < b.left + b.width &&
    a.left + a.width > b.left &&
    a.top < b.top + b.height &&
    a.top + a.height > b.top
  )
}

export interface WorldRect {
  left: number
  top: number
  right: number
  bottom: number
}

interface ViewportSource {
  container: HTMLElement
  offsetX: number
  offsetY: number
  scale: number
}

interface CullableNode {
  x: number
  y: number
  width: number
  height: number
}

export function viewportWorldRect(
  source: ViewportSource,
  paddingPx = 80,
): WorldRect {
  const width = source.container.clientWidth
  const height = source.container.clientHeight
  if (width <= 0 || height <= 0) {
    return {
      left: -Infinity,
      top: -Infinity,
      right: Infinity,
      bottom: Infinity,
    }
  }
  const scale = source.scale || 1
  const padding = paddingPx / scale
  const left = -source.offsetX / scale - padding
  const top = -source.offsetY / scale - padding
  return {
    left,
    top,
    right: left + width / scale + padding * 2,
    bottom: top + height / scale + padding * 2,
  }
}

export function nodeWorldRect(
  node: CullableNode,
  rotation = 0,
  padding = 0,
): WorldRect {
  const centerX = node.x + node.width / 2
  const centerY = node.y + node.height / 2
  if (!rotation) {
    return {
      left: node.x - padding,
      top: node.y - padding,
      right: node.x + node.width + padding,
      bottom: node.y + node.height + padding,
    }
  }
  const radians = (rotation * Math.PI) / 180
  const cos = Math.abs(Math.cos(radians))
  const sin = Math.abs(Math.sin(radians))
  const halfWidth = (cos * node.width + sin * node.height) / 2 + padding
  const halfHeight = (sin * node.width + cos * node.height) / 2 + padding
  return {
    left: centerX - halfWidth,
    top: centerY - halfHeight,
    right: centerX + halfWidth,
    bottom: centerY + halfHeight,
  }
}

export function intersectsViewport(node: WorldRect, viewport: WorldRect) {
  return (
    node.left <= viewport.right &&
    node.right >= viewport.left &&
    node.top <= viewport.bottom &&
    node.bottom >= viewport.top
  )
}

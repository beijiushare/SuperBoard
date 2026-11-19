import type { CanvasNode, CanvasSide, SuperBoardStroke } from '../model'

export function distanceToSegment(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
) {
  const dx = bx - ax
  const dy = by - ay
  const lengthSquared = dx * dx + dy * dy
  if (lengthSquared === 0) return Math.hypot(px - ax, py - ay)
  let t = ((px - ax) * dx + (py - ay) * dy) / lengthSquared
  t = Math.max(0, Math.min(1, t))
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy))
}

export function strokeHit(
  stroke: SuperBoardStroke,
  node: CanvasNode,
  x: number,
  y: number,
  tolerance: number,
) {
  const points = stroke.points
  const radius = stroke.size / 2 + tolerance
  if (points.length === 1) {
    return (
      Math.hypot(x - (node.x + points[0][0]), y - (node.y + points[0][1])) <=
      radius
    )
  }
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1]
    const current = points[index]
    const distance = distanceToSegment(
      x,
      y,
      node.x + previous[0],
      node.y + previous[1],
      node.x + current[0],
      node.y + current[1],
    )
    if (distance <= radius) return true
  }
  return false
}

export function closestSide(node: CanvasNode, x: number, y: number): CanvasSide {
  const distances = {
    top: Math.abs(y - node.y),
    right: Math.abs(x - (node.x + node.width)),
    bottom: Math.abs(y - (node.y + node.height)),
    left: Math.abs(x - node.x),
  }
  return (Object.keys(distances) as CanvasSide[]).reduce((best, side) =>
    distances[side] < distances[best] ? side : best,
  )
}

export function arrowSides(from: CanvasNode, to: CanvasNode) {
  const fromX = from.x + from.width / 2
  const fromY = from.y + from.height / 2
  const toX = to.x + to.width / 2
  const toY = to.y + to.height / 2
  const dx = toX - fromX
  const dy = toY - fromY
  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0
      ? ({ fromSide: 'right', toSide: 'left' } as const)
      : ({ fromSide: 'left', toSide: 'right' } as const)
  }
  return dy >= 0
    ? ({ fromSide: 'bottom', toSide: 'top' } as const)
    : ({ fromSide: 'top', toSide: 'bottom' } as const)
}

export function screenRect(
  view: { offsetX: number; offsetY: number; scale: number },
  startX: number,
  startY: number,
  endX: number,
  endY: number,
) {
  return {
    left: view.offsetX + Math.min(startX, endX) * view.scale,
    top: view.offsetY + Math.min(startY, endY) * view.scale,
    width: Math.abs(endX - startX) * view.scale,
    height: Math.abs(endY - startY) * view.scale,
  }
}

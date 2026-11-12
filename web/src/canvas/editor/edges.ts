import type { CanvasEdge, CanvasNode, CanvasSide } from '../model'

function anchor(node: CanvasNode, side: CanvasSide | undefined) {
  const middleX = node.x + node.width / 2
  const middleY = node.y + node.height / 2
  if (side === 'top') return { x: middleX, y: node.y }
  if (side === 'bottom') return { x: middleX, y: node.y + node.height }
  if (side === 'left') return { x: node.x, y: middleY }
  if (side === 'right') return { x: node.x + node.width, y: middleY }
  return { x: middleX, y: middleY }
}

function nearestSide(from: CanvasNode, to: CanvasNode): CanvasSide {
  const dx = to.x + to.width / 2 - (from.x + from.width / 2)
  const dy = to.y + to.height / 2 - (from.y + from.height / 2)
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? 'right' : 'left'
  return dy >= 0 ? 'bottom' : 'top'
}

function opposite(side: CanvasSide): CanvasSide {
  if (side === 'top') return 'bottom'
  if (side === 'bottom') return 'top'
  if (side === 'left') return 'right'
  return 'left'
}

export function edgeEndpoints(
  edge: CanvasEdge,
  nodes: Map<string, CanvasNode>,
) {
  const from = nodes.get(edge.fromNode)
  const to = nodes.get(edge.toNode)
  if (!from || !to) return null
  const fromSide = edge.fromSide ?? nearestSide(from, to)
  const toSide = edge.toSide ?? opposite(fromSide)
  return { start: anchor(from, fromSide), end: anchor(to, toSide) }
}

export function distanceToEdge(
  edge: CanvasEdge,
  nodes: Map<string, CanvasNode>,
  x: number,
  y: number,
) {
  const points = edgeEndpoints(edge, nodes)
  if (!points) return Infinity
  const dx = points.end.x - points.start.x
  const dy = points.end.y - points.start.y
  const lengthSquared = dx * dx + dy * dy
  if (lengthSquared === 0) {
    return Math.hypot(x - points.start.x, y - points.start.y)
  }
  let t = ((x - points.start.x) * dx + (y - points.start.y) * dy) / lengthSquared
  t = Math.max(0, Math.min(1, t))
  return Math.hypot(
    x - (points.start.x + t * dx),
    y - (points.start.y + t * dy),
  )
}

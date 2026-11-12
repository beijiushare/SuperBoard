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

function controlPoints(
  start: { x: number; y: number },
  end: { x: number; y: number },
  fromSide: CanvasSide,
  toSide: CanvasSide,
) {
  const distanceX = end.x - start.x
  const distanceY = end.y - start.y
  const realDistance =
    Math.min(Math.abs(distanceX), Math.abs(distanceY)) +
    0.3 * Math.max(Math.abs(distanceX), Math.abs(distanceY))
  const padding = Math.max(60, Math.min(300, realDistance * 0.5))
  const controlA = { ...start }
  const controlB = { ...end }
  if (fromSide === 'top') controlA.y -= padding
  else if (fromSide === 'bottom') controlA.y += padding
  else if (fromSide === 'left') controlA.x -= padding
  else controlA.x += padding
  if (toSide === 'top') controlB.y -= padding
  else if (toSide === 'bottom') controlB.y += padding
  else if (toSide === 'left') controlB.x -= padding
  else controlB.x += padding
  return { controlA, controlB }
}

export function edgeGeometry(
  edge: CanvasEdge,
  nodes: Map<string, CanvasNode>,
) {
  const from = nodes.get(edge.fromNode)
  const to = nodes.get(edge.toNode)
  if (!from || !to) return null
  const fromSide = edge.fromSide ?? nearestSide(from, to)
  const toSide = edge.toSide ?? opposite(fromSide)
  const start = anchor(from, fromSide)
  const end = anchor(to, toSide)
  return { start, end, ...controlPoints(start, end, fromSide, toSide) }
}

export function edgePath(
  edge: CanvasEdge,
  nodes: Map<string, CanvasNode>,
) {
  const geometry = edgeGeometry(edge, nodes)
  if (!geometry) return null
  const { start, end, controlA, controlB } = geometry
  return `M ${start.x} ${start.y} C ${controlA.x} ${controlA.y} ${controlB.x} ${controlB.y} ${end.x} ${end.y}`
}

export function distanceToEdge(
  edge: CanvasEdge,
  nodes: Map<string, CanvasNode>,
  x: number,
  y: number,
) {
  const geometry = edgeGeometry(edge, nodes)
  if (!geometry) return Infinity
  const { start, end, controlA, controlB } = geometry
  let best = Infinity
  let previous = start
  for (let index = 1; index <= 24; index += 1) {
    const t = index / 24
    const inverse = 1 - t
    const point = {
      x:
        inverse ** 3 * start.x +
        3 * inverse ** 2 * t * controlA.x +
        3 * inverse * t ** 2 * controlB.x +
        t ** 3 * end.x,
      y:
        inverse ** 3 * start.y +
        3 * inverse ** 2 * t * controlA.y +
        3 * inverse * t ** 2 * controlB.y +
        t ** 3 * end.y,
    }
    const dx = point.x - previous.x
    const dy = point.y - previous.y
    const lengthSquared = dx * dx + dy * dy
    let segmentT = 0
    if (lengthSquared > 0) {
      segmentT =
        ((x - previous.x) * dx + (y - previous.y) * dy) / lengthSquared
      segmentT = Math.max(0, Math.min(1, segmentT))
    }
    const distance = Math.hypot(
      x - (previous.x + segmentT * dx),
      y - (previous.y + segmentT * dy),
    )
    best = Math.min(best, distance)
    previous = point
  }
  return best
}

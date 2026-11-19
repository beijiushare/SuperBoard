import type { CanvasDocument, CanvasEdge, CanvasNode } from '../model'
import { isLocked, nodeMapOf } from './hierarchy'
import { strokeHit } from './toolGeometry'

export interface ErasurePlan {
  removals: Array<{ node: CanvasNode; hit: Set<string> }>
  edgeIds: Set<string>
}

function hitStroke(
  node: CanvasNode,
  x: number,
  y: number,
  tolerance: number,
) {
  const strokes = node['x-superboard']?.strokes
  if (!strokes?.length) return false
  return strokes.some((stroke) => strokeHit(stroke, node, x, y, tolerance))
}

export function planErasure(
  nodes: CanvasNode[],
  edges: CanvasEdge[],
  x: number,
  y: number,
  scale: number,
): ErasurePlan {
  const tolerance = 4 / scale
  const nodeMap = nodeMapOf(nodes)
  const removals: Array<{ node: CanvasNode; hit: Set<string> }> = []
  for (const node of nodes) {
    if (node['x-superboard']?.kind !== 'drawing') continue
    if (isLocked(node, nodeMap)) continue
    if (!hitStroke(node, x, y, tolerance)) continue
    const hit = new Set<string>()
    for (const stroke of node['x-superboard']?.strokes ?? []) {
      if (strokeHit(stroke, node, x, y, tolerance)) hit.add(stroke.id)
    }
    if (hit.size > 0) removals.push({ node, hit })
  }
  const edgeIds = new Set<string>()
  const edgeTolerance = 8 / scale
  for (const edge of edges) {
    const from = nodeMap.get(edge.fromNode)
    const to = nodeMap.get(edge.toNode)
    if (!from || !to) continue
    if (distanceToEdgeSegment(from, to, x, y) <= edgeTolerance) {
      edgeIds.add(edge.id)
    }
  }
  return { removals, edgeIds }
}

function distanceToEdgeSegment(
  from: CanvasNode,
  to: CanvasNode,
  x: number,
  y: number,
) {
  const ax = from.x + from.width / 2
  const ay = from.y + from.height / 2
  const bx = to.x + to.width / 2
  const by = to.y + to.height / 2
  const dx = bx - ax
  const dy = by - ay
  const lengthSquared = dx * dx + dy * dy
  if (lengthSquared === 0) return Math.hypot(x - ax, y - ay)
  let t = ((x - ax) * dx + (y - ay) * dy) / lengthSquared
  t = Math.max(0, Math.min(1, t))
  return Math.hypot(x - (ax + t * dx), y - (ay + t * dy))
}

interface ApplyErasureOptions {
  canvas: CanvasDocument
  nodeMap: Record<string, { ref: CanvasNode }>
  edgeMap: Record<string, { ref: CanvasEdge }>
  plan: ErasurePlan
}

export function applyErasure({
  canvas,
  nodeMap,
  edgeMap,
  plan,
}: ApplyErasureOptions) {
  const removedNodes = new Set<string>()
  for (const removal of plan.removals) {
    const extension = removal.node['x-superboard']
    if (!extension?.strokes) continue
    extension.strokes = extension.strokes.filter(
      (stroke) => !removal.hit.has(stroke.id),
    )
    if (extension.strokes.length > 0) continue
    removedNodes.add(removal.node.id)
    const index = canvas.nodes.findIndex(
      (node) => node.id === removal.node.id,
    )
    if (index >= 0) canvas.nodes.splice(index, 1)
    delete nodeMap[removal.node.id]
  }
  const shouldRemoveEdge = (edge: CanvasEdge) =>
    plan.edgeIds.has(edge.id) ||
    removedNodes.has(edge.fromNode) ||
    removedNodes.has(edge.toNode)
  canvas.edges = canvas.edges.filter((edge) => !shouldRemoveEdge(edge))
  for (const edge of Object.values(edgeMap)) {
    if (shouldRemoveEdge(edge.ref)) delete edgeMap[edge.ref.id]
  }
}

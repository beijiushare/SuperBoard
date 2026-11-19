import { useState } from 'react'
import type { CanvasDocument, CanvasNode } from '../model'
import { isLocked, nextFreeId, nodeMapOf, topAncestor } from './hierarchy'
import { createArrowEdge, createShapeNode } from './toolCreate'
import type { ArrowDraft, ShapeDraft } from './toolTypes'
import type { ToolDataManager } from './toolViewport'

const MIN_DRAG = 6

interface UseShapeArrowToolsOptions {
  canvas: CanvasDocument
  getData: () => ToolDataManager | null
  onBeforeChange: () => void
  onApply: (next: CanvasDocument, selection?: string[]) => void
}

export function useShapeArrowTools({
  canvas,
  getData,
  onBeforeChange,
  onApply,
}: UseShapeArrowToolsOptions) {
  const [draft, setDraft] = useState<ShapeDraft | null>(null)
  const [arrowDraft, setArrowDraft] = useState<ArrowDraft | null>(null)

  function existingIds() {
    return new Set<string>([
      ...canvas.nodes.map((node) => node.id),
      ...canvas.edges.map((edge) => edge.id),
    ])
  }

  function findNodeAt(
    x: number,
    y: number,
    predicate?: (node: CanvasNode) => boolean,
  ) {
    const dm = getData()
    if (!dm) return null
    const nodes = Object.values(dm.data.nodeMap).map((item) => item.ref)
    const map = nodeMapOf(nodes)
    for (let index = nodes.length - 1; index >= 0; index -= 1) {
      const node = nodes[index]
      if (predicate && !predicate(node)) continue
      const root = predicate ? node : topAncestor(node, map)
      if (isLocked(root, map)) continue
      if (
        x < root.x ||
        x > root.x + root.width ||
        y < root.y ||
        y > root.y + root.height
      ) {
        continue
      }
      return root
    }
    return null
  }

  function commitShape(shape: 'rect' | 'rounded-rect' | 'ellipse' | 'diamond' | 'line') {
    const current = draft
    if (!current) return
    const scale = getData()?.data.scale ?? 1
    const width = Math.abs(current.currentX - current.startX)
    const height = Math.abs(current.currentY - current.startY)
    if (Math.max(width, height) * scale < MIN_DRAG) {
      setDraft(null)
      return
    }
    const shapeKind = shape === 'rounded-rect' ? 'rect' : shape
    const id = nextFreeId(existingIds(), shapeKind)
    const node = createShapeNode({
      id,
      shape,
      startX: current.startX,
      startY: current.startY,
      currentX: current.currentX,
      currentY: current.currentY,
    })
    setDraft(null)
    onBeforeChange()
    onApply({ ...canvas, nodes: [...canvas.nodes, node] }, [id])
  }

  function commitArrow() {
    const current = arrowDraft
    setArrowDraft(null)
    if (!current) return
    const target = findNodeAt(current.currentX, current.currentY)
    if (!target || target.id === current.fromId) return
    const dm = getData()
    if (!dm) return
    const from = dm.data.nodeMap[current.fromId]?.ref
    if (!from) return
    const edge = createArrowEdge({
      id: nextFreeId(existingIds(), 'edge'),
      from,
      to: target,
      currentX: current.currentX,
      currentY: current.currentY,
    })
    onBeforeChange()
    onApply({ ...canvas, edges: [...canvas.edges, edge] }, [])
  }

  const arrowTarget = arrowDraft
    ? findNodeAt(
        arrowDraft.currentX,
        arrowDraft.currentY,
        (node) => node.id !== arrowDraft.fromId,
      )
    : null

  function resetDrafts() {
    setDraft(null)
    setArrowDraft(null)
  }

  return {
    draft,
    setDraft,
    arrowDraft,
    setArrowDraft,
    arrowTarget,
    findNodeAt,
    commitShape,
    commitArrow,
    resetDrafts,
  }
}

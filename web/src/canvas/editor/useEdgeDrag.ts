import { useRef, useState, type MutableRefObject, type RefObject } from 'react'
import type { CanvasEdge, CanvasNode } from '../model'
import { edgeGeometry } from './edges'
import { isLocked, nodeMapOf, selectableAncestor } from './hierarchy'
import type { OverlayController, OverlayDataManager } from './overlayTypes'

interface EdgePreview {
  fromX: number
  fromY: number
  x: number
  y: number
}

interface UseEdgeDragOptions {
  dmRef: MutableRefObject<OverlayDataManager | null>
  overlayRef: RefObject<HTMLDivElement | null>
  controllerRef: MutableRefObject<OverlayController | null>
  focusedGroupId: string | null | undefined
  onBeforeChange?: () => void
  onChange?: () => void
  setTick: (update: (value: number) => number) => void
}

export function useEdgeDrag({
  dmRef,
  overlayRef,
  controllerRef,
  focusedGroupId,
  onBeforeChange,
  onChange,
  setTick,
}: UseEdgeDragOptions) {
  const [edgePreview, setEdgePreview] = useState<EdgePreview | null>(null)
  const edgeDragRef = useRef<{
    edge: CanvasEdge
    point: 'from' | 'to'
    fixedX: number
    fixedY: number
  } | null>(null)

  function edgeWorldPoint(event: { clientX: number; clientY: number }) {
    const overlay = overlayRef.current
    const dm = dmRef.current
    if (!overlay || !dm) return null
    const bounds = overlay.getBoundingClientRect()
    return {
      x: (event.clientX - bounds.left - dm.data.offsetX) / dm.data.scale,
      y: (event.clientY - bounds.top - dm.data.offsetY) / dm.data.scale,
    }
  }

  function beginEdgeEndpoint(
    event: {
      button: number
      preventDefault: () => void
      stopPropagation: () => void
      pointerId: number
      currentTarget: { setPointerCapture: (id: number) => void }
    },
    edge: CanvasEdge,
    point: 'from' | 'to',
  ) {
    if (event.button !== 0) return
    event.preventDefault()
    event.stopPropagation()
    const dm = dmRef.current
    if (!dm) return
    const map = nodeMapOf(Object.values(dm.data.nodeMap).map((item) => item.ref))
    const geometry = edgeGeometry(edge, map)
    if (!geometry) return
    const fixed = point === 'from' ? geometry.end : geometry.start
    edgeDragRef.current = { edge, point, fixedX: fixed.x, fixedY: fixed.y }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function finishEdgeEndpoint(event: { clientX: number; clientY: number }) {
    const dragEdge = edgeDragRef.current
    if (!dragEdge) return
    edgeDragRef.current = null
    setEdgePreview(null)
    const dm = dmRef.current
    const point = edgeWorldPoint(event)
    if (!dm || !point) return
    const nodes = Object.values(dm.data.nodeMap).map((item) => item.ref)
    const map = nodeMapOf(nodes)
    let target: CanvasNode | null = null
    for (let index = nodes.length - 1; index >= 0; index -= 1) {
      const candidate = selectableAncestor(nodes[index], map, focusedGroupId)
      if (isLocked(candidate, map)) continue
      if (
        point.x >= candidate.x &&
        point.x <= candidate.x + candidate.width &&
        point.y >= candidate.y &&
        point.y <= candidate.y + candidate.height
      ) {
        target = candidate
        break
      }
    }
    if (!target) return
    onBeforeChange?.()
    if (dragEdge.point === 'from') {
      dragEdge.edge.fromNode = target.id
      delete dragEdge.edge.fromSide
    } else {
      dragEdge.edge.toNode = target.id
      delete dragEdge.edge.toSide
    }
    controllerRef.current?.refresh()
    onChange?.()
    setTick((value) => value + 1)
  }

  function moveEdge(event: { clientX: number; clientY: number }) {
    if (!edgeDragRef.current) return false
    const point = edgeWorldPoint(event)
    if (point) {
      setEdgePreview({
        fromX: edgeDragRef.current.fixedX,
        fromY: edgeDragRef.current.fixedY,
        x: point.x,
        y: point.y,
      })
    }
    return true
  }

  return {
    edgePreview,
    beginEdgeEndpoint,
    finishEdgeEndpoint,
    moveEdge,
  }
}

import type { MutableRefObject, RefObject } from 'react'
import type { CanvasNode } from '../model'
import type { StrokePoint } from './freehand'
import type { Editing } from './useTextEditing'
import type { EditorTool } from './tools'
import type { ArrowDraft, ShapeDraft } from './toolTypes'
import type { ToolController, ToolDataManager } from './toolViewport'

interface PanGesture {
  startClientX: number
  startClientY: number
  offsetX: number
  offsetY: number
  controller: ToolController
  dm: ToolDataManager
}

interface SurfacePoint {
  screenX: number
  screenY: number
  worldX: number
  worldY: number
}

interface UseToolPointersOptions {
  tool: EditorTool
  surfaceRef: RefObject<HTMLDivElement | null>
  strokeRef: MutableRefObject<StrokePoint[] | null>
  arrowRef: MutableRefObject<ArrowDraft | null>
  eraserRef: MutableRefObject<{ changed: boolean } | null>
  panModeRef: MutableRefObject<boolean>
  panGestureRef: MutableRefObject<PanGesture | null>
  draft: ShapeDraft | null
  setDraft: (draft: ShapeDraft | null) => void
  setArrowDraft: (draft: ArrowDraft | null) => void
  editingRef: MutableRefObject<Editing | null>
  suppressTextCreateRef: MutableRefObject<boolean>
  internals: () => {
    dm: ToolDataManager
    controller: ToolController
  } | null
  surfacePoint: (event: { clientX: number; clientY: number }) => SurfacePoint | null
  findNodeAt: (
    x: number,
    y: number,
    predicate?: (node: CanvasNode) => boolean,
  ) => CanvasNode | null
  editKindOf: (node: CanvasNode) => Editing['kind'] | null
  startEditing: (node: CanvasNode | null, x: number, y: number) => void
  commitEditing: () => void
  redrawStrokePreview: () => void
  eraseAt: (x: number, y: number) => void
  commitShape: (
    shape: 'rect' | 'rounded-rect' | 'ellipse' | 'diamond' | 'line',
  ) => void
  commitStroke: () => void
  commitArrow: () => void
  onExitTool: () => void
  onEditMarkdown?: (id: string) => void
  onCreateText: (x: number, y: number) => void
}

export function useToolPointers({
  tool,
  surfaceRef,
  strokeRef,
  arrowRef,
  eraserRef,
  panModeRef,
  panGestureRef,
  draft,
  setDraft,
  setArrowDraft,
  editingRef,
  suppressTextCreateRef,
  internals,
  surfacePoint,
  findNodeAt,
  editKindOf,
  startEditing,
  commitEditing,
  redrawStrokePreview,
  eraseAt,
  commitShape,
  commitStroke,
  commitArrow,
  onExitTool,
  onEditMarkdown,
  onCreateText,
}: UseToolPointersOptions) {
  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (
      event.button === 1 ||
      event.button === 2 ||
      (event.button === 0 && panModeRef.current)
    ) {
      const data = internals()
      if (!data) return
      panGestureRef.current = {
        startClientX: event.clientX,
        startClientY: event.clientY,
        offsetX: data.dm.data.offsetX,
        offsetY: data.dm.data.offsetY,
        controller: data.controller,
        dm: data.dm,
      }
      event.currentTarget.setPointerCapture(event.pointerId)
      event.preventDefault()
      return
    }
    if (event.button !== 0) return
    if (editingRef.current) {
      commitEditing()
      onExitTool()
      return
    }
    if (suppressTextCreateRef.current) {
      suppressTextCreateRef.current = false
      onExitTool()
      return
    }
    const point = surfacePoint(event)
    if (!point) return
    if (tool === 'text') {
      event.preventDefault()
      event.stopPropagation()
      const hit = findNodeAt(
        point.worldX,
        point.worldY,
        (node) => editKindOf(node) !== null,
      )
      if (hit?.['x-superboard']?.kind === 'markdown' && onEditMarkdown) {
        onEditMarkdown(hit.id)
        return
      }
      if (hit) startEditing(hit, point.worldX, point.worldY)
      else onCreateText(point.worldX, point.worldY)
      return
    }
    if (
      tool === 'rect' ||
      tool === 'rounded-rect' ||
      tool === 'ellipse' ||
      tool === 'diamond' ||
      tool === 'line'
    ) {
      setDraft({
        startX: point.worldX,
        startY: point.worldY,
        currentX: point.worldX,
        currentY: point.worldY,
      })
      event.currentTarget.setPointerCapture(event.pointerId)
      return
    }
    if (tool === 'draw') {
      strokeRef.current = [
        [point.screenX, point.screenY, event.pressure || 0.5],
      ]
      redrawStrokePreview()
      event.currentTarget.setPointerCapture(event.pointerId)
      return
    }
    if (tool === 'arrow') {
      const from = findNodeAt(point.worldX, point.worldY)
      if (!from) return
      const draftValue: ArrowDraft = {
        fromId: from.id,
        startX: from.x + from.width / 2,
        startY: from.y + from.height / 2,
        currentX: point.worldX,
        currentY: point.worldY,
      }
      arrowRef.current = draftValue
      setArrowDraft(draftValue)
      event.currentTarget.setPointerCapture(event.pointerId)
      return
    }
    if (tool === 'eraser') {
      eraserRef.current = { changed: false }
      eraseAt(point.worldX, point.worldY)
      event.currentTarget.setPointerCapture(event.pointerId)
    }
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const pan = panGestureRef.current
    if (pan) {
      pan.dm.data.offsetX = pan.offsetX + event.clientX - pan.startClientX
      pan.dm.data.offsetY = pan.offsetY + event.clientY - pan.startClientY
      pan.controller.refresh()
      return
    }
    if (tool === 'draw' && strokeRef.current) {
      const surface = surfaceRef.current
      if (!surface) return
      const bounds = surface.getBoundingClientRect()
      const point: StrokePoint = [
        event.clientX - bounds.left,
        event.clientY - bounds.top,
        event.pressure || 0.5,
      ]
      const points = strokeRef.current
      const last = points[points.length - 1]
      if (Math.hypot(point[0] - last[0], point[1] - last[1]) < 1) return
      points.push(point)
      redrawStrokePreview()
      return
    }
    if (tool === 'eraser' && eraserRef.current) {
      const point = surfacePoint(event)
      if (point) eraseAt(point.worldX, point.worldY)
      return
    }
    const point = surfacePoint(event)
    if (!point) return
    if (draft) {
      setDraft({ ...draft, currentX: point.worldX, currentY: point.worldY })
    } else if (arrowRef.current) {
      const next = {
        ...arrowRef.current,
        currentX: point.worldX,
        currentY: point.worldY,
      }
      arrowRef.current = next
      setArrowDraft(next)
    }
  }

  function handlePointerUp(event: React.PointerEvent<HTMLDivElement>) {
    if (panGestureRef.current) {
      panGestureRef.current = null
      return
    }
    if (event.button !== 0) return
    if (
      tool === 'rect' ||
      tool === 'rounded-rect' ||
      tool === 'ellipse' ||
      tool === 'diamond' ||
      tool === 'line'
    ) {
      commitShape(tool)
      return
    }
    if (tool === 'draw') {
      commitStroke()
      return
    }
    if (tool === 'arrow') {
      commitArrow()
      // Without this the ref keeps the finished draft, and the next pointer
      // move resurrects it: clicking another block would draw a second arrow
      // from the previous source.
      arrowRef.current = null
      return
    }
    if (tool === 'eraser') {
      eraserRef.current = null
    }
  }

  return { handlePointerDown, handlePointerMove, handlePointerUp }
}

export type { PanGesture }

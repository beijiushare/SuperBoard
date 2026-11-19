import { useEffect, useRef, useState } from 'react'
import {
  TEXT_LINE_HEIGHT,
  TEXT_PADDING_X,
  TEXT_PADDING_Y,
  type CanvasDocument,
  type CanvasNode,
} from '../model'
import type { CanvasViewerHandle } from '../viewer/CanvasViewer'
import { isLocked, nextFreeId, nodeMapOf, topAncestor } from './hierarchy'
import type { EditorTool } from './tools'
import { getUiState } from './uiState'
import {
  createDrawingNode,
  drawStrokePreview,
  type StrokePoint,
} from './freehand'
import { createArrowEdge, createShapeNode } from './toolCreate'
import { applyErasure, planErasure } from './eraser'
import { useTextEditing } from './useTextEditing'
import { useToolViewport } from './toolViewport'
import type { ToolController, ToolDataManager } from './toolViewport'
import { useToolPointers } from './useToolPointers'
import type { ArrowDraft, ShapeDraft } from './toolTypes'
import { TextEditingOverlay } from './TextEditingOverlay'
import { ToolPreviewLayer } from './ToolPreviewLayer'

type DataManager = ToolDataManager
type Controller = ToolController

interface CanvasEditorToolsProps {
  canvas: CanvasDocument
  tool: EditorTool
  viewerRef: React.RefObject<CanvasViewerHandle | null>
  onBeforeChange: () => void
  onChange: () => void
  onApply: (next: CanvasDocument, selection?: string[]) => void
  onExitTool: () => void
  editRequest?: { id: string; nonce: number } | null
  onEditRequestHandled?: () => void
  createRequest?: { x: number; y: number; nonce: number } | null
  onCreateRequestHandled?: () => void
  onEditMarkdown?: (id: string) => void
  onEditingChange?: (id: string | null) => void
}

const MIN_DRAG = 6

export function CanvasEditorTools({
  canvas,
  tool,
  viewerRef,
  onBeforeChange,
  onChange,
  onApply,
  onExitTool,
  editRequest,
  onEditRequestHandled,
  createRequest,
  onCreateRequestHandled,
  onEditMarkdown,
  onEditingChange,
}: CanvasEditorToolsProps) {
  const surfaceRef = useRef<HTMLDivElement>(null)
  const previewCanvasRef = useRef<HTMLCanvasElement>(null)
  const strokeRef = useRef<StrokePoint[] | null>(null)
  const arrowRef = useRef<ArrowDraft | null>(null)
  const eraserRef = useRef<{ changed: boolean } | null>(null)
  const panModeRef = useRef(false)
  const panGestureRef = useRef<{
    startClientX: number
    startClientY: number
    offsetX: number
    offsetY: number
    controller: Controller
    dm: DataManager
  } | null>(null)
  const [draft, setDraft] = useState<ShapeDraft | null>(null)
  const [arrowDraft, setArrowDraft] = useState<ArrowDraft | null>(null)
  const { internals, getView, surfacePoint } = useToolViewport({
    viewerRef,
    surfaceRef,
  })
  const {
    editing,
    editingRef,
    textareaRef,
    suppressTextCreateRef,
    startEditing,
    commitEditing,
    updateEditing,
    resetEditing,
    editKindOf,
  } = useTextEditing({
    canvas,
    getScale: () => internals()?.dm.data.scale ?? 1,
    onBeforeChange,
    onApply,
    onExitTool,
    onEditingChange,
  })
  const { handlePointerDown, handlePointerMove, handlePointerUp } =
    useToolPointers({
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
    })

  useEffect(() => {
    setDraft(null)
    setArrowDraft(null)
    strokeRef.current = null
    arrowRef.current = null
    eraserRef.current = null
    panGestureRef.current = null
    suppressTextCreateRef.current = false
    resetEditing()
  }, [tool])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code !== 'Space' || event.repeat) return
      const target = event.target as HTMLElement | null
      if (target?.closest('input, textarea, select, button, [contenteditable="true"]')) return
      panModeRef.current = true
      event.preventDefault()
    }
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code === 'Space') panModeRef.current = false
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [])

  useEffect(() => {
    if (tool === 'select') return
    const surface = surfaceRef.current
    if (!surface) return
    const onWheel = (event: WheelEvent) => {
      const data = internals()
      if (!data) return
      event.preventDefault()
      const bounds = surface.getBoundingClientRect()
      if (event.ctrlKey || event.metaKey) {
        const factor = event.deltaY < 0 ? 1.1 : 1 / 1.1
        const nextScale = Math.min(20, Math.max(0.05, data.dm.data.scale * factor))
        const originX = event.clientX - bounds.left
        const originY = event.clientY - bounds.top
        const worldX = (originX - data.dm.data.offsetX) / data.dm.data.scale
        const worldY = (originY - data.dm.data.offsetY) / data.dm.data.scale
        data.dm.data.offsetX = originX - worldX * nextScale
        data.dm.data.offsetY = originY - worldY * nextScale
        data.dm.data.scale = nextScale
      } else {
        const deltaX = event.shiftKey ? -event.deltaY : -event.deltaX
        const deltaY = event.shiftKey ? 0 : -event.deltaY
        data.dm.data.offsetX += deltaX
        data.dm.data.offsetY += deltaY
      }
      data.controller.refresh()
    }
    surface.addEventListener('wheel', onWheel, { passive: false })
    return () => surface.removeEventListener('wheel', onWheel)
  }, [tool])

  useEffect(() => {
    if (tool !== 'draw') return
    const surface = surfaceRef.current
    const canvasElement = previewCanvasRef.current
    if (!surface || !canvasElement) return
    const dpr = window.devicePixelRatio || 1
    canvasElement.width = Math.max(1, Math.round(surface.clientWidth * dpr))
    canvasElement.height = Math.max(1, Math.round(surface.clientHeight * dpr))
    const ctx = canvasElement.getContext('2d')
    if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  }, [tool])

  useEffect(() => {
    if (!editRequest) return
    const node = canvas.nodes.find((item) => item.id === editRequest.id)
    if (node) startEditing(node, node.x, node.y)
    onEditRequestHandled?.()
  }, [editRequest, canvas])

  useEffect(() => {
    if (!createRequest) return
    startEditing(null, createRequest.x, createRequest.y)
    onCreateRequestHandled?.()
  }, [createRequest, onCreateRequestHandled])

  function redrawStrokePreview() {
    const canvasElement = previewCanvasRef.current
    const points = strokeRef.current
    if (!canvasElement || !points) return
    const ctx = canvasElement.getContext('2d')
    if (!ctx) return
    drawStrokePreview(
      ctx,
      window.devicePixelRatio || 1,
      points,
      getUiState().brush,
      internals()?.dm.data.scale ?? 1,
    )
  }

  function clearStrokePreview() {
    const canvasElement = previewCanvasRef.current
    const ctx = canvasElement?.getContext('2d')
    if (!canvasElement || !ctx) return
    const dpr = window.devicePixelRatio || 1
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, canvasElement.width / dpr, canvasElement.height / dpr)
  }

  function existingIds() {
    return new Set<string>([
      ...canvas.nodes.map((node) => node.id),
      ...canvas.edges.map((edge) => edge.id),
    ])
  }

  function findNodeAt(x: number, y: number, predicate?: (node: CanvasNode) => boolean) {
    const data = internals()
    if (!data) return null
    const nodes = Object.values(data.dm.data.nodeMap).map((item) => item.ref)
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

  function eraseAt(x: number, y: number) {
    const data = internals()
    const gesture = eraserRef.current
    if (!data || !gesture) return
    const { dm, controller } = data
    const nodes = Object.values(dm.data.nodeMap).map((item) => item.ref)
    const plan = planErasure(nodes, canvas.edges, x, y, dm.data.scale)
    if (plan.removals.length === 0 && plan.edgeIds.size === 0) return
    if (!gesture.changed) {
      gesture.changed = true
      onBeforeChange()
    }
    applyErasure({
      canvas,
      nodeMap: dm.data.nodeMap,
      edgeMap: dm.data.edgeMap ?? {},
      plan,
    })
    controller.refresh()
    onChange()
  }

  function commitShape(shape: 'rect' | 'rounded-rect' | 'ellipse' | 'diamond' | 'line') {
    const current = draft
    if (!current) return
    const scale = internals()?.dm.data.scale ?? 1
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

  function commitStroke() {
    const points = strokeRef.current
    strokeRef.current = null
    clearStrokePreview()
    if (!points || points.length < 2) return
    const data = internals()
    if (!data) return
    const { offsetX, offsetY, scale } = data.dm.data
    const node = createDrawingNode({
      id: nextFreeId(existingIds(), 'draw'),
      points,
      offsetX,
      offsetY,
      scale,
      brush: getUiState().brush,
    })
    onBeforeChange()
    onApply({ ...canvas, nodes: [...canvas.nodes, node] }, [])
  }

  function commitArrow() {
    const current = arrowRef.current
    arrowRef.current = null
    setArrowDraft(null)
    if (!current) return
    const target = findNodeAt(current.currentX, current.currentY)
    if (!target || target.id === current.fromId) return
    const data = internals()
    if (!data) return
    const from = data.dm.data.nodeMap[current.fromId]?.ref
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

  if (tool === 'select') return null

  const view = getView()

  const arrowTarget = arrowDraft
    ? findNodeAt(arrowDraft.currentX, arrowDraft.currentY, (node) => node.id !== arrowDraft.fromId)
    : null
  const textPreview = editing
    ? (() => {
        const scale = view?.scale ?? 1
        return {
          left: (view?.offsetX ?? 0) + editing.x * scale,
          top: (view?.offsetY ?? 0) + editing.y * scale,
          width: editing.width * scale,
          height: editing.height * scale,
          fontSize: editing.fontSize * scale,
          padding: `${TEXT_PADDING_Y * scale}px ${TEXT_PADDING_X * scale}px`,
          color: editing.color,
          opacity: editing.opacity ?? 1,
          fontFamily: editing.fontFamily,
          lineHeight: TEXT_LINE_HEIGHT,
          textAlign: editing.textAlign,
        }
      })()
    : null

  return (
    <>
      <div
        ref={surfaceRef}
        className="sb-editor-tool-surface"
        data-tool={tool}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      />
      {tool === 'draw' ? (
        <canvas ref={previewCanvasRef} className="sb-editor-draw-preview" />
      ) : null}
      <ToolPreviewLayer
        tool={tool}
        view={view}
        draft={draft}
        arrowDraft={arrowDraft}
        arrowTarget={arrowTarget}
      />
      {editing && textPreview ? (
        <TextEditingOverlay
          style={textPreview}
          value={editing.value}
          textareaRef={textareaRef}
          getScale={() => internals()?.dm.data.scale ?? 1}
          onChange={(value, height) => {
            const current = editingRef.current
            if (!current) return
            updateEditing({ ...current, value, height })
          }}
          onCommit={commitEditing}
          onExitTool={onExitTool}
        />
      ) : null}
    </>
  )
}

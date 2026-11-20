import { useEffect, useRef, useState } from 'react'
import {
  TEXT_LINE_HEIGHT,
  TEXT_PADDING_X,
  TEXT_PADDING_Y,
  type CanvasDocument,
  type CanvasNode,
} from '../model'
import type { CanvasViewerHandle } from '../viewer/CanvasViewer'
import { nextFreeId } from './hierarchy'
import type { EditorTool } from './tools'
import { textStyleFromPreferences } from './preferences'
import { DEFAULT_BLOCK_SIZES } from './blocks'
import { applyErasure, planErasure } from './eraser'
import { useTextEditing } from './useTextEditing'
import { useToolViewport } from './toolViewport'
import type { ToolController, ToolDataManager } from './toolViewport'
import { useToolPointers } from './useToolPointers'
import { useFreehandTool } from './useFreehandTool'
import { useShapeArrowTools } from './useShapeArrowTools'
import type { ArrowDraft } from './toolTypes'
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
  onRequestEdit?: (id: string) => void
}

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
  onRequestEdit,
}: CanvasEditorToolsProps) {
  const surfaceRef = useRef<HTMLDivElement>(null)
  const arrowRef = useRef<ArrowDraft | null>(null)
  const [, forceView] = useState(0)
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
  const { internals, getView, surfacePoint } = useToolViewport({
    viewerRef,
    surfaceRef,
  })
  useEffect(() => {
    let unsubscribe: (() => void) | undefined
    let timer: number | undefined
    const attach = () => {
      const data = internals()
      const onRefresh = data?.controller.onRefresh
      if (!onRefresh) {
        timer = window.setTimeout(attach, 100)
        return
      }
      unsubscribe = onRefresh.subscribe(() => forceView((value) => value + 1))
    }
    attach()
    return () => {
      if (timer) window.clearTimeout(timer)
      unsubscribe?.()
    }
  }, [])
  const {
    previewCanvasRef,
    strokeRef,
    redrawStrokePreview,
    commitStroke,
    resetStroke,
  } = useFreehandTool({
    canvas,
    getScale: () => internals()?.dm.data.scale ?? 1,
    getOffset: () => {
      const data = internals()
      if (!data) return null
      return {
        offsetX: data.dm.data.offsetX,
        offsetY: data.dm.data.offsetY,
        scale: data.dm.data.scale,
      }
    },
    onBeforeChange,
    onApply,
  })
  const {
    draft,
    setDraft,
    arrowDraft,
    setArrowDraft,
    arrowTarget,
    findNodeAt,
    commitShape,
    commitArrow,
    resetDrafts,
  } = useShapeArrowTools({
    canvas,
    getData: () => internals()?.dm ?? null,
    onBeforeChange,
    onApply,
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
      onCreateText: createTextAt,
    })

  function createTextAt(x: number, y: number) {
    const settings = canvas['x-superboard']?.settings
    const width =
      settings?.defaultBlockWidth ?? DEFAULT_BLOCK_SIZES.text.width
    const height =
      settings?.defaultBlockHeight ?? DEFAULT_BLOCK_SIZES.text.height
    const existing = new Set<string>([
      ...canvas.nodes.map((node) => node.id),
      ...canvas.edges.map((edge) => edge.id),
    ])
    const id = nextFreeId(existing, 'text')
    const node: CanvasNode = {
      id,
      type: 'text',
      x,
      y,
      width,
      height,
      text: '',
      'x-superboard': {
        kind: 'text',
        style: textStyleFromPreferences(),
      },
    }
    onBeforeChange()
    onApply({ ...canvas, nodes: [...canvas.nodes, node] }, [id])
    onRequestEdit?.(id)
  }

  useEffect(() => {
    resetDrafts()
    resetStroke()
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

  if (tool === 'select') return null

  const view = getView()

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

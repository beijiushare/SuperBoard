import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { getStroke } from 'perfect-freehand'
import { internal } from '../../vendor/json-canvas-viewer/src/index.ts'
import {
  TEXT_LINE_HEIGHT,
  TEXT_MIN_HEIGHT,
  TEXT_PADDING_X,
  TEXT_PADDING_Y,
  type CanvasDocument,
  type CanvasEdge,
  type CanvasNode,
  type CanvasSide,
  type SuperBoardNodeExtension,
  type SuperBoardStroke,
} from '../model'
import type { CanvasViewerHandle } from '../viewer/CanvasViewer'
import { DEFAULT_BLOCK_SIZES, blockEditor } from './blocks'
import { isLocked, nextFreeId, nodeMapOf, topAncestor } from './hierarchy'
import {
  DEFAULT_PREFERENCES,
  blockStyleFromPreferences,
  getPreferences,
  textStyleFromPreferences,
} from './preferences'
import { detectMediaKind, type EditorTool } from './tools'

type DataManager = {
  data: {
    offsetX: number
    offsetY: number
    scale: number
    nodeMap: Record<string, { ref: CanvasNode }>
    edgeMap: Record<string, { ref: CanvasEdge }>
  }
}

type Controller = {
  refresh: () => void
}

type ViewerInternals = {
  container?: { get: (key: unknown) => unknown }
}

interface View {
  offsetX: number
  offsetY: number
  scale: number
}

interface ShapeDraft {
  startX: number
  startY: number
  currentX: number
  currentY: number
}

interface ArrowDraft {
  fromId: string
  startX: number
  startY: number
  currentX: number
  currentY: number
}

interface Editing {
  id: string | null
  kind: 'text' | 'markdown' | 'pele' | 'media'
  x: number
  y: number
  width: number
  height: number
  value: string
  fontSize: number
  fontFamily?: string
  color?: string
  opacity?: number
  textAlign?: 'left' | 'center' | 'right'
}

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

const STROKE_SIZE = 4
const MIN_DRAG = 6

function distanceToSegment(
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

function strokeHit(
  stroke: SuperBoardStroke,
  node: CanvasNode,
  x: number,
  y: number,
  tolerance: number,
) {
  const points = stroke.points
  const radius = stroke.size / 2 + tolerance
  if (points.length === 1) {
    return Math.hypot(x - (node.x + points[0][0]), y - (node.y + points[0][1])) <= radius
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

function closestSide(node: CanvasNode, x: number, y: number): CanvasSide {
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

function arrowSides(from: CanvasNode, to: CanvasNode) {
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
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const strokeRef = useRef<number[][] | null>(null)
  const arrowRef = useRef<ArrowDraft | null>(null)
  const editingRef = useRef<Editing | null>(null)
  const suppressTextCreateRef = useRef(false)
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
  const [editing, setEditing] = useState<Editing | null>(null)

  function internals() {
    try {
      const viewer = viewerRef.current?.viewer as ViewerInternals | undefined
      if (!viewer?.container) return null
      const dm = viewer.container.get(internal.DataManager as never) as DataManager
      const controller = viewer.container.get(internal.Controller as never) as Controller
      return { dm, controller }
    } catch {
      return null
    }
  }

  function getView(): View | null {
    const data = internals()
    if (!data) return null
    return {
      offsetX: data.dm.data.offsetX,
      offsetY: data.dm.data.offsetY,
      scale: data.dm.data.scale,
    }
  }

  function surfacePoint(event: { clientX: number; clientY: number }) {
    const surface = surfaceRef.current
    const data = internals()
    if (!surface || !data) return null
    const bounds = surface.getBoundingClientRect()
    const screenX = event.clientX - bounds.left
    const screenY = event.clientY - bounds.top
    const { offsetX, offsetY, scale } = data.dm.data
    return {
      screenX,
      screenY,
      worldX: (screenX - offsetX) / scale,
      worldY: (screenY - offsetY) / scale,
    }
  }

  function setTextOverlayHidden(id: string | null, hidden: boolean) {
    if (!id) return
    document.getElementById(id)?.classList.toggle('sb-text-editing-hidden', hidden)
  }

  function updateEditing(next: Editing | null) {
    const previous = editingRef.current
    if (previous?.id && (!next || next.id !== previous.id)) {
      setTextOverlayHidden(previous.id, false)
    }
    if (next?.id) setTextOverlayHidden(next.id, true)
    editingRef.current = next
    setEditing(next)
  }

  useEffect(() => {
    onEditingChange?.(editing?.id ?? null)
  }, [editing?.id, onEditingChange])

  useEffect(() => {
    return () => {
      if (editingRef.current?.id) {
        setTextOverlayHidden(editingRef.current.id, false)
      }
    }
  }, [])

  useEffect(() => {
    setDraft(null)
    setArrowDraft(null)
    strokeRef.current = null
    arrowRef.current = null
    eraserRef.current = null
    panGestureRef.current = null
    suppressTextCreateRef.current = false
    updateEditing(null)
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
    if (!editing) return
    const textarea = textareaRef.current
    if (!textarea) return
    textarea.focus()
    textarea.setSelectionRange(textarea.value.length, textarea.value.length)
  }, [editing?.id, editing?.x, editing?.y, editing ? 'open' : 'closed'])

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

  useEffect(() => {
    const current = editingRef.current
    if (!current?.id) return
    const node = canvas.nodes.find((item) => item.id === current.id)
    if (!node) return
    const style = node['x-superboard']?.style
    updateEditing({
      ...current,
      x: node.x,
      y: node.y,
      width: node.width,
      height: node.height,
      fontSize: style?.fontSize ?? current.fontSize,
      fontFamily: style?.fontFamily ?? current.fontFamily,
      color: style?.color ?? current.color,
      opacity: style?.opacity ?? current.opacity,
      textAlign: style?.textAlign ?? current.textAlign,
    })
  }, [canvas])

  function editKindOf(node: CanvasNode): Editing['kind'] | null {
    const editor = blockEditor(node)
    if (!editor || editor === 'schedule') return null
    return editor
  }

  function editingValue(node: CanvasNode, kind: Editing['kind']) {
    const extension = node['x-superboard']
    if (kind === 'media') {
      return node.type === 'link' ? (extension?.media?.url ?? node.url) : ''
    }
    if (kind === 'pele') {
      const code = extension?.code
      return typeof code === 'string' ? code : node.type === 'text' ? node.text : ''
    }
    return node.type === 'text' ? node.text : ''
  }

  function redrawStrokePreview() {
    const canvasElement = previewCanvasRef.current
    const points = strokeRef.current
    if (!canvasElement) return
    const ctx = canvasElement.getContext('2d')
    if (!ctx) return
    const dpr = window.devicePixelRatio || 1
    const width = canvasElement.width / dpr
    const height = canvasElement.height / dpr
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, width, height)
    if (!points || points.length < 2) return
    const scale = internals()?.dm.data.scale ?? 1
    const outline = getStroke(points, { size: STROKE_SIZE * scale, simulatePressure: true })
    if (outline.length < 3) return
    ctx.beginPath()
    ctx.moveTo(outline[0][0], outline[0][1])
    for (let index = 1; index < outline.length; index += 1) {
      ctx.lineTo(outline[index][0], outline[index][1])
    }
    ctx.closePath()
    ctx.fillStyle = '#1d1d1d'
    ctx.fill()
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

  function startEditing(node: CanvasNode | null, x: number, y: number) {
    suppressTextCreateRef.current = false
    const textDefaults = DEFAULT_PREFERENCES.text
    const newTextDefaults = getPreferences().text
    const kind = node ? editKindOf(node) : null
    if (node && kind) {
      const style = node['x-superboard']?.style
      updateEditing({
        id: node.id,
        kind,
        x: node.x,
        y: node.y,
        width: node.width,
        height: node.height,
        value: editingValue(node, kind),
        fontSize: style?.fontSize ?? textDefaults.fontSize,
        fontFamily: style?.fontFamily ?? textDefaults.fontFamily,
        color: style?.color ?? textDefaults.color,
        opacity: style?.opacity ?? textDefaults.opacity,
        textAlign: style?.textAlign ?? textDefaults.textAlign,
      })
      return
    }
    updateEditing({
      id: null,
      kind: 'text',
      x,
      y,
      width:
        canvas['x-superboard']?.settings?.defaultBlockWidth ??
        DEFAULT_BLOCK_SIZES.text.width,
      height:
        canvas['x-superboard']?.settings?.defaultBlockHeight ??
        DEFAULT_BLOCK_SIZES.text.height,
      value: '',
      fontSize: newTextDefaults.fontSize,
      fontFamily: newTextDefaults.fontFamily,
      color: newTextDefaults.color,
      opacity: newTextDefaults.opacity,
      textAlign: newTextDefaults.textAlign,
    })
  }

  function commitEditing() {
    const current = editingRef.current
    if (!current) return
    suppressTextCreateRef.current = true
    const textarea = textareaRef.current
    const scale = internals()?.dm.data.scale ?? 1
    const measured = Math.max(
      TEXT_MIN_HEIGHT,
      (textarea?.scrollHeight ?? current.height * scale) / scale,
    )
    updateEditing(null)
    if (current.id) {
      const index = canvas.nodes.findIndex((item) => item.id === current.id)
      const node = canvas.nodes[index]
      if (!node) return
      if (current.value === '') {
        onBeforeChange()
        onApply(
          { ...canvas, nodes: canvas.nodes.filter((item) => item.id !== current.id) },
          [],
        )
        return
      }
      let nextNode: CanvasNode
      if (current.kind === 'media') {
        if (node.type !== 'link') return
        const extension = node['x-superboard']
        nextNode = {
          ...node,
          url: current.value,
          'x-superboard': {
            ...extension,
            kind: 'media',
            media: {
              ...extension?.media,
              kind: detectMediaKind(current.value),
              url: current.value,
            },
          },
        }
      } else if (current.kind === 'pele') {
        if (node.type !== 'text') return
        nextNode = {
          ...node,
          text: `\`\`\`mermaid\n${current.value}\n\`\`\``,
          height: measured,
          'x-superboard': { ...node['x-superboard'], kind: 'pele', code: current.value },
        }
      } else {
        if (node.type !== 'text') return
        nextNode = { ...node, text: current.value, height: measured }
      }
      onBeforeChange()
      onApply(
        {
          ...canvas,
          nodes: canvas.nodes.map((item, itemIndex) =>
            itemIndex === index ? nextNode : item,
          ),
        },
        [current.id],
      )
      return
    }
    if (current.value.trim() === '') return
    const id = nextFreeId(existingIds(), 'text')
    const node: CanvasNode = {
      id,
      type: 'text',
      x: current.x,
      y: current.y,
      width: current.width,
      height: measured,
      text: current.value,
      'x-superboard': {
        kind: 'text',
        style: textStyleFromPreferences(),
      },
    }
    onBeforeChange()
    onApply({ ...canvas, nodes: [...canvas.nodes, node] }, [id])
    onExitTool()
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

  function eraseAt(x: number, y: number) {
    const data = internals()
    const gesture = eraserRef.current
    if (!data || !gesture) return
    const { dm, controller } = data
    const nodes = Object.values(dm.data.nodeMap).map((item) => item.ref)
    const map = nodeMapOf(nodes)
    const tolerance = 4 / dm.data.scale
    const removals: Array<{ node: CanvasNode; hit: Set<string> }> = []
    for (const node of nodes) {
      if (node['x-superboard']?.kind !== 'drawing' || isLocked(node, map)) continue
      if (!hitStroke(node, x, y, tolerance)) continue
      const hit = new Set<string>()
      for (const stroke of node['x-superboard']?.strokes ?? []) {
        if (strokeHit(stroke, node, x, y, tolerance)) hit.add(stroke.id)
      }
      if (hit.size > 0) removals.push({ node, hit })
    }
    const edgeIds = new Set<string>()
    const edgeTolerance = 8 / dm.data.scale
    for (const item of Object.values(dm.data.edgeMap ?? {})) {
      const edge = item.ref
      const from = dm.data.nodeMap[edge.fromNode]?.ref
      const to = dm.data.nodeMap[edge.toNode]?.ref
      if (!from || !to) continue
      const distance = distanceToSegment(
        x,
        y,
        from.x + from.width / 2,
        from.y + from.height / 2,
        to.x + to.width / 2,
        to.y + to.height / 2,
      )
      if (distance <= edgeTolerance) edgeIds.add(edge.id)
    }
    if (removals.length === 0 && edgeIds.size === 0) return
    if (!gesture.changed) {
      gesture.changed = true
      onBeforeChange()
    }
    const removedNodes = new Set<string>()
    for (const removal of removals) {
      const extension = removal.node['x-superboard']
      if (!extension?.strokes) continue
      extension.strokes = extension.strokes.filter((stroke) => !removal.hit.has(stroke.id))
      if (extension.strokes.length > 0) continue
      removedNodes.add(removal.node.id)
      const index = canvas.nodes.findIndex((node) => node.id === removal.node.id)
      if (index >= 0) canvas.nodes.splice(index, 1)
      delete dm.data.nodeMap[removal.node.id]
    }
    const shouldRemoveEdge = (edge: CanvasEdge) =>
      edgeIds.has(edge.id) ||
      removedNodes.has(edge.fromNode) ||
      removedNodes.has(edge.toNode)
    canvas.edges = canvas.edges.filter((edge) => !shouldRemoveEdge(edge))
    for (const edge of Object.values(dm.data.edgeMap ?? {})) {
      if (shouldRemoveEdge(edge.ref)) delete dm.data.edgeMap[edge.ref.id]
    }
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
    const x = Math.min(current.startX, current.currentX)
    const y = Math.min(current.startY, current.currentY)
    const shapeKind = shape === 'rounded-rect' ? 'rect' : shape
    const id = nextFreeId(existingIds(), shapeKind)
    const extension: SuperBoardNodeExtension = {
      kind: 'shape',
      shape: shapeKind,
      ...(shape === 'rounded-rect' ? { roundedRect: true } : {}),
      style: {
        ...blockStyleFromPreferences(),
        ...(shape === 'line' ? { backgroundColor: 'transparent' } : {}),
        ...(shape === 'rounded-rect'
          ? { cornerRadius: 8 }
          : shape === 'rect'
            ? { cornerRadius: getPreferences().shapeCornerRadius }
            : {}),
      },
    }
    if (shape === 'line') {
      extension.lineFlip = {
        x: current.currentX < current.startX,
        y: current.currentY < current.startY,
      }
    }
    const node: CanvasNode = {
      id,
      type: 'group',
      x,
      y,
      width: Math.max(1, width),
      height: Math.max(1, height),
      'x-superboard': extension,
    }
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
    const world = points.map(([x, y, pressure]) => [
      (x - offsetX) / scale,
      (y - offsetY) / scale,
      pressure ?? 0.5,
    ])
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    for (const [x, y] of world) {
      minX = Math.min(minX, x)
      minY = Math.min(minY, y)
      maxX = Math.max(maxX, x)
      maxY = Math.max(maxY, y)
    }
    const pad = STROKE_SIZE / 2 + 1
    minX -= pad
    minY -= pad
    maxX += pad
    maxY += pad
    const id = nextFreeId(existingIds(), 'draw')
    const local = world.map(
      ([x, y, pressure]) => [x - minX, y - minY, pressure] as [number, number, number],
    )
    const node: CanvasNode = {
      id,
      type: 'group',
      x: minX,
      y: minY,
      width: Math.max(1, maxX - minX),
      height: Math.max(1, maxY - minY),
      'x-superboard': {
        kind: 'drawing',
        strokes: [
          {
            id: `${id}-1`,
            color: '#1d1d1d',
            size: STROKE_SIZE,
            points: local,
          },
        ],
      },
    }
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
    const sides = arrowSides(from, target)
    const edge: CanvasEdge = {
      id: nextFreeId(existingIds(), 'edge'),
      fromNode: from.id,
      toNode: target.id,
      fromSide: sides.fromSide,
      toSide: closestSide(target, current.currentX, current.currentY),
      fromEnd: 'none',
      toEnd: 'arrow',
    }
    onBeforeChange()
    onApply({ ...canvas, edges: [...canvas.edges, edge] }, [])
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
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
      const hit = findNodeAt(point.worldX, point.worldY, (node) => editKindOf(node) !== null)
      if (hit?.['x-superboard']?.kind === 'markdown' && onEditMarkdown) {
        onEditMarkdown(hit.id)
        return
      }
      startEditing(hit, point.worldX, point.worldY)
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

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
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
      const point = [
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
      const next = { ...arrowRef.current, currentX: point.worldX, currentY: point.worldY }
      arrowRef.current = next
      setArrowDraft(next)
    }
  }

  function handlePointerUp(event: ReactPointerEvent<HTMLDivElement>) {
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
      return
    }
    if (tool === 'eraser') {
      eraserRef.current = null
    }
  }

  if (tool === 'select') return null

  const view = getView()

  function screenRect(startX: number, startY: number, endX: number, endY: number) {
    if (!view) return null
    const left = view.offsetX + Math.min(startX, endX) * view.scale
    const top = view.offsetY + Math.min(startY, endY) * view.scale
    return {
      left,
      top,
      width: Math.abs(endX - startX) * view.scale,
      height: Math.abs(endY - startY) * view.scale,
    }
  }

  const shapePreview = draft && view ? screenRect(draft.startX, draft.startY, draft.currentX, draft.currentY) : null
  const arrowPreview =
    arrowDraft && view
      ? {
          startX: view.offsetX + arrowDraft.startX * view.scale,
          startY: view.offsetY + arrowDraft.startY * view.scale,
          endX: view.offsetX + arrowDraft.currentX * view.scale,
          endY: view.offsetY + arrowDraft.currentY * view.scale,
        }
      : null
  const arrowTarget = arrowDraft
    ? findNodeAt(arrowDraft.currentX, arrowDraft.currentY, (node) => node.id !== arrowDraft.fromId)
    : null
  const arrowTargetSide =
    arrowDraft && arrowTarget
      ? closestSide(arrowTarget, arrowDraft.currentX, arrowDraft.currentY)
      : null
  const arrowTargetBox =
    arrowTarget && view
      ? {
          left: view.offsetX + arrowTarget.x * view.scale,
          top: view.offsetY + arrowTarget.y * view.scale,
          width: arrowTarget.width * view.scale,
          height: arrowTarget.height * view.scale,
        }
      : null
  const arrowTargetHandles = arrowTargetBox
    ? {
        top: {
          x: arrowTargetBox.left + arrowTargetBox.width / 2,
          y: arrowTargetBox.top,
        },
        bottom: {
          x: arrowTargetBox.left + arrowTargetBox.width / 2,
          y: arrowTargetBox.top + arrowTargetBox.height,
        },
        left: {
          x: arrowTargetBox.left,
          y: arrowTargetBox.top + arrowTargetBox.height / 2,
        },
        right: {
          x: arrowTargetBox.left + arrowTargetBox.width,
          y: arrowTargetBox.top + arrowTargetBox.height / 2,
        },
      }
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
      {shapePreview || arrowPreview ? (
        <svg className="sb-editor-tool-preview">
          {shapePreview && draft ? (
            tool === 'line' ? (
              <line
                x1={shapePreview.left + (draft.currentX <= draft.startX ? shapePreview.width : 0)}
                y1={shapePreview.top + (draft.currentY <= draft.startY ? shapePreview.height : 0)}
                x2={shapePreview.left + (draft.currentX <= draft.startX ? 0 : shapePreview.width)}
                y2={shapePreview.top + (draft.currentY <= draft.startY ? 0 : shapePreview.height)}
              />
            ) : tool === 'ellipse' ? (
              <ellipse
                cx={shapePreview.left + shapePreview.width / 2}
                cy={shapePreview.top + shapePreview.height / 2}
                rx={shapePreview.width / 2}
                ry={shapePreview.height / 2}
              />
            ) : tool === 'diamond' ? (
              <polygon
                points={[
                  `${shapePreview.left + shapePreview.width / 2},${shapePreview.top}`,
                  `${shapePreview.left + shapePreview.width},${shapePreview.top + shapePreview.height / 2}`,
                  `${shapePreview.left + shapePreview.width / 2},${shapePreview.top + shapePreview.height}`,
                  `${shapePreview.left},${shapePreview.top + shapePreview.height / 2}`,
                ].join(' ')}
              />
            ) : (
              <rect
                x={shapePreview.left}
                y={shapePreview.top}
                width={shapePreview.width}
                height={shapePreview.height}
                rx={tool === 'rounded-rect' ? 8 : 0}
              />
            )
          ) : null}
          {arrowPreview ? (
            <>
              {arrowTargetBox ? (
                <>
                  <rect
                    className="sb-editor-arrow-target"
                    x={arrowTargetBox.left}
                    y={arrowTargetBox.top}
                    width={arrowTargetBox.width}
                    height={arrowTargetBox.height}
                    rx={6}
                  />
                  {arrowTargetHandles
                    ? (['top', 'right', 'bottom', 'left'] as const).map((side) => (
                        <circle
                          key={side}
                          className={`sb-editor-arrow-target-handle${
                            arrowTargetSide === side ? ' is-active' : ''
                          }`}
                          cx={arrowTargetHandles[side].x}
                          cy={arrowTargetHandles[side].y}
                          r={arrowTargetSide === side ? 5 : 3.5}
                        />
                      ))
                    : null}
                </>
              ) : null}
              <line
                x1={arrowPreview.startX}
                y1={arrowPreview.startY}
                x2={arrowPreview.endX}
                y2={arrowPreview.endY}
              />
              <circle cx={arrowPreview.startX} cy={arrowPreview.startY} r={4} />
            </>
          ) : null}
        </svg>
      ) : null}
      {editing && textPreview ? (
        <textarea
          ref={textareaRef}
          autoFocus
          className="sb-editor-text-input"
          style={textPreview}
          value={editing.value}
          onChange={(event) => {
            const current = editingRef.current
            if (!current) return
            const scale = internals()?.dm.data.scale ?? 1
            const height = Math.max(
              TEXT_MIN_HEIGHT,
              event.currentTarget.scrollHeight / scale,
            )
            updateEditing({ ...current, value: event.target.value, height })
          }}
          onBlur={commitEditing}
          onPointerDown={(event) => event.stopPropagation()}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.preventDefault()
              event.stopPropagation()
              commitEditing()
              onExitTool()
              return
            }
            if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
              event.preventDefault()
              commitEditing()
              onExitTool()
            }
          }}
        />
      ) : null}
    </>
  )
}

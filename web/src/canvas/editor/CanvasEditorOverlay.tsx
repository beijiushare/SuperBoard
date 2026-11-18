import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { internal } from '../../vendor/json-canvas-viewer/src/index.ts'
import type { CanvasDocument, CanvasEdge, CanvasNode } from '../model'
import type { CanvasViewerHandle } from '../viewer/CanvasViewer'
import {
  blockKind,
  contentScale,
  isActionableNode,
  isBlockNode,
  isRatioLocked,
} from './blocks'
import { BlockActions } from './BlockActions'
import { edgeGeometry, edgePath } from './edges'
import {
  SELECTION_CORNERS,
  SELECTION_SIDES,
  canShowSelectionRotate,
  selectionChromeStyle,
  selectionEdgeStyle,
  selectionHandleStyle,
  selectionRotateStyle,
  visibleSelectionCorners,
} from './selectionChrome'
import {
  collectDescendants,
  isInsideGroup,
  isLocked,
  nodeMapOf,
  selectableAncestor,
} from './hierarchy'

type DataManager = {
  data: {
    container: HTMLDivElement
    offsetX: number
    offsetY: number
    scale: number
    nodeMap: Record<string, { ref: CanvasNode }>
  }
}

type Controller = {
  refresh: () => void
  onRefresh: { subscribe: (callback: () => void) => () => void }
}

interface CanvasEditorOverlayProps {
  canvas: CanvasDocument
  viewerRef: React.RefObject<CanvasViewerHandle | null>
  selectedIds: string[]
  onSelect: (ids: string[]) => void
  onChange?: () => void
  onBeforeChange?: () => void
  interactive?: boolean
  selectedEdgeId?: string | null
  onSelectEdge?: (id: string | null) => void
  focusedGroupId?: string | null
  activeEditingId?: string | null
  selectionSuppressedId?: string | null
  guidesEnabled?: boolean
  onToggleBlockEdit?: (id: string) => void
  onFocusBlockEdit?: (id: string) => void
  onDeleteBlock?: (id: string) => void
  onResetBlockSize?: (id: string) => void
  onToggleRatioLock?: (id: string) => void
}

interface DragNode {
  node: CanvasNode
  startX: number
  startY: number
  startWidth: number
  startHeight: number
}

const GUIDE_DISTANCE_THRESHOLD_PX = 3

function hasIframeContent(node: CanvasNode) {
  if (node['x-superboard']?.kind === 'schedule') return true
  if (node['x-superboard']?.media?.kind === 'iframe') return true
  return node.type === 'text' && /<iframe\b/i.test(node.text)
}

interface DragState {
  kind: 'move' | 'resize' | 'rotate'
  nodes: DragNode[]
  primary: CanvasNode
  startClientX: number
  startClientY: number
  startX: number
  startY: number
  startWidth: number
  startHeight: number
  scale: number
  corner?: string
  startAngle?: number
  startRotation?: number
  changed?: boolean
  centerX?: number
  centerY?: number
  ratioLocked?: boolean
  startContentScale?: number
  rotationNodes?: Array<{
    node: CanvasNode
    startRotation: number
    offsetX: number
    offsetY: number
  }>
}

interface Marquee {
  left: number
  top: number
  width: number
  height: number
}

function isAdditiveSelection(event: {
  shiftKey: boolean
  metaKey: boolean
  ctrlKey: boolean
}) {
  return event.shiftKey || event.metaKey || event.ctrlKey
}

function screenRect(node: CanvasNode, offsetX: number, offsetY: number, scale: number) {
  return {
    left: offsetX + node.x * scale,
    top: offsetY + node.y * scale,
    width: node.width * scale,
    height: node.height * scale,
  }
}

function screenStyle(
  node: CanvasNode,
  offsetX: number,
  offsetY: number,
  scale: number,
): CSSProperties {
  const rect = screenRect(node, offsetX, offsetY, scale)
  const rotation = node['x-superboard']?.rotation
  return rotation
    ? { ...rect, transform: `rotate(${rotation}deg)`, transformOrigin: 'center center' }
    : rect
}

function intersects(a: Marquee, b: Marquee) {
  return (
    a.left < b.left + b.width &&
    a.left + a.width > b.left &&
    a.top < b.top + b.height &&
    a.top + a.height > b.top
  )
}

export function CanvasEditorOverlay({
  canvas,
  viewerRef,
  selectedIds,
  onSelect,
  onChange,
  onBeforeChange,
  interactive = true,
  selectedEdgeId = null,
  onSelectEdge,
  focusedGroupId = null,
  activeEditingId = null,
  selectionSuppressedId = null,
  guidesEnabled = true,
  onToggleBlockEdit,
  onFocusBlockEdit,
  onDeleteBlock,
  onResetBlockSize,
  onToggleRatioLock,
}: CanvasEditorOverlayProps) {
  const [tick, setTick] = useState(0)
  const [view, setView] = useState({ offsetX: 0, offsetY: 0, scale: 1 })
  const [marquee, setMarquee] = useState<Marquee | null>(null)
  const [guides, setGuides] = useState<{ x?: number; y?: number } | null>(null)
  const [actionsVisible, setActionsVisible] = useState(true)
  const [edgePreview, setEdgePreview] = useState<{
    fromX: number
    fromY: number
    x: number
    y: number
  } | null>(null)
  const canShowGuides =
    guidesEnabled && !activeEditingId && !selectionSuppressedId

  useEffect(() => {
    if (!canShowGuides) setGuides(null)
  }, [canShowGuides])

  useEffect(() => {
    const clearGuides = () => setGuides(null)
    window.addEventListener('pointerdown', clearGuides, true)
    return () => window.removeEventListener('pointerdown', clearGuides, true)
  }, [])
  const edgeDragRef = useRef<{
    edge: CanvasEdge
    point: 'from' | 'to'
    fixedX: number
    fixedY: number
  } | null>(null)
  const overlayRef = useRef<HTMLDivElement>(null)
  const worldRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef(view)
  const pendingViewRef = useRef<{ offsetX: number; offsetY: number; scale: number } | null>(null)
  const dmRef = useRef<DataManager | null>(null)
  const controllerRef = useRef<Controller | null>(null)
  const dragRef = useRef<DragState | null>(null)
  const marqueeStartRef = useRef<{ x: number; y: number } | null>(null)
  const marqueeAdditiveRef = useRef(false)
  const marqueeMovedRef = useRef(false)
  const suppressClickRef = useRef(false)

  useEffect(() => {
    const clearDrag = () => {
      dragRef.current = null
      setGuides(null)
      setActionsVisible(true)
    }
    window.addEventListener('pointerup', clearDrag, true)
    window.addEventListener('pointercancel', clearDrag, true)
    window.addEventListener('blur', clearDrag)
    return () => {
      window.removeEventListener('pointerup', clearDrag, true)
      window.removeEventListener('pointercancel', clearDrag, true)
      window.removeEventListener('blur', clearDrag)
    }
  }, [])

  useLayoutEffect(() => {
    const world = worldRef.current
    if (!world) return
    world.style.transform = ''
    world.style.removeProperty('--sb-actions-inverse')
  }, [view])

  useEffect(() => {
    let disposed = false
    let timer: number | undefined
    let unsubscribe: (() => void) | undefined
    let frame = 0
    let commitTimer: number | undefined

    const update = () => {
      frame = 0
      const dm = dmRef.current
      if (!dm) return
      const next = {
        offsetX: dm.data.offsetX,
        offsetY: dm.data.offsetY,
        scale: dm.data.scale,
      }
      const current = viewRef.current
      if (
        next.offsetX === current.offsetX &&
        next.offsetY === current.offsetY &&
        next.scale === current.scale
      ) {
        setTick((value) => value + 1)
        return
      }
      pendingViewRef.current = next
      const factor = next.scale / current.scale
      const translateX = next.offsetX - current.offsetX * factor
      const translateY = next.offsetY - current.offsetY * factor
      if (worldRef.current) {
        worldRef.current.style.transformOrigin = '0 0'
        worldRef.current.style.transform = `translate(${translateX}px, ${translateY}px) scale(${factor})`
        // Keep the action bar at a stable screen size while the overlay follows the zoom transform.
        worldRef.current.style.setProperty('--sb-actions-inverse', String(1 / factor))
      }
      if (!commitTimer) {
        commitTimer = window.setTimeout(() => {
          commitTimer = undefined
          const target = pendingViewRef.current
          if (!target) return
          pendingViewRef.current = null
          viewRef.current = target
          setView(target)
        }, 120)
      }
    }

    const schedule = () => {
      if (frame) return
      frame = requestAnimationFrame(update)
    }

    const attach = () => {
      if (disposed) return
      const viewer = viewerRef.current?.viewer as
        | { container?: { get: (key: unknown) => unknown } }
        | undefined
      if (!viewer?.container) {
        timer = window.setTimeout(attach, 100)
        return
      }
      try {
        dmRef.current = viewer.container.get(internal.DataManager as never) as DataManager
        controllerRef.current = viewer.container.get(internal.Controller as never) as Controller
        unsubscribe = controllerRef.current.onRefresh.subscribe(schedule)
        const initial = {
          offsetX: dmRef.current.data.offsetX,
          offsetY: dmRef.current.data.offsetY,
          scale: dmRef.current.data.scale,
        }
        pendingViewRef.current = null
        viewRef.current = initial
        setView(initial)
        setTick((value) => value + 1)
      } catch {
        timer = window.setTimeout(attach, 100)
      }
    }

    attach()
    return () => {
      disposed = true
      if (timer) window.clearTimeout(timer)
      if (frame) cancelAnimationFrame(frame)
      if (commitTimer) window.clearTimeout(commitTimer)
      unsubscribe?.()
      pendingViewRef.current = null
      dmRef.current = null
      controllerRef.current = null
    }
  }, [viewerRef])

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (!interactive || activeEditingId) return
      if (event.button !== 0) return
      const overlay = overlayRef.current
      const dm = dmRef.current
      if (!overlay || !dm) return
      const target = event.target as HTMLElement | null
      if (
        target?.closest(
          '.sb-editor-selection, .sb-editor-hitbox, .sb-editor-edge-hit, .sb-editor-edge-endpoint, .sb-block-actions, .sb-md-editor, .sb-style-panel, .sb-color-popover, .sb-color-trigger, .sb-modal-backdrop, .canvas-tool-palette, .canvas-tool-flyout, .JCV-overlay-container, .JCV-controls, .JCV-minimap-container, .sb-frame-controller, button, a, input, textarea, [contenteditable="true"]',
        )
      ) {
        return
      }
      const bounds = overlay.getBoundingClientRect()
      if (
        event.clientX < bounds.left ||
        event.clientX > bounds.right ||
        event.clientY < bounds.top ||
        event.clientY > bounds.bottom
      ) {
        return
      }
      event.preventDefault()
      event.stopPropagation()
      marqueeAdditiveRef.current = isAdditiveSelection(event)
      marqueeMovedRef.current = false
      marqueeStartRef.current = { x: event.clientX, y: event.clientY }
      setMarquee({ left: event.clientX - bounds.left, top: event.clientY - bounds.top, width: 0, height: 0 })
    }

    const onPointerMove = (event: PointerEvent) => {
      if (!interactive) return
      const start = marqueeStartRef.current
      const overlay = overlayRef.current
      if (!start || !overlay) return
      const bounds = overlay.getBoundingClientRect()
      const x = event.clientX - bounds.left
      const y = event.clientY - bounds.top
      const width = Math.abs(x - (start.x - bounds.left))
      const height = Math.abs(y - (start.y - bounds.top))
      if (width > 2 || height > 2) marqueeMovedRef.current = true
      setMarquee({
        left: Math.min(start.x - bounds.left, x),
        top: Math.min(start.y - bounds.top, y),
        width,
        height,
      })
    }

    const onPointerUp = (event: PointerEvent) => {
      const start = marqueeStartRef.current
      if (!interactive) {
        marqueeStartRef.current = null
        setMarquee(null)
        return
      }
      const dm = dmRef.current
      const overlay = overlayRef.current
      if (!start || !dm || !overlay) return
      marqueeStartRef.current = null
      const bounds = overlay.getBoundingClientRect()
      const x = event.clientX - bounds.left
      const y = event.clientY - bounds.top
      const box = {
        left: Math.min(start.x - bounds.left, x),
        top: Math.min(start.y - bounds.top, y),
        width: Math.abs(x - (start.x - bounds.left)),
        height: Math.abs(y - (start.y - bounds.top)),
      }
      onSelectEdge?.(null)
      const { offsetX, offsetY, scale } = dm.data
      const nodes = Object.values(dm.data.nodeMap).map((item) => item.ref)
      const map = nodeMapOf(nodes)
      const ids = new Set<string>()
      for (const node of nodes) {
        if (isLocked(node, map)) continue
        if (focusedGroupId && !isInsideGroup(node, focusedGroupId, map)) continue
        if (!intersects(box, screenRect(node, offsetX, offsetY, scale))) continue
        ids.add(selectableAncestor(node, map, focusedGroupId).id)
      }
      if (marqueeAdditiveRef.current) {
        for (const id of selectedIds) ids.add(id)
      }
      marqueeAdditiveRef.current = false
      suppressClickRef.current = marqueeMovedRef.current
      marqueeMovedRef.current = false
      onSelect([...ids])
      setMarquee(null)
    }

    window.addEventListener('pointerdown', onPointerDown, true)
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
    return () => {
      window.removeEventListener('pointerdown', onPointerDown, true)
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
    }
  }, [onSelect, onSelectEdge, interactive, focusedGroupId, selectedIds, activeEditingId])

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (suppressClickRef.current) {
        suppressClickRef.current = false
        return
      }
      const dm = dmRef.current
      const target = event.target as HTMLElement | null
      if (!dm || !target) return
      if (!dm.data.container.contains(target)) return
      if (isAdditiveSelection(event)) return
      if (
        target.closest('.JCV-overlay-container') ||
        target.closest('.sb-modal-backdrop') ||
        target.closest('button, a, input, textarea, select, [contenteditable="true"]')
      ) {
        return
      }
      onSelect([])
      onSelectEdge?.(null)
    }

    window.addEventListener('click', onClick)
    return () => window.removeEventListener('click', onClick)
  }, [onSelect, onSelectEdge])

  function beginMove(event: ReactPointerEvent, node: CanvasNode) {
    if (event.button !== 0 && event.button !== 2) return
    event.preventDefault()
    event.stopPropagation()
    const dm = dmRef.current
    if (!dm) return
    const allNodes = Object.values(dm.data.nodeMap).map((item) => item.ref)
    const map = nodeMapOf(allNodes)
    const target = selectableAncestor(node, map, focusedGroupId)
    if (isLocked(target, map)) return

    if (isAdditiveSelection(event)) {
      onSelect(
        selectedIds.includes(target.id)
          ? selectedIds.filter((id) => id !== target.id)
          : [...selectedIds, target.id],
      )
      return
    }

    const rootIds = selectedIds.includes(target.id) ? selectedIds : [target.id]
    if (!selectedIds.includes(target.id)) onSelect(rootIds)
    const seen = new Set<string>()
    const dragNodes: DragNode[] = []
    for (const id of rootIds) {
      const root = map.get(id)
      if (!root) continue
      for (const item of [root, ...collectDescendants(root, allNodes)]) {
        if (seen.has(item.id)) continue
        seen.add(item.id)
        dragNodes.push({
          node: item,
          startX: item.x,
          startY: item.y,
          startWidth: item.width,
          startHeight: item.height,
        })
      }
    }
    if (dragNodes.length === 0) return
    dragRef.current = {
      kind: 'move',
      nodes: dragNodes,
      primary: target,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startX: target.x,
      startY: target.y,
      startWidth: target.width,
      startHeight: target.height,
      scale: dm.data.scale,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function beginResize(event: ReactPointerEvent, node: CanvasNode, corner: string) {
    if (event.button !== 0) return
    event.stopPropagation()
    const dm = dmRef.current
    if (!dm) return
    const allNodes = Object.values(dm.data.nodeMap).map((item) => item.ref)
    const map = nodeMapOf(allNodes)
    const target = selectableAncestor(node, map, focusedGroupId)
    if (isLocked(target, map)) return
    onSelect([target.id])
    const dragNodes: DragNode[] = [target, ...collectDescendants(target, allNodes)].map((item) => ({
      node: item,
      startX: item.x,
      startY: item.y,
      startWidth: item.width,
      startHeight: item.height,
    }))
    dragRef.current = {
      kind: 'resize',
      nodes: dragNodes,
      primary: target,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startX: target.x,
      startY: target.y,
      startWidth: target.width,
      startHeight: target.height,
      scale: dm.data.scale,
      corner,
      ratioLocked: isActionableNode(target) && isRatioLocked(target),
      startContentScale: contentScale(target),
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function beginMultiMove(event: ReactPointerEvent, selection: CanvasNode[]) {
    if (event.button !== 0 && event.button !== 2) return
    if (selection.length < 2) return
    event.preventDefault()
    event.stopPropagation()
    const dm = dmRef.current
    if (!dm) return
    const allNodes = Object.values(dm.data.nodeMap).map((item) => item.ref)
    const map = nodeMapOf(allNodes)
    if (selection.some((node) => isLocked(node, map))) return
    const seen = new Set<string>()
    const dragNodes: DragNode[] = []
    for (const root of selection) {
      for (const item of [root, ...collectDescendants(root, allNodes)]) {
        if (seen.has(item.id)) continue
        seen.add(item.id)
        dragNodes.push({
          node: item,
          startX: item.x,
          startY: item.y,
          startWidth: item.width,
          startHeight: item.height,
        })
      }
    }
    const primary = selection[0]
    dragRef.current = {
      kind: 'move',
      nodes: dragNodes,
      primary,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startX: primary.x,
      startY: primary.y,
      startWidth: primary.width,
      startHeight: primary.height,
      scale: dm.data.scale,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function ensureExtension(node: CanvasNode) {
    if (!node['x-superboard']) {
      node['x-superboard'] = {
        kind: node.type === 'text' ? 'text' : node.type === 'group' ? 'group' : 'media',
      }
    }
    return node['x-superboard']
  }

  function beginMultiRotate(event: ReactPointerEvent, selection: CanvasNode[]) {
    if (event.button !== 0 || selection.length < 2) return
    event.stopPropagation()
    const dm = dmRef.current
    const overlay = overlayRef.current
    if (!dm || !overlay) return
    const map = nodeMapOf(selection)
    if (
      selection.some(
        (node) =>
          node['x-superboard']?.kind === 'group' || isLocked(node, map),
      )
    ) {
      return
    }
    const minX = Math.min(...selection.map((node) => node.x))
    const minY = Math.min(...selection.map((node) => node.y))
    const maxX = Math.max(...selection.map((node) => node.x + node.width))
    const maxY = Math.max(...selection.map((node) => node.y + node.height))
    const centerX = (minX + maxX) / 2
    const centerY = (minY + maxY) / 2
    const bounds = overlay.getBoundingClientRect()
    const { offsetX, offsetY, scale } = dm.data
    const centerScreenX = bounds.left + offsetX + centerX * scale
    const centerScreenY = bounds.top + offsetY + centerY * scale
    dragRef.current = {
      kind: 'rotate',
      nodes: selection.map((node) => ({
        node,
        startX: node.x,
        startY: node.y,
        startWidth: node.width,
        startHeight: node.height,
      })),
      primary: selection[0],
      startClientX: event.clientX,
      startClientY: event.clientY,
      startX: centerX,
      startY: centerY,
      startWidth: 0,
      startHeight: 0,
      scale,
      centerX,
      centerY,
      startAngle: Math.atan2(event.clientY - centerScreenY, event.clientX - centerScreenX),
      rotationNodes: selection.map((node) => ({
        node,
        startRotation: node['x-superboard']?.rotation ?? 0,
        offsetX: node.x + node.width / 2 - centerX,
        offsetY: node.y + node.height / 2 - centerY,
      })),
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function beginRotate(event: ReactPointerEvent, node: CanvasNode) {
    if (event.button !== 0) return
    event.stopPropagation()
    const dm = dmRef.current
    const overlay = overlayRef.current
    if (!dm || !overlay) return
    const map = nodeMapOf(Object.values(dm.data.nodeMap).map((item) => item.ref))
    const target = selectableAncestor(node, map, focusedGroupId)
    if (target['x-superboard']?.kind === 'group') return
    if (isLocked(target, map)) return
    ensureExtension(target)
    onSelect([target.id])
    const bounds = overlay.getBoundingClientRect()
    const { offsetX, offsetY, scale } = dm.data
    const centerX = bounds.left + offsetX + (target.x + target.width / 2) * scale
    const centerY = bounds.top + offsetY + (target.y + target.height / 2) * scale
    dragRef.current = {
      kind: 'rotate',
      nodes: [
        {
          node: target,
          startX: target.x,
          startY: target.y,
          startWidth: target.width,
          startHeight: target.height,
        },
      ],
      primary: target,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startX: target.x,
      startY: target.y,
      startWidth: target.width,
      startHeight: target.height,
      scale,
      startAngle: Math.atan2(event.clientY - centerY, event.clientX - centerX),
      startRotation: target['x-superboard']?.rotation ?? 0,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

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
    event: ReactPointerEvent,
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

  function finishEdgeEndpoint(event: ReactPointerEvent) {
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

function cornerRatioScale(
  width: number,
  height: number,
  startWidth: number,
  startHeight: number,
) {
  const startRatio = startWidth / startHeight
  const cornerRatio = width / height
  return cornerRatio > startRatio ? width / startWidth : height / startHeight
}

  function applyContentScale(drag: DragState, ratioScale: number) {
    if (!drag.ratioLocked || drag.nodes.length !== 1) return
    const kind = blockKind(drag.primary)
    if (!kind) return
    const extension = ensureExtension(drag.primary)
    extension.contentScale =
      Math.round((drag.startContentScale ?? 1) * ratioScale * 1000) / 1000
  }

  function movePointer(event: ReactPointerEvent) {
    if (edgeDragRef.current) {
      const point = edgeWorldPoint(event)
      if (point) {
        setEdgePreview({
          fromX: edgeDragRef.current.fixedX,
          fromY: edgeDragRef.current.fixedY,
          x: point.x,
          y: point.y,
        })
      }
      return
    }
    const drag = dragRef.current
    if (!drag) return
    const dx = (event.clientX - drag.startClientX) / drag.scale
    const dy = (event.clientY - drag.startClientY) / drag.scale
    if (!drag.changed && (dx !== 0 || dy !== 0)) {
      drag.changed = true
      setActionsVisible(false)
      onBeforeChange?.()
    }
    if (drag.kind === 'move') {
      const dmNow = dmRef.current
      const dragDistance = Math.hypot(
        event.clientX - drag.startClientX,
        event.clientY - drag.startClientY,
      )
      const showGuides = canShowGuides && dragDistance >= GUIDE_DISTANCE_THRESHOLD_PX
      let moveX = dx
      let moveY = dy
      let nextGuides: { x?: number; y?: number } | null = null
      if (dmNow && !event.altKey && showGuides) {
        const dragged = new Set(drag.nodes.map((item) => item.node.id))
        let left = Infinity
        let top = Infinity
        let right = -Infinity
        let bottom = -Infinity
        for (const item of drag.nodes) {
          left = Math.min(left, item.startX)
          top = Math.min(top, item.startY)
          right = Math.max(right, item.startX + item.startWidth)
          bottom = Math.max(bottom, item.startY + item.startHeight)
        }
        const leftEdge = left + dx
        const rightEdge = right + dx
        const topEdge = top + dy
        const bottomEdge = bottom + dy
        const xAnchors = [leftEdge, (leftEdge + rightEdge) / 2, rightEdge]
        const yAnchors = [topEdge, (topEdge + bottomEdge) / 2, bottomEdge]
        const threshold = 8 / drag.scale
        let bestX = { diff: threshold + 1, target: 0, anchor: 0 }
        let bestY = { diff: threshold + 1, target: 0, anchor: 0 }
        for (const item of Object.values(dmNow.data.nodeMap)) {
          const node = item.ref
          if (dragged.has(node.id)) continue
          const xTargets = [node.x, node.x + node.width / 2, node.x + node.width]
          const yTargets = [node.y, node.y + node.height / 2, node.y + node.height]
          for (const target of xTargets) {
            for (const anchor of xAnchors) {
              const diff = Math.abs(target - anchor)
              if (diff < bestX.diff) bestX = { diff, target, anchor }
            }
          }
          for (const target of yTargets) {
            for (const anchor of yAnchors) {
              const diff = Math.abs(target - anchor)
              if (diff < bestY.diff) bestY = { diff, target, anchor }
            }
          }
        }
        if (bestX.diff <= threshold) {
          moveX += bestX.target - bestX.anchor
          nextGuides = { ...(nextGuides ?? {}), x: bestX.target }
        }
        if (bestY.diff <= threshold) {
          moveY += bestY.target - bestY.anchor
          nextGuides = { ...(nextGuides ?? {}), y: bestY.target }
        }
      }
      setGuides(showGuides ? nextGuides : null)
      for (const item of drag.nodes) {
        item.node.x = item.startX + moveX
        item.node.y = item.startY + moveY
      }
    } else if (drag.kind === 'rotate' && drag.rotationNodes) {
      const overlay = overlayRef.current
      const dm = dmRef.current
      if (!overlay || !dm || drag.centerX === undefined || drag.centerY === undefined) return
      const bounds = overlay.getBoundingClientRect()
      const { offsetX, offsetY, scale } = dm.data
      const centerScreenX = bounds.left + offsetX + drag.centerX * scale
      const centerScreenY = bounds.top + offsetY + drag.centerY * scale
      const angle = Math.atan2(event.clientY - centerScreenY, event.clientX - centerScreenX)
      let delta = ((angle - (drag.startAngle ?? angle)) * 180) / Math.PI
      if (event.shiftKey) delta = Math.round(delta / 15) * 15
      const radians = (delta * Math.PI) / 180
      const cos = Math.cos(radians)
      const sin = Math.sin(radians)
      for (const item of drag.rotationNodes) {
        const centerX = drag.centerX + item.offsetX * cos - item.offsetY * sin
        const centerY = drag.centerY + item.offsetX * sin + item.offsetY * cos
        item.node.x = centerX - item.node.width / 2
        item.node.y = centerY - item.node.height / 2
        const extension = ensureExtension(item.node)
        const degree = ((item.startRotation + delta) % 360 + 360) % 360
        extension.rotation = Math.round(degree * 10) / 10
      }
    } else if (drag.kind === 'rotate') {
      const overlay = overlayRef.current
      const dm = dmRef.current
      if (!overlay || !dm) return
      const extension = ensureExtension(drag.primary)
      const bounds = overlay.getBoundingClientRect()
      const { offsetX, offsetY, scale } = dm.data
      const centerX = bounds.left + offsetX + (drag.startX + drag.startWidth / 2) * scale
      const centerY = bounds.top + offsetY + (drag.startY + drag.startHeight / 2) * scale
      const angle = Math.atan2(event.clientY - centerY, event.clientX - centerX)
      const delta = ((angle - (drag.startAngle ?? angle)) * 180) / Math.PI
      let degree = (drag.startRotation ?? 0) + delta
      if (event.shiftKey) degree = Math.round(degree / 15) * 15
      degree = ((degree % 360) + 360) % 360
      extension.rotation = Math.round(degree * 10) / 10
    } else {
      const corner = drag.corner ?? 'se'
      const hasEast = corner.includes('e')
      const hasWest = corner.includes('w')
      const hasSouth = corner.includes('s')
      const hasNorth = corner.includes('n')
      const rotation = drag.primary['x-superboard']?.rotation ?? 0
      const overlay = overlayRef.current
      const dm = dmRef.current
      if (drag.nodes.length === 1 && rotation !== 0 && overlay && dm) {
        const bounds = overlay.getBoundingClientRect()
        const pointerX = (event.clientX - bounds.left - dm.data.offsetX) / dm.data.scale
        const pointerY = (event.clientY - bounds.top - dm.data.offsetY) / dm.data.scale
        const radians = (rotation * Math.PI) / 180
        const cos = Math.cos(radians)
        const sin = Math.sin(radians)
        const rotate = (x: number, y: number) => ({
          x: x * cos - y * sin,
          y: x * sin + y * cos,
        })
        const inverseRotate = (x: number, y: number) => ({
          x: x * cos + y * sin,
          y: -x * sin + y * cos,
        })
        const signX = hasEast ? 1 : hasWest ? -1 : 0
        const signY = hasSouth ? 1 : hasNorth ? -1 : 0
        const centerX = drag.startX + drag.startWidth / 2
        const centerY = drag.startY + drag.startHeight / 2
        const anchorOffset = rotate(
          (-signX * drag.startWidth) / 2,
          (-signY * drag.startHeight) / 2,
        )
        const anchor = { x: centerX + anchorOffset.x, y: centerY + anchorOffset.y }
        const local = inverseRotate(pointerX - anchor.x, pointerY - anchor.y)
        let width = signX === 0 ? drag.startWidth : Math.max(40, signX * local.x)
        let height = signY === 0 ? drag.startHeight : Math.max(40, signY * local.y)
        let ratioScale = 1
        if (drag.ratioLocked) {
          if (signX === 0) ratioScale = height / drag.startHeight
          else if (signY === 0) ratioScale = width / drag.startWidth
          else ratioScale = cornerRatioScale(width, height, drag.startWidth, drag.startHeight)
          width = drag.startWidth * ratioScale
          height = drag.startHeight * ratioScale
        }
        const centerOffset = rotate((signX * width) / 2, (signY * height) / 2)
        const nextCenter = { x: anchor.x + centerOffset.x, y: anchor.y + centerOffset.y }
        drag.primary.x = nextCenter.x - width / 2
        drag.primary.y = nextCenter.y - height / 2
        drag.primary.width = width
        drag.primary.height = height
        applyContentScale(drag, ratioScale)
      } else {
        let width = hasEast
          ? Math.max(40, drag.startWidth + dx)
          : hasWest
            ? Math.max(40, drag.startWidth - dx)
            : drag.startWidth
        let height = hasSouth
          ? Math.max(40, drag.startHeight + dy)
          : hasNorth
            ? Math.max(40, drag.startHeight - dy)
            : drag.startHeight
        let ratioScale = 1
        if (drag.ratioLocked) {
          if (!hasEast && !hasWest) ratioScale = height / drag.startHeight
          else if (!hasSouth && !hasNorth) ratioScale = width / drag.startWidth
          else ratioScale = cornerRatioScale(width, height, drag.startWidth, drag.startHeight)
          width = drag.startWidth * ratioScale
          height = drag.startHeight * ratioScale
        }
        const nextX = hasWest ? drag.startX + drag.startWidth - width : drag.startX
        const nextY = hasNorth ? drag.startY + drag.startHeight - height : drag.startY
        const scaleX = drag.startWidth === 0 ? 1 : width / drag.startWidth
        const scaleY = drag.startHeight === 0 ? 1 : height / drag.startHeight
        for (const item of drag.nodes) {
          item.node.x = nextX + (item.startX - drag.startX) * scaleX
          item.node.y = nextY + (item.startY - drag.startY) * scaleY
          item.node.width = Math.max(1, item.startWidth * scaleX)
          item.node.height = Math.max(1, item.startHeight * scaleY)
        }
        applyContentScale(drag, ratioScale)
      }
    }
    const dmNow = dmRef.current
    if (focusedGroupId && dmNow) {
      const allNodes = Object.values(dmNow.data.nodeMap).map((item) => item.ref)
      const group = dmNow.data.nodeMap[focusedGroupId]?.ref
      const descendants = group ? collectDescendants(group, allNodes) : []
      if (group && descendants.length > 0) {
        const minX = Math.min(...descendants.map((node) => node.x))
        const minY = Math.min(...descendants.map((node) => node.y))
        const maxX = Math.max(...descendants.map((node) => node.x + node.width))
        const maxY = Math.max(...descendants.map((node) => node.y + node.height))
        group.x = minX
        group.y = minY
        group.width = Math.max(1, maxX - minX)
        group.height = Math.max(1, maxY - minY)
      }
    }
    controllerRef.current?.refresh()
    onChange?.()
    setTick((value) => value + 1)
  }

  function endDrag() {
    dragRef.current = null
    setGuides(null)
    setActionsVisible(true)
  }

  const dm = dmRef.current
  if (!dm) return null
  const { offsetX, offsetY, scale } = view
  const nodes = Object.values(dm.data.nodeMap).map((item) => item.ref)
  const map = nodeMapOf(nodes)
  const selectedNodes = nodes.filter((node) => selectedIds.includes(node.id))
  const selectionBoxNodes = selectedNodes.filter(
    (node) =>
      node.id !== selectionSuppressedId &&
      (node.id !== activeEditingId || blockKind(node) === 'text'),
  )
  const focusedNode = focusedGroupId ? map.get(focusedGroupId) ?? null : null
  const selectedEdge = selectedEdgeId
    ? canvas.edges.find((edge) => edge.id === selectedEdgeId) ?? null
    : null
  const selectedEdgeGeometry = selectedEdge ? edgeGeometry(selectedEdge, map) : null
  const canMultiRotate =
    selectedNodes.length > 1 &&
    selectedNodes.every(
      (node) => node['x-superboard']?.kind !== 'group' && !isLocked(node, map),
    )
  const selectedBounds =
    selectedNodes.length > 0
      ? {
          left: Math.min(...selectedNodes.map((node) => node.x)),
          top: Math.min(...selectedNodes.map((node) => node.y)),
          right: Math.max(...selectedNodes.map((node) => node.x + node.width)),
          bottom: Math.max(...selectedNodes.map((node) => node.y + node.height)),
        }
      : null
  const editable = nodes.filter((node) => {
    const kind = node['x-superboard']?.kind
    if (kind !== 'shape' && kind !== 'drawing' && kind !== 'group') return false
    return !isLocked(node, map)
  })

  return (
    <div
      ref={overlayRef}
      className="sb-editor-overlay"
      data-tick={tick}
      style={selectionChromeStyle}
    >
      <div ref={worldRef} className="sb-editor-world">
      <svg className="sb-editor-edge-layer">
        <g transform={`translate(${offsetX} ${offsetY}) scale(${scale})`}>
          {canvas.edges.map((edge) => {
            const path = edgePath(edge, map)
            if (!path) return null
            return (
              <g key={edge.id}>
                <path
                  className="sb-editor-edge-hit"
                  d={path}
                  fill="none"
                  vectorEffect="non-scaling-stroke"
                  onPointerDown={(event) => {
                    if (event.button !== 0) return
                    event.preventDefault()
                    event.stopPropagation()
                    onSelect?.([])
                    onSelectEdge?.(edge.id)
                  }}
                />
                {edge.id === selectedEdgeId ? (
                  <path
                    className="sb-editor-edge-selected"
                    d={path}
                    fill="none"
                    vectorEffect="non-scaling-stroke"
                  />
                ) : null}
              </g>
            )
          })}
        </g>
        {edgePreview ? (
          <line
            className="sb-editor-edge-preview"
            x1={offsetX + edgePreview.fromX * scale}
            y1={offsetY + edgePreview.fromY * scale}
            x2={offsetX + edgePreview.x * scale}
            y2={offsetY + edgePreview.y * scale}
            vectorEffect="non-scaling-stroke"
          />
        ) : null}
      </svg>
      {selectedEdge && selectedEdgeGeometry ? (
        <>
          <div
            className="sb-editor-edge-endpoint"
            style={{
              left: offsetX + selectedEdgeGeometry.start.x * scale,
              top: offsetY + selectedEdgeGeometry.start.y * scale,
            }}
            onPointerDown={(event) => beginEdgeEndpoint(event, selectedEdge, 'from')}
            onPointerMove={movePointer}
            onPointerUp={finishEdgeEndpoint}
          />
          <div
            className="sb-editor-edge-endpoint"
            style={{
              left: offsetX + selectedEdgeGeometry.end.x * scale,
              top: offsetY + selectedEdgeGeometry.end.y * scale,
            }}
            onPointerDown={(event) => beginEdgeEndpoint(event, selectedEdge, 'to')}
            onPointerMove={movePointer}
            onPointerUp={finishEdgeEndpoint}
          />
        </>
      ) : null}
      {focusedNode ? (
        <div
          className="sb-editor-group-focus"
          style={screenStyle(focusedNode, offsetX, offsetY, scale)}
        />
      ) : null}
      {editable
        .map((node) => (
          <div
            key={node.id}
            className="sb-editor-hitbox"
            style={screenStyle(node, offsetX, offsetY, scale)}
            onPointerDown={(event) => beginMove(event, node)}
            onPointerMove={movePointer}
            onPointerUp={endDrag}
          />
        ))}

      {nodes
        .filter((node) => isBlockNode(node) && !isLocked(node, map))
        .map((node) => (
          <div
            key={`block-hit-${node.id}`}
            data-node-id={node.id}
            className={`sb-editor-hitbox sb-editor-block-hitbox${
              selectedIds.includes(node.id) && hasIframeContent(node)
                ? ' is-interactive'
                : ''
            }`}
            style={screenStyle(node, offsetX, offsetY, scale)}
            onPointerDown={(event) => beginMove(event, node)}
            onPointerMove={movePointer}
            onPointerUp={endDrag}
            onDoubleClick={(event) => {
              event.preventDefault()
              event.stopPropagation()
              onToggleBlockEdit?.(node.id)
            }}
          />
        ))}

      {nodes
        .filter(
          (node) =>
            isLocked(node, map) &&
            node.id === selectableAncestor(node, map, focusedGroupId)?.id,
        )
        .map((node) => (
          <div
            key={`locked-hit-${node.id}`}
            className="sb-editor-hitbox sb-editor-locked-hitbox"
            style={screenStyle(node, offsetX, offsetY, scale)}
            onPointerDown={(event) => {
              if (event.button !== 0) return
              event.preventDefault()
              event.stopPropagation()
              onSelect(
                isAdditiveSelection(event)
                  ? selectedIds.includes(node.id)
                    ? selectedIds.filter((id) => id !== node.id)
                    : [...selectedIds, node.id]
                  : [node.id],
              )
              onSelectEdge?.(null)
            }}
          />
        ))}

      {selectionBoxNodes.map((node) => (
        <div
          key={node.id}
          className={`sb-editor-selection${
            hasIframeContent(node) || activeEditingId === node.id
              ? ' is-interactive'
              : ''
          }`}
          style={screenStyle(node, offsetX, offsetY, scale)}
          onPointerDown={(event) => beginMove(event, node)}
          onPointerMove={movePointer}
          onPointerUp={endDrag}
        >
          {selectionBoxNodes.length === 1 ? (
            <>
              {hasIframeContent(node)
                ? SELECTION_SIDES.map((side) => (
                    <span
                      key={`drag-${side}`}
                      className={`sb-editor-drag-edge sb-editor-drag-edge-${side}`}
                      onPointerDown={(event) => beginMove(event, node)}
                      onPointerMove={movePointer}
                      onPointerUp={endDrag}
                    />
                  ))
                : null}
              {visibleSelectionCorners(
                node.width * scale,
                node.height * scale,
              ).map((corner) => (
                <span
                  key={corner}
                  className="sb-editor-handle"
                  style={selectionHandleStyle(corner)}
                  onPointerDown={(event) => beginResize(event, node, corner)}
                  onPointerMove={movePointer}
                  onPointerUp={endDrag}
                />
              ))}
              {SELECTION_SIDES.map((side) => (
                <span
                  key={side}
                  className="sb-editor-edge-handle"
                  style={selectionEdgeStyle(side)}
                  onPointerDown={(event) => beginResize(event, node, side)}
                  onPointerMove={movePointer}
                  onPointerUp={endDrag}
                />
              ))}
              {node['x-superboard']?.kind !== 'group' &&
              canShowSelectionRotate(node.width * scale, node.height * scale)
                ? SELECTION_CORNERS.map((corner) => (
                    <span
                      key={corner}
                      className="sb-editor-rotate"
                      style={selectionRotateStyle(corner)}
                      onPointerDown={(event) => beginRotate(event, node)}
                      onPointerMove={movePointer}
                      onPointerUp={endDrag}
                    />
                  ))
                : null}
            </>
          ) : null}
        </div>
      ))}

      {canMultiRotate && selectedBounds ? (
        <div
          className="sb-editor-multi-selection"
          style={{
            left: offsetX + selectedBounds.left * scale,
            top: offsetY + selectedBounds.top * scale,
            width: (selectedBounds.right - selectedBounds.left) * scale,
            height: (selectedBounds.bottom - selectedBounds.top) * scale,
          }}
          onPointerDown={(event) => beginMultiMove(event, selectedNodes)}
          onPointerMove={movePointer}
          onPointerUp={endDrag}
        >
          {SELECTION_CORNERS.map((corner) => (
            <span
              key={corner}
              className="sb-editor-rotate"
              style={selectionRotateStyle(corner)}
              onPointerDown={(event) => beginMultiRotate(event, selectedNodes)}
              onPointerMove={movePointer}
              onPointerUp={endDrag}
            />
          ))}
        </div>
      ) : null}

      {nodes
        .filter(
          (node) =>
            actionsVisible &&
            isActionableNode(node) &&
            ((selectedIds.length === 1 && selectedIds[0] === node.id) ||
              activeEditingId === node.id) &&
            (node.id !== selectionSuppressedId ||
              activeEditingId === node.id),
        )
        .map((node) => (
          <BlockActions
            key={`block-actions-${node.id}`}
            node={node}
            offsetX={offsetX}
            offsetY={offsetY}
            scale={scale}
            stageWidth={dm.data.container.clientWidth}
            stageHeight={dm.data.container.clientHeight}
            editing={activeEditingId === node.id}
            onToggleBlockEdit={onToggleBlockEdit}
            onFocusBlockEdit={onFocusBlockEdit}
            onDeleteBlock={onDeleteBlock}
                onResetBlockSize={onResetBlockSize}
            onToggleRatioLock={onToggleRatioLock}
          />
        ))}

      {canShowGuides && guides?.x !== undefined ? (
        <div
          className="sb-editor-guide sb-editor-guide-v"
          style={{ left: offsetX + guides.x * scale }}
        />
      ) : null}
      {canShowGuides && guides?.y !== undefined ? (
        <div
          className="sb-editor-guide sb-editor-guide-h"
          style={{ top: offsetY + guides.y * scale }}
        />
      ) : null}

      {marquee ? <div className="sb-editor-marquee" style={marquee} /> : null}
      </div>
    </div>
  )
}

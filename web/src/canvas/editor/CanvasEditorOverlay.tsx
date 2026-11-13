import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import UseAnimations from 'react-useanimations'
import lock from 'react-useanimations/lib/lock'
import typeIcon from 'react-useanimations/lib/type'
import { internal } from '../../vendor/json-canvas-viewer/src/index.ts'
import type { CanvasDocument, CanvasEdge, CanvasNode } from '../model'
import type { CanvasViewerHandle } from '../viewer/CanvasViewer'
import { blockKind, contentScale, isBlockNode, isRatioLocked } from './blocks'
import { edgeGeometry, edgePath } from './edges'
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
  onToggleBlockEdit?: (id: string) => void
  onToggleRatioLock?: (id: string) => void
}

interface DragNode {
  node: CanvasNode
  startX: number
  startY: number
  startWidth: number
  startHeight: number
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
  onToggleBlockEdit,
  onToggleRatioLock,
}: CanvasEditorOverlayProps) {
  const [tick, setTick] = useState(0)
  const [marquee, setMarquee] = useState<Marquee | null>(null)
  const [guides, setGuides] = useState<{ x?: number; y?: number } | null>(null)
  const [edgePreview, setEdgePreview] = useState<{
    fromX: number
    fromY: number
    x: number
    y: number
  } | null>(null)
  const edgeDragRef = useRef<{
    edge: CanvasEdge
    point: 'from' | 'to'
    fixedX: number
    fixedY: number
  } | null>(null)
  const overlayRef = useRef<HTMLDivElement>(null)
  const dmRef = useRef<DataManager | null>(null)
  const controllerRef = useRef<Controller | null>(null)
  const dragRef = useRef<DragState | null>(null)
  const marqueeStartRef = useRef<{ x: number; y: number } | null>(null)
  const marqueeAdditiveRef = useRef(false)

  useEffect(() => {
    let disposed = false
    let timer: number | undefined
    let unsubscribe: (() => void) | undefined

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
        unsubscribe = controllerRef.current.onRefresh.subscribe(() => setTick((value) => value + 1))
        setTick((value) => value + 1)
      } catch {
        timer = window.setTimeout(attach, 100)
      }
    }

    attach()
    return () => {
      disposed = true
      if (timer) window.clearTimeout(timer)
      unsubscribe?.()
      dmRef.current = null
      controllerRef.current = null
    }
  }, [canvas, viewerRef])

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (!interactive) return
      if (event.button !== 0) return
      const overlay = overlayRef.current
      const dm = dmRef.current
      if (!overlay || !dm) return
      const target = event.target as HTMLElement | null
      if (
        target?.closest(
          '.sb-editor-selection, .sb-editor-hitbox, .sb-editor-edge-endpoint, .sb-block-actions, .sb-md-editor, .sb-style-panel, .canvas-editor-toolstrip, .JCV-overlay-container, .JCV-controls, .JCV-minimap-container, .sb-frame-controller, button, a, input, textarea',
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
      marqueeAdditiveRef.current = event.shiftKey
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
      setMarquee({
        left: Math.min(start.x - bounds.left, x),
        top: Math.min(start.y - bounds.top, y),
        width: Math.abs(x - (start.x - bounds.left)),
        height: Math.abs(y - (start.y - bounds.top)),
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
  }, [onSelect, onSelectEdge, interactive, focusedGroupId, selectedIds])

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const dm = dmRef.current
      const target = event.target as HTMLElement | null
      if (!dm || !target) return
      if (!dm.data.container.contains(target)) return
      if (
        target.closest('.JCV-overlay-container') ||
        target.closest('button, a, input, textarea, select')
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
    if (event.button !== 0) return
    event.stopPropagation()
    const dm = dmRef.current
    if (!dm) return
    const allNodes = Object.values(dm.data.nodeMap).map((item) => item.ref)
    const map = nodeMapOf(allNodes)
    const target = selectableAncestor(node, map, focusedGroupId)
    if (isLocked(target, map)) return

    if (event.shiftKey) {
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
      ratioLocked: isBlockNode(target) && isRatioLocked(target),
      startContentScale: contentScale(target),
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

  function reflowTextHeight(node: CanvasNode) {
    if (node.type !== 'text') return
    const kind = node['x-superboard']?.kind
    if (kind && kind !== 'text') return
    const fontSize = node['x-superboard']?.style?.fontSize ?? 16
    const charsPerLine = Math.max(
      1,
      Math.floor((node.width - 32) / (fontSize * 0.62)),
    )
    const lines = node.text
      .split('\n')
      .reduce(
        (sum, line) => sum + Math.max(1, Math.ceil(Array.from(line).length / charsPerLine)),
        0,
      )
    node.height = Math.max(40, Math.round(lines * fontSize * 1.45 + 28))
  }

  function applyContentScale(drag: DragState, ratioScale: number) {
    if (!drag.ratioLocked || drag.nodes.length !== 1) return
    const kind = blockKind(drag.primary)
    if (!kind || kind === 'media') return
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
      onBeforeChange?.()
    }
    if (drag.kind === 'move') {
      const dmNow = dmRef.current
      let moveX = dx
      let moveY = dy
      let nextGuides: { x?: number; y?: number } | null = null
      if (dmNow && !event.altKey) {
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
      setGuides(nextGuides)
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
          else ratioScale = Math.max(width / drag.startWidth, height / drag.startHeight)
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
          else ratioScale = Math.max(width / drag.startWidth, height / drag.startHeight)
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
      if (drag.nodes.length === 1 && !drag.ratioLocked) reflowTextHeight(drag.primary)
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
  }

  const dm = dmRef.current
  if (!dm) return null
  const { offsetX, offsetY, scale } = dm.data
  const nodes = Object.values(dm.data.nodeMap).map((item) => item.ref)
  const map = nodeMapOf(nodes)
  const selectedNodes = nodes.filter((node) => selectedIds.includes(node.id))
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
    <div ref={overlayRef} className="sb-editor-overlay" data-tick={tick}>
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

      {selectedNodes.map((node) => (
        <div
          key={node.id}
          className="sb-editor-selection"
          style={screenStyle(node, offsetX, offsetY, scale)}
          onPointerDown={(event) => beginMove(event, node)}
          onPointerMove={movePointer}
          onPointerUp={endDrag}
        >
          {selectedNodes.length === 1 ? (
            <>
              <span className="sb-editor-selection-label">{node.id}</span>
              {['nw', 'ne', 'sw', 'se'].map((corner) => (
                <span
                  key={corner}
                  className={`sb-editor-handle sb-editor-handle-${corner}`}
                  onPointerDown={(event) => beginResize(event, node, corner)}
                  onPointerMove={movePointer}
                  onPointerUp={endDrag}
                />
              ))}
              {(['n', 'e', 's', 'w'] as const).map((side) => (
                <span
                  key={side}
                  className={`sb-editor-edge-handle sb-editor-edge-handle-${side}`}
                  onPointerDown={(event) => beginResize(event, node, side)}
                  onPointerMove={movePointer}
                  onPointerUp={endDrag}
                />
              ))}
              {node['x-superboard']?.kind !== 'group'
                ? ['nw', 'ne', 'sw', 'se'].map((corner) => (
                    <span
                      key={corner}
                      className={`sb-editor-rotate sb-editor-rotate-${corner}`}
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
        >
          <span className="sb-editor-selection-label">
            已选 {selectedNodes.length} 项
          </span>
          {['nw', 'ne', 'sw', 'se'].map((corner) => (
            <span
              key={corner}
              className={`sb-editor-rotate sb-editor-rotate-${corner}`}
              onPointerDown={(event) => beginMultiRotate(event, selectedNodes)}
              onPointerMove={movePointer}
              onPointerUp={endDrag}
            />
          ))}
        </div>
      ) : null}

      {nodes
        .filter((node) => node['x-superboard']?.locked)
        .map((node) => (
          <div
            key={`locked-${node.id}`}
            className="sb-editor-locked"
            style={screenStyle(node, offsetX, offsetY, scale)}
          >
            <span className="sb-editor-locked-badge">锁定</span>
          </div>
        ))}

      {nodes
        .filter(
          (node) =>
            isBlockNode(node) &&
            ((selectedIds.length === 1 && selectedIds[0] === node.id) ||
              activeEditingId === node.id),
        )
        .map((node) => {
          const editing = activeEditingId === node.id
          const ratioLocked = isRatioLocked(node)
          return (
            <div
              key={`block-actions-${node.id}`}
              className="sb-block-actions"
              style={{
                left: offsetX + (node.x + node.width / 2) * scale,
                top: Math.max(8, offsetY + node.y * scale - 84),
              }}
              onPointerDown={(event) => {
                event.preventDefault()
                event.stopPropagation()
              }}
              onContextMenu={(event) => {
                event.preventDefault()
                event.stopPropagation()
              }}
            >
              <button
                type="button"
                className={`sb-block-action${editing ? ' is-active' : ''}`}
                title={editing ? '退出编辑' : '编辑'}
                onClick={(event) => {
                  event.stopPropagation()
                  onToggleBlockEdit?.(node.id)
                }}
              >
                <span className={`sb-block-check${editing ? ' is-checked' : ''}`} />
                <UseAnimations
                  animation={typeIcon}
                  size={32}
                  active={editing}
                  interaction="click-replay"
                />
              </button>
              <button
                type="button"
                className={`sb-block-action${ratioLocked ? ' is-active' : ''}`}
                title={ratioLocked ? '解锁比例' : '锁定比例'}
                onClick={(event) => {
                  event.stopPropagation()
                  onToggleRatioLock?.(node.id)
                }}
              >
                <span className={`sb-block-check${ratioLocked ? ' is-checked' : ''}`} />
                <UseAnimations
                  animation={lock}
                  size={32}
                  active={ratioLocked}
                  interaction="click-replay"
                />
              </button>
            </div>
          )
        })}

      {guides?.x !== undefined ? (
        <div
          className="sb-editor-guide sb-editor-guide-v"
          style={{ left: offsetX + guides.x * scale }}
        />
      ) : null}
      {guides?.y !== undefined ? (
        <div
          className="sb-editor-guide sb-editor-guide-h"
          style={{ top: offsetY + guides.y * scale }}
        />
      ) : null}

      {marquee ? <div className="sb-editor-marquee" style={marquee} /> : null}
    </div>
  )
}

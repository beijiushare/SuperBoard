import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { internal } from '../../vendor/json-canvas-viewer/src/index.ts'
import type { CanvasDocument, CanvasNode } from '../model'
import type { CanvasViewerHandle } from '../viewer/CanvasViewer'
import { edgePath } from './edges'
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
}: CanvasEditorOverlayProps) {
  const [tick, setTick] = useState(0)
  const [marquee, setMarquee] = useState<Marquee | null>(null)
  const overlayRef = useRef<HTMLDivElement>(null)
  const dmRef = useRef<DataManager | null>(null)
  const controllerRef = useRef<Controller | null>(null)
  const dragRef = useRef<DragState | null>(null)
  const marqueeStartRef = useRef<{ x: number; y: number } | null>(null)

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
      if (!event.shiftKey || event.button !== 0) return
      const overlay = overlayRef.current
      const dm = dmRef.current
      if (!overlay || !dm) return
      if ((event.target as HTMLElement | null)?.closest('.sb-editor-selection, .sb-editor-hitbox')) {
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
  }, [onSelect, onSelectEdge, interactive, focusedGroupId])

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
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function beginRotate(event: ReactPointerEvent, node: CanvasNode) {
    if (event.button !== 0) return
    event.stopPropagation()
    const dm = dmRef.current
    const overlay = overlayRef.current
    if (!dm || !overlay || !node['x-superboard']) return
    const map = nodeMapOf(Object.values(dm.data.nodeMap).map((item) => item.ref))
    const target = selectableAncestor(node, map, focusedGroupId)
    if (!target['x-superboard'] || target['x-superboard'].kind === 'group') return
    if (isLocked(target, map)) return
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

  function movePointer(event: ReactPointerEvent) {
    const drag = dragRef.current
    if (!drag) return
    const dx = (event.clientX - drag.startClientX) / drag.scale
    const dy = (event.clientY - drag.startClientY) / drag.scale
    if (!drag.changed && (dx !== 0 || dy !== 0)) {
      drag.changed = true
      onBeforeChange?.()
    }
    if (drag.kind === 'move') {
      for (const item of drag.nodes) {
        item.node.x = item.startX + dx
        item.node.y = item.startY + dy
      }
    } else if (drag.kind === 'rotate') {
      const extension = drag.primary['x-superboard']
      const overlay = overlayRef.current
      const dm = dmRef.current
      if (!extension || !overlay || !dm) return
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
      const width = Math.max(40, drag.startWidth + (corner.includes('e') ? dx : -dx))
      const height = Math.max(40, drag.startHeight + (corner.includes('s') ? dy : -dy))
      const nextX = corner.includes('w') ? drag.startX + drag.startWidth - width : drag.startX
      const nextY = corner.includes('n') ? drag.startY + drag.startHeight - height : drag.startY
      const scaleX = drag.startWidth === 0 ? 1 : width / drag.startWidth
      const scaleY = drag.startHeight === 0 ? 1 : height / drag.startHeight
      for (const item of drag.nodes) {
        item.node.x = nextX + (item.startX - drag.startX) * scaleX
        item.node.y = nextY + (item.startY - drag.startY) * scaleY
        item.node.width = Math.max(1, item.startWidth * scaleX)
        item.node.height = Math.max(1, item.startHeight * scaleY)
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
  }

  const dm = dmRef.current
  if (!dm) return null
  const { offsetX, offsetY, scale } = dm.data
  const nodes = Object.values(dm.data.nodeMap).map((item) => item.ref)
  const map = nodeMapOf(nodes)
  const selectedNodes = nodes.filter((node) => selectedIds.includes(node.id))
  const focusedNode = focusedGroupId ? map.get(focusedGroupId) ?? null : null
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
                    vectorEffect="non-scaling-stroke"
                  />
                ) : null}
              </g>
            )
          })}
        </g>
      </svg>
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
              {node['x-superboard'] && node['x-superboard'].kind !== 'group' ? (
                <span
                  className="sb-editor-rotate"
                  onPointerDown={(event) => beginRotate(event, node)}
                  onPointerMove={movePointer}
                  onPointerUp={endDrag}
                />
              ) : null}
              {['nw', 'ne', 'sw', 'se'].map((corner) => (
                <span
                  key={corner}
                  className={`sb-editor-handle sb-editor-handle-${corner}`}
                  onPointerDown={(event) => beginResize(event, node, corner)}
                  onPointerMove={movePointer}
                  onPointerUp={endDrag}
                />
              ))}
            </>
          ) : null}
        </div>
      ))}

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

      {marquee ? <div className="sb-editor-marquee" style={marquee} /> : null}
    </div>
  )
}

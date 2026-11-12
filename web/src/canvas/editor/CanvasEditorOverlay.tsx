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
}

interface DragNode {
  node: CanvasNode
  startX: number
  startY: number
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
      const { offsetX, offsetY, scale } = dm.data
      const ids = Object.values(dm.data.nodeMap)
        .map((item) => item.ref)
        .filter((node) => intersects(box, screenRect(node, offsetX, offsetY, scale)))
        .map((node) => node.id)
      onSelect(ids)
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
  }, [onSelect])

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
    }

    window.addEventListener('click', onClick)
    return () => window.removeEventListener('click', onClick)
  }, [onSelect])

  function beginMove(event: ReactPointerEvent, node: CanvasNode) {
    if (event.button !== 0) return
    event.stopPropagation()
    const dm = dmRef.current
    if (!dm) return
    if (event.shiftKey) {
      onSelect(
        selectedIds.includes(node.id)
          ? selectedIds.filter((id) => id !== node.id)
          : [...selectedIds, node.id],
      )
      return
    }

    const ids = selectedIds.includes(node.id) ? selectedIds : [node.id]
    if (!selectedIds.includes(node.id)) onSelect(ids)
    const nodes = ids
      .map((id) => dm.data.nodeMap[id]?.ref)
      .filter((item): item is CanvasNode => Boolean(item))
      .map((item) => ({ node: item, startX: item.x, startY: item.y }))
    dragRef.current = {
      kind: 'move',
      nodes,
      primary: node,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startX: node.x,
      startY: node.y,
      startWidth: node.width,
      startHeight: node.height,
      scale: dm.data.scale,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function beginResize(event: ReactPointerEvent, node: CanvasNode, corner: string) {
    if (event.button !== 0) return
    event.stopPropagation()
    const dm = dmRef.current
    if (!dm) return
    onSelect([node.id])
    dragRef.current = {
      kind: 'resize',
      nodes: [{ node, startX: node.x, startY: node.y }],
      primary: node,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startX: node.x,
      startY: node.y,
      startWidth: node.width,
      startHeight: node.height,
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
    onSelect([node.id])
    const bounds = overlay.getBoundingClientRect()
    const { offsetX, offsetY, scale } = dm.data
    const centerX = bounds.left + offsetX + (node.x + node.width / 2) * scale
    const centerY = bounds.top + offsetY + (node.y + node.height / 2) * scale
    dragRef.current = {
      kind: 'rotate',
      nodes: [{ node, startX: node.x, startY: node.y }],
      primary: node,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startX: node.x,
      startY: node.y,
      startWidth: node.width,
      startHeight: node.height,
      scale,
      startAngle: Math.atan2(event.clientY - centerY, event.clientX - centerX),
      startRotation: node['x-superboard']?.rotation ?? 0,
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
      drag.primary.x = corner.includes('w') ? drag.startX + drag.startWidth - width : drag.startX
      drag.primary.y = corner.includes('n') ? drag.startY + drag.startHeight - height : drag.startY
      drag.primary.width = width
      drag.primary.height = height
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
  const selectedNodes = nodes.filter((node) => selectedIds.includes(node.id))

  return (
    <div ref={overlayRef} className="sb-editor-overlay" data-tick={tick}>
      {nodes
        .filter((node) => node['x-superboard']?.kind === 'shape' || node['x-superboard']?.kind === 'drawing')
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
              {node['x-superboard'] ? (
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

      {marquee ? <div className="sb-editor-marquee" style={marquee} /> : null}
    </div>
  )
}

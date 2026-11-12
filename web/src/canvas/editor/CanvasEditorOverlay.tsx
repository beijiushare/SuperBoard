import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { internal } from '../../vendor/json-canvas-viewer/src/index.ts'
import type { CanvasDocument, CanvasNode } from '../model'
import type { CanvasViewerHandle } from '../viewer/CanvasViewer'

type DataManager = {
  data: {
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
  selectedId: string | null
  onSelect: (id: string | null) => void
  onChange?: () => void
}

interface DragState {
  kind: 'move' | 'resize'
  node: CanvasNode
  startClientX: number
  startClientY: number
  startX: number
  startY: number
  startWidth: number
  startHeight: number
  scale: number
  corner?: string
}

export function CanvasEditorOverlay({
  canvas,
  viewerRef,
  selectedId,
  onSelect,
  onChange,
}: CanvasEditorOverlayProps) {
  const [tick, setTick] = useState(0)
  const dmRef = useRef<DataManager | null>(null)
  const controllerRef = useRef<Controller | null>(null)
  const dragRef = useRef<DragState | null>(null)

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
    }
  }, [canvas, viewerRef])

  function beginDrag(event: ReactPointerEvent, node: CanvasNode) {
    if (event.button !== 0) return
    event.stopPropagation()
    const dm = dmRef.current
    if (!dm) return
    onSelect(node.id)
    dragRef.current = {
      kind: 'move',
      node,
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
    onSelect(node.id)
    dragRef.current = {
      kind: 'resize',
      node,
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

  function moveDrag(event: ReactPointerEvent) {
    const drag = dragRef.current
    if (!drag) return
    const dx = (event.clientX - drag.startClientX) / drag.scale
    const dy = (event.clientY - drag.startClientY) / drag.scale
    if (drag.kind === 'move') {
      drag.node.x = drag.startX + dx
      drag.node.y = drag.startY + dy
    } else {
      const corner = drag.corner ?? 'se'
      const width = Math.max(40, drag.startWidth + (corner.includes('e') ? dx : -dx))
      const height = Math.max(40, drag.startHeight + (corner.includes('s') ? dy : -dy))
      drag.node.x = corner.includes('w') ? drag.startX + drag.startWidth - width : drag.startX
      drag.node.y = corner.includes('n') ? drag.startY + drag.startHeight - height : drag.startY
      drag.node.width = width
      drag.node.height = height
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
  const selected = nodes.find((node) => node.id === selectedId)
  const selectedRect = selected
    ? {
        left: offsetX + selected.x * scale,
        top: offsetY + selected.y * scale,
        width: selected.width * scale,
        height: selected.height * scale,
      }
    : null

  return (
    <div className="sb-editor-overlay" data-tick={tick}>
      {nodes
        .filter((node) => node['x-superboard']?.kind === 'shape' || node['x-superboard']?.kind === 'drawing')
        .map((node) => (
          <div
            key={node.id}
            className="sb-editor-hitbox"
            style={{
              left: offsetX + node.x * scale,
              top: offsetY + node.y * scale,
              width: node.width * scale,
              height: node.height * scale,
            }}
            onPointerDown={(event) => beginDrag(event, node)}
            onPointerMove={moveDrag}
            onPointerUp={endDrag}
          />
        ))}

      {selectedRect ? (
        <div
          className="sb-editor-selection"
          style={selectedRect}
          onPointerDown={(event) => selected && beginDrag(event, selected)}
          onPointerMove={moveDrag}
          onPointerUp={endDrag}
        >
          <span className="sb-editor-selection-label">{selected?.id}</span>
          {selected
            ? ['nw', 'ne', 'sw', 'se'].map((corner) => (
                <span
                  key={corner}
                  className={`sb-editor-handle sb-editor-handle-${corner}`}
                  onPointerDown={(event) => beginResize(event, selected, corner)}
                  onPointerMove={moveDrag}
                  onPointerUp={endDrag}
                />
              ))
            : null}
        </div>
      ) : null}
    </div>
  )
}

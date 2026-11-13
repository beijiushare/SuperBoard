import {
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { internal } from '../../vendor/json-canvas-viewer/src/index.ts'
import type { CanvasDocument, CanvasFrame } from '../model'
import type { CanvasViewerHandle } from '../viewer/CanvasViewer'

type DataManager = {
  data: {
    offsetX: number
    offsetY: number
    scale: number
  }
}

type Controller = {
  refresh: () => void
  onRefresh: { subscribe: (callback: () => void) => () => void }
}

type ViewerInternals = {
  container?: { get: (key: unknown) => unknown }
}

interface CanvasDirectorOverlayProps {
  canvas: CanvasDocument
  viewerRef: React.RefObject<CanvasViewerHandle | null>
  selectedId: string | null
  onSelect: (id: string | null) => void
  onBeforeChange: () => void
  onChangeFrames: (frames: CanvasFrame[]) => void
  onPlayFrame: (frame: CanvasFrame) => void
  onOpenController: () => void
}

interface DragState {
  kind: 'move' | 'resize'
  start: CanvasFrame
  startX: number
  startY: number
  corner?: string
  changed?: boolean
}

interface MenuState {
  x: number
  y: number
  frameId: string | null
}

const FRAME_WIDTH = 1280
const FRAME_HEIGHT = 720
const MIN_FRAME_WIDTH = 160

export function CanvasDirectorOverlay({
  canvas,
  viewerRef,
  selectedId,
  onSelect,
  onBeforeChange,
  onChangeFrames,
  onPlayFrame,
  onOpenController,
}: CanvasDirectorOverlayProps) {
  const overlayRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const dmRef = useRef<DataManager | null>(null)
  const controllerRef = useRef<Controller | null>(null)
  const dragRef = useRef<DragState | null>(null)
  const panRef = useRef<{
    startClientX: number
    startClientY: number
    offsetX: number
    offsetY: number
    moved: boolean
  } | null>(null)
  const suppressContextMenuRef = useRef(false)
  const [menu, setMenu] = useState<MenuState | null>(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let disposed = false
    let timer: number | undefined
    let unsubscribe: (() => void) | undefined
    const attach = () => {
      if (disposed) return
      const viewer = viewerRef.current?.viewer as ViewerInternals | undefined
      if (!viewer?.container) {
        timer = window.setTimeout(attach, 100)
        return
      }
      try {
        dmRef.current = viewer.container.get(internal.DataManager as never) as DataManager
        controllerRef.current = viewer.container.get(internal.Controller as never) as Controller
        unsubscribe = controllerRef.current.onRefresh.subscribe(() =>
          setTick((value) => value + 1),
        )
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
      if (menuRef.current?.contains(event.target as Node)) return
      setMenu(null)
    }
    document.addEventListener('pointerdown', onPointerDown, true)
    return () => document.removeEventListener('pointerdown', onPointerDown, true)
  }, [])

  useEffect(() => {
    const node = overlayRef.current
    if (!node) return
    const onWheel = (event: WheelEvent) => {
      const dm = dmRef.current
      if (!dm) return
      event.preventDefault()
      event.stopPropagation()
      const bounds = node.getBoundingClientRect()
      if (event.ctrlKey || event.metaKey) {
        const originX = event.clientX - bounds.left
        const originY = event.clientY - bounds.top
        const factor = event.deltaY < 0 ? 1.1 : 1 / 1.1
        const nextScale = Math.min(20, Math.max(0.05, dm.data.scale * factor))
        const worldX = (originX - dm.data.offsetX) / dm.data.scale
        const worldY = (originY - dm.data.offsetY) / dm.data.scale
        dm.data.offsetX = originX - worldX * nextScale
        dm.data.offsetY = originY - worldY * nextScale
        dm.data.scale = nextScale
      } else {
        const deltaX = event.shiftKey ? -event.deltaY : -event.deltaX
        const deltaY = event.shiftKey ? 0 : -event.deltaY
        dm.data.offsetX += deltaX
        dm.data.offsetY += deltaY
      }
      controllerRef.current?.refresh()
    }
    node.addEventListener('wheel', onWheel, { passive: false })
    return () => node.removeEventListener('wheel', onWheel)
  }, [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!selectedId) return
      if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault()
        event.stopPropagation()
        deleteFrame(selectedId)
      }
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  })

  function framesNow() {
    return canvas['x-superboard']?.director?.frames ?? []
  }

  function worldPoint(event: { clientX: number; clientY: number }) {
    const overlay = overlayRef.current
    const dm = dmRef.current
    if (!overlay || !dm) return null
    const bounds = overlay.getBoundingClientRect()
    return {
      x: (event.clientX - bounds.left - dm.data.offsetX) / dm.data.scale,
      y: (event.clientY - bounds.top - dm.data.offsetY) / dm.data.scale,
    }
  }

  function updateFrame(frame: CanvasFrame) {
    onChangeFrames(framesNow().map((item) => (item.id === frame.id ? frame : item)))
    setTick((value) => value + 1)
  }

  function addFrameAt(x: number, y: number) {
    const frames = framesNow()
    const frame: CanvasFrame = {
      id: crypto.randomUUID(),
      order: frames.reduce((max, item) => Math.max(max, item.order), 0) + 1,
      x: Math.round(x - FRAME_WIDTH / 2),
      y: Math.round(y - FRAME_HEIGHT / 2),
      width: FRAME_WIDTH,
      height: FRAME_HEIGHT,
    }
    onBeforeChange()
    onChangeFrames([...frames, frame])
    onSelect(frame.id)
    setTick((value) => value + 1)
  }

  function deleteFrame(id: string) {
    onBeforeChange()
    onChangeFrames(framesNow().filter((frame) => frame.id !== id))
    onSelect(null)
    setMenu(null)
    setTick((value) => value + 1)
  }

  function beginPan(event: ReactPointerEvent<HTMLDivElement>) {
    const dm = dmRef.current
    if (!dm) return false
    panRef.current = {
      startClientX: event.clientX,
      startClientY: event.clientY,
      offsetX: dm.data.offsetX,
      offsetY: dm.data.offsetY,
      moved: false,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
    event.preventDefault()
    return true
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button === 1 || event.button === 2) {
      beginPan(event)
      return
    }
    if (event.button !== 0) return
    if ((event.target as HTMLElement).closest('.sb-director-frame, .sb-director-menu')) return
    setMenu(null)
  }

  function beginMove(event: ReactPointerEvent, frame: CanvasFrame) {
    if (event.button !== 0) return
    event.stopPropagation()
    onSelect(frame.id)
    const point = worldPoint(event)
    if (!point) return
    dragRef.current = {
      kind: 'move',
      start: { ...frame },
      startX: point.x,
      startY: point.y,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function beginResize(event: ReactPointerEvent, frame: CanvasFrame, corner: string) {
    if (event.button !== 0) return
    event.stopPropagation()
    onSelect(frame.id)
    const point = worldPoint(event)
    if (!point) return
    dragRef.current = {
      kind: 'resize',
      start: { ...frame },
      startX: point.x,
      startY: point.y,
      corner,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const pan = panRef.current
    const dm = dmRef.current
    if (pan && dm) {
      const dx = event.clientX - pan.startClientX
      const dy = event.clientY - pan.startClientY
      if (Math.hypot(dx, dy) > 3) pan.moved = true
      dm.data.offsetX = pan.offsetX + dx
      dm.data.offsetY = pan.offsetY + dy
      controllerRef.current?.refresh()
      return
    }
    const drag = dragRef.current
    if (!drag) return
    const point = worldPoint(event)
    if (!point) return
    const dx = point.x - drag.startX
    const dy = point.y - drag.startY
    if (!drag.changed && (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5)) {
      drag.changed = true
      onBeforeChange()
    }
    if (drag.kind === 'move') {
      updateFrame({ ...drag.start, x: Math.round(drag.start.x + dx), y: Math.round(drag.start.y + dy) })
      return
    }
    const corner = drag.corner ?? 'se'
    const rawWidth = drag.start.width + (corner.includes('e') ? dx : -dx)
    const rawHeight = drag.start.height + (corner.includes('s') ? dy : -dy)
    const scale = Math.max(rawWidth / drag.start.width, rawHeight / drag.start.height)
    const width = Math.max(MIN_FRAME_WIDTH, drag.start.width * scale)
    const height = (width * 9) / 16
    const x = corner.includes('w') ? drag.start.x + drag.start.width - width : drag.start.x
    const y = corner.includes('n') ? drag.start.y + drag.start.height - height : drag.start.y
    updateFrame({
      ...drag.start,
      x: Math.round(x),
      y: Math.round(y),
      width: Math.round(width),
      height: Math.round(height),
    })
  }

  function endDrag() {
    dragRef.current = null
    if (panRef.current?.moved) suppressContextMenuRef.current = true
    panRef.current = null
  }

  function openMenu(event: ReactMouseEvent, frameId: string | null) {
    event.preventDefault()
    event.stopPropagation()
    if (suppressContextMenuRef.current) {
      suppressContextMenuRef.current = false
      return
    }
    if (frameId) onSelect(frameId)
    const bounds = overlayRef.current?.getBoundingClientRect()
    setMenu({
      x: event.clientX - (bounds?.left ?? 0),
      y: event.clientY - (bounds?.top ?? 0),
      frameId,
    })
  }

  function handleDoubleClick(event: ReactMouseEvent<HTMLDivElement>) {
    if ((event.target as HTMLElement).closest('.sb-director-frame, .sb-director-menu')) return
    const point = worldPoint(event)
    if (!point) return
    addFrameAt(point.x, point.y)
  }

  const dm = dmRef.current
  const frames = framesNow()
  const selectedFrame = menu?.frameId
    ? frames.find((frame) => frame.id === menu.frameId) ?? null
    : null

  return (
    <div
      ref={overlayRef}
      className="sb-director-overlay"
      data-tick={tick}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onDoubleClick={handleDoubleClick}
      onContextMenu={(event) => openMenu(event, null)}
    >
      {dm
        ? frames.map((frame) => {
            const selected = frame.id === selectedId
            return (
              <div
                key={frame.id}
                className={`sb-director-frame${selected ? ' is-selected' : ''}`}
                style={{
                  left: dm.data.offsetX + frame.x * dm.data.scale,
                  top: dm.data.offsetY + frame.y * dm.data.scale,
                  width: frame.width * dm.data.scale,
                  height: frame.height * dm.data.scale,
                }}
                onPointerDown={(event) => beginMove(event, frame)}
                onPointerMove={handlePointerMove}
                onPointerUp={endDrag}
                onDoubleClick={(event) => event.stopPropagation()}
                onContextMenu={(event) => openMenu(event, frame.id)}
              >
                <div className="sb-director-frame-label">
                  {frame.order}:{frame.name || `帧 ${frame.order}`}
                </div>
                {selected
                  ? ['nw', 'ne', 'sw', 'se'].map((corner) => (
                      <span
                        key={corner}
                        className={`sb-director-handle sb-director-handle-${corner}`}
                        onPointerDown={(event) => beginResize(event, frame, corner)}
                        onPointerMove={handlePointerMove}
                        onPointerUp={endDrag}
                      />
                    ))
                  : null}
              </div>
            )
          })
        : null}

      {menu ? (
        <div
          ref={menuRef}
          className="sb-director-menu"
          style={{ left: menu.x, top: menu.y }}
          onPointerDown={(event) => event.stopPropagation()}
        >
          {menu.frameId ? (
            <>
              <button
                type="button"
                onClick={() => {
                  if (selectedFrame) onPlayFrame(selectedFrame)
                  setMenu(null)
                }}
              >
                播放此帧
              </button>
              <button type="button" onClick={() => deleteFrame(menu.frameId!)}>
                删除帧
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => {
                const bounds = overlayRef.current?.getBoundingClientRect()
                const dmNow = dmRef.current
                if (bounds && dmNow) {
                  addFrameAt(
                    (menu.x - dmNow.data.offsetX) / dmNow.data.scale,
                    (menu.y - dmNow.data.offsetY) / dmNow.data.scale,
                  )
                }
                setMenu(null)
              }}
            >
              新建帧
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setMenu(null)
              onOpenController()
            }}
          >
            打开控制器
          </button>
        </div>
      ) : null}
    </div>
  )
}

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type MouseEvent as ReactMouseEvent } from 'react'
import type { Editor } from 'tldraw'
import type { DirectorFrame } from '../shared/board/types'
import { DirectorFrameController } from './DirectorFrameController'

interface DirectorOverlayProps {
  editor: Editor
  frames: DirectorFrame[]
  selectedId: string | null
  onSelect: (id: string | null) => void
  onChangeFrames: (frames: DirectorFrame[]) => void
  onPlayFrame: (frame: DirectorFrame) => void
}

interface DragState {
  kind: 'move' | 'resize'
  frame: DirectorFrame
  startPage: { x: number; y: number }
  corner?: string
}

interface MenuState {
  x: number
  y: number
  page: { x: number; y: number }
  frame: DirectorFrame | null
}

const FRAME_WIDTH = 1280
const FRAME_HEIGHT = 720
const MIN_FRAME_WIDTH = 160

export function DirectorOverlay({
  editor,
  frames,
  selectedId,
  onSelect,
  onChangeFrames,
  onPlayFrame,
}: DirectorOverlayProps) {
  const overlayRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<DragState | null>(null)
  const panRef = useRef<{
    startClient: { x: number; y: number }
    startCamera: { x: number; y: number; z: number }
    moved: boolean
  } | null>(null)
  const suppressContextMenuRef = useRef(false)
  const [menu, setMenu] = useState<MenuState | null>(null)
  const [controllerOpen, setControllerOpen] = useState(false)
  const [, setCameraTick] = useState(0)

  useEffect(() => {
    return editor.store.listen(() => setCameraTick((tick) => tick + 1), { scope: 'all' })
  }, [editor])

  useEffect(() => {
    const node = overlayRef.current
    if (!node) return

    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return
      event.preventDefault()
      event.stopPropagation()
      if (event.deltaY < 0) editor.zoomIn(undefined, { force: true })
      else editor.zoomOut(undefined, { force: true })
    }

    node.addEventListener('wheel', onWheel, { passive: false })
    return () => node.removeEventListener('wheel', onWheel)
  }, [editor])

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (menuRef.current?.contains(event.target as Node)) return
      setMenu(null)
    }
    document.addEventListener('pointerdown', onPointerDown, true)
    return () => document.removeEventListener('pointerdown', onPointerDown, true)
  }, [])

  function pagePoint(event: { clientX: number; clientY: number }) {
    return editor.screenToPage({ x: event.clientX, y: event.clientY })
  }

  function beginPan(event: ReactPointerEvent) {
    if (event.button !== 1 && event.button !== 2) return false
    event.preventDefault()
    panRef.current = {
      startClient: { x: event.clientX, y: event.clientY },
      startCamera: editor.getCamera(),
      moved: false,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
    return true
  }

  function updateFrame(frame: DirectorFrame) {
    onChangeFrames(frames.map((item) => (item.id === frame.id ? frame : item)))
  }

  function beginMove(event: ReactPointerEvent, frame: DirectorFrame) {
    if (event.button !== 0) return
    event.stopPropagation()
    onSelect(frame.id)
    dragRef.current = { kind: 'move', frame, startPage: pagePoint(event) }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function beginResize(event: ReactPointerEvent, frame: DirectorFrame, corner: string) {
    if (event.button !== 0) return
    event.stopPropagation()
    onSelect(frame.id)
    dragRef.current = { kind: 'resize', frame, startPage: pagePoint(event), corner }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function handleMove(event: ReactPointerEvent) {
    const pan = panRef.current
    if (pan) {
      const dx = event.clientX - pan.startClient.x
      const dy = event.clientY - pan.startClient.y
      if (Math.hypot(dx, dy) > 3) pan.moved = true
      editor.setCamera(
        {
          x: pan.startCamera.x + dx / pan.startCamera.z,
          y: pan.startCamera.y + dy / pan.startCamera.z,
          z: pan.startCamera.z,
        },
        { force: true, immediate: true },
      )
      return
    }

    const drag = dragRef.current
    if (!drag) return
    const point = pagePoint(event)
    const dx = point.x - drag.startPage.x
    const dy = point.y - drag.startPage.y

    if (drag.kind === 'move') {
      updateFrame({ ...drag.frame, x: drag.frame.x + dx, y: drag.frame.y + dy })
      return
    }

    const corner = drag.corner ?? 'se'
    const rawWidth = drag.frame.w + (corner.includes('e') ? dx : -dx)
    const rawHeight = drag.frame.h + (corner.includes('s') ? dy : -dy)
    const scale = Math.max(rawWidth / drag.frame.w, rawHeight / drag.frame.h)
    const width = Math.max(MIN_FRAME_WIDTH, drag.frame.w * scale)
    const height = (width * 9) / 16
    const x = corner.includes('w') ? drag.frame.x + drag.frame.w - width : drag.frame.x
    const y = corner.includes('n') ? drag.frame.y + drag.frame.h - height : drag.frame.y
    updateFrame({ ...drag.frame, x, y, w: width, h: height })
  }

  function endDrag() {
    dragRef.current = null
    if (panRef.current?.moved) suppressContextMenuRef.current = true
    panRef.current = null
  }

  function handleContextMenu(event: ReactMouseEvent, frame: DirectorFrame | null) {
    event.preventDefault()
    event.stopPropagation()
    if (frame) onSelect(frame.id)
    const rect = overlayRef.current?.getBoundingClientRect()
    setMenu({
      x: event.clientX - (rect?.left ?? 0),
      y: event.clientY - (rect?.top ?? 0),
      page: pagePoint(event),
      frame,
    })
  }

  function addFrameAt(point: { x: number; y: number }) {
    const frame: DirectorFrame = {
      id: crypto.randomUUID(),
      order: frames.reduce((max, item) => Math.max(max, item.order), 0) + 1,
      x: point.x - FRAME_WIDTH / 2,
      y: point.y - FRAME_HEIGHT / 2,
      w: FRAME_WIDTH,
      h: FRAME_HEIGHT,
    }
    onChangeFrames([...frames, frame])
    onSelect(frame.id)
  }

  const zoom = editor.getZoomLevel()
  const viewport = editor.getViewportScreenBounds()
  const curtain =
    frames.length > 0
      ? (() => {
          const minX = Math.min(...frames.map((frame) => frame.x))
          const minY = Math.min(...frames.map((frame) => frame.y))
          const maxX = Math.max(...frames.map((frame) => frame.x + frame.w))
          const maxY = Math.max(...frames.map((frame) => frame.y + frame.h))
          const topLeft = editor.pageToScreen({ x: minX, y: minY })
          return {
            left: topLeft.x - viewport.x,
            top: topLeft.y - viewport.y,
            width: (maxX - minX) * zoom,
            height: (maxY - minY) * zoom,
          }
        })()
      : null

  return (
    <div
      ref={overlayRef}
      className="sb-director-overlay"
      onPointerDown={(event) => {
        setMenu(null)
        beginPan(event)
      }}
      onPointerMove={handleMove}
      onPointerUp={endDrag}
      onContextMenuCapture={(event) => {
        if (!suppressContextMenuRef.current) return
        suppressContextMenuRef.current = false
        event.preventDefault()
        event.stopPropagation()
      }}
      onContextMenu={(event) => {
        if (event.target === event.currentTarget) handleContextMenu(event, null)
      }}
    >
      {curtain ? <div className="sb-director-curtain" style={curtain} /> : null}

      {frames.map((frame) => {
        const point = editor.pageToScreen({ x: frame.x, y: frame.y })
        const selected = frame.id === selectedId
        return (
          <div
            key={frame.id}
            className={`sb-director-frame${selected ? ' is-selected' : ''}`}
            style={{
              left: point.x - viewport.x,
              top: point.y - viewport.y,
              width: frame.w * zoom,
              height: frame.h * zoom,
              borderWidth: Math.max(1, zoom * 2),
            }}
            onPointerDown={(event) => beginMove(event, frame)}
            onDoubleClick={(event) => {
              event.stopPropagation()
              setControllerOpen(true)
            }}
            onContextMenu={(event) => handleContextMenu(event, frame)}
          >
            <div className="sb-director-frame-label">
              {frame.order}:{frame.name || `帧${frame.order}`}
            </div>
            {selected
              ? ['nw', 'ne', 'sw', 'se'].map((corner) => (
                  <span
                    key={corner}
                    className={`sb-director-handle sb-director-handle-${corner}`}
                    onPointerDown={(event) => beginResize(event, frame, corner)}
                  />
                ))
              : null}
          </div>
        )
      })}

      {menu ? (
        <div
          ref={menuRef}
          className="sb-director-menu"
          style={{ left: menu.x, top: menu.y }}
          onPointerDown={(event) => event.stopPropagation()}
        >
          {menu.frame ? (
            <>
              <button type="button" onClick={() => { setMenu(null); setControllerOpen(true) }}>
                控制帧
              </button>
              <button type="button" onClick={() => { setMenu(null); onPlayFrame(menu.frame!) }}>
                此帧开始播放
              </button>
              <button
                type="button"
                onClick={() => {
                  const frame = menu.frame!
                  setMenu(null)
                  onChangeFrames(frames.filter((item) => item.id !== frame.id))
                  onSelect(null)
                }}
              >
                删除帧
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => {
                setMenu(null)
                addFrameAt(menu.page)
              }}
            >
              添加帧
            </button>
          )}
        </div>
      ) : null}

      {controllerOpen ? (
        <DirectorFrameController
          frames={frames}
          selectedId={selectedId}
          onSelect={onSelect}
          onChangeFrames={onChangeFrames}
          onClose={() => setControllerOpen(false)}
        />
      ) : null}
    </div>
  )
}

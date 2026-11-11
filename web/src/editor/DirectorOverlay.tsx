import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type MouseEvent as ReactMouseEvent } from 'react'
import type { Editor } from 'tldraw'
import type { DirectorFrame } from '../shared/board/types'

interface DirectorOverlayProps {
  editor: Editor
  frames: DirectorFrame[]
  selectedId: string | null
  onSelect: (id: string | null) => void
  onChangeFrames: (frames: DirectorFrame[]) => void
  onEditFrame: (frame: DirectorFrame) => void
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
  onEditFrame,
  onPlayFrame,
}: DirectorOverlayProps) {
  const overlayRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<DragState | null>(null)
  const [menu, setMenu] = useState<MenuState | null>(null)
  const [, setCameraTick] = useState(0)

  useEffect(() => {
    return editor.store.listen(() => setCameraTick((tick) => tick + 1), { scope: 'all' })
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
    const rect = overlayRef.current?.getBoundingClientRect()
    return editor.screenToPage({
      x: event.clientX - (rect?.left ?? 0),
      y: event.clientY - (rect?.top ?? 0),
    })
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

  return (
    <div
      ref={overlayRef}
      className="sb-director-overlay"
      onPointerDown={() => setMenu(null)}
      onPointerMove={handleMove}
      onPointerUp={endDrag}
      onContextMenu={(event) => {
        if (event.target === event.currentTarget) handleContextMenu(event, null)
      }}
    >
      {frames.map((frame) => {
        const point = editor.pageToScreen({ x: frame.x, y: frame.y })
        const zoom = editor.getZoomLevel()
        const selected = frame.id === selectedId
        return (
          <div
            key={frame.id}
            className={`sb-director-frame${selected ? ' is-selected' : ''}`}
            style={{
              left: point.x,
              top: point.y,
              width: frame.w * zoom,
              height: frame.h * zoom,
            }}
            onPointerDown={(event) => beginMove(event, frame)}
            onDoubleClick={(event) => {
              event.stopPropagation()
              onEditFrame(frame)
            }}
            onContextMenu={(event) => handleContextMenu(event, frame)}
          >
            <div className="sb-director-frame-label">帧 {frame.order}</div>
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
              <button type="button" onClick={() => { setMenu(null); onEditFrame(menu.frame!) }}>
                编辑帧值
              </button>
              <button type="button" onClick={() => { setMenu(null); onPlayFrame(menu.frame!) }}>
                此帧开始播放
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
    </div>
  )
}

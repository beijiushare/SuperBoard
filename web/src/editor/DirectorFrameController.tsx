import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import type { DirectorFrame } from '../shared/board/types'

interface DirectorFrameControllerProps {
  frames: DirectorFrame[]
  selectedId: string | null
  onSelect: (id: string | null) => void
  onChangeFrames: (frames: DirectorFrame[]) => void
  onClose: () => void
}

interface DragState {
  kind: 'move' | 'resize'
  startX: number
  startY: number
  startLeft: number
  startTop: number
  startHeight: number
}

const WIDTH = 220
const MIN_HEIGHT = 150

export function DirectorFrameController({
  frames,
  selectedId,
  onSelect,
  onChangeFrames,
  onClose,
}: DirectorFrameControllerProps) {
  const [position, setPosition] = useState({ left: 20, top: 80 })
  const [height, setHeight] = useState(300)
  const dragRef = useRef<DragState | null>(null)
  const [dragId, setDragId] = useState<string | null>(null)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')

  function beginMove(event: ReactPointerEvent) {
    if (event.button !== 0) return
    event.stopPropagation()
    dragRef.current = {
      kind: 'move',
      startX: event.clientX,
      startY: event.clientY,
      startLeft: position.left,
      startTop: position.top,
      startHeight: height,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function beginResize(event: ReactPointerEvent) {
    if (event.button !== 0) return
    event.stopPropagation()
    dragRef.current = {
      kind: 'resize',
      startX: event.clientX,
      startY: event.clientY,
      startLeft: position.left,
      startTop: position.top,
      startHeight: height,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function handlePointerMove(event: ReactPointerEvent) {
    const drag = dragRef.current
    if (!drag) return
    if (drag.kind === 'move') {
      setPosition({
        left: Math.max(0, drag.startLeft + event.clientX - drag.startX),
        top: Math.max(0, drag.startTop + event.clientY - drag.startY),
      })
      return
    }
    setHeight(Math.max(MIN_HEIGHT, drag.startHeight + event.clientY - drag.startY))
  }

  function endDrag() {
    dragRef.current = null
  }

  function dropOn(targetId: string) {
    if (!dragId || dragId === targetId) return
    const ordered = [...frames].sort((a, b) => a.order - b.order)
    const from = ordered.findIndex((frame) => frame.id === dragId)
    const to = ordered.findIndex((frame) => frame.id === targetId)
    if (from < 0 || to < 0) return
    const [moved] = ordered.splice(from, 1)
    ordered.splice(to, 0, moved)
    onChangeFrames(ordered.map((frame, index) => ({ ...frame, order: index + 1 })))
    setDragId(null)
  }

  function commitRename(frame: DirectorFrame) {
    const value = renameValue.trim()
    onChangeFrames(
      frames.map((item) =>
        item.id === frame.id
          ? { ...item, name: value && value !== `帧${item.order}` ? value : undefined }
          : item,
      ),
    )
    setRenamingId(null)
  }

  return (
    <div
      className="sb-frame-controller"
      style={{ left: position.left, top: position.top, width: WIDTH, height }}
      onPointerMove={handlePointerMove}
      onPointerUp={endDrag}
      onPointerDown={(event) => event.stopPropagation()}
      onContextMenu={(event) => event.stopPropagation()}
    >
      <div className="sb-frame-controller-title" onPointerDown={beginMove}>
        <span>控制帧</span>
        <button
          type="button"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={onClose}
          aria-label="关闭"
        >
          ×
        </button>
      </div>

      <div className="sb-frame-controller-list">
        {[...frames]
          .sort((a, b) => a.order - b.order)
          .map((frame) => (
            <div
              key={frame.id}
              className={`sb-frame-controller-row${frame.id === selectedId ? ' is-selected' : ''}`}
              draggable={renamingId !== frame.id}
              onDragStart={() => setDragId(frame.id)}
              onDragEnd={() => setDragId(null)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => dropOn(frame.id)}
              onClick={() => onSelect(frame.id)}
              onDoubleClick={() => {
                setRenamingId(frame.id)
                setRenameValue(frame.name || `帧${frame.order}`)
              }}
            >
              <span className="sb-frame-controller-handle">⋮⋮</span>
              <span className="sb-frame-controller-order">{frame.order}</span>
              {renamingId === frame.id ? (
                <input
                  className="sb-frame-controller-input"
                  value={renameValue}
                  autoFocus
                  onFocus={(event) => event.currentTarget.select()}
                  onPointerDown={(event) => event.stopPropagation()}
                  onChange={(event) => setRenameValue(event.target.value)}
                  onBlur={() => commitRename(frame)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault()
                      commitRename(frame)
                    } else if (event.key === 'Escape') {
                      event.preventDefault()
                      setRenamingId(null)
                    }
                  }}
                />
              ) : (
                <span className="sb-frame-controller-name">
                  {frame.name || `帧${frame.order}`}
                </span>
              )}
            </div>
          ))}
      </div>

      <div className="sb-frame-controller-resize" onPointerDown={beginResize} />
    </div>
  )
}

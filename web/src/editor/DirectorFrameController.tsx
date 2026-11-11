import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
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

interface SortableFrameRowProps {
  frame: DirectorFrame
  selected: boolean
  renaming: boolean
  renameValue: string
  onSelect: () => void
  onStartRename: () => void
  onRenameChange: (value: string) => void
  onCommitRename: () => void
  onCancelRename: () => void
}

const WIDTH = 220
const MIN_HEIGHT = 150

function SortableFrameRow({
  frame,
  selected,
  renaming,
  renameValue,
  onSelect,
  onStartRename,
  onRenameChange,
  onCommitRename,
  onCancelRename,
}: SortableFrameRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: frame.id,
    disabled: renaming,
  })

  return (
    <div
      ref={setNodeRef}
      className={`sb-frame-controller-row${selected ? ' is-selected' : ''}${
        isDragging ? ' is-dragging' : ''
      }`}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...attributes}
      onClick={onSelect}
      onDoubleClick={onStartRename}
    >
      <span
        className="sb-frame-controller-handle"
        {...listeners}
        onClick={(event) => event.stopPropagation()}
        onDoubleClick={(event) => event.stopPropagation()}
      >
        ⋮⋮
      </span>
      <span className="sb-frame-controller-order">{frame.order}</span>
      {renaming ? (
        <input
          className="sb-frame-controller-input"
          value={renameValue}
          autoFocus
          onFocus={(event) => event.currentTarget.select()}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
          onDoubleClick={(event) => event.stopPropagation()}
          onChange={(event) => onRenameChange(event.target.value)}
          onBlur={onCommitRename}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              onCommitRename()
            } else if (event.key === 'Escape') {
              event.preventDefault()
              onCancelRename()
            }
          }}
        />
      ) : (
        <span className="sb-frame-controller-name">{frame.name || `帧${frame.order}`}</span>
      )}
    </div>
  )
}

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
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const orderedFrames = [...frames].sort((a, b) => a.order - b.order)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

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

  function handleSortEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const from = orderedFrames.findIndex((frame) => frame.id === active.id)
    const to = orderedFrames.findIndex((frame) => frame.id === over.id)
    if (from < 0 || to < 0) return
    onChangeFrames(arrayMove(orderedFrames, from, to).map((frame, index) => ({ ...frame, order: index + 1 })))
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
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleSortEnd}>
          <SortableContext
            items={orderedFrames.map((frame) => frame.id)}
            strategy={verticalListSortingStrategy}
          >
            {orderedFrames.map((frame) => (
              <SortableFrameRow
                key={frame.id}
                frame={frame}
                selected={frame.id === selectedId}
                renaming={renamingId === frame.id}
                renameValue={renameValue}
                onSelect={() => onSelect(frame.id)}
                onStartRename={() => {
                  setRenamingId(frame.id)
                  setRenameValue(frame.name || `帧${frame.order}`)
                }}
                onRenameChange={setRenameValue}
                onCommitRename={() => commitRename(frame)}
                onCancelRename={() => setRenamingId(null)}
              />
            ))}
          </SortableContext>
        </DndContext>
      </div>

      <div className="sb-frame-controller-resize" onPointerDown={beginResize} />
    </div>
  )
}

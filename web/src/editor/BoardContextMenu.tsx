import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react'
import type { BoardTreeContextTarget } from '../shared/board/BoardTree'
import type { BoardTreeFile } from '../shared/board/types'

export type BoardContextTarget = BoardTreeContextTarget | { type: 'root' }

interface BoardContextMenuProps {
  x: number
  y: number
  target: BoardContextTarget
  onClose: () => void
  onCreate: (folder: string) => void
  onRename: (board: BoardTreeFile) => void
  onDelete: (board: BoardTreeFile) => void
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
      <path d="M8 3.2v9.6M3.2 8h9.6" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function PencilIcon() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
      <path
        d="m3 11.2-.6 2.9 2.9-.6 7.1-7.1-2.3-2.3-7.1 7.1Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path d="m9.2 3.4 2.3 2.3" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
      <path d="M3.4 4.6h9.2M6.2 4.6V2.8h3.6v1.8M4.5 4.6l.5 8.6h6l.5-8.6" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6.7 7.2v3.7M9.3 7.2v3.7" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  )
}

export function BoardContextMenu({
  x,
  y,
  target,
  onClose,
  onCreate,
  onRename,
  onDelete,
}: BoardContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState({ left: x, top: y })

  useLayoutEffect(() => {
    const menu = menuRef.current
    if (!menu) return
    const rect = menu.getBoundingClientRect()
    setPosition({
      left: Math.max(8, Math.min(x, window.innerWidth - rect.width - 8)),
      top: Math.max(8, Math.min(y, window.innerHeight - rect.height - 8)),
    })
  }, [x, y, target])

  useEffect(() => {
    menuRef.current?.focus({ preventScroll: true })
  }, [])

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) onClose()
    }
    const onContextMenu = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) onClose()
    }
    const onScroll = (event: Event) => {
      if (!menuRef.current?.contains(event.target as Node)) onClose()
    }
    const onResize = () => onClose()

    document.addEventListener('pointerdown', onPointerDown, true)
    document.addEventListener('contextmenu', onContextMenu, true)
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onResize)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true)
      document.removeEventListener('contextmenu', onContextMenu, true)
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onResize)
    }
  }, [onClose])

  function run(action: () => void) {
    onClose()
    action()
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      event.preventDefault()
      onClose()
      return
    }
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp' && event.key !== 'Home' && event.key !== 'End') {
      return
    }

    const items = [...(menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? [])]
    if (items.length === 0) return
    event.preventDefault()

    const activeIndex = items.findIndex((item) => item === document.activeElement)
    let nextIndex = 0
    if (event.key === 'ArrowDown') nextIndex = activeIndex < 0 ? 0 : (activeIndex + 1) % items.length
    else if (event.key === 'ArrowUp') nextIndex = activeIndex < 0 ? items.length - 1 : (activeIndex - 1 + items.length) % items.length
    else if (event.key === 'End') nextIndex = items.length - 1
    items[nextIndex]?.focus()
  }

  const folder = target.type === 'folder' ? target.node.path : ''

  return (
    <div
      ref={menuRef}
      className="sb-context-menu"
      role="menu"
      aria-label="白板操作"
      tabIndex={-1}
      style={{ left: position.left, top: position.top }}
      onKeyDown={handleKeyDown}
      onContextMenu={(event) => event.preventDefault()}
    >
      {target.type === 'file' ? (
        <>
          <div className="sb-context-menu-group">
            <button
              className="sb-context-menu-item"
              type="button"
              role="menuitem"
              onClick={() => run(() => onRename(target.node))}
            >
              <span className="sb-context-menu-icon">
                <PencilIcon />
              </span>
              <span className="sb-context-menu-label">重命名 / 移动…</span>
            </button>
          </div>
          <div className="sb-context-menu-group">
            <button
              className="sb-context-menu-item sb-context-menu-item-danger"
              type="button"
              role="menuitem"
              onClick={() => run(() => onDelete(target.node))}
            >
              <span className="sb-context-menu-icon">
                <TrashIcon />
              </span>
              <span className="sb-context-menu-label">删除…</span>
            </button>
          </div>
        </>
      ) : (
        <div className="sb-context-menu-group">
          <button
            className="sb-context-menu-item"
            type="button"
            role="menuitem"
            onClick={() => run(() => onCreate(folder))}
            title={folder ? `在 ${folder} 中新建白板` : '在根目录新建白板'}
          >
            <span className="sb-context-menu-icon">
              <PlusIcon />
            </span>
            <span className="sb-context-menu-label">{target.type === 'folder' ? '在此新建白板…' : '新建白板…'}</span>
          </button>
        </div>
      )}
    </div>
  )
}

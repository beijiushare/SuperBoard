import {
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react'

interface FloatingPanelOptions {
  x?: number
  alignRight?: boolean
  centerVertically?: boolean
}

export function useFloatingPanel({
  x = 16,
  alignRight = false,
  centerVertically = true,
}: FloatingPanelOptions = {}) {
  const rootRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{
    pointerX: number
    pointerY: number
    x: number
    y: number
  } | null>(null)
  const [position, setPosition] = useState({ x, y: 16 })

  useLayoutEffect(() => {
    const root = rootRef.current
    const stage = root?.parentElement
    if (!root || !stage) return
    setPosition((current) => ({
      x: alignRight
        ? Math.max(8, stage.clientWidth - root.offsetWidth - x)
        : current.x,
      y: centerVertically
        ? Math.max(8, (stage.clientHeight - root.offsetHeight) / 2)
        : current.y,
    }))
  }, [alignRight, centerVertically, x])

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    event.preventDefault()
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    dragRef.current = {
      pointerX: event.clientX,
      pointerY: event.clientY,
      x: position.x,
      y: position.y,
    }
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current
    const root = rootRef.current
    const stage = root?.parentElement
    if (!drag || !root || !stage) return
    const maxX = Math.max(0, stage.clientWidth - root.offsetWidth - 8)
    const maxY = Math.max(0, stage.clientHeight - root.offsetHeight - 8)
    setPosition({
      x: Math.max(0, Math.min(maxX, drag.x + event.clientX - drag.pointerX)),
      y: Math.max(0, Math.min(maxY, drag.y + event.clientY - drag.pointerY)),
    })
  }

  function handlePointerUp() {
    dragRef.current = null
  }

  return {
    rootRef,
    position,
    handleProps: {
      onPointerDown: handlePointerDown,
      onPointerMove: handlePointerMove,
      onPointerUp: handlePointerUp,
      onPointerCancel: handlePointerUp,
    },
  }
}

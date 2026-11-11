import {
  useLayoutEffect,
  useRef,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type RefObject,
} from 'react'
import { HTMLContainer, useEditor, useValue } from 'tldraw'
import { getSbBlockStyle } from './blockStyles'
import { requestShapeEdit } from './shapeEvents'
import type { SuperboardShape } from './types'

const AUTO_GROW_PADDING = 4

function useAutoGrow(
  contentRef: RefObject<HTMLDivElement | null>,
  measureSelector: string,
  baseHeight: number,
  onGrow?: (baseHeight: number) => void,
) {
  useLayoutEffect(() => {
    if (!onGrow) return
    const scroller = contentRef.current?.querySelector<HTMLElement>(measureSelector)
    if (!scroller) return

    const measure = () => {
      const overflow = scroller.scrollHeight - scroller.clientHeight
      if (overflow <= 1) return
      onGrow(Math.ceil(scroller.scrollHeight + AUTO_GROW_PADDING))
    }

    measure()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(scroller)
    return () => observer.disconnect()
  }, [baseHeight, measureSelector, onGrow, contentRef])
}

interface SbShapeContainerProps {
  shape: SuperboardShape
  baseWidth: number
  baseHeight: number
  measureSelector: string
  onGrow?: (baseHeight: number) => void
  children: ReactNode
}

export function SbShapeContainer({
  shape,
  baseWidth,
  baseHeight,
  measureSelector,
  onGrow,
  children,
}: SbShapeContainerProps) {
  const editor = useEditor()
  const contentRef = useRef<HTMLDivElement>(null)
  const colors = useValue(
    'superboard block colors',
    () => {
      const theme = editor.getCurrentTheme()
      return theme.colors[editor.getColorMode()]
    },
    [editor],
  )
  const lastDownRef = useRef<{ time: number; x: number; y: number } | null>(null)

  useAutoGrow(contentRef, measureSelector, baseHeight, onGrow)

  function onPointerDownCapture(event: ReactPointerEvent) {
    if (editor.getInstanceState().isReadonly) return
    if (event.button !== 0) {
      lastDownRef.current = null
      return
    }

    const now = performance.now()
    const last = lastDownRef.current
    const isSecondClick =
      last !== null &&
      now - last.time < 500 &&
      Math.hypot(event.clientX - last.x, event.clientY - last.y) < 6

    if (!isSecondClick) {
      lastDownRef.current = { time: now, x: event.clientX, y: event.clientY }
      return
    }

    lastDownRef.current = null
    event.preventDefault()
    event.stopPropagation()
    requestShapeEdit(editor, shape.id)
  }

  function onDoubleClick(event: ReactMouseEvent) {
    event.stopPropagation()
    requestShapeEdit(editor, shape.id)
  }

  return (
    <HTMLContainer
      className="sb-shape-container"
      style={{
        ...getSbBlockStyle(colors, shape.props),
        width: shape.props.w,
        height: shape.props.h,
      }}
      onPointerDownCapture={onPointerDownCapture}
      onDoubleClick={onDoubleClick}
    >
      <div
        ref={contentRef}
        className="sb-block-scale"
        style={{
          width: baseWidth,
          height: baseHeight,
          transform: `scale(${shape.props.w / baseWidth}, ${shape.props.h / baseHeight})`,
        }}
      >
        {children}
      </div>
    </HTMLContainer>
  )
}

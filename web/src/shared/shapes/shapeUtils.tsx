import { useRef, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { BaseBoxShapeUtil, HTMLContainer, Rectangle2d, useEditor } from 'tldraw'
import { KanbanView } from '../kanban/KanbanView'
import { MarkdownView } from '../markdown/MarkdownView'
import { PeleView } from '../pele/PeleView'
import {
  DEFAULT_KANBAN_TEXT,
  DEFAULT_MARKDOWN_TEXT,
  DEFAULT_PELE_CODE,
  SB_KANBAN_TYPE,
  SB_MARKDOWN_TYPE,
  SB_PELE_TYPE,
  SUPERBOARD_EDIT_EVENT,
  sbKanbanProps,
  sbMarkdownProps,
  sbPeleProps,
  type SbKanbanShape,
  type SbMarkdownShape,
  type SbPeleShape,
} from './types'

function requestEdit(editor: { getInstanceState: () => { isReadonly: boolean } }, shapeId: string) {
  if (editor.getInstanceState().isReadonly) return
  window.dispatchEvent(new CustomEvent(SUPERBOARD_EDIT_EVENT, { detail: { shapeId } }))
}

interface SbShapeContainerProps {
  shapeId: string
  width: number
  height: number
  children: ReactNode
}

function SbShapeContainer({ shapeId, width, height, children }: SbShapeContainerProps) {
  const editor = useEditor()
  const lastDownRef = useRef<{ time: number; x: number; y: number } | null>(null)

  function onPointerDownCapture(event: ReactPointerEvent) {
    if (editor.getInstanceState().isReadonly) return

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
    requestEdit(editor, shapeId)
  }

  function onDoubleClick(event: ReactMouseEvent) {
    event.stopPropagation()
    requestEdit(editor, shapeId)
  }

  return (
    <HTMLContainer
      className="sb-shape-container"
      style={{ width, height }}
      onPointerDownCapture={onPointerDownCapture}
      onDoubleClick={onDoubleClick}
    >
      {children}
    </HTMLContainer>
  )
}

export class SbMarkdownShapeUtil extends BaseBoxShapeUtil<SbMarkdownShape> {
  static override type = SB_MARKDOWN_TYPE
  static override props = sbMarkdownProps

  getDefaultProps(): SbMarkdownShape['props'] {
    return { w: 460, h: 340, text: DEFAULT_MARKDOWN_TEXT }
  }

  getGeometry(shape: SbMarkdownShape) {
    return new Rectangle2d({ width: shape.props.w, height: shape.props.h, isFilled: true })
  }

  component(shape: SbMarkdownShape) {
    return (
      <SbShapeContainer shapeId={shape.id} width={shape.props.w} height={shape.props.h}>
        <div className="sb-card sb-card-markdown">
          <div className="sb-card-scroll">
            <MarkdownView source={shape.props.text} />
          </div>
        </div>
      </SbShapeContainer>
    )
  }

  getIndicatorPath(shape: SbMarkdownShape) {
    const path = new Path2D()
    path.rect(0, 0, shape.props.w, shape.props.h)
    return path
  }

  override onDoubleClick(shape: SbMarkdownShape) {
    requestEdit(this.editor, shape.id)
  }
}

export class SbKanbanShapeUtil extends BaseBoxShapeUtil<SbKanbanShape> {
  static override type = SB_KANBAN_TYPE
  static override props = sbKanbanProps

  getDefaultProps(): SbKanbanShape['props'] {
    return { w: 780, h: 420, text: DEFAULT_KANBAN_TEXT }
  }

  getGeometry(shape: SbKanbanShape) {
    return new Rectangle2d({ width: shape.props.w, height: shape.props.h, isFilled: true })
  }

  component(shape: SbKanbanShape) {
    return (
      <SbShapeContainer shapeId={shape.id} width={shape.props.w} height={shape.props.h}>
        <div className="sb-card sb-card-kanban">
          <KanbanView source={shape.props.text} />
        </div>
      </SbShapeContainer>
    )
  }

  getIndicatorPath(shape: SbKanbanShape) {
    const path = new Path2D()
    path.rect(0, 0, shape.props.w, shape.props.h)
    return path
  }

  override onDoubleClick(shape: SbKanbanShape) {
    requestEdit(this.editor, shape.id)
  }
}

export class SbPeleShapeUtil extends BaseBoxShapeUtil<SbPeleShape> {
  static override type = SB_PELE_TYPE
  static override props = sbPeleProps

  getDefaultProps(): SbPeleShape['props'] {
    return { w: 580, h: 380, code: DEFAULT_PELE_CODE, diagram: 'flowchart' }
  }

  getGeometry(shape: SbPeleShape) {
    return new Rectangle2d({ width: shape.props.w, height: shape.props.h, isFilled: true })
  }

  component(shape: SbPeleShape) {
    return (
      <SbShapeContainer shapeId={shape.id} width={shape.props.w} height={shape.props.h}>
        <div className="sb-card sb-card-pele">
          <PeleView code={shape.props.code} />
        </div>
      </SbShapeContainer>
    )
  }

  getIndicatorPath(shape: SbPeleShape) {
    const path = new Path2D()
    path.rect(0, 0, shape.props.w, shape.props.h)
    return path
  }

  override onDoubleClick(shape: SbPeleShape) {
    requestEdit(this.editor, shape.id)
  }
}

export const superboardShapeUtils = [SbMarkdownShapeUtil, SbKanbanShapeUtil, SbPeleShapeUtil]

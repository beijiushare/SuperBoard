import { useRef, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { BaseBoxShapeUtil, HTMLContainer, Rectangle2d, useEditor, useValue } from 'tldraw'
import { MarkdownView } from '../markdown/MarkdownView'
import { PeleView } from '../pele/PeleView'
import { getSbBlockStyle } from './blockStyles'
import {
  DEFAULT_MARKDOWN_TEXT,
  DEFAULT_PELE_CODE,
  DEFAULT_SB_BLOCK_STYLE,
  DEFAULT_SB_PELE_STYLE,
  SB_MARKDOWN_TYPE,
  SB_PELE_TYPE,
  SUPERBOARD_EDIT_EVENT,
  sbMarkdownMigrations,
  sbMarkdownProps,
  sbPeleMigrations,
  sbPeleProps,
  type SbMarkdownShape,
  type SbPeleShape,
  type SuperboardShape,
} from './types'

function requestEdit(editor: { getInstanceState: () => { isReadonly: boolean } }, shapeId: string) {
  if (editor.getInstanceState().isReadonly) return
  window.dispatchEvent(new CustomEvent(SUPERBOARD_EDIT_EVENT, { detail: { shapeId } }))
}

interface SbShapeContainerProps {
  shape: SuperboardShape
  children: ReactNode
}

function SbShapeContainer({ shape, children }: SbShapeContainerProps) {
  const editor = useEditor()
  const colors = useValue(
    'superboard block colors',
    () => {
      const theme = editor.getCurrentTheme()
      return theme.colors[editor.getColorMode()]
    },
    [editor],
  )
  const lastDownRef = useRef<{ time: number; x: number; y: number } | null>(null)

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
    requestEdit(editor, shape.id)
  }

  function onDoubleClick(event: ReactMouseEvent) {
    event.stopPropagation()
    requestEdit(editor, shape.id)
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
      {children}
    </HTMLContainer>
  )
}

export class SbMarkdownShapeUtil extends BaseBoxShapeUtil<SbMarkdownShape> {
  static override type = SB_MARKDOWN_TYPE
  static override props = sbMarkdownProps
  static override migrations = sbMarkdownMigrations

  getDefaultProps(): SbMarkdownShape['props'] {
    return { ...DEFAULT_SB_BLOCK_STYLE, w: 460, h: 340, text: DEFAULT_MARKDOWN_TEXT }
  }

  getGeometry(shape: SbMarkdownShape) {
    return new Rectangle2d({ width: shape.props.w, height: shape.props.h, isFilled: true })
  }

  component(shape: SbMarkdownShape) {
    return (
      <SbShapeContainer shape={shape}>
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

export class SbPeleShapeUtil extends BaseBoxShapeUtil<SbPeleShape> {
  static override type = SB_PELE_TYPE
  static override props = sbPeleProps
  static override migrations = sbPeleMigrations

  getDefaultProps(): SbPeleShape['props'] {
    return {
      ...DEFAULT_SB_PELE_STYLE,
      w: 580,
      h: 380,
      code: DEFAULT_PELE_CODE,
      diagram: 'flowchart',
    }
  }

  getGeometry(shape: SbPeleShape) {
    return new Rectangle2d({ width: shape.props.w, height: shape.props.h, isFilled: true })
  }

  component(shape: SbPeleShape) {
    return (
      <SbShapeContainer shape={shape}>
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

export const superboardShapeUtils = [SbMarkdownShapeUtil, SbPeleShapeUtil]

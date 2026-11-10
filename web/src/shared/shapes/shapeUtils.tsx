import { useLayoutEffect, useRef, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
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
  SB_MEDIA_TYPE,
  SB_PELE_TYPE,
  SUPERBOARD_EDIT_EVENT,
  SUPERBOARD_MEDIA_EVENT,
  sbMarkdownMigrations,
  sbMarkdownProps,
  sbMediaMigrations,
  sbMediaProps,
  sbPeleMigrations,
  sbPeleProps,
  type SbMarkdownShape,
  type SbMediaProps,
  type SbMediaShape,
  type SbPeleShape,
  type SuperboardShape,
} from './types'

function requestEdit(editor: { getInstanceState: () => { isReadonly: boolean } }, shapeId: string) {
  if (editor.getInstanceState().isReadonly) return
  window.dispatchEvent(new CustomEvent(SUPERBOARD_EDIT_EVENT, { detail: { shapeId } }))
}

function requestMediaEdit(editor: { getInstanceState: () => { isReadonly: boolean } }, shapeId: string) {
  if (editor.getInstanceState().isReadonly) return
  window.dispatchEvent(new CustomEvent(SUPERBOARD_MEDIA_EVENT, { detail: { shapeId } }))
}

function clampPercent(value: number) {
  return Math.min(100, Math.max(0, value))
}

function mediaClipPath(props: SbMediaProps) {
  if (props.crop === 'circle') {
    const radius = (Math.min(props.w, props.h) * clampPercent(props.cropRadius)) / 100
    return `circle(${radius}px at ${clampPercent(props.cropCx)}% ${clampPercent(props.cropCy)}%)`
  }

  const x = clampPercent(props.cropX)
  const y = clampPercent(props.cropY)
  const width = clampPercent(props.cropW)
  const height = clampPercent(props.cropH)
  const right = clampPercent(100 - x - width)
  const bottom = clampPercent(100 - y - height)
  const inset = `inset(${y}% ${right}% ${bottom}% ${x}%`
  if (props.crop === 'rounded') {
    const cropWidth = (props.w * width) / 100
    const cropHeight = (props.h * height) / 100
    const radius = (Math.min(cropWidth, cropHeight) * Math.min(50, clampPercent(props.cropCorner))) / 100
    return `${inset} round ${radius}px)`
  }
  return `${inset})`
}

function SbMediaContainer({ shape }: { shape: SbMediaShape }) {
  const editor = useEditor()
  const { url, kind, w, h } = shape.props
  const readonly = editor.getInstanceState().isReadonly

  function onDoubleClick(event: ReactMouseEvent) {
    event.stopPropagation()
    requestMediaEdit(editor, shape.id)
  }

  return (
    <HTMLContainer
      className="sb-shape-container"
      style={{ width: w, height: h }}
      onDoubleClick={onDoubleClick}
    >
      <div className="sb-card sb-card-media" style={{ clipPath: mediaClipPath(shape.props) }}>
        {kind === 'image' ? (
          <img src={url} alt="" draggable={false} />
        ) : kind === 'video' ? (
          <video src={url} controls playsInline />
        ) : (
          <iframe
            src={url}
            title="嵌入内容"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            style={{ pointerEvents: readonly ? 'auto' : 'none' }}
          />
        )}
      </div>
    </HTMLContainer>
  )
}

interface SbShapeContainerProps {
  shape: SuperboardShape
  baseWidth: number
  baseHeight: number
  measureSelector: string
  onGrow?: (baseHeight: number) => void
  children: ReactNode
}

function SbShapeContainer({
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

  useLayoutEffect(() => {
    if (!onGrow) return
    const scroller = contentRef.current?.querySelector<HTMLElement>(measureSelector)
    if (!scroller) return

    const measure = () => {
      const overflow = scroller.scrollHeight - scroller.clientHeight
      if (overflow <= 1) return
      onGrow(Math.ceil(scroller.scrollHeight + 4))
    }

    measure()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(scroller)
    return () => observer.disconnect()
  }, [baseHeight, measureSelector, onGrow])

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

export class SbMarkdownShapeUtil extends BaseBoxShapeUtil<SbMarkdownShape> {
  static override type = SB_MARKDOWN_TYPE
  static override props = sbMarkdownProps
  static override migrations = sbMarkdownMigrations

  getDefaultProps(): SbMarkdownShape['props'] {
    return { ...DEFAULT_SB_BLOCK_STYLE, w: 460, h: 340, baseH: 340, text: DEFAULT_MARKDOWN_TEXT }
  }

  override isAspectRatioLocked() {
    return true
  }

  getGeometry(shape: SbMarkdownShape) {
    return new Rectangle2d({ width: shape.props.w, height: shape.props.h, isFilled: true })
  }

  component(shape: SbMarkdownShape) {
    const editor = this.editor
    return (
      <SbShapeContainer
        shape={shape}
        baseWidth={460}
        baseHeight={shape.props.baseH}
        measureSelector=".sb-card-scroll"
        onGrow={(baseH) => {
          const scale = shape.props.w / 460
          const props = { ...shape.props, baseH, h: baseH * scale }
          if (editor.getIsReadonly()) {
            editor.store.put([{ ...shape, props }])
          } else {
            editor.updateShape<SbMarkdownShape>({
              id: shape.id,
              type: SB_MARKDOWN_TYPE,
              props,
            })
          }
        }}
      >
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
      baseH: 380,
      code: DEFAULT_PELE_CODE,
      diagram: 'flowchart',
    }
  }

  override isAspectRatioLocked() {
    return true
  }

  getGeometry(shape: SbPeleShape) {
    return new Rectangle2d({ width: shape.props.w, height: shape.props.h, isFilled: true })
  }

  component(shape: SbPeleShape) {
    const editor = this.editor
    return (
      <SbShapeContainer
        shape={shape}
        baseWidth={580}
        baseHeight={shape.props.baseH}
        measureSelector=".sb-pele"
        onGrow={(baseH) => {
          const scale = shape.props.w / 580
          const props = { ...shape.props, baseH, h: baseH * scale }
          if (editor.getIsReadonly()) {
            editor.store.put([{ ...shape, props }])
          } else {
            editor.updateShape<SbPeleShape>({
              id: shape.id,
              type: SB_PELE_TYPE,
              props,
            })
          }
        }}
      >
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

export class SbMediaShapeUtil extends BaseBoxShapeUtil<SbMediaShape> {
  static override type = SB_MEDIA_TYPE
  static override props = sbMediaProps
  static override migrations = sbMediaMigrations

  getDefaultProps(): SbMediaShape['props'] {
    return {
      w: 640,
      h: 360,
      url: '',
      kind: 'iframe',
      crop: 'rounded',
      cropX: 0,
      cropY: 0,
      cropW: 100,
      cropH: 100,
      cropCx: 50,
      cropCy: 50,
      cropRadius: 50,
      cropCorner: 8,
    }
  }

  getGeometry(shape: SbMediaShape) {
    return new Rectangle2d({ width: shape.props.w, height: shape.props.h, isFilled: true })
  }

  override isAspectRatioLocked() {
    return true
  }

  component(shape: SbMediaShape) {
    return <SbMediaContainer shape={shape} />
  }

  getIndicatorPath(shape: SbMediaShape) {
    const path = new Path2D()
    path.rect(0, 0, shape.props.w, shape.props.h)
    return path
  }

  override onDoubleClick(shape: SbMediaShape) {
    requestMediaEdit(this.editor, shape.id)
  }
}

export const superboardShapeUtils = [SbMarkdownShapeUtil, SbPeleShapeUtil, SbMediaShapeUtil]

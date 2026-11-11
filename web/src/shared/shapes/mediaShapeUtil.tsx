import type { MouseEvent as ReactMouseEvent } from 'react'
import { BaseBoxShapeUtil, HTMLContainer, Rectangle2d, useEditor, useValue } from 'tldraw'
import { requestMediaEdit } from './shapeEvents'
import {
  SB_MEDIA_TYPE,
  sbMediaMigrations,
  sbMediaProps,
  type SbMediaProps,
  type SbMediaShape,
} from './types'

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
  const isSelected = useValue(
    'superboard media selected',
    () => editor.getSelectedShapeIds().includes(shape.id),
    [editor, shape.id],
  )
  const interactive = readonly || isSelected

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
          <video
            src={url}
            controls
            playsInline
            style={{ pointerEvents: interactive ? 'auto' : 'none' }}
          />
        ) : (
          <iframe
            src={url}
            title="嵌入内容"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            style={{ pointerEvents: interactive ? 'auto' : 'none' }}
          />
        )}
      </div>
    </HTMLContainer>
  )
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

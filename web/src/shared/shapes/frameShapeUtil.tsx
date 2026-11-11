import { BaseBoxShapeUtil, HTMLContainer, Rectangle2d } from 'tldraw'
import { isFrameMode } from './frameMode'
import { SB_FRAME_TYPE, sbFrameProps, type SbFrameShape } from './types'

const BASE_WIDTH = 1280
const BASE_HEIGHT = 720

function SbFrameContainer({ shape }: { shape: SbFrameShape }) {
  return (
    <HTMLContainer className="sb-frame-container" style={{ width: shape.props.w, height: shape.props.h }}>
      <div className="sb-frame-outline" />
      <div className="sb-frame-badge">帧 {shape.props.order}</div>
    </HTMLContainer>
  )
}

export class SbFrameShapeUtil extends BaseBoxShapeUtil<SbFrameShape> {
  static override type = SB_FRAME_TYPE
  static override props = sbFrameProps

  getDefaultProps(): SbFrameShape['props'] {
    return { w: BASE_WIDTH, h: BASE_HEIGHT, order: 1 }
  }

  getGeometry(shape: SbFrameShape) {
    if (!isFrameMode() || this.editor.getInstanceState().isReadonly) {
      return new Rectangle2d({ width: 0, height: 0, isFilled: false })
    }
    return new Rectangle2d({ width: shape.props.w, height: shape.props.h, isFilled: true })
  }

  override isAspectRatioLocked() {
    return true
  }

  component(shape: SbFrameShape) {
    return <SbFrameContainer shape={shape} />
  }

  getIndicatorPath(shape: SbFrameShape) {
    const path = new Path2D()
    path.rect(0, 0, shape.props.w, shape.props.h)
    return path
  }
}

import { BaseBoxShapeUtil, Rectangle2d } from 'tldraw'
import { PeleView } from '../pele/PeleView'
import { SbShapeContainer } from './shapeContainer'
import { requestShapeEdit } from './shapeEvents'
import {
  DEFAULT_PELE_CODE,
  DEFAULT_SB_PELE_STYLE,
  SB_PELE_TYPE,
  sbPeleMigrations,
  sbPeleProps,
  type SbPeleShape,
} from './types'

const BASE_WIDTH = 580
const BASE_HEIGHT = 380

export class SbPeleShapeUtil extends BaseBoxShapeUtil<SbPeleShape> {
  static override type = SB_PELE_TYPE
  static override props = sbPeleProps
  static override migrations = sbPeleMigrations

  getDefaultProps(): SbPeleShape['props'] {
    return {
      ...DEFAULT_SB_PELE_STYLE,
      w: BASE_WIDTH,
      h: BASE_HEIGHT,
      baseH: BASE_HEIGHT,
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
        baseWidth={BASE_WIDTH}
        baseHeight={shape.props.baseH}
        measureSelector=".sb-pele"
        onGrow={(baseH) => {
          const scale = shape.props.w / BASE_WIDTH
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
    requestShapeEdit(this.editor, shape.id)
  }
}

import { BaseBoxShapeUtil, Rectangle2d } from 'tldraw'
import { MarkdownView } from '../markdown/MarkdownView'
import { SbShapeContainer } from './shapeContainer'
import { requestShapeEdit } from './shapeEvents'
import {
  DEFAULT_MARKDOWN_TEXT,
  DEFAULT_SB_BLOCK_STYLE,
  SB_MARKDOWN_TYPE,
  sbMarkdownMigrations,
  sbMarkdownProps,
  type SbMarkdownShape,
} from './types'

const BASE_WIDTH = 460
const BASE_HEIGHT = 340

export class SbMarkdownShapeUtil extends BaseBoxShapeUtil<SbMarkdownShape> {
  static override type = SB_MARKDOWN_TYPE
  static override props = sbMarkdownProps
  static override migrations = sbMarkdownMigrations

  getDefaultProps(): SbMarkdownShape['props'] {
    return {
      ...DEFAULT_SB_BLOCK_STYLE,
      w: BASE_WIDTH,
      h: BASE_HEIGHT,
      baseH: BASE_HEIGHT,
      text: DEFAULT_MARKDOWN_TEXT,
    }
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
        baseWidth={BASE_WIDTH}
        baseHeight={shape.props.baseH}
        measureSelector=".sb-card-scroll"
        onGrow={(baseH) => {
          const scale = shape.props.w / BASE_WIDTH
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
    requestShapeEdit(this.editor, shape.id)
  }
}

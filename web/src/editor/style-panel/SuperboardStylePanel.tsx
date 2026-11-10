import {
  DefaultStylePanel,
  StylePanelSection,
  StylePanelSubheading,
  useEditor,
  useValue,
  type TLUiStylePanelProps,
} from 'tldraw'
import { superboardCanvasComponents } from '../../shared/canvas/CanvasBackground'
import {
  isSuperboardShapeType,
  sbBlockBackgroundColorStyle,
  sbBlockBackgroundOpacityStyle,
  sbBlockBorderColorStyle,
  sbBlockBorderOpacityStyle,
} from '../../shared/shapes/types'
import { BlockColorPicker } from './BlockColorPicker'
import { BorderStylePicker, BorderWidthPicker } from './BorderPickers'
import { OpacitySlider } from './OpacitySlider'

function SuperboardBlockStylePanel() {
  return (
    <>
      <StylePanelSection>
        <StylePanelSubheading>块背景</StylePanelSubheading>
        <BlockColorPicker title="颜色" style={sbBlockBackgroundColorStyle} />
        <OpacitySlider title="透明度" style={sbBlockBackgroundOpacityStyle} />
      </StylePanelSection>
      <StylePanelSection>
        <StylePanelSubheading>块边框</StylePanelSubheading>
        <BlockColorPicker title="颜色" style={sbBlockBorderColorStyle} />
        <BorderWidthPicker />
        <BorderStylePicker />
        <OpacitySlider title="透明度" style={sbBlockBorderOpacityStyle} />
      </StylePanelSection>
    </>
  )
}

export function SuperboardStylePanel(props: TLUiStylePanelProps) {
  const editor = useEditor()
  const hasCustomShape = useValue(
    'superboard style panel selection',
    () => editor.getSelectedShapes().some((shape) => isSuperboardShapeType(shape.type)),
    [editor],
  )

  return (
    <DefaultStylePanel {...props}>
      {hasCustomShape ? <SuperboardBlockStylePanel /> : undefined}
    </DefaultStylePanel>
  )
}

export const superboardEditorComponents = {
  ...superboardCanvasComponents,
  StylePanel: SuperboardStylePanel,
}

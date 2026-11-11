import {
  DefaultStylePanel,
  StylePanelSection,
  useEditor,
  useValue,
  type TLUiStylePanelProps,
} from 'tldraw'
import { superboardCanvasComponents } from '../../shared/canvas/CanvasBackground'
import { useEditorUiState } from '../editorUiState'
import {
  isSuperboardShapeType,
  SB_MEDIA_TYPE,
  sbBlockBackgroundColorStyle,
  sbBlockBackgroundOpacityStyle,
  sbBlockBorderColorStyle,
  sbBlockBorderOpacityStyle,
} from '../../shared/shapes/types'
import { BlockColorPicker } from './BlockColorPicker'
import { BorderStylePicker, BorderWidthPicker } from './BorderPickers'
import { MediaCropPanel } from './MediaCropPanel'
import { OpacitySlider } from './OpacitySlider'

function SuperboardBlockStylePanel() {
  return (
    <>
      <StylePanelSection>
        <BlockColorPicker title="背景颜色" style={sbBlockBackgroundColorStyle} />
        <OpacitySlider title="背景透明度" style={sbBlockBackgroundOpacityStyle} />
      </StylePanelSection>
      <StylePanelSection>
        <BlockColorPicker title="边框颜色" style={sbBlockBorderColorStyle} />
        <BorderWidthPicker />
        <BorderStylePicker />
        <OpacitySlider title="边框透明度" style={sbBlockBorderOpacityStyle} />
      </StylePanelSection>
    </>
  )
}

export function SuperboardStylePanel(props: TLUiStylePanelProps) {
  const { stylePanelOpen } = useEditorUiState()
  const editor = useEditor()
  const hasCustomShape = useValue(
    'superboard style panel selection',
    () => editor.getSelectedShapes().some((shape) => isSuperboardShapeType(shape.type)),
    [editor],
  )
  const hasMediaShape = useValue(
    'superboard media style panel selection',
    () => editor.getSelectedShapes().some((shape) => shape.type === SB_MEDIA_TYPE),
    [editor],
  )

  if (!stylePanelOpen) return null

  return (
    <DefaultStylePanel {...props}>
      {hasCustomShape ? <SuperboardBlockStylePanel /> : undefined}
      {hasMediaShape ? <MediaCropPanel /> : undefined}
    </DefaultStylePanel>
  )
}

export const superboardEditorComponents = {
  ...superboardCanvasComponents,
  StylePanel: SuperboardStylePanel,
}

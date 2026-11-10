import type { CSSProperties } from 'react'
import {
  DefaultStylePanel,
  StylePanelSection,
  StylePanelSubheading,
  TldrawUiSlider,
  useEditor,
  useStylePanelContext,
  useValue,
  type SharedStyle,
  type StyleProp,
  type TLUiStylePanelProps,
} from 'tldraw'
import {
  SB_BLOCK_BORDER_STYLE_LABELS,
  SB_BLOCK_BORDER_STYLE_VALUES,
  SB_BLOCK_BORDER_WIDTH_LABELS,
  SB_BLOCK_BORDER_WIDTH_PX,
  SB_BLOCK_BORDER_WIDTH_VALUES,
  SB_BLOCK_COLOR_LABELS,
  SB_BLOCK_COLOR_VALUES,
  resolveSbBlockColor,
  type SbBlockColor,
} from '../shared/shapes/blockStyles'
import { superboardCanvasComponents } from '../shared/canvas/CanvasBackground'
import {
  isSuperboardShapeType,
  sbBlockBackgroundColorStyle,
  sbBlockBackgroundOpacityStyle,
  sbBlockBorderColorStyle,
  sbBlockBorderOpacityStyle,
  sbBlockBorderStyleStyle,
  sbBlockBorderWidthStyle,
} from '../shared/shapes/types'

function useSharedValue<T>(style: StyleProp<T>): SharedStyle<T> | undefined {
  return useStylePanelContext().styles.get(style)
}

function BlockColorPicker({ title, style }: { title: string; style: StyleProp<SbBlockColor> }) {
  const editor = useEditor()
  const { onHistoryMark, onValueChange } = useStylePanelContext()
  const colors = useValue(
    'superboard block style colors',
    () => {
      const theme = editor.getCurrentTheme()
      return theme.colors[editor.getColorMode()]
    },
    [editor],
  )
  const current = useSharedValue(style)

  return (
    <div className="sb-block-style-picker">
      <span className="sb-block-style-label">{title}</span>
      <div className="sb-block-color-grid" role="group" aria-label={title}>
        {SB_BLOCK_COLOR_VALUES.map((color) => {
          const active = current?.type === 'shared' && current.value === color
          const label = SB_BLOCK_COLOR_LABELS[color]
          return (
            <button
              key={color}
              className={`sb-block-color${active ? ' is-active' : ''}`}
              type="button"
              title={label}
              aria-label={`${title}：${label}`}
              aria-pressed={active}
              style={{ '--sb-block-swatch': resolveSbBlockColor(colors, color) } as CSSProperties}
              onClick={() => {
                onHistoryMark('superboard block color')
                onValueChange(style, color)
              }}
            >
              <span />
            </button>
          )
        })}
      </div>
    </div>
  )
}

function BorderWidthPicker() {
  const { onHistoryMark, onValueChange } = useStylePanelContext()
  const current = useSharedValue(sbBlockBorderWidthStyle)

  return (
    <div className="sb-block-style-picker sb-block-style-picker-inline">
      <span className="sb-block-style-label">粗细</span>
      <div className="sb-block-choice-row" role="group" aria-label="边框粗细">
        {SB_BLOCK_BORDER_WIDTH_VALUES.map((width) => {
          const active = current?.type === 'shared' && current.value === width
          const label = SB_BLOCK_BORDER_WIDTH_LABELS[width]
          return (
            <button
              key={width}
              className={`sb-block-choice${active ? ' is-active' : ''}`}
              type="button"
              title={label}
              aria-label={`边框粗细：${label}`}
              aria-pressed={active}
              onClick={() => {
                onHistoryMark('superboard border width')
                onValueChange(sbBlockBorderWidthStyle, width)
              }}
            >
              {width === 'none' ? (
                <span className="sb-block-choice-none">无</span>
              ) : (
                <span
                  className="sb-block-border-sample"
                  style={{ borderTopWidth: `${SB_BLOCK_BORDER_WIDTH_PX[width]}px` }}
                />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function BorderStylePicker() {
  const { onHistoryMark, onValueChange } = useStylePanelContext()
  const current = useSharedValue(sbBlockBorderStyleStyle)

  return (
    <div className="sb-block-style-picker sb-block-style-picker-inline">
      <span className="sb-block-style-label">样式</span>
      <div className="sb-block-choice-row" role="group" aria-label="边框样式">
        {SB_BLOCK_BORDER_STYLE_VALUES.map((borderStyle) => {
          const active = current?.type === 'shared' && current.value === borderStyle
          const label = SB_BLOCK_BORDER_STYLE_LABELS[borderStyle]
          return (
            <button
              key={borderStyle}
              className={`sb-block-choice${active ? ' is-active' : ''}`}
              type="button"
              title={label}
              aria-label={`边框样式：${label}`}
              aria-pressed={active}
              onClick={() => {
                onHistoryMark('superboard border style')
                onValueChange(sbBlockBorderStyleStyle, borderStyle)
              }}
            >
              <span className="sb-block-border-sample" style={{ borderTopStyle: borderStyle }} />
            </button>
          )
        })}
      </div>
    </div>
  )
}

function OpacitySlider({ title, style }: { title: string; style: StyleProp<number> }) {
  const { onHistoryMark, onValueChange } = useStylePanelContext()
  const current = useSharedValue(style)
  const value = current?.type === 'shared' ? Math.round(current.value) : null
  const label = value === null ? '多个值' : `${value}%`

  return (
    <div className="sb-block-opacity">
      <div className="sb-block-opacity-head">
        <span>{title}</span>
        <span>{label}</span>
      </div>
      <TldrawUiSlider
        value={value}
        label={label}
        title={title}
        steps={100}
        onHistoryMark={onHistoryMark}
        onValueChange={(next) => onValueChange(style, next)}
      />
    </div>
  )
}

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

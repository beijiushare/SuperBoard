import { useStylePanelContext } from 'tldraw'
import {
  SB_BLOCK_BORDER_STYLE_LABELS,
  SB_BLOCK_BORDER_STYLE_VALUES,
  SB_BLOCK_BORDER_WIDTH_LABELS,
  SB_BLOCK_BORDER_WIDTH_PX,
  SB_BLOCK_BORDER_WIDTH_VALUES,
} from '../../shared/shapes/blockStyles'
import { sbBlockBorderStyleStyle, sbBlockBorderWidthStyle } from '../../shared/shapes/types'
import { useSharedValue } from './useSharedValue'

export function BorderWidthPicker() {
  const { onHistoryMark, onValueChange } = useStylePanelContext()
  const current = useSharedValue(sbBlockBorderWidthStyle)

  return (
    <div className="sb-block-style-picker">
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
                <span className="sb-block-choice-none" />
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

export function BorderStylePicker() {
  const { onHistoryMark, onValueChange } = useStylePanelContext()
  const current = useSharedValue(sbBlockBorderStyleStyle)

  return (
    <div className="sb-block-style-picker">
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

import type { CSSProperties } from 'react'
import { useEditor, useStylePanelContext, useValue, type StyleProp } from 'tldraw'
import {
  SB_BLOCK_COLOR_LABELS,
  SB_BLOCK_COLOR_VALUES,
  resolveSbBlockColor,
  type SbBlockColor,
} from '../../shared/shapes/blockStyles'
import { useSharedValue } from './useSharedValue'

export function BlockColorPicker({ title, style }: { title: string; style: StyleProp<SbBlockColor> }) {
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
      <div className="sb-block-color-grid" role="group" aria-label={title}>
        {SB_BLOCK_COLOR_VALUES.map((color) => {
          const active = current?.type === 'shared' && current.value === color
          const label = SB_BLOCK_COLOR_LABELS[color]
          const light = color === 'white' || color === 'paper'
          return (
            <button
              key={color}
              className={`sb-block-color${active ? ' is-active' : ''}${light ? ' is-light' : ''}`}
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

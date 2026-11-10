import { TldrawUiSlider, useStylePanelContext, type StyleProp } from 'tldraw'
import { useSharedValue } from './useSharedValue'

export function OpacitySlider({ title, style }: { title: string; style: StyleProp<number> }) {
  const { onHistoryMark, onValueChange } = useStylePanelContext()
  const current = useSharedValue(style)
  const value = current?.type === 'shared' ? Math.round(current.value) : null
  const label = value === null ? '混合值' : `${value}%`

  return (
    <div className="sb-block-opacity">
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

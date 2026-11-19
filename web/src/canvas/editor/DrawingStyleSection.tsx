import { ColorPicker } from './ColorPicker'
import type { DrawingPatch } from './drawingStyle'
import { StyleNumberControl } from './StyleNumberControl'

interface DrawingStyleSectionProps {
  size: number
  color: string
  opacity: number
  thinning: number
  smoothing: number
  streamline: number
  simulatePressure: boolean
  start: number
  end: number
  recentColors?: string[]
  onChange: (patch: DrawingPatch) => void
  onColorUsed?: (value: string) => void
}

export function DrawingStyleSection({
  size,
  color,
  opacity,
  thinning,
  smoothing,
  streamline,
  simulatePressure,
  start,
  end,
  recentColors,
  onChange,
  onColorUsed,
}: DrawingStyleSectionProps) {
  return (
    <section>
      <h3>笔触</h3>
      <StyleNumberControl
        label="粗细"
        value={size}
        min={1}
        max={80}
        step={1}
        unit="px"
        onChange={(value) => onChange({ size: value })}
      />
      <ColorPicker
        label="颜色"
        value={color}
        recentColors={recentColors}
        onChange={(value) => onChange({ color: value })}
        onColorUsed={onColorUsed}
      />
      <StyleNumberControl
        label="透明度"
        value={opacity}
        min={0}
        max={100}
        step={1}
        unit="%"
        slider
        onChange={(value) => onChange({ opacity: value / 100 })}
      />
      <StyleNumberControl
        label="压感强度"
        value={thinning}
        min={-1}
        max={1}
        step={0.05}
        onChange={(value) => onChange({ thinning: value })}
      />
      <StyleNumberControl
        label="平滑"
        value={smoothing}
        min={0}
        max={1}
        step={0.05}
        onChange={(value) => onChange({ smoothing: value })}
      />
      <StyleNumberControl
        label="流线"
        value={streamline}
        min={0}
        max={1}
        step={0.05}
        onChange={(value) => onChange({ streamline: value })}
      />
      <div className="sb-style-row">
        <span>模拟压感</span>
        <button
          type="button"
          className={`sb-style-toggle${simulatePressure ? ' is-active' : ''}`}
          onClick={() => onChange({ simulatePressure: !simulatePressure })}
        >
          {simulatePressure ? '开启' : '关闭'}
        </button>
      </div>
      <StyleNumberControl
        label="起笔"
        value={start}
        min={0}
        max={100}
        step={1}
        onChange={(value) => onChange({ start: value })}
      />
      <StyleNumberControl
        label="收笔"
        value={end}
        min={0}
        max={100}
        step={1}
        onChange={(value) => onChange({ end: value })}
      />
    </section>
  )
}

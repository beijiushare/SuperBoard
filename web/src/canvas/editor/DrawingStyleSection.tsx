import { useTranslation } from 'react-i18next'
import { ColorPicker } from './ColorPicker'
import type { DrawingPatch } from './drawingStyle'
import { StyleNumberControl } from './StyleNumberControl'
import { Switch } from '../../components/ui/switch'

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
  const { t } = useTranslation(['editor'])
  return (
    <section>
      <h3>{t('editor:style.stroke')}</h3>
      <StyleNumberControl
        label={t('editor:style.thickness')}
        value={size}
        min={1}
        max={80}
        step={1}
        unit="px"
        onChange={(value) => onChange({ size: value })}
      />
      <ColorPicker
        label={t('editor:style.color')}
        value={color}
        recentColors={recentColors}
        onChange={(value) => onChange({ color: value })}
        onColorUsed={onColorUsed}
      />
      <StyleNumberControl
        label={t('editor:style.opacity')}
        value={opacity}
        min={0}
        max={100}
        step={1}
        unit="%"
        slider
        onChange={(value) => onChange({ opacity: value / 100 })}
      />
      <StyleNumberControl
        label={t('editor:style.pressure')}
        value={thinning}
        min={-1}
        max={1}
        step={0.05}
        onChange={(value) => onChange({ thinning: value })}
      />
      <StyleNumberControl
        label={t('editor:style.smoothing')}
        value={smoothing}
        min={0}
        max={1}
        step={0.05}
        onChange={(value) => onChange({ smoothing: value })}
      />
      <StyleNumberControl
        label={t('editor:style.streamline')}
        value={streamline}
        min={0}
        max={1}
        step={0.05}
        onChange={(value) => onChange({ streamline: value })}
      />
      <div className="sb-style-row">
        <span>{t('editor:style.simulatePressure')}</span>
        <Switch
          checked={simulatePressure}
          onChange={(checked) => onChange({ simulatePressure: checked })}
          ariaLabel={t('editor:style.simulatePressure')}
        />
      </div>
      <StyleNumberControl
        label={t('editor:style.start')}
        value={start}
        min={0}
        max={100}
        step={1}
        onChange={(value) => onChange({ start: value })}
      />
      <StyleNumberControl
        label={t('editor:style.end')}
        value={end}
        min={0}
        max={100}
        step={1}
        onChange={(value) => onChange({ end: value })}
      />
    </section>
  )
}

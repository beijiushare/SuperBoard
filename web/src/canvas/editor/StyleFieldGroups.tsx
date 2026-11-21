import { useTranslation } from 'react-i18next'
import {
  DEFAULT_TEXT_FONT,
  type CanvasNode,
  type SuperBoardCanvasSettings,
  type SuperBoardGridMode,
  type SuperBoardStyle,
} from '../model'
import { ColorPicker } from './ColorPicker'
import { DEFAULT_PREFERENCES, fontOptions } from './preferences'
import { StyleNumberControl } from './StyleNumberControl'
import { Select } from '../../components/ui/select'

interface TransformFieldsProps {
  rotation: number
  width: number
  height: number
  onRotation: (value: number) => void
  onWidth: (value: number) => void
  onHeight: (value: number) => void
}

export function TransformFields({
  rotation,
  width,
  height,
  onRotation,
  onWidth,
  onHeight,
}: TransformFieldsProps) {
  const { t } = useTranslation(['editor'])
  return (
    <section>
      <h3>{t('editor:style.transform')}</h3>
      <StyleNumberControl
        label={t('editor:style.angle')}
        value={rotation}
        min={-360}
        max={360}
        step={1}
        unit="°"
        slider
        onChange={onRotation}
      />
      <StyleNumberControl
        label={t('editor:style.height')}
        value={height}
        min={1}
        max={10000}
        step={1}
        unit="px"
        onChange={onHeight}
      />
      <StyleNumberControl
        label={t('editor:style.width')}
        value={width}
        min={1}
        max={10000}
        step={1}
        unit="px"
        onChange={onWidth}
      />
    </section>
  )
}

interface BackgroundFieldsProps {
  color: string
  opacity: number
  allowNone?: boolean
  recentColors?: string[]
  onColor: (value: string) => void
  onOpacity: (value: number) => void
  onColorUsed?: (value: string) => void
}

export function BackgroundFields({
  color,
  opacity,
  allowNone = true,
  recentColors,
  onColor,
  onOpacity,
  onColorUsed,
}: BackgroundFieldsProps) {
  const { t } = useTranslation(['editor'])
  return (
    <section>
      <h3>{t('editor:style.background')}</h3>
      <ColorPicker
        label={t('editor:style.color')}
        value={color}
        allowNone={allowNone}
        recentColors={recentColors}
        onChange={onColor}
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
        onChange={onOpacity}
      />
    </section>
  )
}

interface BorderFieldsProps {
  color: string
  opacity: number
  width: number
  style: string
  showStyle?: boolean
  recentColors?: string[]
  onColor: (value: string) => void
  onOpacity: (value: number) => void
  onWidth: (value: number) => void
  onStyle: (value: string) => void
  onColorUsed?: (value: string) => void
}

export function BorderFields({
  color,
  opacity,
  width,
  style,
  showStyle = true,
  recentColors,
  onColor,
  onOpacity,
  onWidth,
  onStyle,
  onColorUsed,
}: BorderFieldsProps) {
  const { t } = useTranslation(['editor'])
  return (
    <section>
      <h3>{t('editor:style.border')}</h3>
      <ColorPicker
        label={t('editor:style.color')}
        value={color}
        allowNone
        recentColors={recentColors}
        onChange={onColor}
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
        onChange={onOpacity}
      />
      <StyleNumberControl
        label={t('editor:style.thickness')}
        value={width}
        min={0}
        max={40}
        step={0.5}
        unit="px"
        onChange={onWidth}
      />
      {showStyle ? (
        <div className="sb-style-row">
          <span>{t('editor:style.lineStyle')}</span>
          <div className="sb-style-buttons">
            {(
              [
                ['solid', t('editor:style.solid')],
                ['dashed', t('editor:style.dashed')],
                ['dotted', t('editor:style.dotted')],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={style === value ? 'is-active' : undefined}
                onClick={() => onStyle(value)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  )
}

interface CanvasFieldsProps {
  background: string
  backgroundOpacity: number
  grid: SuperBoardGridMode
  guides: boolean
  recentColors?: string[]
  onUpdate: (patch: Partial<SuperBoardCanvasSettings>) => void
  onToggleGuides: () => void
  onColorUsed?: (value: string) => void
}

export function CanvasFields({
  background,
  backgroundOpacity,
  grid,
  guides,
  recentColors,
  onUpdate,
  onToggleGuides,
  onColorUsed,
}: CanvasFieldsProps) {
  const { t } = useTranslation(['editor'])
  return (
    <section>
      <h3>{t('editor:style.canvas')}</h3>
      <ColorPicker
        label={t('editor:style.color')}
        value={background}
        recentColors={recentColors}
        onChange={(value) => onUpdate({ background: value })}
        onColorUsed={onColorUsed}
      />
      <StyleNumberControl
        label={t('editor:style.opacity')}
        value={backgroundOpacity}
        min={0}
        max={100}
        step={1}
        unit="%"
        slider
        onChange={(value) => onUpdate({ backgroundOpacity: value / 100 })}
      />
      <div className="sb-style-row">
        <span>{t('editor:style.grid')}</span>
        <div className="sb-style-buttons">
          {(
            [
              ['none', t('editor:style.gridNone')],
              ['lines', t('editor:style.gridLines')],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={grid === value ? 'is-active' : undefined}
              onClick={() => onUpdate({ grid: value })}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="sb-style-row">
        <span>{t('editor:style.guides')}</span>
        <button
          type="button"
          className={`sb-style-toggle${guides ? ' is-active' : ''}`}
          onClick={onToggleGuides}
        >
          {guides ? t('editor:style.on') : t('editor:style.off')}
        </button>
      </div>
    </section>
  )
}

interface TextFieldsProps {
  node?: CanvasNode
  recentColors?: string[]
  onChange: (patch: Partial<SuperBoardStyle>) => void
  onColorUsed?: (value: string) => void
}

export function TextFields({
  node,
  recentColors,
  onChange,
  onColorUsed,
}: TextFieldsProps) {
  const { t } = useTranslation(['editor'])
  const style = {
    ...DEFAULT_PREFERENCES.text,
    ...node?.['x-superboard']?.style,
  }
  return (
    <section>
      <h3>{t('editor:style.text')}</h3>
      <div className="sb-style-row">
        <span>{t('editor:style.font')}</span>
        <Select
          className="sb-select-compact"
          value={style.fontFamily ?? DEFAULT_TEXT_FONT}
          onChange={(value) => onChange({ fontFamily: value || undefined })}
          ariaLabel={t('editor:style.font')}
          options={fontOptions(t)}
        />
      </div>
      <StyleNumberControl
        label={t('editor:style.fontSize')}
        value={style.fontSize ?? 16}
        min={8}
        max={200}
        step={1}
        unit="px"
        onChange={(fontSize) => onChange({ fontSize })}
      />
      <ColorPicker
        label={t('editor:style.color')}
        value={style.color ?? '#1d1d1d'}
        recentColors={recentColors}
        onChange={(color) => onChange({ color })}
        onColorUsed={onColorUsed}
      />
      <StyleNumberControl
        label={t('editor:style.opacity')}
        value={Math.round((style.opacity ?? 1) * 100)}
        min={0}
        max={100}
        step={1}
        unit="%"
        slider
        onChange={(value) => onChange({ opacity: value / 100 })}
      />
      <div className="sb-style-row">
        <span>{t('editor:style.fontStyle')}</span>
        <div className="sb-style-buttons">
          <button
            type="button"
            className={Number(style.fontWeight ?? 400) >= 700 ? 'is-active' : undefined}
            onClick={() =>
              onChange({
                fontWeight: Number(style.fontWeight ?? 400) >= 700 ? 400 : 700,
              })
            }
          >
            <strong>B</strong>
          </button>
          <button
            type="button"
            className={style.fontStyle === 'italic' ? 'is-active' : undefined}
            onClick={() =>
              onChange({
                fontStyle: style.fontStyle === 'italic' ? 'normal' : 'italic',
              })
            }
          >
            <em>I</em>
          </button>
          <button
            type="button"
            className={style.textDecoration === 'underline' ? 'is-active' : undefined}
            onClick={() =>
              onChange({
                textDecoration:
                  style.textDecoration === 'underline' ? 'none' : 'underline',
              })
            }
          >
            <u>U</u>
          </button>
        </div>
      </div>
      <div className="sb-style-row">
        <span>{t('editor:style.textAlign')}</span>
        <div className="sb-style-buttons">
          {(
            [
              ['left', t('editor:style.alignLeftShort')],
              ['center', t('editor:style.alignCenterShort')],
              ['right', t('editor:style.alignRightShort')],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={(style.textAlign ?? 'left') === value ? 'is-active' : undefined}
              onClick={() => onChange({ textAlign: value })}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </section>
  )
}

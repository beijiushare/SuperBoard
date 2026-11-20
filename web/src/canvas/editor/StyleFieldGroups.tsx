import {
  DEFAULT_TEXT_FONT,
  type CanvasNode,
  type SuperBoardCanvasSettings,
  type SuperBoardGridMode,
  type SuperBoardStyle,
} from '../model'
import { ColorPicker } from './ColorPicker'
import { DEFAULT_PREFERENCES, FONT_OPTIONS } from './preferences'
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
  return (
    <section>
      <h3>变换</h3>
      <StyleNumberControl
        label="角度"
        value={rotation}
        min={-360}
        max={360}
        step={1}
        unit="°"
        slider
        onChange={onRotation}
      />
      <StyleNumberControl
        label="高度"
        value={height}
        min={1}
        max={10000}
        step={1}
        unit="px"
        onChange={onHeight}
      />
      <StyleNumberControl
        label="宽度"
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
  return (
    <section>
      <h3>背景</h3>
      <ColorPicker
        label="颜色"
        value={color}
        allowNone={allowNone}
        recentColors={recentColors}
        onChange={onColor}
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
  return (
    <section>
      <h3>边框</h3>
      <ColorPicker
        label="颜色"
        value={color}
        allowNone
        recentColors={recentColors}
        onChange={onColor}
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
        onChange={onOpacity}
      />
      <StyleNumberControl
        label="粗细"
        value={width}
        min={0}
        max={40}
        step={0.5}
        unit="px"
        onChange={onWidth}
      />
      {showStyle ? (
        <div className="sb-style-row">
          <span>线型</span>
          <div className="sb-style-buttons">
            {(
              [
                ['solid', '实线'],
                ['dashed', '虚线'],
                ['dotted', '点线'],
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
  return (
    <section>
      <h3>画布</h3>
      <ColorPicker
        label="颜色"
        value={background}
        recentColors={recentColors}
        onChange={(value) => onUpdate({ background: value })}
        onColorUsed={onColorUsed}
      />
      <StyleNumberControl
        label="透明度"
        value={backgroundOpacity}
        min={0}
        max={100}
        step={1}
        unit="%"
        slider
        onChange={(value) => onUpdate({ backgroundOpacity: value / 100 })}
      />
      <div className="sb-style-row">
        <span>网格</span>
        <div className="sb-style-buttons">
          {(
            [
              ['none', '无'],
              ['lines', '网格'],
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
        <span>对齐</span>
        <button
          type="button"
          className={`sb-style-toggle${guides ? ' is-active' : ''}`}
          onClick={onToggleGuides}
        >
          {guides ? '开启' : '关闭'}
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
  const style = {
    ...DEFAULT_PREFERENCES.text,
    ...node?.['x-superboard']?.style,
  }
  return (
    <section>
      <h3>文本</h3>
      <div className="sb-style-row">
        <span>字体</span>
        <Select
          className="sb-select-compact"
          value={style.fontFamily ?? DEFAULT_TEXT_FONT}
          onChange={(value) => onChange({ fontFamily: value || undefined })}
          ariaLabel="字体"
          options={FONT_OPTIONS}
        />
      </div>
      <StyleNumberControl
        label="字号"
        value={style.fontSize ?? 16}
        min={8}
        max={200}
        step={1}
        unit="px"
        onChange={(fontSize) => onChange({ fontSize })}
      />
      <ColorPicker
        label="颜色"
        value={style.color ?? '#1d1d1d'}
        recentColors={recentColors}
        onChange={(color) => onChange({ color })}
        onColorUsed={onColorUsed}
      />
      <StyleNumberControl
        label="透明度"
        value={Math.round((style.opacity ?? 1) * 100)}
        min={0}
        max={100}
        step={1}
        unit="%"
        slider
        onChange={(value) => onChange({ opacity: value / 100 })}
      />
      <div className="sb-style-row">
        <span>样式</span>
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
        <span>对齐</span>
        <div className="sb-style-buttons">
          {(
            [
              ['left', '左'],
              ['center', '中'],
              ['right', '右'],
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

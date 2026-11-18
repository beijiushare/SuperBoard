import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { ColorPicker } from './ColorPicker'
import {
  DEFAULT_PREFERENCES,
  FONT_OPTIONS,
  getPreferences,
  savePreferences,
  type EditorPreferences,
  type TextAlign,
} from './preferences'
import { BackgroundFields, BorderFields } from './StyleFieldGroups'
import { StyleNumberControl } from './StyleNumberControl'

interface PreferencesDialogProps {
  onClose: () => void
}

export function PreferencesDialog({ onClose }: PreferencesDialogProps) {
  const [draft, setDraft] = useState<EditorPreferences>(() =>
    structuredClone(getPreferences()),
  )

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  function updateBlock(patch: Partial<EditorPreferences['block']>) {
    setDraft((current) => ({
      ...current,
      block: { ...current.block, ...patch },
    }))
  }

  function updateText(patch: Partial<EditorPreferences['text']>) {
    setDraft((current) => ({
      ...current,
      text: { ...current.text, ...patch },
    }))
  }

  return createPortal(
    <div
      className="canvas-editor-dialog-backdrop"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="canvas-editor-dialog sb-preferences-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="偏好设置"
        onClick={(event) => event.stopPropagation()}
      >
        <h2>偏好设置</h2>
        <p className="sb-preferences-note">
          保存在当前浏览器，作为所有未单独设置样式的块的默认值。
        </p>

        <BackgroundFields
          color={draft.block.backgroundColor}
          opacity={Math.round(draft.block.backgroundOpacity * 100)}
          allowNone={false}
          onColor={(backgroundColor) => updateBlock({ backgroundColor })}
          onOpacity={(value) => updateBlock({ backgroundOpacity: value / 100 })}
        />
        <BorderFields
          color={draft.block.borderColor}
          opacity={Math.round(draft.block.borderOpacity * 100)}
          width={draft.block.borderWidth}
          style={draft.block.borderStyle}
          onColor={(borderColor) => updateBlock({ borderColor })}
          onOpacity={(value) => updateBlock({ borderOpacity: value / 100 })}
          onWidth={(borderWidth) => updateBlock({ borderWidth })}
          onStyle={(borderStyle) =>
            updateBlock({
              borderStyle: borderStyle as EditorPreferences['block']['borderStyle'],
            })
          }
        />

        <section>
          <h3>文本默认样式</h3>
          <div className="sb-style-row">
            <span>字体</span>
            <select
              className="sb-style-select"
              value={draft.text.fontFamily}
              onChange={(event) =>
                updateText({ fontFamily: event.target.value })
              }
            >
              {FONT_OPTIONS.map((font) => (
                <option key={font.value} value={font.value}>
                  {font.label}
                </option>
              ))}
            </select>
          </div>
          <StyleNumberControl
            label="字号"
            value={draft.text.fontSize}
            min={8}
            max={200}
            step={1}
            unit="px"
            onChange={(fontSize) => updateText({ fontSize })}
          />
          <ColorPicker
            label="颜色"
            value={draft.text.color}
            onChange={(color) => updateText({ color })}
          />
          <StyleNumberControl
            label="透明度"
            value={Math.round(draft.text.opacity * 100)}
            min={0}
            max={100}
            step={1}
            unit="%"
            slider
            onChange={(value) => updateText({ opacity: value / 100 })}
          />
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
                  className={
                    draft.text.textAlign === value ? 'is-active' : undefined
                  }
                  onClick={() => updateText({ textAlign: value as TextAlign })}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </section>

        <section>
          <h3>形状默认样式</h3>
          <StyleNumberControl
            label="圆角"
            value={draft.shapeCornerRadius}
            min={0}
            max={200}
            step={1}
            unit="px"
            onChange={(shapeCornerRadius) =>
              setDraft((current) => ({ ...current, shapeCornerRadius }))
            }
          />
        </section>

        <div className="canvas-editor-dialog-actions">
          <button
            type="button"
            onClick={() => setDraft(structuredClone(DEFAULT_PREFERENCES))}
          >
            恢复默认
          </button>
          <button type="button" onClick={onClose}>
            取消
          </button>
          <button
            type="button"
            onClick={() => {
              savePreferences(draft)
              onClose()
            }}
          >
            保存
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

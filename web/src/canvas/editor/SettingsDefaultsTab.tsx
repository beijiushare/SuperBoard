import { useTranslation } from 'react-i18next'
import { ColorPicker } from './ColorPicker'
import {
  fontOptions,
  type EditorPreferences,
  type TextAlign,
} from './preferences'
import { BackgroundFields, BorderFields } from './StyleFieldGroups'
import { StyleNumberControl } from './StyleNumberControl'
import { Select } from '../../components/ui/select'

interface SettingsDefaultsTabProps {
  draft: EditorPreferences
  onBlockChange: (patch: Partial<EditorPreferences['block']>) => void
  onTextChange: (patch: Partial<EditorPreferences['text']>) => void
  onShapeRadius: (value: number) => void
  onRequestReset: () => void
}

export function SettingsDefaultsTab({
  draft,
  onBlockChange,
  onTextChange,
  onShapeRadius,
  onRequestReset,
}: SettingsDefaultsTabProps) {
  const { t } = useTranslation(['settings', 'editor'])

  return (
    <>
      <section className="sb-settings-card">
        <header className="sb-settings-card-head">
          <div>
            <h3>{t('settings:textDefaults.title')}</h3>
          </div>
        </header>
        <div className="sb-settings-rows">
          <div className="sb-settings-row">
            <span>{t('editor:style.font')}</span>
            <Select
              className="sb-select-settings"
              value={draft.text.fontFamily}
              onChange={(value) => onTextChange({ fontFamily: value })}
              ariaLabel={t('editor:style.font')}
              options={fontOptions(t)}
            />
          </div>
          <StyleNumberControl
            label={t('editor:style.fontSize')}
            value={draft.text.fontSize}
            min={8}
            max={200}
            step={1}
            unit="px"
            onChange={(fontSize) => onTextChange({ fontSize })}
          />
          <ColorPicker
            label={t('editor:style.color')}
            value={draft.text.color}
            onChange={(color) => onTextChange({ color })}
          />
          <StyleNumberControl
            label={t('editor:style.opacity')}
            value={Math.round(draft.text.opacity * 100)}
            min={0}
            max={100}
            step={1}
            unit="%"
            slider
            onChange={(value) => onTextChange({ opacity: value / 100 })}
          />
          <div className="sb-settings-row">
            <span>{t('settings:textDefaults.align')}</span>
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
                  className={
                    draft.text.textAlign === value ? 'is-active' : undefined
                  }
                  onClick={() => onTextChange({ textAlign: value as TextAlign })}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <BackgroundFields
        color={draft.block.backgroundColor}
        opacity={Math.round(draft.block.backgroundOpacity * 100)}
        allowNone={false}
        onColor={(backgroundColor) => onBlockChange({ backgroundColor })}
        onOpacity={(value) => onBlockChange({ backgroundOpacity: value / 100 })}
      />
      <BorderFields
        color={draft.block.borderColor}
        opacity={Math.round(draft.block.borderOpacity * 100)}
        width={draft.block.borderWidth}
        style={draft.block.borderStyle}
        onColor={(borderColor) => onBlockChange({ borderColor })}
        onOpacity={(value) => onBlockChange({ borderOpacity: value / 100 })}
        onWidth={(borderWidth) => onBlockChange({ borderWidth })}
        onStyle={(borderStyle) =>
          onBlockChange({
            borderStyle:
              borderStyle as EditorPreferences['block']['borderStyle'],
          })
        }
      />

      <section className="sb-settings-card">
        <header className="sb-settings-card-head">
          <div>
            <h3>{t('settings:blockDefaults.title')}</h3>
          </div>
        </header>
        <div className="sb-settings-rows">
          <StyleNumberControl
            label={t('editor:style.cornerRadius')}
            value={draft.shapeCornerRadius}
            min={0}
            max={200}
            step={1}
            unit="px"
            onChange={onShapeRadius}
          />
        </div>
      </section>

      <section className="sb-settings-card">
        <header className="sb-settings-card-head">
          <div>
            <h3>{t('settings:reset.title')}</h3>
            <p>{t('settings:reset.description')}</p>
          </div>
          <button
            type="button"
            className="sb-button sb-button-small sb-button-danger"
            onClick={onRequestReset}
          >
            {t('settings:reset.action')}
          </button>
        </header>
      </section>
    </>
  )
}

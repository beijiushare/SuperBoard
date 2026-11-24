import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import {
  DEFAULT_PREFERENCES,
  getPreferences,
  savePreferences,
  type EditorPreferences,
} from './preferences'
import { usePreferencesWorkspace } from './usePreferencesWorkspace'
import { SettingsAboutTab } from './SettingsAboutTab'
import { SettingsAITab } from './SettingsAITab'
import { SettingsDefaultsTab } from './SettingsDefaultsTab'
import { SettingsGeneralTab } from './SettingsGeneralTab'
import { SettingsHelpTab } from './SettingsHelpTab'

interface PreferencesDialogProps {
  onClose: () => void
}

export function PreferencesDialog({ onClose }: PreferencesDialogProps) {
  const { t } = useTranslation(['settings', 'common'])
  const [draft, setDraft] = useState<EditorPreferences>(() =>
    structuredClone(getPreferences()),
  )
  const [confirmReset, setConfirmReset] = useState(false)
  const [tab, setTab] = useState<'about' | 'general' | 'defaults' | 'ai' | 'help'>(
    'general',
  )
  const workspace = usePreferencesWorkspace()

  useEffect(() => {
    savePreferences(draft)
  }, [draft])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      if (confirmReset) setConfirmReset(false)
      else if (workspace.protectedWorkspace) workspace.setProtectedWorkspace(null)
      else onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [confirmReset, onClose, workspace.protectedWorkspace])

  return createPortal(
    <>
      <div
        className="canvas-editor-dialog-backdrop"
        onClick={onClose}
        role="presentation"
      >
        <div
          className="canvas-editor-dialog sb-preferences-dialog"
          role="dialog"
          aria-modal="true"
          aria-label={t('settings:dialogAria')}
          onClick={(event) => event.stopPropagation()}
        >
          <div className="sb-preferences-header">
            <div>
              <h2>{t('settings:title')}</h2>
              <p className="sb-preferences-note">{t('settings:note')}</p>
            </div>
            <button
              type="button"
              className="sb-preferences-close"
              title={t('common:actions.close')}
              aria-label={t('common:actions.close')}
              onClick={onClose}
            >
              ×
            </button>
          </div>

          <div
            className="sb-preferences-tabs"
            role="tablist"
            aria-label={t('settings:options')}
          >
            <p className="sb-settings-group">{t('settings:options')}</p>
            {(
              [
                ['general', 'settings:tabs.general'],
                ['defaults', 'settings:tabs.defaults'],
                ['ai', 'settings:tabs.ai'],
                ['help', 'settings:tabs.help'],
                ['about', 'settings:tabs.about'],
              ] as const
            ).map(([value, labelKey]) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={tab === value}
                className={tab === value ? 'is-active' : undefined}
                onClick={() => setTab(value)}
              >
                {t(labelKey)}
              </button>
            ))}
          </div>

          <div className="sb-settings-content">
            {tab === 'general' ? (
              <SettingsGeneralTab
                autoOpen={draft.autoOpenRecentWorkspace}
                onAutoOpenChange={(checked) =>
                  setDraft((current) => ({
                    ...current,
                    autoOpenRecentWorkspace: checked,
                  }))
                }
                workspace={workspace}
              />
            ) : null}
            {tab === 'defaults' ? (
              <SettingsDefaultsTab
                draft={draft}
                onBlockChange={(patch) =>
                  setDraft((current) => ({
                    ...current,
                    block: { ...current.block, ...patch },
                  }))
                }
                onTextChange={(patch) =>
                  setDraft((current) => ({
                    ...current,
                    text: { ...current.text, ...patch },
                  }))
                }
                onShapeRadius={(shapeCornerRadius) =>
                  setDraft((current) => ({ ...current, shapeCornerRadius }))
                }
                onRequestReset={() => setConfirmReset(true)}
              />
            ) : null}
            {tab === 'help' ? <SettingsHelpTab /> : null}
            {tab === 'ai' ? (
              <SettingsAITab
                draft={draft.ai}
                onChange={(patch) =>
                  setDraft((current) => ({
                    ...current,
                    ai: { ...current.ai, ...patch },
                  }))
                }
              />
            ) : null}
            {tab === 'about' ? <SettingsAboutTab /> : null}
          </div>
        </div>
      </div>
      {confirmReset ? (
        <div
          className="canvas-editor-dialog-backdrop is-nested"
          role="presentation"
          onClick={() => setConfirmReset(false)}
        >
          <div
            className="canvas-editor-dialog sb-confirm-dialog"
            role="dialog"
            aria-modal="true"
            aria-label={t('settings:reset.confirmTitle')}
            onClick={(event) => event.stopPropagation()}
          >
            <h2>{t('settings:reset.confirmTitle')}</h2>
            <p>{t('settings:reset.confirmBody')}</p>
            <div className="canvas-editor-dialog-actions">
              <button type="button" onClick={() => setConfirmReset(false)}>
                {t('settings:reset.cancel')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setDraft(structuredClone(DEFAULT_PREFERENCES))
                  setConfirmReset(false)
                }}
              >
                {t('settings:reset.confirm')}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {workspace.protectedWorkspace ? (
        <div
          className="canvas-editor-dialog-backdrop is-nested"
          role="presentation"
          onClick={() => workspace.setProtectedWorkspace(null)}
        >
          <div
            className="canvas-editor-dialog sb-confirm-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-label={t('settings:protected.title')}
            onClick={(event) => event.stopPropagation()}
          >
            <h2>{t('settings:protected.title')}</h2>
            <p>
              {t('settings:protected.bodyBefore', {
                name: workspace.protectedWorkspace.name,
              })}
              <button
                type="button"
                className="sb-inline-link"
                onClick={() => {
                  workspace.setProtectedWorkspace(null)
                  workspace.goStart()
                }}
              >
                {t('settings:protected.startLink')}
              </button>
              {t('settings:protected.bodyAfter')}
            </p>
            <div className="canvas-editor-dialog-actions">
              <button
                type="button"
                onClick={() => workspace.setProtectedWorkspace(null)}
              >
                {t('settings:protected.ok')}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>,
    document.body,
  )
}

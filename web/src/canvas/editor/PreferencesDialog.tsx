import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { ColorPicker } from './ColorPicker'
import {
  DEFAULT_PREFERENCES,
  fontOptions,
  getPreferences,
  savePreferences,
  type EditorPreferences,
  type TextAlign,
} from './preferences'
import { BackgroundFields, BorderFields } from './StyleFieldGroups'
import { StyleNumberControl } from './StyleNumberControl'
import { Select } from '../../components/ui/select'
import { desktopMode, desktopWorkspacePath } from '../../desktop/platform'
import { APP_VERSION } from '../../shared/appVersion'
import {
  canOpenWorkspace,
  changeAppLanguage,
  forgetRecentWorkspace,
  listRecentWorkspaces,
  openRecentWorkspace,
  openWorkspace,
  workspaceName,
  type WorkspaceRecentItem,
} from './workspacePlatform'
import { getAppLanguage, SUPPORTED_LANGUAGES } from '../../i18n'

interface PreferencesDialogProps {
  onClose: () => void
}

export function PreferencesDialog({ onClose }: PreferencesDialogProps) {
  const { t } = useTranslation(['settings', 'common', 'editor'])
  const language = getAppLanguage()
  const [draft, setDraft] = useState<EditorPreferences>(() =>
    structuredClone(getPreferences()),
  )
  const [confirmReset, setConfirmReset] = useState(false)
  const [tab, setTab] = useState<'about' | 'general' | 'defaults' | 'help'>(
    'general',
  )
  const [switching, setSwitching] = useState(false)
  const [workspacePath, setWorkspacePath] = useState('')
  const [recent, setRecent] = useState<WorkspaceRecentItem[]>([])
  const [protectedWorkspace, setProtectedWorkspace] =
    useState<WorkspaceRecentItem | null>(null)

  const refreshRecent = () => {
    void listRecentWorkspaces()
      .then(setRecent)
      .catch(() => setRecent([]))
  }

  useEffect(() => {
    refreshRecent()
  }, [])

  useEffect(() => {
    if (!desktopMode()) return
    let alive = true
    void desktopWorkspacePath().then((path) => {
      if (alive) setWorkspacePath(path)
    })
    return () => {
      alive = false
    }
  }, [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      if (confirmReset) setConfirmReset(false)
      else if (protectedWorkspace) setProtectedWorkspace(null)
      else onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [confirmReset, onClose, protectedWorkspace])

  useEffect(() => {
    savePreferences(draft)
  }, [draft])

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

  const currentWorkspace = workspacePath || workspaceName()

  function isCurrentWorkspace(item: WorkspaceRecentItem) {
    return item.path
      ? item.path === currentWorkspace
      : item.name === currentWorkspace
  }

  function switchToRecent(item: WorkspaceRecentItem) {
    if (!item.available || switching) return
    setSwitching(true)
    void openRecentWorkspace(item)
      .then(() => window.location.reload())
      .catch(() => setSwitching(false))
  }

  function removeRecent(item: WorkspaceRecentItem) {
    if (isCurrentWorkspace(item)) {
      setProtectedWorkspace(item)
      return
    }
    void forgetRecentWorkspace(item).then(refreshRecent)
  }

  function goStart() {
    const params = new URLSearchParams(window.location.search)
    params.set('start', '1')
    params.delete('board')
    params.delete('scope')
    window.location.href = `${window.location.pathname}?${params.toString()}`
  }

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
        {tab === 'about' ? (
          <section className="sb-settings-card">
            <header className="sb-settings-card-head">
              <div>
                <h3>{t('settings:about.title')}</h3>
                <p>
                  {t('settings:about.version', {
                    version: APP_VERSION,
                    platform: desktopMode()
                      ? t('settings:about.desktop')
                      : t('settings:about.browser'),
                  })}
                </p>
              </div>
            </header>
            <div className="sb-settings-rows">
              <p className="sb-settings-note">
                {desktopMode()
                  ? t('settings:about.desktopNote')
                  : t('settings:about.browserNote')}
              </p>
            </div>
          </section>
        ) : null}

        {tab === 'help' ? (
          <>
            <section className="sb-settings-card">
              <header className="sb-settings-card-head">
                <div>
                  <h3>{t('settings:help.focusTitle')}</h3>
                  <p>{t('settings:help.focusBody')}</p>
                </div>
              </header>
              <div className="sb-settings-rows">
                <p className="sb-settings-note">
                  {t('settings:help.focusNote')}
                </p>
              </div>
            </section>
            <section className="sb-settings-card">
              <header className="sb-settings-card-head">
                <div>
                  <h3>{t('settings:help.windowTitle')}</h3>
                  <p>{t('settings:help.windowOrder')}</p>
                </div>
              </header>
              <div className="sb-settings-rows">
                <p className="sb-settings-note">
                  {t('settings:help.windowDrag')}
                </p>
              </div>
            </section>
          </>
        ) : null}

        {tab === 'general' ? (
          <>
            <section className="sb-settings-card">
              <header className="sb-settings-card-head">
                <div>
                  <h3>{t('settings:workspace.title')}</h3>
                  <p>
                    {t('settings:workspace.current', {
                      path:
                        workspacePath ||
                        workspaceName() ||
                        t('settings:workspace.none'),
                    })}
                  </p>
                </div>
                {canOpenWorkspace() ? (
                  <button
                    type="button"
                    className="sb-button sb-button-small"
                    disabled={switching}
                    onClick={() => {
                      setSwitching(true)
                      void openWorkspace()
                        .then(() => window.location.reload())
                        .catch(() => setSwitching(false))
                    }}
                  >
                    {switching
                      ? t('settings:workspace.switching')
                      : t('settings:workspace.reselect')}
                  </button>
                ) : null}
              </header>

              <div className="sb-settings-rows">
                <p className="sb-settings-row-title">
                  {t('settings:workspace.recent')}
                </p>
                {recent.length > 0 ? (
                  <div className="sb-workspace-recent">
                    {recent.map((item) => {
                      const current = isCurrentWorkspace(item)
                      const detail = !item.available
                        ? t('settings:workspace.missing')
                        : item.permission === 'prompt'
                          ? t('settings:workspace.permission')
                          : item.path || item.name
                      return (
                        <div
                          key={item.id}
                          className={`sb-workspace-recent-row${
                            item.available ? '' : ' is-missing'
                          }`}
                        >
                          <button
                            type="button"
                            className="sb-workspace-recent-open"
                            disabled={!item.available || switching}
                            onClick={() => switchToRecent(item)}
                          >
                            <span className="sb-workspace-recent-name">
                              {item.name}
                              {current ? (
                                <small>{t('settings:workspace.currentBadge')}</small>
                              ) : null}
                            </span>
                            <span className="sb-workspace-recent-path">
                              {detail}
                            </span>
                          </button>
                          <button
                            type="button"
                            className="sb-workspace-recent-remove"
                            aria-label={t('settings:workspace.removeAria', {
                              name: item.name,
                            })}
                            title={t('settings:workspace.remove')}
                            onClick={() => removeRecent(item)}
                          >
                            ×
                          </button>
                        </div>
                      )
                    })}
                    <button
                      type="button"
                      className="sb-workspace-start"
                      onClick={goStart}
                    >
                      <span className="sb-workspace-recent-name">
                        {t('settings:start.open')}
                      </span>
                      <span className="sb-workspace-recent-path">
                        {t('settings:start.description')}
                      </span>
                    </button>
                  </div>
                ) : (
                  <p className="sb-settings-note">
                    {t('settings:workspace.noRecent')}
                  </p>
                )}
                <p className="sb-settings-note">
                  {t('settings:workspace.prefsSaved')}
                </p>
              </div>
            </section>

            <section className="sb-settings-card">
              <div className="sb-settings-rows">
                <div className="sb-settings-row">
                  <div className="sb-settings-row-text">
                    <span>{t('settings:language.title')}</span>
                    <small>{t('settings:language.description')}</small>
                  </div>
                  <Select
                    className="sb-select-settings"
                    value={language}
                    onChange={(value) => void changeAppLanguage(value)}
                    ariaLabel={t('settings:language.aria')}
                    options={SUPPORTED_LANGUAGES.map((lang) => ({
                      value: lang,
                      label: t(`common:language.${lang}`),
                    }))}
                  />
                </div>
              </div>
            </section>
          </>
        ) : null}

        {tab === 'defaults' ? (
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
                    onChange={(value) => updateText({ fontFamily: value })}
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
                  onChange={(fontSize) => updateText({ fontSize })}
                />
                <ColorPicker
                  label={t('editor:style.color')}
                  value={draft.text.color}
                  onChange={(color) => updateText({ color })}
                />
                <StyleNumberControl
                  label={t('editor:style.opacity')}
                  value={Math.round(draft.text.opacity * 100)}
                  min={0}
                  max={100}
                  step={1}
                  unit="%"
                  slider
                  onChange={(value) => updateText({ opacity: value / 100 })}
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
                        onClick={() => updateText({ textAlign: value as TextAlign })}
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
                  onChange={(shapeCornerRadius) =>
                    setDraft((current) => ({ ...current, shapeCornerRadius }))
                  }
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
                  onClick={() => setConfirmReset(true)}
                >
                  {t('settings:reset.action')}
                </button>
              </header>
            </section>
          </>
        ) : null}
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
    {protectedWorkspace ? (
      <div
        className="canvas-editor-dialog-backdrop is-nested"
        role="presentation"
        onClick={() => setProtectedWorkspace(null)}
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
              name: protectedWorkspace.name,
            })}
            <button
              type="button"
              className="sb-inline-link"
              onClick={() => {
                setProtectedWorkspace(null)
                goStart()
              }}
            >
              {t('settings:protected.startLink')}
            </button>
            {t('settings:protected.bodyAfter')}
          </p>
          <div className="canvas-editor-dialog-actions">
            <button
              type="button"
              onClick={() => setProtectedWorkspace(null)}
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

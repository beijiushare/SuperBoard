import { useTranslation } from 'react-i18next'
import { Select } from '../../components/ui/select'
import { Switch } from '../../components/ui/switch'
import { getAppLanguage, SUPPORTED_LANGUAGES } from '../../i18n'
import { changeAppLanguage, canOpenWorkspace } from './workspacePlatform'
import type { usePreferencesWorkspace } from './usePreferencesWorkspace'
import type { HistoryPreferences } from './preferences'
import { SettingsHistoryCard } from './SettingsHistoryCard'

interface SettingsGeneralTabProps {
  autoOpen: boolean
  onAutoOpenChange: (value: boolean) => void
  history: HistoryPreferences
  onHistoryChange: (patch: Partial<HistoryPreferences>) => void
  workspace: ReturnType<typeof usePreferencesWorkspace>
}

export function SettingsGeneralTab({
  autoOpen,
  onAutoOpenChange,
  history,
  onHistoryChange,
  workspace,
}: SettingsGeneralTabProps) {
  const { t } = useTranslation(['settings', 'common'])
  const language = getAppLanguage()

  return (
    <>
      <section className="sb-settings-card">
        <header className="sb-settings-card-head">
          <div>
            <h3>{t('settings:workspace.title')}</h3>
            <p>
              {t('settings:workspace.current', {
                path:
                  workspace.currentWorkspace ||
                  t('settings:workspace.none'),
              })}
            </p>
          </div>
          {canOpenWorkspace() ? (
            <button
              type="button"
              className="sb-button sb-button-small"
              disabled={workspace.switching}
              onClick={workspace.openFolder}
            >
              {workspace.switching
                ? t('settings:workspace.switching')
                : t('settings:workspace.reselect')}
            </button>
          ) : null}
        </header>

        <div className="sb-settings-rows">
          <div className="sb-settings-row">
            <div className="sb-settings-row-text">
              <span>{t('settings:workspace.autoOpen.title')}</span>
              <small>{t('settings:workspace.autoOpen.description')}</small>
            </div>
            <Switch
              checked={autoOpen}
              onChange={onAutoOpenChange}
              ariaLabel={t('settings:workspace.autoOpen.title')}
            />
          </div>
          <p className="sb-settings-row-title">
            {t('settings:workspace.recent')}
          </p>
          {workspace.recent.length > 0 ? (
            <div className="sb-workspace-recent">
              {workspace.recent.map((item) => {
                const current = workspace.isCurrentWorkspace(item)
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
                      disabled={!item.available || workspace.switching}
                      onClick={() => workspace.switchToRecent(item)}
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
                      onClick={() => workspace.removeRecent(item)}
                    >
                      ×
                    </button>
                  </div>
                )
              })}
              <button
                type="button"
                className="sb-workspace-start"
                onClick={workspace.goStart}
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

      <SettingsHistoryCard history={history} onChange={onHistoryChange} />

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
  )
}

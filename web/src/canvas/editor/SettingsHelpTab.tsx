import { useTranslation } from 'react-i18next'

export function SettingsHelpTab() {
  const { t } = useTranslation(['settings'])

  return (
    <>
      <section className="sb-settings-card">
        <header className="sb-settings-card-head">
          <div>
            <h3>{t('settings:help.focusTitle')}</h3>
            <p>{t('settings:help.focusBody')}</p>
          </div>
        </header>
        <div className="sb-settings-rows">
          <p className="sb-settings-note">{t('settings:help.focusNote')}</p>
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
          <p className="sb-settings-note">{t('settings:help.windowDrag')}</p>
        </div>
      </section>
    </>
  )
}

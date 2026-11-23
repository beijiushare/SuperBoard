import { useTranslation } from 'react-i18next'
import { desktopMode } from '../../desktop/platform'
import { APP_VERSION } from '../../shared/appVersion'
import { UpdateSettingsCard } from './UpdateSettingsCard'

export function SettingsAboutTab() {
  const { t } = useTranslation(['settings'])

  return (
    <>
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
      {desktopMode() ? <UpdateSettingsCard /> : null}
    </>
  )
}

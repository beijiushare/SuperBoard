import { useTranslation } from 'react-i18next'
import { APP_VERSION } from '../../shared/appVersion'
import { useDesktopUpdate } from './useDesktopUpdate'

export function UpdateSettingsCard() {
  const { t } = useTranslation(['settings'])
  const update = useDesktopUpdate()
  const version = update.version || APP_VERSION

  return (
    <section className="sb-settings-card">
      <header className="sb-settings-card-head">
        <div>
          <h3>{t('settings:update.title')}</h3>
          <p>{t('settings:update.hint')}</p>
        </div>
      </header>
      <div className="sb-settings-rows">
        <div className="sb-settings-row">
          <div className="sb-settings-row-text">
            <span>{t('settings:update.current', { version })}</span>
            <small>{t('settings:update.manualOnly')}</small>
          </div>
          <div className="sb-settings-actions">
            <button
              type="button"
              className="sb-button sb-button-small"
              disabled={update.phase !== 'idle'}
              onClick={update.check}
            >
              {update.phase === 'checking'
                ? t('settings:update.checking')
                : t('settings:update.check')}
            </button>
            <button
              type="button"
              className="sb-button sb-button-small sb-button-ghost"
              onClick={update.reveal}
            >
              {t('settings:update.reveal')}
            </button>
          </div>
        </div>
        {update.info ? (
          <div className="sb-settings-update">
            <p className="sb-settings-row-title">
              {t('settings:update.available', {
                version: update.info.version ?? '',
              })}
            </p>
            <p className="sb-settings-note">
              {update.info.size
                ? `${(update.info.size / 1024 / 1024).toFixed(1)} MB · `
                : ''}
              {update.info.name ?? ''}
            </p>
            {update.info.notes ? (
              <pre className="sb-settings-update-notes">{update.info.notes}</pre>
            ) : null}
            <p className="sb-settings-note">{t('settings:update.quitHint')}</p>
            <button
              type="button"
              className="sb-button sb-button-primary sb-button-small"
              onClick={update.openPage}
            >
              {t('settings:update.manual')}
            </button>
          </div>
        ) : update.error ? (
          <div className="sb-settings-update">
            <p className="sb-settings-note sb-settings-note-error">
              {t('settings:update.failed', { message: update.error })}
            </p>
            <button
              type="button"
              className="sb-button sb-button-small"
              onClick={update.openPage}
            >
              {t('settings:update.manual')}
            </button>
          </div>
        ) : update.checked ? (
          <p className="sb-settings-note">{t('settings:update.latest')}</p>
        ) : null}
      </div>
    </section>
  )
}

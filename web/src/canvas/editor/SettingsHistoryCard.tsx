import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getAppLanguage } from '../../i18n'
import {
  HISTORY_MAX_LIMIT,
  type HistoryPreferences,
} from './preferences'
import {
  clearAllHistory,
  historyStats,
} from './workspaceApi'

interface SettingsHistoryCardProps {
  history: HistoryPreferences
  onChange: (patch: Partial<HistoryPreferences>) => void
}

function formatSize(bytes: number) {
  const number = new Intl.NumberFormat(getAppLanguage(), {
    maximumFractionDigits: 1,
  })
  if (bytes < 1024) return `${number.format(bytes)} B`
  if (bytes < 1024 * 1024) return `${number.format(bytes / 1024)} KB`
  return `${number.format(bytes / 1024 / 1024)} MB`
}

export function SettingsHistoryCard({
  history,
  onChange,
}: SettingsHistoryCardProps) {
  const { t } = useTranslation(['settings', 'common'])
  const [stats, setStats] = useState<{ totalSize: number; count: number } | null>(
    null,
  )
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  const refresh = () => {
    void historyStats()
      .then(setStats)
      .catch(() => setStats(null))
  }

  useEffect(() => {
    refresh()
  }, [])

  const clearAll = () => {
    setBusy(true)
    setMessage('')
    void clearAllHistory()
      .then(() => {
        setConfirming(false)
        setMessage(t('settings:history.cleared'))
        refresh()
      })
      .catch((reason: unknown) => {
        setMessage(
          t('settings:history.clearFailed', {
            message:
              reason instanceof Error ? reason.message : String(reason),
          }),
        )
      })
      .finally(() => setBusy(false))
  }

  return (
    <section className="sb-settings-card">
      <header className="sb-settings-card-head">
        <div>
          <h3>{t('settings:history.title')}</h3>
          <p>{t('settings:history.description')}</p>
        </div>
      </header>
      <div className="sb-settings-rows">
        <div className="sb-settings-row">
          <div className="sb-settings-row-text">
            <span>{t('settings:history.interval')}</span>
            <small>{t('settings:history.intervalNote')}</small>
          </div>
          <div className="sb-settings-actions">
            <input
              className="sb-text-field sb-text-field-number"
              type="number"
              min={0}
              max={24 * 60}
              step={1}
              value={history.intervalMinutes}
              onChange={(event) => {
                const next = Number(event.target.value)
                if (!Number.isFinite(next) || next < 0) return
                onChange({
                  intervalMinutes: Math.min(24 * 60, Math.round(next)),
                })
              }}
            />
          </div>
        </div>
        <div className="sb-settings-row">
          <div className="sb-settings-row-text">
            <span>{t('settings:history.limit')}</span>
            <small>{t('settings:history.limitNote')}</small>
          </div>
          <div className="sb-settings-actions">
            <input
              className="sb-text-field sb-text-field-number"
              type="number"
              min={1}
              max={HISTORY_MAX_LIMIT}
              step={1}
              value={history.limit}
              onChange={(event) => {
                const next = Number(event.target.value)
                if (!Number.isFinite(next) || next <= 0) return
                onChange({
                  limit: Math.min(HISTORY_MAX_LIMIT, Math.round(next)),
                })
              }}
            />
          </div>
        </div>
        <div className="sb-settings-row">
          <div className="sb-settings-row-text">
            <span>{t('settings:history.storage')}</span>
            <small>
              {stats
                ? stats.count > 0
                  ? t('settings:history.usage', {
                      size: formatSize(stats.totalSize),
                      count: stats.count,
                    })
                  : t('settings:history.usageEmpty')
                : t('settings:history.usageUnknown')}
            </small>
          </div>
          <div className="sb-settings-actions">
            <button
              type="button"
              className="sb-button sb-button-small sb-button-danger"
              disabled={busy || !stats || stats.count === 0}
              onClick={() => setConfirming(true)}
            >
              {t('settings:history.clear')}
            </button>
          </div>
        </div>
        {message ? <p className="sb-settings-note">{message}</p> : null}
      </div>
      {confirming ? (
        <div
          className="canvas-editor-dialog-backdrop is-nested"
          role="presentation"
          onClick={() => !busy && setConfirming(false)}
        >
          <div
            className="canvas-editor-dialog sb-confirm-dialog"
            role="dialog"
            aria-modal="true"
            aria-label={t('settings:history.clearConfirmTitle')}
            onClick={(event) => event.stopPropagation()}
          >
            <h2>{t('settings:history.clearConfirmTitle')}</h2>
            <p>{t('settings:history.clearConfirmBody')}</p>
            <div className="canvas-editor-dialog-actions">
              <button
                type="button"
                disabled={busy}
                onClick={() => setConfirming(false)}
              >
                {t('common:actions.cancel')}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={clearAll}
              >
                {t('common:actions.confirm')}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}

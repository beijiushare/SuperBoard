import { useTranslation } from 'react-i18next'
import type { SaveState } from '../../editor/saveState'

interface SaveConflictBannerProps {
  conflict: boolean
  saveState: SaveState
  onOverwrite: () => void
  onReload: () => void
  onRetry: () => void
}

/** Save conflict and failure banners shown above the editor workspace. */
export function SaveConflictBanner({
  conflict,
  saveState,
  onOverwrite,
  onReload,
  onRetry,
}: SaveConflictBannerProps) {
  const { t } = useTranslation(['editor'])

  if (conflict) {
    return (
      <div className="sb-save-conflict" role="alert">
        <div className="sb-save-conflict-text">
          <strong>{t('editor:save.conflictTitle')}</strong>
          <span>{t('editor:save.conflictBody')}</span>
        </div>
        <div className="sb-save-conflict-actions">
          <button type="button" onClick={onOverwrite}>
            {t('editor:save.overwrite')}
          </button>
          <button
            type="button"
            className="is-secondary"
            onClick={() => {
              if (!window.confirm(t('editor:save.reloadConfirm'))) return
              onReload()
            }}
          >
            {t('editor:save.reload')}
          </button>
        </div>
      </div>
    )
  }

  if (saveState !== 'error') return null

  return (
    <div className="sb-save-conflict is-error" role="alert">
      <div className="sb-save-conflict-text">
        <strong>{t('editor:save.failed')}</strong>
        <span>{t('editor:save.failedBody')}</span>
      </div>
      <button type="button" onClick={onRetry}>
        {t('editor:save.retry')}
      </button>
    </div>
  )
}

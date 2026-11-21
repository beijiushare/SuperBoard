import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  requestCancelFolderMove,
  subscribeFolderMoveProgress,
  type FolderMoveProgress,
} from './folderMove'

export function FolderMoveOverlay() {
  const { t } = useTranslation(['editor'])
  const [progress, setProgress] = useState<FolderMoveProgress | null>(null)

  useEffect(() => {
    const unsubscribe = subscribeFolderMoveProgress((next) => {
      if (next.phase === 'end') {
        setProgress(null)
        return
      }
      setProgress(next)
    })
    return unsubscribe
  }, [])

  useEffect(() => {
    if (!progress) return
    document.body.classList.add('is-folder-moving')
    ;(document.activeElement as HTMLElement | null)?.blur()
    return () => document.body.classList.remove('is-folder-moving')
  }, [progress])

  if (!progress) return null
  const copying = progress.total > 0

  return (
    <div className="sb-folder-moving" role="alertdialog" aria-busy="true">
      <div className="sb-folder-moving-card">
        <strong>{t('editor:move.title')}</strong>
        <span>
          {copying
            ? t('editor:move.copied', { copied: progress.copied, total: progress.total })
            : t('editor:move.wait')}
        </span>
        {copying ? (
          <button type="button" onClick={requestCancelFolderMove}>
            {t('editor:move.cancel')}
          </button>
        ) : null}
      </div>
    </div>
  )
}

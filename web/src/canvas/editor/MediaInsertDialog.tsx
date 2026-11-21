import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { desktopMode } from '../../desktop/platform'

interface MediaInsertDialogProps {
  initialUrl: string
  onClose: () => void
  onInsertUrl: (url: string) => void
  onInsertFile: (file: File) => void
  onPickFiles?: () => void
}

export function MediaInsertDialog({
  initialUrl,
  onClose,
  onInsertUrl,
  onInsertFile,
  onPickFiles,
}: MediaInsertDialogProps) {
  const { t } = useTranslation(['editor', 'common'])
  const [url, setUrl] = useState(initialUrl)
  return (
    <div
      className="sb-modal-backdrop"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <div className="sb-dialog" role="dialog" aria-modal="true" aria-label={t('editor:media.title')}>
        <div className="sb-dialog-header">
          <h2>{t('editor:media.title')}</h2>
          <button className="sb-icon-button" type="button" onClick={onClose} aria-label={t('common:actions.close')}>
            ×
          </button>
        </div>
        <div className="sb-dialog-body">
          <p className="sb-dialog-copy">{t('editor:media.online')}</p>
          <input
            className="sb-dialog-input"
            value={url}
            placeholder="https://..."
            onChange={(event) => setUrl(event.target.value)}
            autoFocus
          />
          <button
            className="sb-button sb-button-primary"
            type="button"
            disabled={!url.trim()}
            onClick={() => {
              onInsertUrl(url)
              onClose()
            }}
          >
            {t('editor:media.insertOnline')}
          </button>
          <hr className="sb-dialog-sep" />
          <p className="sb-dialog-copy">{t('editor:media.local')}</p>
          {desktopMode() && onPickFiles ? (
            <button
              className="sb-button"
              type="button"
              onClick={() => {
                onPickFiles()
                onClose()
              }}
            >
              {t('editor:media.chooseFile')}
            </button>
          ) : (
            <label className="sb-button">
              {t('editor:media.chooseFile')}
              <input
                type="file"
                hidden
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  if (file) {
                    onInsertFile(file)
                    onClose()
                  }
                }}
              />
            </label>
          )}
        </div>
        <div className="sb-dialog-actions">
          <button className="sb-button" type="button" onClick={onClose}>
            {t('editor:media.cancel')}
          </button>
        </div>
      </div>
    </div>
  )
}

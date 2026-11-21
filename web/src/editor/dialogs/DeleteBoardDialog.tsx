import { useState } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import type { BoardListItem } from '../../shared/board/types'
import { useDialogEscape } from './useDialogEscape'

interface DeleteBoardDialogProps {
  board: BoardListItem
  onClose: () => void
  onConfirm: (slug: string) => Promise<void>
}

export function DeleteBoardDialog({ board, onClose, onConfirm }: DeleteBoardDialogProps) {
  const { t } = useTranslation(['editor', 'common'])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const scope = board.scope ?? 'public'
  const filePath = `whiteboards/${scope}/${board.path ? `${board.path}/` : ''}${board.slug}.canvas`

  useDialogEscape(busy, onClose)

  async function handleConfirm() {
    if (busy) return
    setBusy(true)
    setError('')
    try {
      await onConfirm(board.slug)
      onClose()
    } catch (confirmError) {
      setError(confirmError instanceof Error ? confirmError.message : String(confirmError))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="sb-modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && !busy && onClose()}>
      <div className="sb-dialog" role="alertdialog" aria-modal="true" aria-labelledby="sb-delete-dialog-title">
        <div className="sb-dialog-header">
          <h2 id="sb-delete-dialog-title">{t('editor:dialog.deleteBoard.title')}</h2>
          <button
            className="sb-icon-button"
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label={t('common:actions.close')}
          >
            ×
          </button>
        </div>

        <div className="sb-dialog-body">
          <p className="sb-dialog-copy">
            <Trans
              i18nKey="editor:dialog.deleteBoard.body"
              values={{ title: board.title, path: filePath }}
              components={{ strong: <strong />, code: <code /> }}
            />
          </p>
          <p className="sb-dialog-hint">
            {scope === 'public'
              ? t('editor:dialog.deleteBoard.hintPublic')
              : t('editor:dialog.deleteBoard.hintPrivate')}
          </p>
          {error ? <p className="sb-dialog-error">{error}</p> : null}
        </div>

        <div className="sb-dialog-actions">
          <button className="sb-button" type="button" onClick={onClose} disabled={busy}>
            {t('common:actions.cancel')}
          </button>
          <button
            className="sb-button sb-button-danger"
            type="button"
            onClick={() => void handleConfirm()}
            disabled={busy}
          >
            {busy ? t('editor:dialog.deleteBoard.deleting') : t('editor:dialog.deleteBoard.confirm')}
          </button>
        </div>
      </div>
    </div>
  )
}

import { useEffect, useState, type FormEvent } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import type { BoardTreeFolder } from '../../shared/board/types'
import {
  requestCancelFolderMove,
  subscribeFolderMoveProgress,
  type FolderMoveProgress,
} from '../../canvas/editor/folderMove'
import { useDialogEscape } from './useDialogEscape'
import { Select } from '../../components/ui/select'

interface RenameFolderDialogProps {
  folder: BoardTreeFolder
  folders?: string[]
  onClose: () => void
  onSubmit: (name: string, parent: string) => Promise<void>
}

export function RenameFolderDialog({
  folder,
  folders = [],
  onClose,
  onSubmit,
}: RenameFolderDialogProps) {
  const { t } = useTranslation(['editor', 'common'])
  const [name, setName] = useState(folder.name)
  const [parent, setParent] = useState(
    folder.path.split('/').slice(0, -1).join('/'),
  )
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [progress, setProgress] = useState<FolderMoveProgress | null>(null)

  useDialogEscape(busy, onClose)

  useEffect(
    () =>
      subscribeFolderMoveProgress((next) => {
        setProgress(next)
      }),
    [],
  )

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    setError('')
    setCancelling(false)
    setProgress(null)
    try {
      await onSubmit(name.trim(), parent)
      onClose()
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : String(submitError))
    } finally {
      setBusy(false)
      setProgress(null)
      setCancelling(false)
    }
  }

  return (
    <div className="sb-modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && !busy && onClose()}>
      <form
        className="sb-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sb-folder-dialog-title"
        onSubmit={(event) => void handleSubmit(event)}
      >
        <div className="sb-dialog-header">
          <h2 id="sb-folder-dialog-title">{t('editor:dialog.renameFolder.title')}</h2>
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
              i18nKey="editor:dialog.renameFolder.currentPath"
              values={{ path: folder.path }}
              components={{ code: <code /> }}
            />
          </p>
          <label className="sb-field">
            <span>{t('editor:dialog.renameFolder.name')}</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              onFocus={(event) => event.currentTarget.select()}
              required
              autoFocus
              disabled={busy}
            />
            <small>{t('editor:dialog.renameFolder.nameHint')}</small>
          </label>
          <label className="sb-field">
            <span>{t('editor:dialog.renameFolder.parent')}</span>
            <Select
              value={parent}
              onChange={setParent}
              disabled={busy}
              ariaLabel={t('editor:dialog.renameFolder.parent')}
              options={[
                { value: '', label: t('editor:dialog.board.root') },
                ...folders.map((path) => ({ value: path, label: path })),
              ]}
            />
            <small>{t('editor:dialog.renameFolder.parentHint')}</small>
          </label>
          {error ? <p className="sb-dialog-error">{error}</p> : null}
          {busy && progress ? (
            <p className="sb-dialog-copy">
              {t('editor:dialog.renameFolder.progress', {
                copied: progress.copied,
                total: progress.total,
              })}
            </p>
          ) : null}
        </div>

        <div className="sb-dialog-actions">
          <button className="sb-button" type="button" onClick={onClose} disabled={busy}>
            {t('common:actions.cancel')}
          </button>
          {busy && progress ? (
            <button
              className="sb-button"
              type="button"
              disabled={cancelling}
              onClick={() => {
                setCancelling(true)
                requestCancelFolderMove()
              }}
            >
              {cancelling
                ? t('editor:dialog.renameFolder.cancelling')
                : t('editor:dialog.renameFolder.cancelMove')}
            </button>
          ) : null}
          <button className="sb-button sb-button-primary" type="submit" disabled={busy}>
            {busy ? t('editor:dialog.processing') : t('editor:dialog.save')}
          </button>
        </div>
      </form>
    </div>
  )
}

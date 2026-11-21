import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import type { BoardListItem } from '../../shared/board/types'
import type { BoardFormValues } from './types'
import { useDialogEscape } from './useDialogEscape'
import { Select } from '../../components/ui/select'

interface BoardDialogProps {
  mode: 'create' | 'rename'
  board?: BoardListItem
  folders?: string[]
  defaultFolder?: string
  onClose: () => void
  onSubmit: (values: BoardFormValues) => Promise<void>
}

export function BoardDialog({
  mode,
  board,
  folders = [],
  defaultFolder = '',
  onClose,
  onSubmit,
}: BoardDialogProps) {
  const { t } = useTranslation(['editor', 'common'])
  const [title, setTitle] = useState(board?.title ?? '')
  const [slug, setSlug] = useState(board?.slug ?? '')
  const [folder, setFolder] = useState(board?.path ?? defaultFolder)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useDialogEscape(busy, onClose)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    setError('')
    try {
      await onSubmit({ title: title.trim(), slug: slug.trim(), folder: folder.trim() })
      onClose()
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : String(submitError))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="sb-modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && !busy && onClose()}>
      <form
        className="sb-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sb-board-dialog-title"
        onSubmit={(event) => void handleSubmit(event)}
      >
        <div className="sb-dialog-header">
          <h2 id="sb-board-dialog-title">
            {mode === 'create' ? t('editor:dialog.board.createTitle') : t('editor:dialog.board.renameTitle')}
          </h2>
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
          <label className="sb-field">
            <span>{t('editor:dialog.board.title')}</span>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder={t('editor:dialog.board.titlePlaceholder')}
              required
              autoFocus
              disabled={busy}
            />
          </label>

          <label className="sb-field">
            <span>{t('editor:dialog.board.slug')}</span>
            <input
              value={slug}
              onChange={(event) => setSlug(event.target.value)}
              placeholder={t('editor:dialog.board.slugPlaceholder')}
              pattern="[a-z0-9][a-z0-9-]*"
              title={t('editor:dialog.board.slugTitle')}
              required
              disabled={busy}
            />
            <small>{t('editor:dialog.board.slugHint', { slug: slug.trim() || '…' })}</small>
          </label>

          <label className="sb-field">
            <span>{t('editor:dialog.board.folder')}</span>
            <Select
              value={folder}
              onChange={setFolder}
              disabled={busy}
              ariaLabel={t('editor:dialog.board.folder')}
              options={[
                { value: '', label: t('editor:dialog.board.root') },
                ...folders.map((path) => ({ value: path, label: path })),
              ]}
            />
            <small>
              {mode === 'create'
                ? t('editor:dialog.board.folderHintCreate')
                : t('editor:dialog.board.folderHintRename')}
            </small>
          </label>

          {error ? <p className="sb-dialog-error">{error}</p> : null}
        </div>

        <div className="sb-dialog-actions">
          <button className="sb-button" type="button" onClick={onClose} disabled={busy}>
            {t('common:actions.cancel')}
          </button>
          <button className="sb-button sb-button-primary" type="submit" disabled={busy}>
            {busy
              ? t('editor:dialog.processing')
              : mode === 'create'
                ? t('editor:dialog.create')
                : t('editor:dialog.save')}
          </button>
        </div>
      </form>
    </div>
  )
}

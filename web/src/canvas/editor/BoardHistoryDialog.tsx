import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getAppLanguage } from '../../i18n'
import type { CanvasDocument } from '../model'
import type { CanvasListItem } from './appUtils'
import { CanvasViewer } from '../viewer/CanvasViewer'
import {
  clearBoardHistory,
  getBoardHistoryEntry,
  listBoardHistory,
  restoreBoardHistory,
  type BoardHistoryEntry,
} from './workspaceApi'

interface BoardHistoryDialogProps {
  board: CanvasListItem
  onClose: () => void
  onRestored: () => void
  /** Flush pending edits before the server snapshots the current version. */
  beforeRestore?: () => Promise<boolean>
}

function formatSize(bytes: number) {
  const number = new Intl.NumberFormat(getAppLanguage(), {
    maximumFractionDigits: 1,
  })
  if (bytes < 1024) return `${number.format(bytes)} B`
  if (bytes < 1024 * 1024) return `${number.format(bytes / 1024)} KB`
  return `${number.format(bytes / 1024 / 1024)} MB`
}

function formatTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat(getAppLanguage(), {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

export function BoardHistoryDialog({
  board,
  onClose,
  onRestored,
  beforeRestore,
}: BoardHistoryDialogProps) {
  const { t } = useTranslation(['editor', 'common'])
  const [entries, setEntries] = useState<BoardHistoryEntry[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [preview, setPreview] = useState<CanvasDocument | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [confirmRestore, setConfirmRestore] = useState<BoardHistoryEntry | null>(
    null,
  )
  const [confirmClear, setConfirmClear] = useState(false)

  const refresh = () => {
    setLoading(true)
    setError('')
    void listBoardHistory(board)
      .then((data) => {
        setEntries(data.entries)
        setSelectedId((current) =>
          current && data.entries.some((entry) => entry.id === current)
            ? current
            : (data.entries[0]?.id ?? null),
        )
      })
      .catch((reason: unknown) => {
        setError(reason instanceof Error ? reason.message : String(reason))
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!selectedId) {
      setPreview(null)
      return
    }
    let cancelled = false
    setPreview(null)
    void getBoardHistoryEntry(board, selectedId)
      .then((canvas) => {
        if (!cancelled) setPreview(canvas)
      })
      .catch((reason: unknown) => {
        if (!cancelled) {
          setError(reason instanceof Error ? reason.message : String(reason))
        }
      })
    return () => {
      cancelled = true
    }
    // Only the selected entry and board identity matter; the parent passes a
    // fresh object every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, board.slug, board.scope])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      if (confirmClear) setConfirmClear(false)
      else if (confirmRestore) setConfirmRestore(null)
      else onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [confirmClear, confirmRestore, onClose])

  function restore(entry: BoardHistoryEntry) {
    setBusy(true)
    setError('')
    void (async () => {
      if (beforeRestore && !(await beforeRestore())) {
        setError(t('editor:history.saveFailed'))
        setBusy(false)
        return
      }
      await restoreBoardHistory(board, entry.id)
      onRestored()
      onClose()
    })()
      .catch((reason: unknown) => {
        setError(reason instanceof Error ? reason.message : String(reason))
      })
      .finally(() => {
        setBusy(false)
        setConfirmRestore(null)
      })
  }

  function clearHistory() {
    setBusy(true)
    setError('')
    void clearBoardHistory(board)
      .then(() => {
        setEntries([])
        setSelectedId(null)
        setPreview(null)
        setConfirmClear(false)
      })
      .catch((reason: unknown) => {
        setError(reason instanceof Error ? reason.message : String(reason))
      })
      .finally(() => setBusy(false))
  }

  const selected = entries.find((entry) => entry.id === selectedId) ?? null

  return (
    <>
      <div
        className="canvas-editor-dialog-backdrop"
        role="presentation"
        onClick={() => !busy && onClose()}
      >
        <div
          className="canvas-editor-dialog sb-history-dialog"
          role="dialog"
          aria-modal="true"
          aria-label={t('editor:history.title')}
          onClick={(event) => event.stopPropagation()}
        >
          <header className="sb-history-head">
            <div>
              <h2>{t('editor:history.title')}</h2>
              <p>{board.title}</p>
            </div>
            <button
              type="button"
              className="sb-icon-button"
              aria-label={t('common:actions.close')}
              title={t('common:actions.close')}
              onClick={onClose}
              disabled={busy}
            >
              ×
            </button>
          </header>

          <div className="sb-history-body">
            <div className="sb-history-list" role="listbox">
              {loading ? (
                <p className="sb-history-empty">{t('editor:history.loading')}</p>
              ) : entries.length === 0 ? (
                <p className="sb-history-empty">{t('editor:history.empty')}</p>
              ) : (
                entries.map((entry) => (
                  <button
                    key={entry.id}
                    type="button"
                    role="option"
                    aria-selected={entry.id === selectedId}
                    className={`sb-history-entry${
                      entry.id === selectedId ? ' is-selected' : ''
                    }`}
                    onClick={() => setSelectedId(entry.id)}
                  >
                    <span className="sb-history-entry-time">
                      {formatTime(entry.createdAt)}
                    </span>
                    <span className="sb-history-entry-size">
                      {formatSize(entry.size)}
                    </span>
                  </button>
                ))
              )}
            </div>

            <div className="sb-history-preview">
              {preview ? (
                <CanvasViewer
                  canvas={preview}
                  style={{ width: '100%', height: '100%' }}
                />
              ) : (
                <p className="sb-history-empty">
                  {selected
                    ? t('editor:history.previewLoading')
                    : t('editor:history.previewEmpty')}
                </p>
              )}
            </div>
          </div>

          {error ? <p className="sb-dialog-error">{error}</p> : null}

          <footer className="sb-history-actions">
            <button
              type="button"
              className="sb-button sb-button-small sb-button-danger"
              disabled={busy || entries.length === 0}
              onClick={() => setConfirmClear(true)}
            >
              {t('editor:history.clearBoard')}
            </button>
            <div className="sb-history-actions-right">
              <button
                type="button"
                className="sb-button"
                onClick={onClose}
                disabled={busy}
              >
                {t('common:actions.close')}
              </button>
              <button
                type="button"
                className="sb-button sb-button-primary"
                disabled={busy || !selected}
                onClick={() => selected && setConfirmRestore(selected)}
              >
                {busy
                  ? t('editor:history.restoring')
                  : t('editor:history.restore')}
              </button>
            </div>
          </footer>
        </div>
      </div>

      {confirmRestore ? (
        <div
          className="canvas-editor-dialog-backdrop is-nested"
          role="presentation"
          onClick={() => !busy && setConfirmRestore(null)}
        >
          <div
            className="canvas-editor-dialog sb-confirm-dialog"
            role="dialog"
            aria-modal="true"
            aria-label={t('editor:history.restoreConfirmTitle')}
            onClick={(event) => event.stopPropagation()}
          >
            <h2>{t('editor:history.restoreConfirmTitle')}</h2>
            <p>
              {t('editor:history.restoreConfirmBody', {
                time: formatTime(confirmRestore.createdAt),
              })}
            </p>
            <div className="canvas-editor-dialog-actions">
              <button
                type="button"
                disabled={busy}
                onClick={() => setConfirmRestore(null)}
              >
                {t('common:actions.cancel')}
              </button>
              <button
                type="button"
                className="is-danger"
                disabled={busy}
                onClick={() => restore(confirmRestore)}
              >
                {t('editor:history.restore')}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {confirmClear ? (
        <div
          className="canvas-editor-dialog-backdrop is-nested"
          role="presentation"
          onClick={() => !busy && setConfirmClear(false)}
        >
          <div
            className="canvas-editor-dialog sb-confirm-dialog"
            role="dialog"
            aria-modal="true"
            aria-label={t('editor:history.clearConfirmTitle')}
            onClick={(event) => event.stopPropagation()}
          >
            <h2>{t('editor:history.clearConfirmTitle')}</h2>
            <p>{t('editor:history.clearConfirmBody')}</p>
            <div className="canvas-editor-dialog-actions">
              <button
                type="button"
                disabled={busy}
                onClick={() => setConfirmClear(false)}
              >
                {t('common:actions.cancel')}
              </button>
              <button
                type="button"
                className="is-danger"
                disabled={busy}
                onClick={clearHistory}
              >
                {t('editor:history.clearBoard')}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}

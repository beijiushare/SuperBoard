import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { getAppLanguage } from '../../i18n'
import { internal } from '../../vendor/json-canvas-viewer/src/index.ts'
import type { CanvasDocument } from '../model'
import type { CanvasListItem } from './appUtils'
import {
  CanvasViewer,
  type CanvasViewerHandle,
} from '../viewer/CanvasViewer'
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
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function formatDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat(getAppLanguage(), {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

function dateKey(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const pad = (input: number) => String(input).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function fitPreview(
  handle: CanvasViewerHandle | null,
  canvas: CanvasDocument,
) {
  const viewer = handle?.viewer as
    | {
        container?: { get: (key: unknown) => unknown }
        refresh?: () => void
      }
    | undefined
  if (!viewer?.container) return
  const dm = viewer.container.get(internal.DataManager as never) as {
    data: {
      container: HTMLDivElement
      offsetX: number
      offsetY: number
      scale: number
    }
  }
  const nodes = canvas.nodes
  if (!nodes.length) return
  const minX = Math.min(...nodes.map((node) => node.x))
  const minY = Math.min(...nodes.map((node) => node.y))
  const maxX = Math.max(...nodes.map((node) => node.x + node.width))
  const maxY = Math.max(...nodes.map((node) => node.y + node.height))
  const width = Math.max(1, dm.data.container.clientWidth)
  const height = Math.max(1, dm.data.container.clientHeight)
  const boardWidth = Math.max(1, maxX - minX)
  const boardHeight = Math.max(1, maxY - minY)
  const scale = Math.min(
    1,
    Math.max(0.05, (width - 96) / boardWidth),
    Math.max(0.05, (height - 96) / boardHeight),
  )
  dm.data.scale = scale
  dm.data.offsetX = (width - boardWidth * scale) / 2 - minX * scale
  dm.data.offsetY = (height - boardHeight * scale) / 2 - minY * scale
  viewer.refresh?.()
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
  const previewRef = useRef<CanvasViewerHandle>(null)

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
    if (!preview) return
    let frame = 0
    const fit = () => fitPreview(previewRef.current, preview)
    frame = requestAnimationFrame(() => requestAnimationFrame(fit))
    window.addEventListener('resize', fit)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', fit)
    }
  }, [preview])

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

  const groups = useMemo(() => {
    const result: Array<{ key: string; label: string; entries: BoardHistoryEntry[] }> = []
    const today = dateKey(new Date().toISOString())
    const yesterday = dateKey(
      new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    )
    for (const entry of entries) {
      const key = dateKey(entry.createdAt)
      const label =
        key === today
          ? t('editor:history.today')
          : key === yesterday
            ? t('editor:history.yesterday')
            : formatDate(entry.createdAt)
      const group = result.find((item) => item.key === key)
      if (group) group.entries.push(entry)
      else result.push({ key, label, entries: [entry] })
    }
    return result
  }, [entries, t])

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

  return createPortal(
    <>
      <div className="sb-history-screen" role="dialog" aria-modal="true">
        <header className="sb-history-topbar">
          <button
            type="button"
            className="sb-history-back"
            aria-label={t('common:actions.close')}
            title={t('common:actions.close')}
            onClick={onClose}
            disabled={busy}
          >
            ←
          </button>
          <div className="sb-history-heading">
            <h2>{t('editor:history.title')}</h2>
            <span>{board.title}</span>
          </div>
          <div className="sb-history-top-actions">
            <button
              type="button"
              className="sb-button sb-button-small"
              disabled={busy || entries.length === 0}
              onClick={() => setConfirmClear(true)}
            >
              {t('editor:history.clearBoard')}
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
        </header>

        <div className="sb-history-main">
          <aside className="sb-history-list" aria-label={t('editor:history.title')}>
            {loading ? (
              <p className="sb-history-empty">{t('editor:history.loading')}</p>
            ) : entries.length === 0 ? (
              <p className="sb-history-empty">{t('editor:history.empty')}</p>
            ) : (
              groups.map((group) => (
                <section key={group.key} className="sb-history-group">
                  <p className="sb-history-date">{group.label}</p>
                  {group.entries.map((entry) => (
                    <button
                      key={entry.id}
                      type="button"
                      className={`sb-history-entry${
                        entry.id === selectedId ? ' is-selected' : ''
                      }`}
                      onClick={() => setSelectedId(entry.id)}
                    >
                      <span className="sb-history-time">
                        {formatTime(entry.createdAt)}
                      </span>
                      <span className="sb-history-size">
                        {formatSize(entry.size)}
                      </span>
                    </button>
                  ))}
                </section>
              ))
            )}
          </aside>

          <div className="sb-history-preview">
            {preview ? (
              <>
                <span className="sb-history-preview-badge">
                  {selected ? formatTime(selected.createdAt) : ''}
                </span>
                <CanvasViewer
                  ref={previewRef}
                  canvas={preview}
                  style={{ width: '100%', height: '100%' }}
                />
              </>
            ) : (
              <p className="sb-history-empty is-centred">
                {selected
                  ? t('editor:history.previewLoading')
                  : t('editor:history.previewEmpty')}
              </p>
            )}
          </div>
        </div>

        {error ? <p className="sb-history-error">{error}</p> : null}
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
                time: `${formatDate(confirmRestore.createdAt)} ${formatTime(
                  confirmRestore.createdAt,
                )}`,
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
                disabled={busy}
                onClick={() => restore(confirmRestore)}
              >
                {t('common:actions.confirm')}
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
                disabled={busy}
                onClick={clearHistory}
              >
                {t('common:actions.confirm')}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>,
    document.body,
  )
}

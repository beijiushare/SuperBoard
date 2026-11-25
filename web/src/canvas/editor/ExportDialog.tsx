import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { CanvasDocument } from '../model'
import type { CanvasViewerHandle } from '../viewer/CanvasViewer'
import {
  buildExportPayload,
  downloadCanvasHtmlSnapshot,
  exportCanvasFolder,
  exportFilename,
  type AttachmentAction,
} from './export'
import {
  desktopExportFolder,
  desktopExportHtml,
  desktopMode,
} from '../../desktop/platform'
import { getAppLanguage } from '../../i18n'
import { Select } from '../../components/ui/select'

interface ExportDialogProps {
  canvas: CanvasDocument
  viewerRef: React.RefObject<CanvasViewerHandle | null>
  /** Expand derived content (knowledge trees) before the DOM snapshot. */
  onPrepare?: () => Promise<void>
  onFinish?: () => void
  onClose: () => void
}

function formatSize(bytes: number) {
  const number = new Intl.NumberFormat(getAppLanguage(), {
    maximumFractionDigits: 1,
  })
  if (bytes < 1024) return `${number.format(bytes)} B`
  if (bytes < 1024 * 1024) return `${number.format(bytes / 1024)} KB`
  return `${number.format(bytes / 1024 / 1024)} MB`
}

export function ExportDialog({
  canvas,
  viewerRef,
  onPrepare,
  onFinish,
  onClose,
}: ExportDialogProps) {
  const { t } = useTranslation(['editor', 'common'])
  const attachments = useMemo(
    () =>
      canvas.nodes
        .map((node) => node['x-superboard']?.media)
        .filter(
          (media) =>
            media?.kind === 'file' && typeof media.file === 'string',
        )
        .map((media) => ({
          file: media!.file!,
          name: media!.name ?? media!.file!,
          size: media!.size ?? 0,
        })),
    [canvas],
  )
  const [actions, setActions] = useState<Map<string, AttachmentAction>>(
    () => new Map(attachments.map((item) => [item.file, 'skip'])),
  )
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const copyCount = attachments.filter(
    (item) => actions.get(item.file) === 'copy',
  ).length
  const embedSize = attachments.reduce(
    (sum, item) =>
      actions.get(item.file) === 'embed'
        ? sum + Math.ceil(item.size * 4 / 3)
        : sum,
    0,
  )
  const copySize = attachments.reduce(
    (sum, item) =>
      actions.get(item.file) === 'copy' ? sum + item.size : sum,
    0,
  )

  function setAction(file: string, action: AttachmentAction) {
    setActions((current) => new Map(current).set(file, action))
  }

  async function run() {
    if (busy) return
    setBusy(true)
    setError('')
    try {
      await onPrepare?.()
      if (desktopMode()) {
        const payload = await buildExportPayload(
          canvas,
          viewerRef.current?.viewer,
          actions,
        )
        if (payload.attachments.length > 0) {
          await desktopExportFolder(payload.html, payload.attachments)
        } else {
          await desktopExportHtml(payload.html, exportFilename(canvas, 'html'))
        }
      } else if (copyCount > 0) {
        await exportCanvasFolder(
          canvas,
          viewerRef.current?.viewer,
          actions,
        )
      } else {
        await downloadCanvasHtmlSnapshot(
          canvas,
          viewerRef.current?.viewer,
          actions,
        )
      }
      onClose()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason))
    } finally {
      onFinish?.()
      setBusy(false)
    }
  }

  return (
    <div
      className="sb-modal-backdrop"
      onMouseDown={(event) =>
        event.target === event.currentTarget && !busy && onClose()
      }
    >
      <div
        className="sb-dialog sb-export-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={t('editor:export.title')}
      >
        <div className="sb-dialog-header">
          <h2>{t('editor:export.title')}</h2>
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
            {t('editor:export.attachments', { total: attachments.length })}
          </p>
          {attachments.length > 0 ? (
            <div className="sb-export-attachments">
              {attachments.map((item) => (
                <div className="sb-export-attachment" key={item.file}>
                  <span title={item.file}>{item.name}</span>
                  <small>{formatSize(item.size)}</small>
                  <Select
                    className="sb-select-export"
                    value={actions.get(item.file) ?? 'skip'}
                    onChange={(value) =>
                      setAction(
                        item.file,
                        value as AttachmentAction,
                      )
                    }
                    ariaLabel={t('editor:export.attachmentMode')}
                    options={[
                      { value: 'skip', label: t('editor:export.skip') },
                      { value: 'embed', label: t('editor:export.embed') },
                      { value: 'copy', label: t('editor:export.copy') },
                    ]}
                  />
                </div>
              ))}
            </div>
          ) : null}
          <div className="sb-export-summary">
            <span>{t('editor:export.embedEstimate', { size: formatSize(embedSize) })}</span>
            <span>{t('editor:export.copyEstimate', { size: formatSize(copySize) })}</span>
            <span>
              {t('editor:export.mode', {
                mode:
                  copyCount > 0
                    ? t('editor:export.modeFolder')
                    : t('editor:export.modeSingle'),
              })}
            </span>
          </div>
          {error ? <p className="sb-dialog-error">{error}</p> : null}
        </div>
        <div className="sb-dialog-actions">
          <button className="sb-button" type="button" onClick={onClose} disabled={busy}>
            {t('common:actions.cancel')}
          </button>
          <button
            className="sb-button sb-button-primary"
            type="button"
            onClick={() => void run()}
            disabled={busy}
          >
            {busy ? t('editor:export.exporting') : t('editor:export.start')}
          </button>
        </div>
      </div>
    </div>
  )
}

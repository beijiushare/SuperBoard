import { useMemo, useState } from 'react'
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
  onClose,
}: ExportDialogProps) {
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
      <div className="sb-dialog sb-export-dialog" role="dialog" aria-modal="true" aria-label="导出">
        <div className="sb-dialog-header">
          <h2>导出</h2>
          <button
            className="sb-icon-button"
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="关闭"
          >
            ×
          </button>
        </div>
        <div className="sb-dialog-body">
          <p className="sb-dialog-copy">
            当前白板有 {attachments.length} 个附件。默认全部不导出。
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
                    ariaLabel="附件导出方式"
                    options={[
                      { value: 'skip', label: '不导出' },
                      { value: 'embed', label: '内嵌到 HTML' },
                      { value: 'copy', label: '复制到附件文件夹' },
                    ]}
                  />
                </div>
              ))}
            </div>
          ) : null}
          <div className="sb-export-summary">
            <span>内嵌预计：{formatSize(embedSize)}</span>
            <span>附件文件夹预计：{formatSize(copySize)}</span>
            <span>
              导出方式：{copyCount > 0 ? '文件夹（HTML + 附件）' : '单 HTML'}
            </span>
          </div>
          {error ? <p className="sb-dialog-error">{error}</p> : null}
        </div>
        <div className="sb-dialog-actions">
          <button className="sb-button" type="button" onClick={onClose} disabled={busy}>
            取消
          </button>
          <button
            className="sb-button sb-button-primary"
            type="button"
            onClick={() => void run()}
            disabled={busy}
          >
            {busy ? '正在导出…' : '开始导出'}
          </button>
        </div>
      </div>
    </div>
  )
}

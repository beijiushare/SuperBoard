import { useState } from 'react'
import type { CanvasDocument } from '../model'
import type { CanvasViewerHandle } from '../viewer/CanvasViewer'
import { downloadCanvasHtmlSnapshot } from './export'

interface ExportDialogProps {
  canvas: CanvasDocument
  viewerRef: React.RefObject<CanvasViewerHandle | null>
  onClose: () => void
}

export function ExportDialog({
  canvas,
  viewerRef,
  onClose,
}: ExportDialogProps) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function exportHtml() {
    if (busy) return
    setBusy(true)
    setError('')
    try {
      await downloadCanvasHtmlSnapshot(canvas, viewerRef.current?.viewer)
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
      <div
        className="sb-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="导出"
      >
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
            导出为单文件 HTML，使用当前只读画面快照，样式与编辑器一致。
          </p>
          {error ? <p className="sb-dialog-error">{error}</p> : null}
        </div>
        <div className="sb-dialog-actions">
          <button className="sb-button" type="button" onClick={onClose} disabled={busy}>
            关闭
          </button>
          <button
            className="sb-button sb-button-primary"
            type="button"
            onClick={() => void exportHtml()}
            disabled={busy}
          >
            {busy ? '正在导出…' : '导出单 HTML'}
          </button>
        </div>
      </div>
    </div>
  )
}

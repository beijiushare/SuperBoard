import { useState } from 'react'
import type { CanvasDocument } from '../model'
import type { CanvasViewerHandle } from '../viewer/CanvasViewer'
import { downloadCanvasHtmlSnapshot, exportCanvasFolder } from './export'

interface ExportDialogProps {
  canvas: CanvasDocument
  viewerRef: React.RefObject<CanvasViewerHandle | null>
  onClose: () => void
}

type Mode = 'embed' | 'link' | 'folder'

export function ExportDialog({
  canvas,
  viewerRef,
  onClose,
}: ExportDialogProps) {
  const [mode, setMode] = useState<Mode>('embed')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function run() {
    if (busy) return
    setBusy(true)
    setError('')
    try {
      if (mode === 'folder') {
        await exportCanvasFolder(canvas, viewerRef.current?.viewer)
      } else {
        await downloadCanvasHtmlSnapshot(
          canvas,
          viewerRef.current?.viewer,
          mode === 'embed',
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
      <div className="sb-dialog" role="dialog" aria-modal="true" aria-label="导出">
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
          <p className="sb-dialog-copy">选择导出方式：</p>
          <div className="sb-export-modes">
            <label>
              <input
                type="radio"
                name="export-mode"
                checked={mode === 'embed'}
                onChange={() => setMode('embed')}
              />
              单 HTML，内嵌图片附件
            </label>
            <label>
              <input
                type="radio"
                name="export-mode"
                checked={mode === 'link'}
                onChange={() => setMode('link')}
              />
              单 HTML，仅保留文件引用
            </label>
            <label>
              <input
                type="radio"
                name="export-mode"
                checked={mode === 'folder'}
                onChange={() => setMode('folder')}
              />
              文件夹，HTML + 附件
            </label>
          </div>
          {mode === 'folder' ? (
            <p className="sb-dialog-copy">
              将先选择一个目录，然后写入 index.html 和 files/。
            </p>
          ) : null}
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

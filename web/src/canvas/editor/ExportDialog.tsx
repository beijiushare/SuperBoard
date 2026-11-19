import type { CanvasDocument } from '../model'
import {
  downloadCanvasHtml,
  downloadCanvasSvg,
} from './export'

interface ExportDialogProps {
  canvas: CanvasDocument
  onClose: () => void
}

export function ExportDialog({ canvas, onClose }: ExportDialogProps) {
  return (
    <div
      className="sb-modal-backdrop"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <div className="sb-dialog" role="dialog" aria-modal="true" aria-label="导出">
        <div className="sb-dialog-header">
          <h2>导出</h2>
          <button
            className="sb-icon-button"
            type="button"
            onClick={onClose}
            aria-label="关闭"
          >
            ×
          </button>
        </div>
        <div className="sb-dialog-body">
          <p className="sb-dialog-copy">
            当前白板可以导出为单文件 HTML，直接分享或嵌入。
          </p>
          <p className="sb-dialog-copy">
            多文件站点导出将在桌面端提供。
          </p>
        </div>
        <div className="sb-dialog-actions">
          <button className="sb-button" type="button" onClick={onClose}>
            关闭
          </button>
          <button
            className="sb-button"
            type="button"
            onClick={() => downloadCanvasSvg(canvas)}
          >
            导出 SVG
          </button>
          <button
            className="sb-button sb-button-primary"
            type="button"
            onClick={() => {
              downloadCanvasHtml(canvas)
              onClose()
            }}
          >
            导出单 HTML
          </button>
        </div>
      </div>
    </div>
  )
}

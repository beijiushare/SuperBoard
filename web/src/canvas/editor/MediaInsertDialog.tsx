import { useState } from 'react'

interface MediaInsertDialogProps {
  initialUrl: string
  onClose: () => void
  onInsertUrl: (url: string) => void
  onInsertFile: (file: File) => void
}

export function MediaInsertDialog({
  initialUrl,
  onClose,
  onInsertUrl,
  onInsertFile,
}: MediaInsertDialogProps) {
  const [url, setUrl] = useState(initialUrl)
  return (
    <div
      className="sb-modal-backdrop"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <div className="sb-dialog" role="dialog" aria-modal="true" aria-label="插入媒体">
        <div className="sb-dialog-header">
          <h2>插入媒体</h2>
          <button className="sb-icon-button" type="button" onClick={onClose} aria-label="关闭">
            ×
          </button>
        </div>
        <div className="sb-dialog-body">
          <p className="sb-dialog-copy">在线媒体 / iframe</p>
          <input
            className="sb-dialog-input"
            value={url}
            placeholder="https://..."
            onChange={(event) => setUrl(event.target.value)}
            autoFocus
          />
          <button
            className="sb-button sb-button-primary"
            type="button"
            disabled={!url.trim()}
            onClick={() => {
              onInsertUrl(url)
              onClose()
            }}
          >
            插入在线媒体
          </button>
          <hr className="sb-dialog-sep" />
          <p className="sb-dialog-copy">本地文件</p>
          <label className="sb-button">
            选择文件…
            <input
              type="file"
              hidden
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (file) {
                  onInsertFile(file)
                  onClose()
                }
              }}
            />
          </label>
        </div>
        <div className="sb-dialog-actions">
          <button className="sb-button" type="button" onClick={onClose}>
            取消
          </button>
        </div>
      </div>
    </div>
  )
}

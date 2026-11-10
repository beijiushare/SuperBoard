import { useState, type FormEvent } from 'react'
import { useDialogEscape } from '../dialogs/useDialogEscape'
import { parseMediaSource, type MediaSource } from './parseMedia'

interface MediaDialogProps {
  initialValue?: string
  onClose: () => void
  onSave: (source: MediaSource) => void
}

export function MediaDialog({ initialValue = '', onClose, onSave }: MediaDialogProps) {
  const [value, setValue] = useState(initialValue)
  const [error, setError] = useState('')

  useDialogEscape(false, onClose)

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const source = parseMediaSource(value)
    if (!source) {
      setError('无法识别链接或 iframe 标签，请检查后重试。')
      return
    }
    onSave(source)
  }

  return (
    <div className="sb-modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <form
        className="sb-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sb-media-dialog-title"
        onSubmit={handleSubmit}
      >
        <div className="sb-dialog-header">
          <div>
            <h2 id="sb-media-dialog-title">{initialValue ? '编辑媒体' : '添加媒体'}</h2>
            <p className="sb-dialog-hint">图片/视频直链、网页链接，或直接粘贴 iframe 标签。</p>
          </div>
          <button className="sb-icon-button" type="button" onClick={onClose} aria-label="关闭">
            ×
          </button>
        </div>

        <div className="sb-dialog-body">
          <label className="sb-field">
            <span>链接或 iframe</span>
            <textarea
              className="sb-media-input"
              value={value}
              onChange={(event) => {
                setValue(event.target.value)
                setError('')
              }}
              rows={6}
              autoFocus
              spellCheck={false}
              placeholder="https://example.com/image.png 或 <iframe src=&quot;...&quot;></iframe>"
            />
            <small>图片和视频直链会按媒体渲染；其他网页链接会按 iframe 嵌入。</small>
          </label>
          {error ? <p className="sb-dialog-error">{error}</p> : null}
        </div>

        <div className="sb-dialog-actions">
          <button className="sb-button" type="button" onClick={onClose}>
            取消
          </button>
          <button className="sb-button sb-button-primary" type="submit">
            保存
          </button>
        </div>
      </form>
    </div>
  )
}

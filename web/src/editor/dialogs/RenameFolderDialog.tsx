import { useState, type FormEvent } from 'react'
import type { BoardTreeFolder } from '../../shared/board/types'
import { useDialogEscape } from './useDialogEscape'

interface RenameFolderDialogProps {
  folder: BoardTreeFolder
  onClose: () => void
  onSubmit: (name: string) => Promise<void>
}

export function RenameFolderDialog({ folder, onClose, onSubmit }: RenameFolderDialogProps) {
  const [name, setName] = useState(folder.name)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useDialogEscape(busy, onClose)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    setError('')
    try {
      await onSubmit(name.trim())
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
        aria-labelledby="sb-folder-dialog-title"
        onSubmit={(event) => void handleSubmit(event)}
      >
        <div className="sb-dialog-header">
          <h2 id="sb-folder-dialog-title">重命名文件夹</h2>
          <button className="sb-icon-button" type="button" onClick={onClose} disabled={busy} aria-label="关闭">
            ×
          </button>
        </div>

        <div className="sb-dialog-body">
          <p className="sb-dialog-copy">
            当前路径：<code>{folder.path}</code>
          </p>
          <label className="sb-field">
            <span>文件夹名称</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              onFocus={(event) => event.currentTarget.select()}
              required
              autoFocus
              disabled={busy}
            />
            <small>只修改当前目录名，目录内的白板和子目录会一起移动。</small>
          </label>
          {error ? <p className="sb-dialog-error">{error}</p> : null}
        </div>

        <div className="sb-dialog-actions">
          <button className="sb-button" type="button" onClick={onClose} disabled={busy}>
            取消
          </button>
          <button className="sb-button sb-button-primary" type="submit" disabled={busy}>
            {busy ? '处理中…' : '保存'}
          </button>
        </div>
      </form>
    </div>
  )
}

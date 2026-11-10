import { useState } from 'react'
import type { BoardScope, BoardTreeFolder } from '../../shared/board/types'
import { useDialogEscape } from './useDialogEscape'

interface DeleteFolderDialogProps {
  folder: BoardTreeFolder
  scope: BoardScope
  onClose: () => void
  onConfirm: (path: string) => Promise<void>
}

export function DeleteFolderDialog({ folder, scope, onClose, onConfirm }: DeleteFolderDialogProps) {
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useDialogEscape(busy, onClose)

  async function handleConfirm() {
    if (busy) return
    setBusy(true)
    setError('')
    try {
      await onConfirm(folder.path)
      onClose()
    } catch (confirmError) {
      setError(confirmError instanceof Error ? confirmError.message : String(confirmError))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="sb-modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && !busy && onClose()}>
      <div className="sb-dialog" role="alertdialog" aria-modal="true" aria-labelledby="sb-delete-folder-dialog-title">
        <div className="sb-dialog-header">
          <h2 id="sb-delete-folder-dialog-title">删除文件夹</h2>
          <button className="sb-icon-button" type="button" onClick={onClose} disabled={busy} aria-label="关闭">
            ×
          </button>
        </div>

        <div className="sb-dialog-body">
          <p className="sb-dialog-copy">
            确定删除文件夹 <strong>{folder.name}</strong> 吗？文件夹内所有白板和子文件夹都会一起删除。
          </p>
          <p className="sb-dialog-copy">
            文件路径：<code>whiteboards/{scope}/{folder.path}</code>
          </p>
          <p className="sb-dialog-hint">
            {scope === 'public'
              ? '此操作不可撤销。公开白板若已提交到 Git，可从提交历史恢复。'
              : '此操作不可撤销。私有白板未纳入 Git，删除后无法恢复。'}
          </p>
          {error ? <p className="sb-dialog-error">{error}</p> : null}
        </div>

        <div className="sb-dialog-actions">
          <button className="sb-button" type="button" onClick={onClose} disabled={busy}>
            取消
          </button>
          <button className="sb-button sb-button-danger" type="button" onClick={() => void handleConfirm()} disabled={busy}>
            {busy ? '删除中…' : '删除文件夹'}
          </button>
        </div>
      </div>
    </div>
  )
}

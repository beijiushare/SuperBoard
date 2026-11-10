import { useState } from 'react'
import type { BoardListItem } from '../../shared/board/types'
import { useDialogEscape } from './useDialogEscape'

interface DeleteBoardDialogProps {
  board: BoardListItem
  onClose: () => void
  onConfirm: (slug: string) => Promise<void>
}

export function DeleteBoardDialog({ board, onClose, onConfirm }: DeleteBoardDialogProps) {
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useDialogEscape(busy, onClose)

  async function handleConfirm() {
    if (busy) return
    setBusy(true)
    setError('')
    try {
      await onConfirm(board.slug)
      onClose()
    } catch (confirmError) {
      setError(confirmError instanceof Error ? confirmError.message : String(confirmError))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="sb-modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && !busy && onClose()}>
      <div className="sb-dialog" role="alertdialog" aria-modal="true" aria-labelledby="sb-delete-dialog-title">
        <div className="sb-dialog-header">
          <h2 id="sb-delete-dialog-title">删除白板</h2>
          <button className="sb-icon-button" type="button" onClick={onClose} disabled={busy} aria-label="关闭">
            ×
          </button>
        </div>

        <div className="sb-dialog-body">
          <p className="sb-dialog-copy">
            确定删除 <strong>{board.title}</strong> 吗？文件会从 <code>{board.path ? `${board.path}/` : ''}{board.slug}.tldr.json</code> 删除。
          </p>
          <p className="sb-dialog-hint">此操作不可撤销，但提交后仍可从 Git 恢复。</p>
          {error ? <p className="sb-dialog-error">{error}</p> : null}
        </div>

        <div className="sb-dialog-actions">
          <button className="sb-button" type="button" onClick={onClose} disabled={busy}>
            取消
          </button>
          <button className="sb-button sb-button-danger" type="button" onClick={() => void handleConfirm()} disabled={busy}>
            {busy ? '删除中…' : '删除'}
          </button>
        </div>
      </div>
    </div>
  )
}

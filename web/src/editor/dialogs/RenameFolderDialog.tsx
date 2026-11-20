import { useEffect, useState, type FormEvent } from 'react'
import type { BoardTreeFolder } from '../../shared/board/types'
import {
  requestCancelFolderMove,
  subscribeFolderMoveProgress,
  type FolderMoveProgress,
} from '../../canvas/editor/folderMove'
import { useDialogEscape } from './useDialogEscape'
import { Select } from '../../components/ui/select'

interface RenameFolderDialogProps {
  folder: BoardTreeFolder
  folders?: string[]
  onClose: () => void
  onSubmit: (name: string, parent: string) => Promise<void>
}

export function RenameFolderDialog({
  folder,
  folders = [],
  onClose,
  onSubmit,
}: RenameFolderDialogProps) {
  const [name, setName] = useState(folder.name)
  const [parent, setParent] = useState(
    folder.path.split('/').slice(0, -1).join('/'),
  )
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [progress, setProgress] = useState<FolderMoveProgress | null>(null)

  useDialogEscape(busy, onClose)

  useEffect(
    () =>
      subscribeFolderMoveProgress((next) => {
        setProgress(next)
      }),
    [],
  )

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    setError('')
    setCancelling(false)
    setProgress(null)
    try {
      await onSubmit(name.trim(), parent)
      onClose()
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : String(submitError))
    } finally {
      setBusy(false)
      setProgress(null)
      setCancelling(false)
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
            <small>目录内的白板和子目录会一起移动。</small>
          </label>
          <label className="sb-field">
            <span>父文件夹</span>
            <Select
              value={parent}
              onChange={setParent}
              disabled={busy}
              ariaLabel="父文件夹"
              options={[
                { value: '', label: '根目录' },
                ...folders.map((path) => ({ value: path, label: path })),
              ]}
            />
            <small>修改父文件夹会把整个目录移动到新位置。</small>
          </label>
          {error ? <p className="sb-dialog-error">{error}</p> : null}
          {busy && progress ? (
            <p className="sb-dialog-copy">
              正在移动：已复制 {progress.copied} / {progress.total} 个文件
            </p>
          ) : null}
        </div>

        <div className="sb-dialog-actions">
          <button className="sb-button" type="button" onClick={onClose} disabled={busy}>
            取消
          </button>
          {busy && progress ? (
            <button
              className="sb-button"
              type="button"
              disabled={cancelling}
              onClick={() => {
                setCancelling(true)
                requestCancelFolderMove()
              }}
            >
              {cancelling ? '正在取消…' : '取消移动'}
            </button>
          ) : null}
          <button className="sb-button sb-button-primary" type="submit" disabled={busy}>
            {busy ? '处理中…' : '保存'}
          </button>
        </div>
      </form>
    </div>
  )
}

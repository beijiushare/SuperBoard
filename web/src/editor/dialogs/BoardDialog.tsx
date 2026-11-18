import { useState, type FormEvent } from 'react'
import type { BoardListItem } from '../../shared/board/types'
import type { BoardFormValues } from './types'
import { useDialogEscape } from './useDialogEscape'

interface BoardDialogProps {
  mode: 'create' | 'rename'
  board?: BoardListItem
  folders?: string[]
  defaultFolder?: string
  onClose: () => void
  onSubmit: (values: BoardFormValues) => Promise<void>
}

export function BoardDialog({
  mode,
  board,
  folders = [],
  defaultFolder = '',
  onClose,
  onSubmit,
}: BoardDialogProps) {
  const [title, setTitle] = useState(board?.title ?? '')
  const [slug, setSlug] = useState(board?.slug ?? '')
  const [folder, setFolder] = useState(board?.path ?? defaultFolder)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useDialogEscape(busy, onClose)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    setError('')
    try {
      await onSubmit({ title: title.trim(), slug: slug.trim(), folder: folder.trim() })
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
        aria-labelledby="sb-board-dialog-title"
        onSubmit={(event) => void handleSubmit(event)}
      >
        <div className="sb-dialog-header">
          <h2 id="sb-board-dialog-title">{mode === 'create' ? '新建白板' : '重命名 / 移动白板'}</h2>
          <button className="sb-icon-button" type="button" onClick={onClose} disabled={busy} aria-label="关闭">
            ×
          </button>
        </div>

        <div className="sb-dialog-body">
          <label className="sb-field">
            <span>标题</span>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="例如：项目笔记"
              required
              autoFocus
              disabled={busy}
            />
          </label>

          <label className="sb-field">
            <span>文件名（slug）</span>
            <input
              value={slug}
              onChange={(event) => setSlug(event.target.value)}
              placeholder="例如：project-notes"
              pattern="[a-z0-9][a-z0-9-]*"
              title="只允许小写字母、数字和连字符，且不能以连字符开头"
              required
              disabled={busy}
            />
            <small>文件名为 {slug.trim() || '…'}.canvas，只允许小写字母、数字和连字符。</small>
          </label>

          <label className="sb-field">
            <span>文件夹</span>
            <select
              value={folder}
              onChange={(event) => setFolder(event.target.value)}
              disabled={busy}
            >
              <option value="">根目录</option>
              {folders.map((path) => (
                <option key={path} value={path}>
                  {path}
                </option>
              ))}
            </select>
            <small>
              {mode === 'create'
                ? '默认放在右键位置，也可以改到其他文件夹。'
                : '修改文件夹会把白板移动到新位置。'}
            </small>
          </label>

          {error ? <p className="sb-dialog-error">{error}</p> : null}
        </div>

        <div className="sb-dialog-actions">
          <button className="sb-button" type="button" onClick={onClose} disabled={busy}>
            取消
          </button>
          <button className="sb-button sb-button-primary" type="submit" disabled={busy}>
            {busy ? '处理中…' : mode === 'create' ? '创建' : '保存'}
          </button>
        </div>
      </form>
    </div>
  )
}

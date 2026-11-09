import { useEffect, useState, type FormEvent } from 'react'
import type { BoardListItem } from '../shared/board/types'

export interface BoardFormValues {
  title: string
  slug: string
  folder: string
}

interface BoardDialogProps {
  mode: 'create' | 'rename'
  board?: BoardListItem
  defaultFolder?: string
  onClose: () => void
  onSubmit: (values: BoardFormValues) => Promise<void>
}

export function BoardDialog({ mode, board, defaultFolder = '', onClose, onSubmit }: BoardDialogProps) {
  const [title, setTitle] = useState(board?.title ?? '')
  const [slug, setSlug] = useState(board?.slug ?? '')
  const [folder, setFolder] = useState(defaultFolder)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [busy, onClose])

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
          <h2 id="sb-board-dialog-title">{mode === 'create' ? '新建白板' : '重命名白板'}</h2>
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
            <span>Slug</span>
            <input
              value={slug}
              onChange={(event) => setSlug(event.target.value)}
              placeholder="例如：project-notes"
              pattern="[a-z0-9][a-z0-9-]*"
              title="只允许小写字母、数字和连字符，且不能以连字符开头"
              required
              disabled={busy}
            />
            <small>文件路由标识，只允许小写字母、数字和连字符。</small>
          </label>

          {mode === 'create' ? (
            <label className="sb-field">
              <span>文件夹</span>
              <input
                value={folder}
                onChange={(event) => setFolder(event.target.value)}
                placeholder="例如：notes/2026，留空表示根目录"
                disabled={busy}
              />
              <small>使用真实目录，可填写多级路径。</small>
            </label>
          ) : (
            <p className="sb-dialog-hint">
              当前路径：<code>{board?.path || '根目录'}</code>
            </p>
          )}

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

interface DeleteBoardDialogProps {
  board: BoardListItem
  onClose: () => void
  onConfirm: (slug: string) => Promise<void>
}

export function DeleteBoardDialog({ board, onClose, onConfirm }: DeleteBoardDialogProps) {
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [busy, onClose])

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

import { useState, type FormEvent } from 'react'
import type { DirectorFrame } from '../../shared/board/types'
import { useDialogEscape } from './useDialogEscape'

interface FrameValueDialogProps {
  frame: DirectorFrame
  existingValues: number[]
  onClose: () => void
  onSubmit: (value: number) => void
}

export function FrameValueDialog({ frame, existingValues, onClose, onSubmit }: FrameValueDialogProps) {
  const [value, setValue] = useState(String(frame.order))
  const [error, setError] = useState('')

  useDialogEscape(false, onClose)

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const next = Number(value)
    if (!Number.isInteger(next) || next < 1) {
      setError('帧值必须是大于 0 的整数。')
      return
    }
    if (existingValues.includes(next)) {
      setError(`帧值 ${next} 已被其他帧使用。`)
      return
    }
    onSubmit(next)
  }

  return (
    <div className="sb-modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <form
        className="sb-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sb-frame-dialog-title"
        onSubmit={handleSubmit}
      >
        <div className="sb-dialog-header">
          <h2 id="sb-frame-dialog-title">编辑帧值</h2>
          <button className="sb-icon-button" type="button" onClick={onClose} aria-label="关闭">
            ×
          </button>
        </div>

        <div className="sb-dialog-body">
          <label className="sb-field">
            <span>帧值</span>
            <input
              type="number"
              min={1}
              step={1}
              value={value}
              onChange={(event) => {
                setValue(event.target.value)
                setError('')
              }}
              autoFocus
            />
            <small>播放时按帧值从小到大排序，值不能重复，可以跳过。</small>
          </label>
          {error ? <p className="sb-dialog-error">{error}</p> : null}
        </div>

        <div className="sb-dialog-actions">
          <button className="sb-button" type="button" onClick={onClose}>
            取消
          </button>
          <button className="sb-button sb-button-primary" type="submit">
            确认
          </button>
        </div>
      </form>
    </div>
  )
}

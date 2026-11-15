import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

interface InputDialogProps {
  title: string
  description?: string
  initialValue?: string
  placeholder?: string
  confirmText?: string
  allowEmpty?: boolean
  onConfirm: (value: string) => void
  onClose: () => void
}

export function InputDialog({
  title,
  description,
  initialValue = '',
  placeholder,
  confirmText = '确定',
  allowEmpty = false,
  onConfirm,
  onClose,
}: InputDialogProps) {
  const [value, setValue] = useState(initialValue)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const canConfirm = allowEmpty || value.trim().length > 0

  useEffect(() => {
    inputRef.current?.focus()
    inputRef.current?.select()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  function confirm() {
    if (!canConfirm) return
    onConfirm(value)
  }

  return createPortal(
    <div
      className="canvas-editor-dialog-backdrop"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="canvas-editor-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
      >
        <h2>{title}</h2>
        {description ? <p>{description}</p> : null}
        <input
          ref={inputRef}
          value={value}
          placeholder={placeholder}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') confirm()
          }}
        />
        <div className="canvas-editor-dialog-actions">
          <button type="button" onClick={onClose}>
            取消
          </button>
          <button type="button" onClick={confirm} disabled={!canConfirm}>
            {confirmText}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

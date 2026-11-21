import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'

interface InputDialogProps {
  title: string
  description?: string
  initialValue?: string
  placeholder?: string
  confirmText?: string
  allowEmpty?: boolean
  onDelete?: () => void
  onConfirm: (value: string) => void
  onClose: () => void
}

export function InputDialog({
  title,
  description,
  initialValue = '',
  placeholder,
  confirmText,
  allowEmpty = false,
  onDelete,
  onConfirm,
  onClose,
}: InputDialogProps) {
  const { t } = useTranslation(['common'])
  const [value, setValue] = useState(initialValue)
  const inputRef = useRef<HTMLTextAreaElement | null>(null)
  const canConfirm = allowEmpty || value.trim().length > 0

  useLayoutEffect(() => {
    const input = inputRef.current
    if (!input) return
    input.style.height = 'auto'
    input.style.height = `${input.scrollHeight}px`
  }, [value])

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
        <textarea
          ref={inputRef}
          rows={1}
          value={value}
          placeholder={placeholder}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault()
              confirm()
            }
          }}
        />
        <div className="canvas-editor-dialog-actions">
          {onDelete ? (
            <button
              type="button"
              className="is-danger"
              onClick={onDelete}
            >
              {t('common:actions.delete')}
            </button>
          ) : null}
          <button type="button" onClick={onClose}>
            {t('common:actions.cancel')}
          </button>
          <button type="button" onClick={confirm} disabled={!canConfirm}>
            {confirmText ?? t('common:actions.confirm')}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

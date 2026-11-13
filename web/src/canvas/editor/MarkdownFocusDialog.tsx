import type { MarkdownTheme } from '../model'
import { useDialogEscape } from '../../editor/dialogs/useDialogEscape'
import { MarkdownVditor } from './MarkdownVditor'

interface MarkdownFocusDialogProps {
  nodeId: string
  value: string
  theme?: MarkdownTheme
  onInput: (value: string) => void
  onCommit: (value: string) => void
  onClose: () => void
}

export function MarkdownFocusDialog({
  nodeId,
  value,
  theme,
  onInput,
  onCommit,
  onClose,
}: MarkdownFocusDialogProps) {
  useDialogEscape(false, onClose)

  return (
    <div
      className="sb-modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        className={`sb-modal sb-md-focus-modal${
          theme ? ` sb-md-theme-${theme}` : ''
        }`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="sb-md-focus-title"
      >
        <div className="sb-modal-header">
          <div>
            <h2 id="sb-md-focus-title">专注编辑</h2>
            <p>内容会实时更新到白板块</p>
          </div>
          <button
            className="sb-icon-button"
            type="button"
            onClick={onClose}
            aria-label="关闭"
          >
            ×
          </button>
        </div>
        <div className="sb-md-focus-body">
          <MarkdownVditor
            key={nodeId}
            value={value}
            onInput={onInput}
            onCommit={onCommit}
            className="sb-md-focus-editor"
          />
        </div>
      </div>
    </div>
  )
}

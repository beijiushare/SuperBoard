import { useTranslation } from 'react-i18next'
import { useDialogEscape } from '../../editor/dialogs/useDialogEscape'
import { MarkdownVditor } from './MarkdownVditor'

interface MarkdownFocusDialogProps {
  nodeId: string
  value: string
  onInput: (value: string) => void
  onCommit: (value: string) => void
  onClose: () => void
}

export function MarkdownFocusDialog({
  nodeId,
  value,
  onInput,
  onCommit,
  onClose,
}: MarkdownFocusDialogProps) {
  const { t } = useTranslation(['editor', 'common'])
  useDialogEscape(false, onClose)

  return (
    <div
      className="sb-modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        className="sb-modal sb-md-focus-modal sb-md-docs"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sb-md-focus-title"
      >
        <div className="sb-modal-header">
          <div>
            <h2 id="sb-md-focus-title">{t('editor:block.focusEdit')}</h2>
            <p>{t('editor:markdown.liveHint')}</p>
          </div>
          <button
            className="sb-icon-button"
            type="button"
            onClick={onClose}
            aria-label={t('common:actions.close')}
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
            onRequestClose={onClose}
            className="sb-md-focus-editor"
          />
        </div>
      </div>
    </div>
  )
}

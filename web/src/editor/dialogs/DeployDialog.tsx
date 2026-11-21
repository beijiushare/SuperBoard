import { useTranslation } from 'react-i18next'
import { useDialogEscape } from './useDialogEscape'

interface DeployDialogProps {
  onClose: () => void
  onConfirm: () => void
}

export function DeployDialog({ onClose, onConfirm }: DeployDialogProps) {
  const { t } = useTranslation(['editor', 'common'])
  useDialogEscape(false, onClose)

  return (
    <div className="sb-modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className="sb-dialog" role="alertdialog" aria-modal="true" aria-labelledby="sb-deploy-dialog-title">
        <div className="sb-dialog-header">
          <h2 id="sb-deploy-dialog-title">{t('editor:dialog.deploy.title')}</h2>
          <button
            className="sb-icon-button"
            type="button"
            onClick={onClose}
            aria-label={t('common:actions.close')}
          >
            ×
          </button>
        </div>

        <div className="sb-dialog-body">
          <p className="sb-dialog-copy">{t('editor:dialog.deploy.body')}</p>
        </div>

        <div className="sb-dialog-actions">
          <button className="sb-button" type="button" onClick={onClose}>
            {t('common:actions.cancel')}
          </button>
          <button className="sb-button sb-button-primary" type="button" onClick={onConfirm}>
            {t('editor:dialog.deploy.confirm')}
          </button>
        </div>
      </div>
    </div>
  )
}

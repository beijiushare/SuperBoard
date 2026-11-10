import { useDialogEscape } from './useDialogEscape'

interface DeployDialogProps {
  onClose: () => void
  onConfirm: () => void
}

export function DeployDialog({ onClose, onConfirm }: DeployDialogProps) {
  useDialogEscape(false, onClose)

  return (
    <div className="sb-modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className="sb-dialog" role="alertdialog" aria-modal="true" aria-labelledby="sb-deploy-dialog-title">
        <div className="sb-dialog-header">
          <h2 id="sb-deploy-dialog-title">确认提交</h2>
          <button className="sb-icon-button" type="button" onClick={onClose} aria-label="关闭">
            ×
          </button>
        </div>

        <div className="sb-dialog-body">
          <p className="sb-dialog-copy">这就提交git，并推送到远程触发部署，确认提交？</p>
        </div>

        <div className="sb-dialog-actions">
          <button className="sb-button" type="button" onClick={onClose}>
            取消
          </button>
          <button className="sb-button sb-button-primary" type="button" onClick={onConfirm}>
            确认
          </button>
        </div>
      </div>
    </div>
  )
}

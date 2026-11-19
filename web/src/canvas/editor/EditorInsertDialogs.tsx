import { PeleCreateDialog } from './PeleCreateDialog'
import { PreferencesDialog } from './PreferencesDialog'
import { InputDialog } from '../../shared/ui/InputDialog'

type PeleDialogState =
  | { mode: 'create'; point?: { x: number; y: number } }
  | { mode: 'edit'; nodeId: string }
  | null

interface EditorInsertDialogsProps {
  peleDialog: PeleDialogState
  peleInitialCode: string
  peleInitialDiagram: string
  onClosePele: () => void
  onSavePele: (value: { code: string; diagram: string }) => void
  mediaOpen: boolean
  mediaUrl: string
  onCloseMedia: () => void
  onConfirmMedia: (value: string) => void
  preferencesOpen: boolean
  onClosePreferences: () => void
}

export function EditorInsertDialogs({
  peleDialog,
  peleInitialCode,
  peleInitialDiagram,
  onClosePele,
  onSavePele,
  mediaOpen,
  mediaUrl,
  onCloseMedia,
  onConfirmMedia,
  preferencesOpen,
  onClosePreferences,
}: EditorInsertDialogsProps) {
  return (
    <>
      {peleDialog ? (
        <PeleCreateDialog
          key={
            peleDialog.mode === 'edit'
              ? `edit:${peleDialog.nodeId}`
              : 'create'
          }
          mode={peleDialog.mode}
          initialCode={peleInitialCode}
          initialDiagram={peleInitialDiagram}
          onClose={onClosePele}
          onSave={onSavePele}
        />
      ) : null}

      {mediaOpen ? (
        <InputDialog
          title="插入媒体"
          description="支持图片、视频链接，以及其他可嵌入的 iframe 地址。"
          initialValue={mediaUrl}
          placeholder="https://..."
          confirmText="插入"
          onConfirm={onConfirmMedia}
          onClose={onCloseMedia}
        />
      ) : null}

      {preferencesOpen ? (
        <PreferencesDialog onClose={onClosePreferences} />
      ) : null}
    </>
  )
}

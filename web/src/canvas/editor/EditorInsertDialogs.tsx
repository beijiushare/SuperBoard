import { PeleCreateDialog } from './PeleCreateDialog'
import { PreferencesDialog } from './PreferencesDialog'
import { MediaInsertDialog } from './MediaInsertDialog'

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
  onInsertFile: (file: File) => void
  onPickFiles?: () => void
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
  onInsertFile,
  onPickFiles,
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
        <MediaInsertDialog
          initialUrl={mediaUrl}
          onClose={onCloseMedia}
          onInsertUrl={onConfirmMedia}
          onInsertFile={onInsertFile}
          onPickFiles={onPickFiles}
        />
      ) : null}

      {preferencesOpen ? (
        <PreferencesDialog onClose={onClosePreferences} />
      ) : null}
    </>
  )
}

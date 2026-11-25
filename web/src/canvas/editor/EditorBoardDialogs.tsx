import { useTranslation } from 'react-i18next'
import {
  BoardDialog,
  DeleteBoardDialog,
  DeleteFolderDialog,
  RenameFolderDialog,
  type BoardFormValues,
} from '../../editor/dialogs'
import {
  BoardContextMenu,
  type BoardContextTarget,
} from '../../editor/BoardContextMenu'
import { InputDialog } from '../../shared/ui/InputDialog'
import type {
  BoardListItem,
  BoardScope,
  BoardTreeFile,
  BoardTreeFolder,
} from '../../shared/board/types'
import type { BoardDialogState } from './appUtils'
import { BoardHistoryDialog } from './BoardHistoryDialog'

interface EditorBoardDialogsProps {
  boardDialog: BoardDialogState | null
  folderDialog: BoardTreeFolder | null
  newFolderParent: string | null
  pendingDelete: BoardListItem | null
  pendingDeleteFolder: BoardTreeFolder | null
  historyBoard: BoardTreeFile | null
  contextMenu: {
    x: number
    y: number
    target: BoardContextTarget
  } | null
  folderPaths: string[]
  scope: BoardScope
  onCloseBoardDialog: () => void
  onCreateBoard: (values: BoardFormValues) => Promise<void>
  onRenameBoard: (values: BoardFormValues) => Promise<void>
  onCloseFolderDialog: () => void
  onRenameFolder: (name: string, parent: string) => Promise<void>
  onCloseNewFolder: () => void
  onCreateFolder: (name: string) => Promise<void>
  onCloseDeleteBoard: () => void
  onDeleteBoard: (slug: string) => Promise<void>
  onCloseDeleteFolder: () => void
  onDeleteFolder: (path: string) => Promise<void>
  onCloseContextMenu: () => void
  onContextCreate: (folder: string) => void
  onContextCreateFolder: (folder: string) => void
  onContextRename: (board: BoardListItem) => void
  onContextRenameFolder: (folder: BoardTreeFolder) => void
  onContextDelete: (board: BoardListItem) => void
  onContextDeleteFolder: (folder: BoardTreeFolder) => void
  onContextHistory: (board: BoardTreeFile) => void
  onCloseHistory: () => void
  onHistoryRestored: () => void
  onBeforeHistoryRestore?: () => Promise<boolean>
}

export function EditorBoardDialogs({
  boardDialog,
  folderDialog,
  newFolderParent,
  pendingDelete,
  pendingDeleteFolder,
  historyBoard,
  contextMenu,
  folderPaths,
  scope,
  onCloseBoardDialog,
  onCreateBoard,
  onRenameBoard,
  onCloseFolderDialog,
  onRenameFolder,
  onCloseNewFolder,
  onCreateFolder,
  onCloseDeleteBoard,
  onDeleteBoard,
  onCloseDeleteFolder,
  onDeleteFolder,
  onCloseContextMenu,
  onContextCreate,
  onContextCreateFolder,
  onContextRename,
  onContextRenameFolder,
  onContextDelete,
  onContextDeleteFolder,
  onContextHistory,
  onCloseHistory,
  onHistoryRestored,
  onBeforeHistoryRestore,
}: EditorBoardDialogsProps) {
  const { t } = useTranslation(['editor'])
  return (
    <>
      {contextMenu ? (
        <BoardContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          target={contextMenu.target}
          onClose={onCloseContextMenu}
          onCreate={onContextCreate}
          onCreateFolder={onContextCreateFolder}
          onRename={onContextRename}
          onRenameFolder={onContextRenameFolder}
          onDelete={onContextDelete}
          onDeleteFolder={onContextDeleteFolder}
          onHistory={onContextHistory}
        />
      ) : null}

      {boardDialog ? (
        <BoardDialog
          key={
            boardDialog.mode === 'create'
              ? `create:${boardDialog.folder ?? ''}`
              : `rename:${boardDialog.board.slug}`
          }
          mode={boardDialog.mode}
          board={boardDialog.mode === 'rename' ? boardDialog.board : undefined}
          folders={folderPaths}
          defaultFolder={
            boardDialog.mode === 'create'
              ? boardDialog.folder ?? ''
              : boardDialog.board.path
          }
          onClose={onCloseBoardDialog}
          onSubmit={
            boardDialog.mode === 'create' ? onCreateBoard : onRenameBoard
          }
        />
      ) : null}

      {folderDialog ? (
        <RenameFolderDialog
          key={folderDialog.path}
          folder={folderDialog}
          folders={folderPaths.filter(
            (path) =>
              path !== folderDialog.path &&
              !path.startsWith(`${folderDialog.path}/`),
          )}
          onClose={onCloseFolderDialog}
          onSubmit={onRenameFolder}
        />
      ) : null}

      {newFolderParent !== null ? (
        <InputDialog
          title={t('editor:context.newFolder')}
          description={
            newFolderParent
              ? t('editor:folder.createIn', { folder: newFolderParent })
              : t('editor:folder.createRoot')
          }
          placeholder={t('editor:folder.name')}
          confirmText={t('editor:dialog.create')}
          onConfirm={(value) => void onCreateFolder(value)}
          onClose={onCloseNewFolder}
        />
      ) : null}

      {pendingDelete ? (
        <DeleteBoardDialog
          board={pendingDelete}
          onClose={onCloseDeleteBoard}
          onConfirm={onDeleteBoard}
        />
      ) : null}

      {pendingDeleteFolder ? (
        <DeleteFolderDialog
          folder={pendingDeleteFolder}
          scope={scope}
          onClose={onCloseDeleteFolder}
          onConfirm={onDeleteFolder}
        />
      ) : null}

      {historyBoard ? (
        <BoardHistoryDialog
          board={{ ...historyBoard, scope: historyBoard.scope ?? scope }}
          onClose={onCloseHistory}
          onRestored={onHistoryRestored}
          beforeRestore={onBeforeHistoryRestore}
        />
      ) : null}
    </>
  )
}

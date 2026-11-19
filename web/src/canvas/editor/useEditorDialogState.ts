import { useState } from 'react'
import type { BoardDialogState } from './appUtils'
import type { BoardContextTarget } from '../../editor/BoardContextMenu'
import type {
  BoardListItem,
  BoardTreeFolder,
} from '../../shared/board/types'

export function useEditorDialogState() {
  const [boardDialog, setBoardDialog] = useState<BoardDialogState | null>(null)
  const [folderDialog, setFolderDialog] = useState<BoardTreeFolder | null>(null)
  const [newFolderParent, setNewFolderParent] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<BoardListItem | null>(null)
  const [pendingDeleteFolder, setPendingDeleteFolder] =
    useState<BoardTreeFolder | null>(null)
  const [exportDialogOpen, setExportDialogOpen] = useState(false)
  const [preferencesOpen, setPreferencesOpen] = useState(false)
  const [contextMenu, setContextMenu] = useState<{
    x: number
    y: number
    target: BoardContextTarget
  } | null>(null)

  return {
    boardDialog,
    setBoardDialog,
    folderDialog,
    setFolderDialog,
    newFolderParent,
    setNewFolderParent,
    pendingDelete,
    setPendingDelete,
    pendingDeleteFolder,
    setPendingDeleteFolder,
    exportDialogOpen,
    setExportDialogOpen,
    preferencesOpen,
    setPreferencesOpen,
    contextMenu,
    setContextMenu,
  }
}

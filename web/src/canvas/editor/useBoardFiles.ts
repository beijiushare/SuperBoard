import type { BoardScope, BoardTreeFolder } from '../../shared/board/types'
import i18n from '../../i18n'
import type { BoardFormValues } from '../../editor/dialogs'
import type { CanvasDocument } from '../model'
import {
  updateEditorUrl,
  type BoardDialogState,
  type CanvasListItem,
  type SaveState,
} from './appUtils'
import {
  createBoard,
  createFolder,
  deleteBoard,
  deleteFolder,
  notifyWorkspaceChanged,
  updateBoard,
  updateFolder,
} from './workspaceApi'

interface UseBoardFilesOptions {
  items: CanvasListItem[]
  selectedSlug: string
  scope: BoardScope
  saveState: SaveState
  savingRef: { current: boolean }
  save: () => Promise<boolean>
  boardDialog: BoardDialogState | null
  folderDialog: BoardTreeFolder | null
  newFolderParent: string | null
  setNewFolderParent: (path: string | null) => void
  treeMode: boolean
  refreshItems: () => Promise<CanvasListItem[]>
  activateCanvas: (item: CanvasListItem, next: CanvasDocument) => void
  fetchCanvasDocument: (item: CanvasListItem) => Promise<CanvasDocument>
  expandPath: (path: string) => void
  renameExpandedPath: (from: string, to: string) => void
  setCanvas: (canvas: CanvasDocument | null) => void
  setSelectedSlug: (slug: string) => void
  setSaveState: (state: SaveState) => void
  setLoading: (loading: boolean) => void
}

export function useBoardFiles({
  items,
  selectedSlug,
  scope,
  saveState,
  savingRef,
  save,
  boardDialog,
  folderDialog,
  newFolderParent,
  setNewFolderParent,
  treeMode,
  refreshItems,
  activateCanvas,
  fetchCanvasDocument,
  expandPath,
  renameExpandedPath,
  setCanvas,
  setSelectedSlug,
  setSaveState,
  setLoading,
}: UseBoardFilesOptions) {
  const activeItem = items.find(
    (entry) => entry.slug === selectedSlug && entry.scope === scope,
  )

  async function handleCreate(values: BoardFormValues) {
    if (saveState !== 'saved') {
      const ok = await save()
      if (!ok) throw new Error(i18n.t('editor:workspace.saveBeforeCreate'))
    }
    const data = await createBoard({
      title: values.title,
      slug: values.slug,
      folder: values.folder || undefined,
      scope,
    })
    notifyWorkspaceChanged()
    const list = await refreshItems()
    const item = list.find(
      (entry) =>
        entry.slug === data.canvas['x-superboard']!.meta.slug &&
        entry.scope === scope,
    )
    if (item) {
      expandPath(item.path)
      activateCanvas(item, data.canvas)
    }
  }

  async function handleRename(values: BoardFormValues) {
    if (!boardDialog || boardDialog.mode !== 'rename') return
    const target = boardDialog.board
    const isCurrent = target.slug === selectedSlug && target.scope === scope
    if (isCurrent && saveState !== 'saved') {
      const ok = await save()
      if (!ok) throw new Error(i18n.t('editor:workspace.saveBeforeRename'))
    }
    const data = await updateBoard(
      { ...target, scope: target.scope ?? scope },
      {
        title: values.title,
        slug: values.slug,
        folder: values.folder,
      },
    )
    notifyWorkspaceChanged()
    await refreshItems()
    expandPath(data.path)
    if (isCurrent) {
      setCanvas(data.canvas)
      setSelectedSlug(data.canvas['x-superboard']!.meta.slug)
      updateEditorUrl(data.canvas['x-superboard']!.meta.slug, scope, treeMode)
    }
  }

  async function handleDelete(slug: string) {
    if (savingRef.current) throw new Error(i18n.t('editor:workspace.savingDelete'))
    const item = items.find(
      (entry) => entry.slug === slug && entry.scope === scope,
    )
    if (!item) return
    const isCurrent = slug === selectedSlug
    if (isCurrent) setSaveState('saved')
    await deleteBoard(item)
    notifyWorkspaceChanged()
    const list = await refreshItems()
    if (!isCurrent) return
    const next = list.find((entry) => entry.scope === scope)
    if (next) {
      setLoading(true)
      try {
        const doc = await fetchCanvasDocument(next)
        activateCanvas(next, doc)
      } finally {
        setLoading(false)
      }
    } else {
      setCanvas(null)
      setSelectedSlug('')
      setSaveState('saved')
      updateEditorUrl(null, scope, treeMode)
    }
  }

  async function handleCreateFolder(name: string) {
    if (newFolderParent === null) return
    const parent = newFolderParent
    await createFolder({ parent, name, scope })
    notifyWorkspaceChanged()
    await refreshItems()
    if (parent) expandPath(parent)
    setNewFolderParent(null)
  }

  async function handleRenameFolder(name: string, parent: string) {
    if (!folderDialog) return
    if (saveState !== 'saved') {
      const ok = await save()
      if (!ok) throw new Error(i18n.t('editor:workspace.saveBeforeFolderRename'))
    }
    const data = await updateFolder({
      path: folderDialog.path,
      scope,
      name,
      parent,
    })
    notifyWorkspaceChanged()
    await refreshItems()
    renameExpandedPath(folderDialog.path, data.path)
  }

  async function handleDeleteFolder(path: string) {
    if (saveState !== 'saved') {
      const ok = await save()
      if (!ok) throw new Error(i18n.t('editor:workspace.saveBeforeFolderDelete'))
    }
    const currentPath = activeItem?.path
    const currentInside = Boolean(
      currentPath &&
        (currentPath === path || currentPath.startsWith(`${path}/`)),
    )
    await deleteFolder(path, scope)
    notifyWorkspaceChanged()
    const list = await refreshItems()
    if (!currentInside) return
    const next = list.find((entry) => entry.scope === scope)
    if (next) {
      setLoading(true)
      try {
        const doc = await fetchCanvasDocument(next)
        activateCanvas(next, doc)
      } finally {
        setLoading(false)
      }
    } else {
      setCanvas(null)
      setSelectedSlug('')
      setSaveState('saved')
      updateEditorUrl(null, scope, treeMode)
    }
  }

  return {
    handleCreate,
    handleRename,
    handleDelete,
    handleCreateFolder,
    handleRenameFolder,
    handleDeleteFolder,
  }
}

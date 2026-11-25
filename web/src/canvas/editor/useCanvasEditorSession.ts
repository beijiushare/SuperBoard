import {
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type RefObject,
  type SetStateAction,
} from 'react'
import type { CanvasViewerHandle } from '../viewer/CanvasViewer'
import type { BoardScope, BoardTreeFolder } from '../../shared/board/types'
import { useTreeExpansion } from '../../shared/board/useTreeExpansion'
import type { CanvasDocument } from '../model'
import {
  normalizeMarkdownLocks,
  updateEditorUrl,
  type BoardDialogState,
  type CanvasListItem,
} from './appUtils'
import { loadWorkspace, readBoard, WORKSPACE_VERSION_KEY } from './workspaceApi'
import { readLastBoard, writeLastBoard } from './lastBoard'
import { useCanvasSave } from './useCanvasSave'
import { useCanvasViewport } from './useCanvasViewport'
import { useCanvasHistory } from './useCanvasHistory'
import { useBoardTreeData } from './useBoardTreeData'
import { useBoardWorkspace } from './useBoardWorkspace'
import { useBoardFiles } from './useBoardFiles'
import type { EditorTool } from './tools'

interface UseCanvasEditorSessionOptions {
  viewerRef: RefObject<CanvasViewerHandle | null>
  setSelectedIds: Dispatch<SetStateAction<string[]>>
  setSelectedEdgeId: (id: string | null) => void
  setFocusedGroupId: (id: string | null) => void
  setTool: (tool: EditorTool) => void
  setTextEditingId: (id: string | null) => void
  setTextCreateRequest: Dispatch<
    SetStateAction<{ x: number; y: number; nonce: number } | null>
  >
  resetMarkdownEditing: () => void
  resetDirectorSession: () => void
  boardDialog: BoardDialogState | null
  folderDialog: BoardTreeFolder | null
  newFolderParent: string | null
  setNewFolderParent: (path: string | null) => void
}

/**
 * Owns the document, the workspace listing, viewport persistence, history and
 * saving. Everything else in the editor composes this session.
 */
export function useCanvasEditorSession({
  viewerRef,
  setSelectedIds,
  setSelectedEdgeId,
  setFocusedGroupId,
  setTool,
  setTextEditingId,
  setTextCreateRequest,
  resetMarkdownEditing,
  resetDirectorSession,
  boardDialog,
  folderDialog,
  newFolderParent,
  setNewFolderParent,
}: UseCanvasEditorSessionOptions) {
  const [items, setItems] = useState<CanvasListItem[]>([])
  const [folders, setFolders] = useState<
    Array<{ path: string; scope: BoardScope }>
  >([])
  const [selectedSlug, setSelectedSlug] = useState('')
  const [canvas, setCanvas] = useState<CanvasDocument | null>(null)
  const [scope, setScope] = useState<BoardScope>(() =>
    new URLSearchParams(window.location.search).get('scope') === 'private'
      ? 'private'
      : 'public',
  )
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [treeMode, setTreeMode] = useState(() =>
    new URLSearchParams(window.location.search).has('tree'),
  )
  const [treeOpen, setTreeOpen] = useState(true)
  const canvasRef = useRef<CanvasDocument | null>(null)

  const { applyCanvasUiSettings, captureViewport } = useCanvasViewport({
    canvas,
    selectedSlug,
    scope,
    viewerRef,
  })

  const {
    saveState,
    setSaveState,
    save,
    resolveConflict,
    clearConflict,
    conflict,
    markDirty,
    savingRef,
  } = useCanvasSave({
    canvas,
    items,
    selectedSlug,
    scope,
  })

  function applyDocument(next: CanvasDocument, selection: string[] = []) {
    captureViewport()
    setSelectedIds(selection)
    setCanvas(next)
    markDirty()
  }

  const { recordHistory, undo, redo, resetHistory } = useCanvasHistory({
    canvasRef,
    onRestore: applyDocument,
  })

  const { scopedItems, folderPaths, treeNodes } = useBoardTreeData({
    items,
    folders,
    scope,
  })
  const { expanded, toggleFolder, expandPath, renameExpandedPath } =
    useTreeExpansion(scopedItems)

  const {
    fetchCanvasDocument,
    activateCanvas,
    openBoard,
    reloadBoard,
    refreshItems,
    switchScope,
    toggleTree,
  } = useBoardWorkspace({
    items,
    selectedSlug,
    scope,
    saveState,
    savingRef,
    save,
    setSaveState,
    setItems,
    setFolders,
    setCanvas,
    setSelectedIds,
    setSelectedEdgeId,
    setFocusedGroupId,
    setScope,
    setSelectedSlug,
    resetMarkdownEditing,
    setTextEditingId,
    setTextCreateRequest,
    setTool,
    resetDirectorSession,
    applyCanvasUiSettings,
    resetHistory,
    expandPath,
    treeMode,
    setTreeOpen,
    setTreeMode,
    setLoading,
    setError,
  })

  const {
    handleCreate,
    handleRename,
    handleDelete,
    handleCreateFolder,
    handleRenameFolder,
    handleDeleteFolder,
  } = useBoardFiles({
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
  })

  canvasRef.current = canvas

  const refreshItemsRef = useRef(refreshItems)
  refreshItemsRef.current = refreshItems
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === WORKSPACE_VERSION_KEY) {
        void refreshItemsRef.current()
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const data = await loadWorkspace()
        if (cancelled) return
        const list = data.boards
        setItems(list)
        setFolders(data.folders)
        const params = new URLSearchParams(window.location.search)
        const initialScope: BoardScope =
          params.get('scope') === 'private' ? 'private' : 'public'
        const initialTree = params.has('tree')
        setScope(initialScope)
        setTreeMode(initialTree)
        const scoped = list.filter((item) => item.scope === initialScope)
        // An explicit `board` parameter (deep link, file association) wins.
        // Otherwise reopen the board from the previous session; the stored
        // record may belong to another workspace, so it must still exist here.
        const requested = params.get('board')
        const remembered = requested ? null : readLastBoard()
        let first = requested
          ? scoped.find((item) => item.slug === requested)
          : remembered
            ? list.find(
                (item) =>
                  item.slug === remembered.slug &&
                  item.scope === remembered.scope,
              )
            : undefined
        first ??= scoped[0]
        if (!first) {
          writeLastBoard(null)
          setLoading(false)
          return
        }
        const next = await readBoard(first)
        if (cancelled) return
        resetHistory()
        setSelectedIds([])
        setTool('select')
        normalizeMarkdownLocks(next)
        setSelectedSlug(first.slug)
        setScope(first.scope)
        applyCanvasUiSettings(next, first.slug, first.scope)
        setCanvas(next)
        resetMarkdownEditing()
        setTextEditingId(null)
        setSaveState('saved')
        expandPath(first.path)
        updateEditorUrl(first.slug, first.scope, initialTree)
        writeLastBoard({ slug: first.slug, scope: first.scope })
        setLoading(false)
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error ? loadError.message : String(loadError),
          )
          setLoading(false)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  return {
    canvas,
    setCanvas,
    canvasRef,
    items,
    folders,
    selectedSlug,
    scope,
    loading,
    error,
    treeMode,
    treeOpen,
    setTreeMode,
    setTreeOpen,
    saveState,
    save,
    conflict,
    resolveConflict,
    clearConflict,
    markDirty,
    recordHistory,
    undo,
    redo,
    applyDocument,
    captureViewport,
    folderPaths,
    treeNodes,
    expanded,
    toggleFolder,
    openBoard,
    reloadBoard,
    switchScope,
    toggleTree,
    handleCreate,
    handleRename,
    handleDelete,
    handleCreateFolder,
    handleRenameFolder,
    handleDeleteFolder,
  }
}

import type { Dispatch, MutableRefObject, SetStateAction } from 'react'
import type { BoardScope } from '../../shared/board/types'
import type { CanvasDocument } from '../model'
import {
  normalizeMarkdownLocks,
  updateEditorUrl,
  type CanvasListItem,
  type SaveState,
} from './appUtils'
import { loadWorkspace, readBoard } from './workspaceApi'
import { updateUiState } from './uiState'
import type { EditorTool } from './tools'

interface UseBoardWorkspaceOptions {
  items: CanvasListItem[]
  selectedSlug: string
  scope: BoardScope
  saveState: SaveState
  savingRef: MutableRefObject<boolean>
  save: () => Promise<boolean>
  setSaveState: (state: SaveState) => void
  setItems: (items: CanvasListItem[]) => void
  setFolders: (folders: Array<{ path: string; scope: BoardScope }>) => void
  setCanvas: (canvas: CanvasDocument | null) => void
  setSelectedIds: (ids: string[]) => void
  setSelectedEdgeId: (id: string | null) => void
  setFocusedGroupId: (id: string | null) => void
  setScope: (scope: BoardScope) => void
  setSelectedSlug: (slug: string) => void
  resetMarkdownEditing: () => void
  setTextEditingId: (id: string | null) => void
  setTextCreateRequest: Dispatch<
    SetStateAction<{ x: number; y: number; nonce: number } | null>
  >
  setTool: (tool: EditorTool) => void
  resetDirectorSession: () => void
  applyCanvasUiSettings: (
    canvas: CanvasDocument,
    slug: string,
    scope: BoardScope,
  ) => void
  resetHistory: () => void
  expandPath: (path: string) => void
  treeMode: boolean
  setTreeOpen: Dispatch<SetStateAction<boolean>>
  setTreeMode: (mode: boolean) => void
  setLoading: (loading: boolean) => void
  setError: (message: string) => void
}

export function useBoardWorkspace({
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
}: UseBoardWorkspaceOptions) {
  async function fetchCanvasDocument(item: CanvasListItem) {
    return readBoard(item)
  }

  function activateCanvas(item: CanvasListItem, next: CanvasDocument) {
    resetHistory()
    normalizeMarkdownLocks(next)
    setSelectedIds([])
    setSelectedEdgeId(null)
    setFocusedGroupId(null)
    resetMarkdownEditing()
    setTextEditingId(null)
    setTextCreateRequest(null)
    setTool('select')
    resetDirectorSession()
    setSelectedSlug(item.slug)
    setScope(item.scope)
    applyCanvasUiSettings(next, item.slug, item.scope)
    setCanvas(next)
    setSaveState('saved')
    expandPath(item.path)
    updateEditorUrl(item.slug, item.scope, treeMode)
  }

  async function openBoard(
    slug: string,
    targetScope: BoardScope = scope,
    force = false,
  ) {
    if (!slug || (slug === selectedSlug && targetScope === scope)) return
    const item = items.find(
      (entry) => entry.slug === slug && entry.scope === targetScope,
    )
    if (!item) return
    if (savingRef.current) {
      window.alert('正在保存，请稍候再切换白板。')
      return
    }
    if (
      !force &&
      saveState !== 'saved' &&
      !window.confirm('当前白板有未保存的修改，切换后会丢失，继续？')
    ) {
      return
    }
    setSaveState('saved')
    setLoading(true)
    try {
      const next = await fetchCanvasDocument(item)
      activateCanvas(item, next)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : String(loadError))
    } finally {
      setLoading(false)
    }
  }

  async function refreshItems() {
    const data = await loadWorkspace()
    setItems(data.boards)
    setFolders(data.folders)
    return data.boards
  }

  async function switchScope(nextScope: BoardScope) {
    if (nextScope === scope) return
    if (saveState !== 'saved' && !savingRef.current) {
      const ok = await save()
      if (!ok) return
    }
    setTreeOpen(true)
    updateUiState({ stylePanelOpen: false, toolPaletteOpen: true })
    const nextItems = items.filter((item) => item.scope === nextScope)
    const target =
      nextItems.find((item) => item.slug === selectedSlug) ?? nextItems[0]
    if (!target) {
      setScope(nextScope)
      setCanvas(null)
      setSelectedSlug('')
      setSaveState('saved')
      resetDirectorSession()
      updateEditorUrl(null, nextScope, treeMode)
      return
    }
    await openBoard(target.slug, nextScope, true)
  }

  function toggleTree() {
    if (treeMode) {
      setTreeOpen((open) => !open)
      return
    }
    setTreeMode(true)
    setTreeOpen(true)
    if (selectedSlug) updateEditorUrl(selectedSlug, scope, true)
  }

  return {
    fetchCanvasDocument,
    activateCanvas,
    openBoard,
    refreshItems,
    switchScope,
    toggleTree,
  }
}

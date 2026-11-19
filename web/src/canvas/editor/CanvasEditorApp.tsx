import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from 'react'
import { internal } from '../../vendor/json-canvas-viewer/src/index.ts'
import type { BoardContextTarget } from '../../editor/BoardContextMenu'
import { DirectorFrameController } from '../../editor/DirectorFrameController'
import type {
  BoardListItem,
  BoardScope,
  BoardTreeFolder,
} from '../../shared/board/types'
import { buildBoardTree } from '../../shared/board/tree'
import { useTreeExpansion } from '../../shared/board/useTreeExpansion'
import { DirectorHud } from '../../shared/director/DirectorHud'
import { PresentationOverlay } from '../../shared/director/PresentationOverlay'
import type {
  CanvasDocument,
  CanvasNode,
  SuperBoardScheduleEvent,
} from '../model'
import { CanvasViewer, type CanvasViewerHandle } from '../viewer/CanvasViewer'
import {
  normalizeMarkdownLocks,
  updateEditorUrl,
  type BoardDialogState,
  type CanvasListItem,
  type CanvasMenuState,
  type ControllerLike,
  type DataManagerLike,
  type ViewerInternals,
} from './appUtils'
import { useCanvasHistory } from './useCanvasHistory'
import { useEditorKeyboard } from './useEditorKeyboard'
import { useCanvasSave } from './useCanvasSave'
import { useCanvasViewport } from './useCanvasViewport'
import { useDirectorSession } from './useDirectorSession'
import { useMarkdownEditingSession } from './useMarkdownEditingSession'
import { useSelectionActions } from './useSelectionActions'
import { useBoardWorkspace } from './useBoardWorkspace'
import { useBoardFiles } from './useBoardFiles'
import { useBlockActions } from './useBlockActions'
import { useCanvasInsertions } from './useCanvasInsertions'
import { useCanvasMenu } from './useCanvasMenu'
import { CanvasEditorOverlay } from './CanvasEditorOverlay'
import { CanvasDirectorOverlay } from './CanvasDirectorOverlay'
import { MarkdownEditorOverlay } from './MarkdownEditorOverlay'
import { MarkdownFocusDialog } from './MarkdownFocusDialog'
import { EditorInsertDialogs } from './EditorInsertDialogs'
import { EditorBoardDialogs } from './EditorBoardDialogs'
import { CanvasBlockMenu } from './CanvasBlockMenu'
import { EditorWorkspace } from './EditorWorkspace'
import { isBrowserFolderMode } from './browserFolderBackend'
import { loadWorkspace, readBoard } from './workspaceApi'
import {
  rememberRecentColor,
  updateUiState,
  useUiState,
} from './uiState'
import { blockEditor } from './blocks'
import { CanvasEditorTools } from './CanvasEditorTools'
import { CanvasToolPalette } from './CanvasToolPalette'
import { CanvasStylePanel } from './CanvasStylePanel'
import type { EditorTool } from './tools'
import {
  isInsideGroup,
  isLocked,
  nodeMapOf,
  selectableAncestor,
} from './hierarchy'

export function CanvasEditorApp() {
  const [items, setItems] = useState<CanvasListItem[]>([])
  const [folders, setFolders] = useState<
    Array<{ path: string; scope: 'public' | 'private' }>
  >([])
  const [selectedSlug, setSelectedSlug] = useState('')
  const [canvas, setCanvas] = useState<CanvasDocument | null>(null)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null)
  const [focusedGroupId, setFocusedGroupId] = useState<string | null>(null)
  const [textEditingId, setTextEditingId] = useState<string | null>(null)
  const [tool, setTool] = useState<EditorTool>('select')
  const [editRequest, setEditRequest] = useState<{ id: string; nonce: number } | null>(null)
  const [textCreateRequest, setTextCreateRequest] = useState<{
    x: number
    y: number
    nonce: number
  } | null>(null)
  const [peleDialog, setPeleDialog] = useState<
    | { mode: 'create'; point?: { x: number; y: number } }
    | { mode: 'edit'; nodeId: string }
    | null
  >(null)
  const [mediaDialogOpen, setMediaDialogOpen] = useState(false)
  const [mediaUrl, setMediaUrl] = useState('')
  const [mediaInsertPoint, setMediaInsertPoint] = useState<{ x: number; y: number } | null>(
    null,
  )
  const [canvasMenu, setCanvasMenu] = useState<CanvasMenuState | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [treeMode, setTreeMode] = useState(() =>
    new URLSearchParams(window.location.search).has('tree'),
  )
  const [treeOpen, setTreeOpen] = useState(true)
  const [scope, setScope] = useState<BoardScope>(() =>
    new URLSearchParams(window.location.search).get('scope') === 'private'
      ? 'private'
      : 'public',
  )
  const uiState = useUiState()
  const stylePanelOpen = uiState.stylePanelOpen
  const menuPanelOpen = uiState.toolPaletteOpen
  const [preferencesOpen, setPreferencesOpen] = useState(false)
  const [boardDialog, setBoardDialog] = useState<BoardDialogState | null>(null)
  const [folderDialog, setFolderDialog] = useState<BoardTreeFolder | null>(null)
  const [newFolderParent, setNewFolderParent] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<BoardListItem | null>(null)
  const [pendingDeleteFolder, setPendingDeleteFolder] = useState<BoardTreeFolder | null>(
    null,
  )
  const [deployDialogOpen, setDeployDialogOpen] = useState(false)
  const [contextMenu, setContextMenu] = useState<{
    x: number
    y: number
    target: BoardContextTarget
  } | null>(null)
  const viewerRef = useRef<CanvasViewerHandle>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const shiftRef = useRef(false)
  const rightDragRef = useRef<{ x: number; y: number } | null>(null)
  const canvasRef = useRef<CanvasDocument | null>(null)
  const { applyCanvasUiSettings, captureViewport } = useCanvasViewport({
    canvas,
    selectedSlug,
    scope,
    viewerRef,
  })
  const { recordHistory, undo, redo, resetHistory } = useCanvasHistory({
    canvasRef,
    onRestore: applyDocument,
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
  const {
    copySelection,
    pasteClipboard,
    duplicateSelection,
    deleteSelection,
    ungroupSelection,
    enterGroup,
    toggleGroup,
    toggleLockSelection,
    unlockAllLocked,
    reorderSelection,
    selectAllUnlocked,
  } = useSelectionActions({
    canvas,
    selectedIds,
    selectedEdgeId,
    recordHistory,
    applyDocument,
    markDirty,
    setSelectedIds,
    setSelectedEdgeId,
    setFocusedGroupId,
  })
  const {
    directorMode,
    presentation,
    presentationMenu,
    selectedFrameId,
    frameControllerOpen,
    directorFrames,
    setPresentationMenu,
    setSelectedFrameId,
    setFrameControllerOpen,
    updateDirectorFrames,
    startPresentation,
    advancePresentation,
    exitPresentation,
    toggleDirector,
    resetDirectorSession,
  } = useDirectorSession({ canvas, viewerRef, markDirty })
  const {
    markdownEditingId,
    markdownFocusId,
    markdownFocusNode,
    openMarkdownEditor,
    openMarkdownFocus,
    closeMarkdownEditor,
    closeMarkdownFocus,
    toggleMarkdownEdit,
    startMarkdownEditing,
    handleMarkdownInput,
    resetMarkdownEditing,
  } = useMarkdownEditingSession({
    canvas,
    canvasRef,
    setCanvas,
    markDirty,
    recordHistory,
    setSelectedIds,
    setSelectedEdgeId,
    closeTextEditing,
    ensureExtension,
  })

  const scopedItems = useMemo(
    () => items.filter((item) => item.scope === scope),
    [items, scope],
  )
  const scopedFolders = useMemo(
    () => folders.filter((folder) => folder.scope === scope),
    [folders, scope],
  )
  const folderPaths = useMemo(
    () => scopedFolders.map((folder) => folder.path).sort((a, b) => a.localeCompare(b, 'zh-CN')),
    [scopedFolders],
  )
  const treeNodes = useMemo(
    () => buildBoardTree(scopedItems, scopedFolders),
    [scopedItems, scopedFolders],
  )
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
  const {
    insertTextBlock,
    openPeleDialog,
    openPeleEditor,
    insertPele,
    insertScheduleBlock,
    insertMedia,
    openMediaDialog,
  } = useCanvasInsertions({
    canvas,
    canvasRef,
    viewerRef,
    peleDialog,
    setPeleDialog,
    mediaUrl,
    mediaInsertPoint,
    setMediaDialogOpen,
    setMediaUrl,
    setMediaInsertPoint,
    applyDocument,
    recordHistory,
    setSelectedIds,
    setTool,
    setEditRequest,
    setTextCreateRequest,
    startMarkdownEditing,
    closeTextEditing,
    closeMarkdownEditor,
    ensureExtension,
  })
  const { openCanvasMenu, openQuickMenu } = useCanvasMenu({
    canvas,
    tool,
    directorMode,
    selectedIds,
    focusedGroupId,
    viewerRef,
    rightDragRef,
    setSelectedIds,
    setSelectedEdgeId,
    setCanvasMenu,
  })
  const {
    openBlockEditor,
    toggleBlockEdit,
    toggleRatioLock,
    resetBlockSize,
    handleMarkdownCommit,
  } = useBlockActions({
    canvasRef,
    viewerRef,
    textEditingId,
    captureViewport,
    recordHistory,
    markDirty,
    setCanvas,
    setSelectedIds,
    setTool,
    setEditRequest,
    closeTextEditing,
    openMarkdownEditor,
    toggleMarkdownEdit,
    closeMarkdownEditor,
    openPeleEditor,
    ensureExtension,
  })
  canvasRef.current = canvas

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      shiftRef.current = event.shiftKey
      if (event.button === 2) {
        rightDragRef.current = { x: event.clientX, y: event.clientY }
      }
    }
    window.addEventListener('pointerdown', onPointerDown, true)
    return () => window.removeEventListener('pointerdown', onPointerDown, true)
  }, [])

  const handleNodeSelect = useCallback(
    (id: string) => {
      if (!canvas) return
      const map = nodeMapOf(canvas.nodes)
      const node = map.get(id)
      if (!node) return
      const target = selectableAncestor(node, map, focusedGroupId)
      if (isLocked(target, map)) return
      if (focusedGroupId && !isInsideGroup(node, focusedGroupId, map)) {
        setFocusedGroupId(null)
      }
      setSelectedIds((current) => {
        if (!shiftRef.current) return [target.id]
        return current.includes(target.id)
          ? current.filter((item) => item !== target.id)
          : [...current, target.id]
      })
    },
    [canvas, focusedGroupId],
  )

  const updateScheduleEvents = useCallback(
    (id: string, events: SuperBoardScheduleEvent[]) => {
      const document = canvasRef.current
      const node = document?.nodes.find((item) => item.id === id)
      if (!document || !node) return
      recordHistory()
      captureViewport()
      const next: CanvasDocument = {
        ...document,
        nodes: document.nodes.map((item) =>
          item.id === id
            ? {
                ...item,
                'x-superboard': {
                  ...ensureExtension(item),
                  kind: 'schedule',
                  scheduleEvents: events,
                },
              }
            : item,
        ),
      }
      setSelectedIds([id])
      setCanvas(next)
      markDirty()
    },
    [canvas],
  )

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
        const requested = params.get('board')
        const first = scoped.find((item) => item.slug === requested) ?? scoped[0]
        if (!first) {
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
        setLoading(false)
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : String(loadError))
          setLoading(false)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const viewer = viewerRef.current?.viewer as ViewerInternals | undefined
    if (!viewer?.container) return
    let dm: DataManagerLike
    try {
      dm = viewer.container.get(internal.DataManager as never) as DataManagerLike
    } catch {
      return
    }
    const container = dm.data.container
    const onDoubleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null
      const element = target?.closest('.JCV-overlay-container') as HTMLElement | null
      if (!element?.id) return
      event.preventDefault()
      const node = canvasRef.current?.nodes.find((item) => item.id === element.id)
      if (node && blockEditor(node)) {
        openBlockEditor(node.id)
        return
      }
      setSelectedIds([element.id])
    }
    container.addEventListener('dblclick', onDoubleClick)
    return () => container.removeEventListener('dblclick', onDoubleClick)
  }, [canvas])

  useEffect(() => {
    if (selectedIds.length > 0) setSelectedEdgeId(null)
  }, [selectedIds])

  useEffect(() => {
    if (!focusedGroupId) return
    const group = canvas?.nodes.find((node) => node.id === focusedGroupId)
    if (!group || group['x-superboard']?.kind !== 'group') {
      setFocusedGroupId(null)
    }
  }, [canvas, focusedGroupId])

  useEffect(() => {
    if (!selectedEdgeId) return
    if (!canvas?.edges.some((edge) => edge.id === selectedEdgeId)) {
      setSelectedEdgeId(null)
    }
  }, [canvas, selectedEdgeId])

  function rememberBoardColor(color: string) {
    rememberRecentColor(color)
  }

  function applyDocument(next: CanvasDocument, selection: string[] = []) {
    captureViewport()
    setSelectedIds(selection)
    setCanvas(next)
    markDirty()
  }

  function closeTextEditing() {
    const active = document.activeElement as HTMLElement | null
    active?.blur()
  }

  function deleteBlock(id: string) {
    if (markdownEditingId === id) closeMarkdownEditor()
    if (markdownFocusId === id) closeMarkdownFocus()
    deleteSelection([id], null)
  }

  function ensureExtension(node: CanvasNode) {
    if (!node['x-superboard']) {
      node['x-superboard'] = {
        kind: node.type === 'text' ? 'text' : node.type === 'group' ? 'group' : 'media',
      }
    }
    return node['x-superboard']!
  }

  useEditorKeyboard({
    canvas,
    presentation,
    focusedGroupId,
    exitPresentation,
    save: conflict ? resolveConflict : save,
    undo,
    redo,
    copySelection,
    pasteClipboard,
    duplicateSelection,
    deleteSelection,
    selectAllUnlocked,
    ungroupSelection,
    toggleGroup,
    toggleLockSelection,
    setTool,
    reorderSelection,
    enterGroup,
    setSelectedIds,
    setSelectedEdgeId,
    setFocusedGroupId,
  })

  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return
    const onWheel = (event: WheelEvent) => {
      const target = event.target as HTMLElement | null
      if (!target) return
      if (
        target.closest(
          '.sb-style-panel, .sb-color-popover, .sb-color-trigger, .sb-modal-backdrop, .canvas-tool-palette, .canvas-tool-flyout, .JCV-controls, .JCV-minimap-container',
        )
      ) {
        return
      }
      if (event.altKey && !event.ctrlKey && !event.metaKey) {
        const hitbox = target.closest<HTMLElement>(
          '.sb-editor-block-hitbox[data-node-id]',
        )
        const host =
          target.closest<HTMLElement>('.sb-md-editor') ??
          target.closest<HTMLElement>('.JCV-overlay-container') ??
          (hitbox?.dataset.nodeId
            ? document.getElementById(hitbox.dataset.nodeId)
            : null)
        if (host) {
          const candidates = [host, ...host.querySelectorAll<HTMLElement>('*')]
          const scroller = candidates.find((element) => {
            if (element.scrollHeight <= element.clientHeight + 1) return false
            const overflowY = getComputedStyle(element).overflowY
            return overflowY === 'auto' || overflowY === 'scroll'
          })
          if (scroller) {
            event.preventDefault()
            event.stopPropagation()
            scroller.scrollBy({ top: event.deltaY })
            return
          }
        }
      }
      const zooming = event.ctrlKey || event.metaKey
      if (!zooming && target.closest('.sb-md-editor')) return
      const viewer = viewerRef.current?.viewer as ViewerInternals | undefined
      if (!viewer?.container) return
      let dm: DataManagerLike
      let controller: ControllerLike
      try {
        dm = viewer.container.get(internal.DataManager as never) as DataManagerLike
        controller = viewer.container.get(
          internal.Controller as never,
        ) as ControllerLike
      } catch {
        return
      }
      event.preventDefault()
      event.stopPropagation()
      const bounds = stage.getBoundingClientRect()
      if (zooming) {
        const clamped = Math.max(-120, Math.min(120, event.deltaY))
        const factor = 1.08 ** (-clamped / 100)
        const nextScale = Math.min(20, Math.max(0.05, dm.data.scale * factor))
        const originX = event.clientX - bounds.left
        const originY = event.clientY - bounds.top
        const worldX = (originX - dm.data.offsetX) / dm.data.scale
        const worldY = (originY - dm.data.offsetY) / dm.data.scale
        dm.data.offsetX = originX - worldX * nextScale
        dm.data.offsetY = originY - worldY * nextScale
        dm.data.scale = nextScale
      } else {
        dm.data.offsetX += event.shiftKey ? -event.deltaY : -event.deltaX
        dm.data.offsetY += event.shiftKey ? 0 : -event.deltaY
      }
      controller.refresh()
    }
    stage.addEventListener('wheel', onWheel, { passive: false, capture: true })
    return () => stage.removeEventListener('wheel', onWheel, { capture: true })
  }, [canvas])

  useEffect(() => {
    if (!canvasMenu) return
    const onPointerDown = (event: PointerEvent) => {
      if ((event.target as HTMLElement | null)?.closest('.sb-canvas-context-menu')) return
      setCanvasMenu(null)
    }
    window.addEventListener('pointerdown', onPointerDown, true)
    return () => window.removeEventListener('pointerdown', onPointerDown, true)
  }, [canvasMenu])

  function openContextMenu(
    event: ReactMouseEvent<HTMLElement>,
    target: BoardContextTarget,
  ) {
    event.preventDefault()
    event.stopPropagation()
    setContextMenu({ x: event.clientX, y: event.clientY, target })
  }

  function openRootContextMenu(event: ReactMouseEvent<HTMLDivElement>) {
    if ((event.target as HTMLElement).closest('.sb-tree-row')) return
    event.preventDefault()
    setContextMenu({
      x: event.clientX,
      y: event.clientY,
      target: { type: 'root' },
    })
  }

  if (loading) return <div className="sb-screen-message">正在加载画布…</div>
  if (error) {
    return (
      <div className="sb-screen-message">
        <h1>无法打开画布</h1>
        <p>{error}</p>
      </div>
    )
  }

  const nodeMap = canvas ? nodeMapOf(canvas.nodes) : new Map<string, CanvasNode>()
  const peleEditNode =
    peleDialog?.mode === 'edit'
      ? canvas?.nodes.find((node) => node.id === peleDialog.nodeId) ?? null
      : null
  const peleInitialCode =
    peleEditNode && peleEditNode.type === 'text'
      ? typeof peleEditNode['x-superboard']?.code === 'string'
        ? peleEditNode['x-superboard'].code
        : peleEditNode.text
      : ''
  const peleInitialDiagram =
    typeof peleEditNode?.['x-superboard']?.diagram === 'string'
      ? peleEditNode['x-superboard'].diagram
      : 'flowchart'
  const canGroup = canvas
    ? selectedIds.filter((id) => {
        const node = nodeMap.get(id)
        return node && !isLocked(node, nodeMap)
      }).length >= 2
    : false
  const canUngroup = selectedIds.some((id) => {
    const node = nodeMap.get(id)
    return node?.['x-superboard']?.kind === 'group' && !isLocked(node, nodeMap)
  })
  const hasLocked = canvas
    ? canvas.nodes.some((node) => isLocked(node, nodeMap))
    : false
  const allSelectedLocked =
    selectedIds.length > 0 &&
    selectedIds.every((id) => {
      const node = nodeMap.get(id)
      return Boolean(node?.['x-superboard']?.locked)
    })
  const railSaveLabel = conflict
    ? '保存冲突，点击覆盖'
    : saveState === 'error'
      ? '保存失败'
      : saveState === 'dirty'
        ? '点击保存'
        : saveState === 'saving'
          ? '保存中…'
          : '已保存'

  return (
    <div
      className={`sb-app sb-app-editor${directorMode ? ' is-director-mode' : ''}${presentation ? ' is-presenting' : ''}`}
    >
      {conflict ? (
        <div className="sb-save-conflict" role="alert">
          <div className="sb-save-conflict-text">
            <strong>保存冲突</strong>
            <span>其他标签页已修改这块白板</span>
          </div>
          <div className="sb-save-conflict-actions">
            <button
              type="button"
              onClick={() => void resolveConflict(false)}
            >
              用当前内容覆盖
            </button>
            <button
              type="button"
              className="is-secondary"
              onClick={() => {
                if (
                  !window.confirm(
                    '放弃当前未保存的修改，重新加载磁盘上的版本？',
                  )
                ) {
                  return
                }
                void reloadBoard().then((ok) => {
                  if (ok) clearConflict()
                })
              }}
            >
              重新加载
            </button>
          </div>
        </div>
      ) : saveState === 'error' ? (
        <div className="sb-save-conflict is-error" role="alert">
          <div className="sb-save-conflict-text">
            <strong>保存失败</strong>
            <span>内容仍在本地，可重试保存</span>
          </div>
          <button type="button" onClick={() => void save()}>
            重试保存
          </button>
        </div>
      ) : null}
      <EditorWorkspace
        treeMode={treeMode}
        treeOpen={treeOpen}
        onToggleTree={toggleTree}
        scopeLabel={scope === 'public' ? '切换到私有白板' : '切换到公开白板'}
        onSwitchScope={() =>
          void switchScope(scope === 'public' ? 'private' : 'public')
        }
        saveLabel={railSaveLabel}
        saveState={saveState}
        canSave={Boolean(canvas) && saveState !== 'saving'}
        onSave={() => void (conflict ? resolveConflict() : save())}
        stylePanelOpen={stylePanelOpen}
        onToggleStylePanel={() =>
          updateUiState({ stylePanelOpen: !stylePanelOpen })
        }
        menuPanelOpen={menuPanelOpen}
        menuPanelLabel={menuPanelOpen ? '隐藏操作栏' : '显示操作栏'}
        onToggleMenuPanel={() =>
          updateUiState({ toolPaletteOpen: !menuPanelOpen })
        }
        directorMode={directorMode}
        onToggleDirector={toggleDirector}
        onDeploy={
          isBrowserFolderMode()
            ? undefined
            : () => setDeployDialogOpen(true)
        }
        onOpenPreferences={() => setPreferencesOpen(true)}
        tree={
          treeMode
            ? {
                nodes: treeNodes,
                title: `SuperBoard-${scope}`,
                collapsed: !treeOpen,
                selectedSlug,
                expanded,
                emptyLabel: '还没有白板，在空白处右键新建',
                onToggle: toggleFolder,
                onSelect: (slug) => {
                  void openBoard(slug, scope)
                  if (window.matchMedia('(max-width: 860px)').matches) {
                    setTreeOpen(false)
                  }
                },
                onContextMenu: openContextMenu,
                onRootContextMenu: openRootContextMenu,
              }
            : undefined
        }
      >
        <main className="sb-canvas">
          <div className="canvas-editor">
            <div
              ref={stageRef}
              className="canvas-editor-stage"
              onContextMenu={openCanvasMenu}
              onDoubleClick={openQuickMenu}
            >
              {canvas ? (
                <>
                  <div className="canvas-viewer-wrap">
                    <CanvasViewer
                    ref={viewerRef}
                    canvas={canvas}
                    onNodeSelect={handleNodeSelect}
                    onScheduleEventsChange={updateScheduleEvents}
                    style={{ width: '100%', height: '100%' }}
                    />
                  </div>
                  <CanvasEditorOverlay
                    canvas={canvas}
                    viewerRef={viewerRef}
                    selectedIds={selectedIds}
                    onSelect={setSelectedIds}
                    onChange={() => {
                      markDirty()
                      if (textEditingId) {
                        setCanvas((current) =>
                          current
                            ? { ...current, nodes: [...current.nodes] }
                            : current,
                        )
                      }
                    }}
                    onBeforeChange={recordHistory}
                    interactive={tool === 'select'}
                    selectedEdgeId={selectedEdgeId}
                    onSelectEdge={(id) => {
                      setSelectedEdgeId(id)
                      if (id) setSelectedIds([])
                    }}
                    focusedGroupId={focusedGroupId}
                    activeEditingId={markdownEditingId ?? textEditingId}
                    guidesEnabled={uiState.guides}
                    onToggleBlockEdit={toggleBlockEdit}
                    onFocusBlockEdit={openMarkdownFocus}
                    onDeleteBlock={deleteBlock}
                    onResetBlockSize={resetBlockSize}
                    onToggleRatioLock={toggleRatioLock}
                  />
                  <CanvasEditorTools
                    canvas={canvas}
                    tool={tool}
                    viewerRef={viewerRef}
                    onBeforeChange={recordHistory}
                    onChange={markDirty}
                    onApply={applyDocument}
                    onExitTool={() => setTool('select')}
                    editRequest={editRequest}
                    onEditRequestHandled={() => setEditRequest(null)}
                    createRequest={textCreateRequest}
                    onCreateRequestHandled={() => setTextCreateRequest(null)}
                    onEditMarkdown={openMarkdownEditor}
                    onEditingChange={setTextEditingId}
                  />
                  {markdownEditingId ? (
                    <MarkdownEditorOverlay
                      canvas={canvas}
                      viewerRef={viewerRef}
                      nodeId={markdownEditingId}
                      onInput={handleMarkdownInput}
                      onCommit={handleMarkdownCommit}
                      onRequestClose={closeMarkdownEditor}
                    />
                  ) : null}
                  {markdownFocusId && markdownFocusNode ? (
                    <MarkdownFocusDialog
                      nodeId={markdownFocusNode.id}
                      value={markdownFocusNode.text}
                      onInput={(value) =>
                        handleMarkdownInput(markdownFocusNode.id, value)
                      }
                      onCommit={(value) =>
                        handleMarkdownCommit(markdownFocusNode.id, value)
                      }
                      onClose={closeMarkdownFocus}
                    />
                  ) : null}
                  {stylePanelOpen ? (
                    <CanvasStylePanel
                      canvas={canvas}
                      selectedIds={selectedIds}
                      selectedEdgeId={selectedEdgeId}
                      onBeforeChange={recordHistory}
                      onApply={applyDocument}
                      onRememberColor={rememberBoardColor}
                    />
                  ) : null}
                  {directorMode && !presentation ? (
                    <CanvasDirectorOverlay
                      canvas={canvas}
                      viewerRef={viewerRef}
                      selectedId={selectedFrameId}
                      onSelect={setSelectedFrameId}
                      onBeforeChange={recordHistory}
                      onChangeFrames={updateDirectorFrames}
                      onPlayFrame={(frame) => {
                        const index = directorFrames.findIndex(
                          (item) => item.id === frame.id,
                        )
                        startPresentation(index < 0 ? 0 : index)
                      }}
                      onOpenController={() => setFrameControllerOpen(true)}
                    />
                  ) : null}
                  {directorMode && !presentation && frameControllerOpen ? (
                    <DirectorFrameController
                      frames={directorFrames.map((frame) => ({
                        id: frame.id,
                        order: frame.order,
                        name: frame.name,
                        x: frame.x,
                        y: frame.y,
                        w: frame.width,
                        h: frame.height,
                      }))}
                      selectedId={selectedFrameId}
                      onSelect={setSelectedFrameId}
                      onChangeFrames={(next) =>
                        updateDirectorFrames(
                          next.map((frame) => ({
                            id: frame.id,
                            order: frame.order,
                            name: frame.name,
                            x: frame.x,
                            y: frame.y,
                            width: frame.w,
                            height: frame.h,
                          })),
                        )
                      }
                      onClose={() => setFrameControllerOpen(false)}
                    />
                  ) : null}
                  {menuPanelOpen ? (
                    <CanvasToolPalette
                      tool={tool}
                      onToolChange={setTool}
                      onInsertMarkdown={() => insertTextBlock('markdown')}
                      onInsertPele={() => openPeleDialog()}
                      onInsertSchedule={() => insertScheduleBlock()}
                      onInsertMedia={() => openMediaDialog()}
                    />
                  ) : null}
                </>
              ) : (
                <div className="sb-canvas-empty">
                  <div>
                    <h2>还没有白板</h2>
                    <p>
                      在左侧目录空白处右键新建白板，或先把 .canvas 放进 whiteboards/{scope}/。
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </main>
      </EditorWorkspace>

      {directorMode && !presentation ? (
        <DirectorHud onPlay={() => startPresentation(0)} onExit={toggleDirector} />
      ) : null}

      {presentation ? (
        <PresentationOverlay
          menu={presentationMenu}
          onMenu={setPresentationMenu}
          onAdvance={advancePresentation}
          onExit={exitPresentation}
        />
      ) : null}

      {canvasMenu && canvas ? (
        <CanvasBlockMenu
          canvas={canvas}
          menu={canvasMenu}
          selectedIds={selectedIds}
          canGroup={canGroup}
          canUngroup={canUngroup}
          allSelectedLocked={allSelectedLocked}
          hasLocked={hasLocked}
          onClose={() => setCanvasMenu(null)}
          onDuplicate={duplicateSelection}
          onDelete={() => deleteSelection()}
          onDeleteEdge={() => deleteSelection()}
          onToggleGroup={toggleGroup}
          onToggleLock={toggleLockSelection}
          onReorder={reorderSelection}
          onUnlockAll={unlockAllLocked}
          onSelectAll={selectAllUnlocked}
          onEditBlock={openBlockEditor}
          onInsertText={() =>
            insertTextBlock('text', {
              x: canvasMenu.worldX,
              y: canvasMenu.worldY,
            })
          }
          onInsertMarkdown={() =>
            insertTextBlock('markdown', {
              x: canvasMenu.worldX,
              y: canvasMenu.worldY,
            })
          }
          onInsertPele={() =>
            openPeleDialog({
              x: canvasMenu.worldX,
              y: canvasMenu.worldY,
            })
          }
          onInsertSchedule={() =>
            insertScheduleBlock({
              x: canvasMenu.worldX,
              y: canvasMenu.worldY,
            })
          }
          onInsertMedia={() =>
            openMediaDialog({ x: canvasMenu.worldX, y: canvasMenu.worldY })
          }
        />
      ) : null}

      <EditorInsertDialogs
        peleDialog={peleDialog}
        peleInitialCode={peleInitialCode}
        peleInitialDiagram={peleInitialDiagram}
        onClosePele={() => setPeleDialog(null)}
        onSavePele={insertPele}
        mediaOpen={mediaDialogOpen}
        mediaUrl={mediaUrl}
        onCloseMedia={() => {
          setMediaDialogOpen(false)
          setMediaInsertPoint(null)
        }}
        onConfirmMedia={(value) => insertMedia(value)}
        preferencesOpen={preferencesOpen}
        onClosePreferences={() => {
          setPreferencesOpen(false)
          viewerRef.current?.viewer?.refresh?.()
        }}
        deployOpen={deployDialogOpen}
        onCloseDeploy={() => setDeployDialogOpen(false)}
        onConfirmDeploy={() => {
          setDeployDialogOpen(false)
          void fetch('/__deploy', { method: 'POST' }).catch(() => {})
        }}
      />

      <EditorBoardDialogs
        boardDialog={boardDialog}
        folderDialog={folderDialog}
        newFolderParent={newFolderParent}
        pendingDelete={pendingDelete}
        pendingDeleteFolder={pendingDeleteFolder}
        contextMenu={contextMenu}
        folderPaths={folderPaths}
        scope={scope}
        onCloseBoardDialog={() => setBoardDialog(null)}
        onCreateBoard={handleCreate}
        onRenameBoard={handleRename}
        onCloseFolderDialog={() => setFolderDialog(null)}
        onRenameFolder={handleRenameFolder}
        onCloseNewFolder={() => setNewFolderParent(null)}
        onCreateFolder={handleCreateFolder}
        onCloseDeleteBoard={() => setPendingDelete(null)}
        onDeleteBoard={handleDelete}
        onCloseDeleteFolder={() => setPendingDeleteFolder(null)}
        onDeleteFolder={handleDeleteFolder}
        onCloseContextMenu={() => setContextMenu(null)}
        onContextCreate={(folder) => setBoardDialog({ mode: 'create', folder })}
        onContextCreateFolder={(folder) => setNewFolderParent(folder)}
        onContextRename={(node) => setBoardDialog({ mode: 'rename', board: node })}
        onContextRenameFolder={(folder) => setFolderDialog(folder)}
        onContextDelete={(node) => setPendingDelete(node)}
        onContextDeleteFolder={(folder) => setPendingDeleteFolder(folder)}
      />
    </div>
  )
}

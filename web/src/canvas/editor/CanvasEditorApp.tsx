import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from 'react'
import { useTranslation } from 'react-i18next'
import { internal } from '../../vendor/json-canvas-viewer/src/index.ts'
import type { BoardContextTarget } from '../../editor/BoardContextMenu'
import { DirectorHud } from '../../shared/director/DirectorHud'
import { PresentationOverlay } from '../../shared/director/PresentationOverlay'
import type {
  CanvasDocument,
  CanvasNode,
  SuperBoardScheduleEvent,
  SuperBoardTreeData,
} from '../model'
import {
  questionsToAnswer,
  removeTreeNode,
  updateTreeNode,
} from '../model'
import { CanvasEditorStage } from './CanvasEditorStage'
import { aiChat } from '../../desktop/ai'
import {
  buildTreeMessages,
  buildCompactionMessages,
  buildCompactionUpdateMessages,
  estimateTokens,
  nearestSummaryNode,
  splitAnswerTitle,
} from '../tree/treePrompt'
import { newTreeNodeId } from '../model'
import { activeAISettings, getPreferences } from './preferences'
import {
  type CanvasMenuState,
  type DataManagerLike,
  type ViewerInternals,
} from './appUtils'
import type { CanvasViewerHandle } from '../viewer/CanvasViewer'
import { useCanvasEditorSession } from './useCanvasEditorSession'
import { useEditorKeyboard } from './useEditorKeyboard'
import { useDirectorSession } from './useDirectorSession'
import { useEditorTextEditing } from './useEditorTextEditing'
import { useEditorSelection } from './useEditorSelection'
import { useCanvasViewportGestures } from './useCanvasViewportGestures'
import { useEditorDialogState } from './useEditorDialogState'
import { useBlockActions } from './useBlockActions'
import { useCanvasInsertions } from './useCanvasInsertions'
import { useCanvasMenu } from './useCanvasMenu'
import { EditorInsertDialogs } from './EditorInsertDialogs'
import { ExportDialog } from './ExportDialog'
import { EditorBoardDialogs } from './EditorBoardDialogs'
import { CanvasContextMenuLayer } from './CanvasContextMenuLayer'
import { SaveConflictBanner } from './SaveConflictBanner'
import { EditorWorkspace } from './EditorWorkspace'
import {
  rememberRecentColor,
  updateUiState,
  useUiState,
} from './uiState'
import { blockEditor } from './blocks'
import type { EditorTool } from './tools'
import {
  isLocked,
  nodeMapOf,
} from './hierarchy'

function waitFrames(count: number) {
  return new Promise<void>((resolve) => {
    let remaining = count
    const step = () => {
      remaining -= 1
      if (remaining <= 0) resolve()
      else requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  })
}

export function CanvasEditorApp() {
  const { t } = useTranslation(['editor'])
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
  const [exportExpanded, setExportExpanded] = useState(false)
  const uiState = useUiState()
  const stylePanelOpen = uiState.stylePanelOpen
  const menuPanelOpen = uiState.toolPaletteOpen
  const {
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
    historyBoard,
    setHistoryBoard,
    contextMenu,
    setContextMenu,
  } = useEditorDialogState()
  const viewerRef = useRef<CanvasViewerHandle>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  // The session hook needs these two resets before their own hooks are called;
  // refs keep the stable callbacks without creating a hook cycle.
  const resetDirectorRef = useRef<() => void>(() => undefined)
  const resetMarkdownRef = useRef<() => void>(() => undefined)
  const {
    canvas,
    setCanvas,
    canvasRef,
    selectedSlug,
    scope,
    loading,
    error,
    treeMode,
    treeOpen,
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
  } = useCanvasEditorSession({
    viewerRef,
    setSelectedIds,
    setSelectedEdgeId,
    setFocusedGroupId,
    setTool,
    setTextEditingId,
    setTextCreateRequest,
    resetMarkdownEditing: () => resetMarkdownRef.current(),
    resetDirectorSession: () => resetDirectorRef.current(),
    boardDialog,
    folderDialog,
    newFolderParent,
    setNewFolderParent,
  })
  const {
    rightDragRef,
    handleNodeSelect,
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
  } = useEditorSelection({
    canvas,
    selectedIds,
    setSelectedIds,
    selectedEdgeId,
    setSelectedEdgeId,
    focusedGroupId,
    setFocusedGroupId,
    recordHistory,
    applyDocument,
    markDirty,
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
    previousPresentation,
    exitPresentation,
    toggleDirector,
    resetDirectorSession,
  } = useDirectorSession({ canvas, viewerRef, markDirty })
  resetDirectorRef.current = resetDirectorSession
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
    closeTextEditing,
  } = useEditorTextEditing({
    canvas,
    canvasRef,
    setCanvas,
    markDirty,
    recordHistory,
    setSelectedIds,
    setSelectedEdgeId,
  })
  resetMarkdownRef.current = resetMarkdownEditing

  const {
    insertTextBlock,
    openPeleDialog,
    openPeleEditor,
    insertPele,
    insertScheduleBlock,
    insertTreeBlock,
    insertMedia,
    insertLocalFile,
    pickLocalFilesFromDialog,
    openMediaDialog,
  } = useCanvasInsertions({
    canvas,
    canvasRef,
    scope,
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

  /** Silently patch one tree block: used for derived state such as answers. */
  const patchTree = useCallback(
    (
      id: string,
      updater: (tree: SuperBoardTreeData) => SuperBoardTreeData,
    ) => {
      setCanvas((current) => {
        if (!current) return current
        const node = current.nodes.find((item) => item.id === id)
        const tree = node?.['x-superboard']?.tree
        if (!node || !tree) return current
        const nextTree = updater(tree)
        if (nextTree === tree) return current
        return {
          ...current,
          nodes: current.nodes.map((item) =>
            item.id === id
              ? {
                  ...item,
                  'x-superboard': {
                    ...ensureExtension(item),
                    kind: 'tree',
                    tree: nextTree,
                  },
                }
              : item,
          ),
        }
      })
    },
    [ensureExtension, setCanvas],
  )

  const runTreeAnswer = useCallback(
    async (blockId: string, nodeId: string, snapshot?: SuperBoardTreeData) => {
      const preferences = getPreferences()
      const settings = activeAISettings(preferences.ai)
      const source =
        snapshot ??
        canvasRef.current?.nodes.find((item) => item.id === blockId)?.[
          'x-superboard'
        ]?.tree
      // Retrying a summary card regenerates the summary, not an answer.
      const target = source?.nodes.find((item) => item.id === nodeId)
      if (target?.role === 'summary') {
        if (!target.parentId || !source) return
        patchTree(blockId, (tree) =>
          updateTreeNode(tree, nodeId, {
            status: 'generating',
            error: undefined,
          }),
        )
        try {
          const summary = await aiChat(
            settings,
            buildCompactionMessages(source, target.parentId),
          )
          patchTree(blockId, (tree) =>
            updateTreeNode(tree, nodeId, {
              answer: summary.trim(),
              status: 'done',
              error: undefined,
            }),
          )
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          patchTree(blockId, (tree) =>
            updateTreeNode(tree, nodeId, { status: 'error', error: message }),
          )
        }
        markDirty()
        return
      }
      patchTree(blockId, (tree) =>
        updateTreeNode(tree, nodeId, {
          status: 'generating',
          error: undefined,
        }),
      )
      try {
        // A submit passes the tree it just produced: the ref may not have
        // caught up yet, and reading a stale tree would drop the question.
        const tree =
          snapshot ??
          canvasRef.current?.nodes.find((item) => item.id === blockId)?.[
            'x-superboard'
          ]?.tree
        if (!tree) return
        const messages = buildTreeMessages(tree, nodeId)
        if (!messages.length) throw new Error('empty prompt')
        const slug =
          canvasRef.current?.['x-superboard']?.meta.slug ?? 'board'

        // Long paths are summarised first: the summary replaces everything down
        // to the ancestor it hangs from, so the next request stays inside the
        // context window.
        let workingTree = tree
        const node = tree.nodes.find((item) => item.id === nodeId)
        // The summary hangs under the deepest ancestor: it covers that ancestor
        // and everything above it, so both this question and the ancestor's own
        // later questions start from the summary.
        const summaryParent = node?.parentId ?? null
        const existing = summaryParent
          ? nearestSummaryNode(tree, nodeId, true)
          : null
        const needsCompaction =
          summaryParent !== null &&
          estimateTokens(messages) > preferences.ai.compactionThreshold

        if (needsCompaction && summaryParent) {
          if (
            existing &&
            existing.status === 'done' &&
            existing.parentId === summaryParent
          ) {
            // The summary already sits under this question's parent, so it
            // covers the whole history; there is nothing new to fold.
          } else if (existing && existing.status === 'done') {
            // Fold only the turns added since that summary, then move the same
            // card under the deepest ancestor. One path keeps one summary.
            const summaryId = existing.id
            patchTree(blockId, (current) =>
              updateTreeNode(current, summaryId, {
                status: 'generating',
                error: undefined,
              }),
            )
            try {
              const summary = await aiChat(
                { ...settings, session: `${slug}:${blockId}` },
                buildCompactionUpdateMessages(tree, summaryId, summaryParent),
              )
              if (summary.trim()) {
                workingTree = updateTreeNode(tree, summaryId, {
                  parentId: summaryParent,
                  answer: summary.trim(),
                  status: 'done',
                  error: undefined,
                })
              } else {
                // Keep the previous summary when the model returns nothing.
                workingTree = updateTreeNode(tree, summaryId, {
                  status: 'done',
                  error: undefined,
                })
              }
              patchTree(blockId, () => workingTree)
            } catch (summaryError) {
              const message =
                summaryError instanceof Error
                  ? summaryError.message
                  : String(summaryError)
              patchTree(blockId, (current) =>
                updateTreeNode(current, summaryId, {
                  status: 'error',
                  error: message,
                }),
              )
              workingTree = tree
            }
          } else {
            // No summary yet, or the last attempt failed: reuse that card when
            // it exists instead of stacking a second one.
            const summaryId = existing?.id ?? newTreeNodeId()
            const withPlaceholder: SuperBoardTreeData = existing
              ? updateTreeNode(tree, summaryId, {
                  parentId: summaryParent,
                  status: 'generating',
                  error: undefined,
                })
              : {
                  ...tree,
                  nodes: [
                    ...tree.nodes,
                    {
                      id: summaryId,
                      parentId: summaryParent,
                      title: '',
                      question: '',
                      answer: '',
                      status: 'generating',
                      createdAt: new Date().toISOString(),
                      role: 'summary',
                    },
                  ],
                }
            patchTree(blockId, () => withPlaceholder)
            try {
              const summary = await aiChat(
                { ...settings, session: `${slug}:${blockId}` },
                buildCompactionMessages(tree, summaryParent),
              )
              if (summary.trim()) {
                workingTree = updateTreeNode(withPlaceholder, summaryId, {
                  parentId: summaryParent,
                  answer: summary.trim(),
                  status: 'done',
                  error: undefined,
                })
              } else {
                workingTree = removeTreeNode(withPlaceholder, summaryId, 'branch')
              }
              patchTree(blockId, () => workingTree)
            } catch (summaryError) {
              const message =
                summaryError instanceof Error
                  ? summaryError.message
                  : String(summaryError)
              patchTree(blockId, (current) =>
                updateTreeNode(current, summaryId, {
                  status: 'error',
                  error: message,
                }),
              )
              workingTree = tree
            }
          }
        }

        const content = await aiChat(
          { ...settings, session: `${slug}:${blockId}` },
          buildTreeMessages(workingTree, nodeId),
        )
        const { title, body } = splitAnswerTitle(content)
        patchTree(blockId, (current) =>
          updateTreeNode(current, nodeId, {
            status: 'done',
            answer: body,
            ...(title ? { title } : {}),
            error: undefined,
          }),
        )
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        patchTree(blockId, (current) =>
          updateTreeNode(current, nodeId, { status: 'error', error: message }),
        )
      }
      markDirty()
    },
    [markDirty, patchTree],
  )

  const updateTreeChange = useCallback(
    (id: string, tree: SuperBoardTreeData) => {
      const document = canvasRef.current
      const node = document?.nodes.find((item) => item.id === id)
      if (!document || !node) return
      const previousTree = node['x-superboard']?.tree
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
                  kind: 'tree',
                  tree,
                },
              }
            : item,
        ),
      }
      setCanvas(next)
      markDirty()
      if (!previousTree) return
      for (const nodeId of questionsToAnswer(previousTree, tree)) {
        void runTreeAnswer(id, nodeId, tree)
      }
    },
    [
      captureViewport,
      ensureExtension,
      markDirty,
      recordHistory,
      runTreeAnswer,
      setCanvas,
    ],
  )

  const updateTreeSize = useCallback(
    (id: string, size: { width: number; height: number }) => {
      setCanvas((current) => {
        if (!current) return current
        const node = current.nodes.find((item) => item.id === id)
        if (!node) return current
        // The tree block is sized by its cards: this is derived state, so it
        // must not enter history or mark the document dirty.
        if (
          Math.abs(node.width - size.width) < 1 &&
          Math.abs(node.height - size.height) < 1
        ) {
          return current
        }
        return {
          ...current,
          nodes: current.nodes.map((item) =>
            item.id === id
              ? { ...item, width: size.width, height: size.height }
              : item,
          ),
        }
      })
    },
    [setCanvas],
  )

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

  function rememberBoardColor(color: string) {
    rememberRecentColor(color)
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

  useCanvasViewportGestures({ stageRef, viewerRef, canvas })

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

  if (loading) return <div className="sb-screen-message">{t('editor:app.loading')}</div>
  if (error) {
    return (
      <div className="sb-screen-message">
        <h1>{t('editor:app.loadFailed')}</h1>
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
    ? t('editor:save.conflictClick')
    : saveState === 'error'
      ? t('editor:save.failed')
      : saveState === 'dirty'
        ? t('editor:save.click')
        : saveState === 'saving'
          ? t('editor:save.saving')
          : t('editor:save.saved')
  const treeConfig = treeMode
    ? {
        nodes: treeNodes,
        title: `SuperBoard-${scope}`,
        collapsed: !treeOpen,
        selectedSlug,
        expanded,
        emptyLabel: t('editor:tree.empty'),
        onToggle: toggleFolder,
        onSelect: (slug: string) => {
          void openBoard(slug, scope)
          if (window.matchMedia('(max-width: 860px)').matches) {
            setTreeOpen(false)
          }
        },
        onContextMenu: openContextMenu,
        onRootContextMenu: openRootContextMenu,
      }
    : undefined

  return (
    <div
      className={`sb-app sb-app-editor${directorMode ? ' is-director-mode' : ''}${presentation ? ' is-presenting' : ''}`}
    >
      <SaveConflictBanner
        conflict={conflict}
        saveState={saveState}
        onOverwrite={() => void resolveConflict(false)}
        onReload={() =>
          void reloadBoard().then((ok) => {
            if (ok) clearConflict()
          })
        }
        onRetry={() => void save()}
      />
      <EditorWorkspace
        treeMode={treeMode}
        treeOpen={treeOpen}
        onToggleTree={toggleTree}
        scopeLabel={
          scope === 'public' ? t('editor:scope.toPrivate') : t('editor:scope.toPublic')
        }
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
        menuPanelLabel={
          menuPanelOpen ? t('editor:shell.hideMenu') : t('editor:shell.showMenu')
        }
        onToggleMenuPanel={() =>
          updateUiState({ toolPaletteOpen: !menuPanelOpen })
        }
        directorMode={directorMode}
        onToggleDirector={toggleDirector}
        onExport={() => setExportDialogOpen(true)}
        onOpenPreferences={() => setPreferencesOpen(true)}
        tree={treeConfig}
      >
        <CanvasEditorStage
          canvas={canvas}
          scope={scope}
          stageRef={stageRef}
          viewerRef={viewerRef}
          onContextMenu={openCanvasMenu}
          onDoubleClick={openQuickMenu}
          onNodeSelect={handleNodeSelect}
          onScheduleEventsChange={updateScheduleEvents}
          onTreeSize={updateTreeSize}
          onTreeChange={updateTreeChange}
          onTreeGenerate={runTreeAnswer}
          expandTrees={exportExpanded}
          selection={{
            selectedIds,
            onSelect: setSelectedIds,
            selectedEdgeId,
            onSelectEdge: (id) => {
              setSelectedEdgeId(id)
              if (id) setSelectedIds([])
            },
            focusedGroupId,
            interactive: tool === 'select',
            activeEditingId: markdownEditingId ?? textEditingId,
            guidesEnabled: uiState.guides,
            onBeforeChange: recordHistory,
            onChange: () => {
              markDirty()
              if (textEditingId) {
                setCanvas((current) =>
                  current
                    ? { ...current, nodes: [...current.nodes] }
                    : current,
                )
              }
            },
            onToggleBlockEdit: toggleBlockEdit,
            onFocusBlockEdit: openMarkdownFocus,
            onDeleteBlock: deleteBlock,
            onResetBlockSize: resetBlockSize,
            onToggleRatioLock: toggleRatioLock,
          }}
          tools={{
            tool,
            onChangeTool: setTool,
            onApply: applyDocument,
            onExitTool: () => setTool('select'),
            editRequest,
            onEditRequestHandled: () => setEditRequest(null),
            createRequest: textCreateRequest,
            onCreateRequestHandled: () => setTextCreateRequest(null),
            onEditMarkdown: openMarkdownEditor,
            onEditingChange: setTextEditingId,
            onRequestEdit: (id) =>
              setEditRequest({ id, nonce: Date.now() }),
          }}
          markdown={{
            editingId: markdownEditingId,
            focusId: markdownFocusId,
            focusNode: markdownFocusNode,
            onInput: handleMarkdownInput,
            onCommit: handleMarkdownCommit,
            onRequestClose: closeMarkdownEditor,
            onCloseFocus: closeMarkdownFocus,
          }}
          stylePanelOpen={stylePanelOpen}
          onRememberColor={rememberBoardColor}
          director={{
            mode: directorMode,
            presentation,
            selectedFrameId,
            onSelectFrame: setSelectedFrameId,
            frames: directorFrames,
            onChangeFrames: updateDirectorFrames,
            onPlayFrame: (frame) => {
              const index = directorFrames.findIndex(
                (item) => item.id === frame.id,
              )
              startPresentation(index < 0 ? 0 : index)
            },
            controllerOpen: frameControllerOpen,
            onOpenController: () => setFrameControllerOpen(true),
            onCloseController: () => setFrameControllerOpen(false),
          }}
          palette={{
            open: menuPanelOpen,
            onInsertMarkdown: () => insertTextBlock('markdown'),
            onInsertPele: () => openPeleDialog(),
            onInsertSchedule: () => insertScheduleBlock(),
            onInsertMedia: () => openMediaDialog(),
            onInsertTree: () => insertTreeBlock(),
          }}
        />
      </EditorWorkspace>

      {directorMode && !presentation ? (
        <DirectorHud onPlay={() => startPresentation(0)} onExit={toggleDirector} />
      ) : null}

      {presentation ? (
        <PresentationOverlay
          menu={presentationMenu}
          onMenu={setPresentationMenu}
          onAdvance={advancePresentation}
          onPrevious={previousPresentation}
          onExit={exitPresentation}
        />
      ) : null}

      <CanvasContextMenuLayer
        menu={canvasMenu}
        canvas={canvas}
        selectedIds={selectedIds}
        canGroup={canGroup}
        canUngroup={canUngroup}
        allSelectedLocked={allSelectedLocked}
        hasLocked={hasLocked}
        onClose={() => setCanvasMenu(null)}
        onDuplicate={duplicateSelection}
        onDelete={() => deleteSelection()}
        onToggleGroup={toggleGroup}
        onToggleLock={toggleLockSelection}
        onReorder={reorderSelection}
        onUnlockAll={unlockAllLocked}
        onSelectAll={selectAllUnlocked}
        onEditBlock={openBlockEditor}
        onInsertText={(point) => insertTextBlock('text', point)}
        onInsertMarkdown={(point) => insertTextBlock('markdown', point)}
        onInsertPele={openPeleDialog}
        onInsertSchedule={insertScheduleBlock}
        onInsertMedia={openMediaDialog}
      />

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
        onInsertFile={(file) => void insertLocalFile(file)}
        onPickFiles={() => void pickLocalFilesFromDialog()}
        preferencesOpen={preferencesOpen}
        onClosePreferences={() => {
          setPreferencesOpen(false)
          viewerRef.current?.viewer?.refresh?.()
        }}
      />

      {exportDialogOpen && canvas ? (
        <ExportDialog
          canvas={canvas}
          viewerRef={viewerRef}
          onPrepare={async () => {
            setExportExpanded(true)
            await waitFrames(12)
          }}
          onFinish={() => setExportExpanded(false)}
          onClose={() => setExportDialogOpen(false)}
        />
      ) : null}

      <EditorBoardDialogs
        boardDialog={boardDialog}
        folderDialog={folderDialog}
        newFolderParent={newFolderParent}
        pendingDelete={pendingDelete}
        pendingDeleteFolder={pendingDeleteFolder}
        historyBoard={historyBoard}
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
        onContextHistory={(node) => setHistoryBoard(node)}
        onCloseHistory={() => setHistoryBoard(null)}
        onHistoryRestored={() => {
          const target = historyBoard
          setHistoryBoard(null)
          if (!target) return
          const targetScope = target.scope ?? scope
          if (target.slug === selectedSlug && targetScope === scope) {
            void reloadBoard()
          } else {
            void openBoard(target.slug, targetScope)
          }
        }}
        onBeforeHistoryRestore={async () =>
          saveState === 'saved' ? true : save()
        }
      />
    </div>
  )
}

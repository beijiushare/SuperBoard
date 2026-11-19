import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from 'react'
import { internal } from '../../vendor/json-canvas-viewer/src/index.ts'
import { BoardContextMenu, type BoardContextTarget } from '../../editor/BoardContextMenu'
import {
  BoardDialog,
  DeleteBoardDialog,
  DeleteFolderDialog,
  DeployDialog,
  RenameFolderDialog,
  type BoardFormValues,
} from '../../editor/dialogs'
import { DirectorFrameController } from '../../editor/DirectorFrameController'
import { EditorRail } from '../../editor/EditorRail'
import { BoardTreePanel } from '../../shared/board/BoardTreePanel'
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
  HISTORY_LIMIT,
  HISTORY_MERGE_MS,
  PASTE_OFFSET,
  nextId,
  normalizeMarkdownLocks,
  normalizeMediaUrl,
  updateEditorUrl,
  type BoardDialogState,
  type CanvasListItem,
  type CanvasMenuState,
  type Clipboard,
  type ControllerLike,
  type DataManagerLike,
  type ViewerInternals,
} from './appUtils'
import { useCanvasSave } from './useCanvasSave'
import { useCanvasViewport } from './useCanvasViewport'
import { useDirectorSession } from './useDirectorSession'
import { useMarkdownEditingSession } from './useMarkdownEditingSession'
import { CanvasEditorOverlay } from './CanvasEditorOverlay'
import { CanvasDirectorOverlay } from './CanvasDirectorOverlay'
import { MarkdownEditorOverlay } from './MarkdownEditorOverlay'
import { MarkdownFocusDialog } from './MarkdownFocusDialog'
import { PeleCreateDialog } from './PeleCreateDialog'
import { PreferencesDialog } from './PreferencesDialog'
import { blockStyleFromPreferences } from './preferences'
import { isBrowserFolderMode } from './browserFolderBackend'
import {
  createBoard,
  createFolder,
  deleteBoard,
  deleteFolder,
  loadWorkspace,
  readBoard,
  updateBoard,
  updateFolder,
} from './workspaceApi'
import {
  rememberRecentColor,
  updateUiState,
  useUiState,
} from './uiState'
import { InputDialog } from '../../shared/ui/InputDialog'
import {
  DEFAULT_BLOCK_SIZES,
  SHAPE_DEFAULT_SIZE,
  blockDefinition,
  blockEditor,
  blockKind,
  isActionableNode,
  isRatioLocked,
  isShapeNode,
} from './blocks'
import { distanceToEdge } from './edges'
import { CanvasEditorTools } from './CanvasEditorTools'
import { CanvasToolPalette } from './CanvasToolPalette'
import { CanvasStylePanel } from './CanvasStylePanel'
import { TOOL_SHORTCUTS, detectMediaKind, type EditorTool } from './tools'
import {
  collectBlocks,
  collectDescendants,
  hasSelectedAncestor,
  isInsideGroup,
  isLocked,
  nextFreeId,
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
  const keydownHandlerRef = useRef<(event: KeyboardEvent) => void>(() => {})
  const historyRef = useRef<{ past: CanvasDocument[]; future: CanvasDocument[] }>({
    past: [],
    future: [],
  })
  const historyMergeRef = useRef<{ key: string; at: number } | null>(null)
  const clipboardRef = useRef<Clipboard | null>(null)
  const pasteCountRef = useRef(0)
  const canvasRef = useRef<CanvasDocument | null>(null)
  const { applyCanvasUiSettings, captureViewport } = useCanvasViewport({
    canvas,
    selectedSlug,
    scope,
    viewerRef,
  })
  const { saveState, setSaveState, save, markDirty, savingRef } = useCanvasSave({
    canvas,
    items,
    selectedSlug,
    scope,
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
        historyRef.current = { past: [], future: [] }
        historyMergeRef.current = null
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

  function recordHistory(mergeKey?: string) {
    if (!canvas) return
    const now = Date.now()
    if (mergeKey) {
      const merged = historyMergeRef.current
      if (merged?.key === mergeKey && now - merged.at < HISTORY_MERGE_MS) {
        merged.at = now
        return
      }
      historyMergeRef.current = { key: mergeKey, at: now }
    } else {
      historyMergeRef.current = null
    }
    const history = historyRef.current
    history.past.push(structuredClone(canvas))
    if (history.past.length > HISTORY_LIMIT) history.past.shift()
    history.future.length = 0
  }

  function rememberBoardColor(color: string) {
    rememberRecentColor(color)
  }

  function applyDocument(next: CanvasDocument, selection: string[] = []) {
    captureViewport()
    setSelectedIds(selection)
    setCanvas(next)
    markDirty()
  }

  function viewportCenter(width: number, height: number) {
    try {
      const viewer = viewerRef.current?.viewer as ViewerInternals | undefined
      if (!viewer?.container) return { x: 0, y: 0 }
      const dm = viewer.container.get(internal.DataManager as never) as DataManagerLike
      const container = dm.data.container
      return {
        x: Math.round(
          (container.clientWidth / 2 - dm.data.offsetX) / dm.data.scale - width / 2,
        ),
        y: Math.round(
          (container.clientHeight / 2 - dm.data.offsetY) / dm.data.scale - height / 2,
        ),
      }
    } catch {
      return { x: 0, y: 0 }
    }
  }

  function nodeAtWorldPoint(x: number, y: number) {
    try {
      const viewer = viewerRef.current?.viewer as ViewerInternals | undefined
      if (!viewer?.container) return null
      const dm = viewer.container.get(internal.DataManager as never) as DataManagerLike
      const nodes = Object.values(dm.data.nodeMap).map((item) => item.ref)
      const map = nodeMapOf(nodes)
      for (let index = nodes.length - 1; index >= 0; index -= 1) {
        const root = selectableAncestor(nodes[index], map, focusedGroupId)
        if (isLocked(root, map) && !selectedIds.includes(root.id)) continue
        if (
          x >= root.x &&
          x <= root.x + root.width &&
          y >= root.y &&
          y <= root.y + root.height
        ) {
          return root
        }
      }
    } catch {
      // ignore
    }
    return null
  }

  function openMediaDialog(point?: { x: number; y: number }) {
    setMediaInsertPoint(point ?? null)
    setMediaDialogOpen(true)
  }

  function openCanvasMenu(event: ReactMouseEvent<HTMLDivElement>) {
    if (rightDragRef.current) {
      const distance = Math.hypot(
        event.clientX - rightDragRef.current.x,
        event.clientY - rightDragRef.current.y,
      )
      rightDragRef.current = null
      if (distance > 4) {
        event.preventDefault()
        event.stopPropagation()
        return
      }
    }
    if (!canvas || directorMode) return
    const target = event.target as HTMLElement
    if (
      target.closest(
        'button, input, textarea, select, .sb-style-panel, .sb-color-popover, .sb-color-trigger, .sb-modal-backdrop, .canvas-tool-palette, .canvas-tool-flyout, .sb-director-overlay, .sb-frame-controller, .JCV-controls, .JCV-minimap-container',
      )
    ) {
      return
    }
    try {
      const viewer = viewerRef.current?.viewer as ViewerInternals | undefined
      if (!viewer?.container) return
      const dm = viewer.container.get(internal.DataManager as never) as DataManagerLike
      const bounds = event.currentTarget.getBoundingClientRect()
      const worldX = (event.clientX - bounds.left - dm.data.offsetX) / dm.data.scale
      const worldY = (event.clientY - bounds.top - dm.data.offsetY) / dm.data.scale
      event.preventDefault()
      if (
        target.closest('.sb-editor-multi-selection') &&
        selectedIds.length > 1
      ) {
        const primary = canvas.nodes.find(
          (node) => node.id === selectedIds[0],
        )
        if (primary) {
          setCanvasMenu({
            x: event.clientX,
            y: event.clientY,
            worldX,
            worldY,
            nodeId: primary.id,
          })
          return
        }
      }
      const hit = nodeAtWorldPoint(worldX, worldY)
      let edgeId: string | null = null
      if (!hit) {
        const map = nodeMapOf(canvas.nodes)
        const tolerance = 10 / dm.data.scale
        for (const edge of canvas.edges) {
          if (distanceToEdge(edge, map, worldX, worldY) <= tolerance) {
            edgeId = edge.id
            break
          }
        }
      }
      if (hit) {
        if (!selectedIds.includes(hit.id)) setSelectedIds([hit.id])
        setSelectedEdgeId(null)
      } else if (edgeId) {
        setSelectedIds([])
        setSelectedEdgeId(edgeId)
      }
      setCanvasMenu({
        x: event.clientX,
        y: event.clientY,
        worldX,
        worldY,
        nodeId: hit?.id ?? null,
        edgeId,
      })
    } catch {
      // ignore
    }
  }

  function openQuickMenu(event: ReactMouseEvent<HTMLDivElement>) {
    if (!canvas || directorMode || tool !== 'select') return
    const target = event.target as HTMLElement
    if (
      target.closest(
        'button, input, textarea, select, .sb-style-panel, .sb-color-popover, .sb-color-trigger, .sb-modal-backdrop, .canvas-tool-palette, .canvas-tool-flyout, .sb-director-overlay, .sb-frame-controller, .JCV-controls, .JCV-minimap-container, .sb-editor-tool-surface, .sb-editor-text-input, .sb-editor-selection, .sb-editor-hitbox, .sb-block-actions, .JCV-overlay-container',
      )
    ) {
      return
    }
    try {
      const viewer = viewerRef.current?.viewer as ViewerInternals | undefined
      if (!viewer?.container) return
      const dm = viewer.container.get(internal.DataManager as never) as DataManagerLike
      const bounds = event.currentTarget.getBoundingClientRect()
      const worldX = (event.clientX - bounds.left - dm.data.offsetX) / dm.data.scale
      const worldY = (event.clientY - bounds.top - dm.data.offsetY) / dm.data.scale
      if (nodeAtWorldPoint(worldX, worldY)) return
      event.preventDefault()
      setSelectedIds([])
      setSelectedEdgeId(null)
      setCanvasMenu({
        x: event.clientX,
        y: event.clientY,
        worldX,
        worldY,
        nodeId: null,
        quick: true,
      })
    } catch {
      // ignore
    }
  }

  function openBlockEditor(id: string) {
    const document = canvasRef.current
    const node = document?.nodes.find((item) => item.id === id)
    const editor = node ? blockEditor(node) : null
    if (!editor) return
    if (editor === 'markdown') {
      closeTextEditing()
      openMarkdownEditor(id)
      return
    }
    if (editor === 'pele') {
      openPeleEditor(id)
      return
    }
    if (editor === 'schedule') {
      closeMarkdownEditor()
      setSelectedIds([id])
      setTool('select')
      return
    }
    closeMarkdownEditor()
    setSelectedIds([id])
    setTool('text')
    setEditRequest({ id, nonce: Date.now() })
  }

  function toggleBlockEdit(id: string) {
    const document = canvasRef.current
    const node = document?.nodes.find((item) => item.id === id)
    const editor = node ? blockEditor(node) : null
    if (!editor) return
    if (editor === 'markdown') {
      closeTextEditing()
      toggleMarkdownEdit(id)
      return
    }
    if (editor === 'schedule') {
      setSelectedIds([id])
      setTool('select')
      return
    }
    if (textEditingId === id) {
      closeTextEditing()
      return
    }
    openBlockEditor(id)
  }

  function closeTextEditing() {
    const active = document.activeElement as HTMLElement | null
    active?.blur()
  }

  function toggleRatioLock(id: string) {
    const document = canvasRef.current
    const node = document?.nodes.find((item) => item.id === id)
    if (!document || !node || !isActionableNode(node)) return
    recordHistory()
    const extension = ensureExtension(node)
    const wasLocked = isRatioLocked(node)
    extension.ratioLocked = !wasLocked
    if (wasLocked) extension.contentScale = 1
    markDirty()
    viewerRef.current?.viewer?.refresh?.()
  }

  function resetBlockSize(id: string) {
    const document = canvasRef.current
    const node = document?.nodes.find((item) => item.id === id)
    if (!document || !node) return
    const kind = blockKind(node)
    const target = kind
      ? DEFAULT_BLOCK_SIZES[kind]
      : isShapeNode(node)
        ? SHAPE_DEFAULT_SIZE
        : null
    if (!target) return
    if (
      node.width === target.width &&
      node.height === target.height &&
      (node['x-superboard']?.contentScale ?? 1) === 1
    ) {
      return
    }
    recordHistory()
    captureViewport()
    const next: CanvasDocument = {
      ...document,
      nodes: document.nodes.map((item) =>
        item.id === id
          ? {
              ...item,
              x: item.x + (item.width - target.width) / 2,
              y: item.y + (item.height - target.height) / 2,
              width: target.width,
              height: target.height,
              'x-superboard': {
                ...ensureExtension(item),
                contentScale: 1,
              },
            }
          : item,
      ),
    }
    setSelectedIds([id])
    setCanvas(next)
    markDirty()
  }

  function handleMarkdownCommit(id: string, value: string) {
    const document = canvasRef.current
    const node = document?.nodes.find((item) => item.id === id)
    if (!document || !node || node.type !== 'text') return
    captureViewport()
    setCanvas({
      ...document,
      nodes: document.nodes.map((item) =>
        item.id === id && item.type === 'text' ? { ...item, text: value } : item,
      ),
    })
    markDirty()
  }

  function defaultBlockSize(kind: keyof typeof DEFAULT_BLOCK_SIZES) {
    const settings = canvasRef.current?.['x-superboard']?.settings
    const base = DEFAULT_BLOCK_SIZES[kind]
    return {
      width: settings?.defaultBlockWidth ?? base.width,
      height: settings?.defaultBlockHeight ?? base.height,
    }
  }

  function insertTextBlock(
    kind: 'text' | 'markdown' | 'pele',
    point?: { x: number; y: number },
  ) {
    if (!canvas) return
    const size = defaultBlockSize(kind)
    const position = point
      ? {
          x: Math.round(point.x - size.width / 2),
          y: Math.round(point.y - size.height / 2),
        }
      : viewportCenter(size.width, size.height)
    if (kind === 'text') {
      setTool('text')
      setTextCreateRequest({ x: position.x, y: position.y, nonce: Date.now() })
      return
    }
    const id = nextFreeId(new Set(canvas.nodes.map((node) => node.id)), kind)
    const code = 'flowchart LR\n    A[开始] --> B[结束]'
    const node: CanvasNode =
      kind === 'markdown'
        ? {
            id,
            type: 'text',
            x: position.x,
            y: position.y,
            width: size.width,
            height: size.height,
            text: '# 新 Markdown\n\n在这里输入内容。',
            'x-superboard': {
              kind: 'markdown',
              markdownLocked: false,
              style: blockStyleFromPreferences(),
            },
          }
        : {
            id,
            type: 'text',
            x: position.x,
            y: position.y,
            width: size.width,
            height: size.height,
            text: `\`\`\`mermaid\n${code}\n\`\`\``,
            'x-superboard': {
              kind: 'pele',
              diagram: 'flowchart',
              code,
              style: blockStyleFromPreferences(),
            },
          }
    recordHistory()
    applyDocument({ ...canvas, nodes: [...canvas.nodes, node] }, [id])
    if (kind === 'markdown') {
      setTool('select')
      startMarkdownEditing(id)
      return
    }
    setTool('text')
    setEditRequest({ id, nonce: Date.now() })
  }

  function openPeleDialog(point?: { x: number; y: number }) {
    setPeleDialog({ mode: 'create', point })
  }

  function openPeleEditor(id: string) {
    const node = canvasRef.current?.nodes.find((item) => item.id === id)
    if (node?.['x-superboard']?.kind !== 'pele') return
    closeTextEditing()
    closeMarkdownEditor()
    setSelectedIds([id])
    setTool('select')
    setPeleDialog({ mode: 'edit', nodeId: id })
  }

  function insertPele({ code, diagram }: { code: string; diagram: string }) {
    if (!canvas || !peleDialog) return
    const text = `\`\`\`mermaid\n${code}\n\`\`\``
    if (peleDialog.mode === 'edit') {
      const target = canvas.nodes.find((node) => node.id === peleDialog.nodeId)
      if (!target) return
      recordHistory()
      applyDocument(
        {
          ...canvas,
          nodes: canvas.nodes.map((node) =>
            node.id === target.id
              ? {
                  ...node,
                  text,
                  'x-superboard': {
                    ...ensureExtension(node),
                    kind: 'pele',
                    code,
                    diagram,
                  },
                }
              : node,
          ),
        },
        [target.id],
      )
      setPeleDialog(null)
      return
    }
    const id = nextFreeId(new Set(canvas.nodes.map((node) => node.id)), 'pele')
    const offset = (canvas.nodes.length % 6) * 24
    const size = defaultBlockSize('pele')
    const position = peleDialog.point
      ? {
          x: Math.round(peleDialog.point.x - size.width / 2),
          y: Math.round(peleDialog.point.y - size.height / 2),
        }
      : (() => {
          const center = viewportCenter(size.width, size.height)
          return { x: center.x + offset, y: center.y + offset }
        })()
    const node: CanvasNode = {
      id,
      type: 'text',
      x: position.x,
      y: position.y,
      width: size.width,
      height: size.height,
      text,
      'x-superboard': {
        kind: 'pele',
        diagram,
        code,
        style: blockStyleFromPreferences(),
      },
    }
    recordHistory()
    applyDocument({ ...canvas, nodes: [...canvas.nodes, node] }, [id])
    setTool('select')
    setPeleDialog(null)
  }

  function insertScheduleBlock(point?: { x: number; y: number }) {
    if (!canvas) return
    const id = nextFreeId(new Set(canvas.nodes.map((node) => node.id)), 'schedule')
    const size = defaultBlockSize('schedule')
    const position = point
      ? {
          x: Math.round(point.x - size.width / 2),
          y: Math.round(point.y - size.height / 2),
        }
      : viewportCenter(size.width, size.height)
    const node: CanvasNode = {
      id,
      type: 'text',
      x: position.x,
      y: position.y,
      width: size.width,
      height: size.height,
      text: '',
      'x-superboard': {
        kind: 'schedule',
        scheduleEvents: [],
        style: blockStyleFromPreferences(),
      },
    }
    recordHistory()
    applyDocument({ ...canvas, nodes: [...canvas.nodes, node] }, [id])
    setTool('select')
  }

  function insertMedia(value = mediaUrl) {
    if (!canvas) return
    const url = normalizeMediaUrl(value)
    if (!url) return
    const id = nextFreeId(new Set(canvas.nodes.map((node) => node.id)), 'media')
    const size = defaultBlockSize('media')
    const position = mediaInsertPoint
      ? {
          x: Math.round(mediaInsertPoint.x - size.width / 2),
          y: Math.round(mediaInsertPoint.y - size.height / 2),
        }
      : viewportCenter(size.width, size.height)
    const node: CanvasNode = {
      id,
      type: 'link',
      url,
      x: position.x,
      y: position.y,
      width: size.width,
      height: size.height,
      'x-superboard': {
        kind: 'media',
        media: { kind: detectMediaKind(url), url },
        style: blockStyleFromPreferences(),
      },
    }
    recordHistory()
    applyDocument({ ...canvas, nodes: [...canvas.nodes, node] }, [id])
    setMediaDialogOpen(false)
    setMediaUrl('')
    setMediaInsertPoint(null)
  }

  function undo() {
    if (!canvas) return
    historyMergeRef.current = null
    const history = historyRef.current
    const previous = history.past.pop()
    if (!previous) return
    history.future.push(structuredClone(canvas))
    applyDocument(previous)
  }

  function redo() {
    if (!canvas) return
    historyMergeRef.current = null
    const history = historyRef.current
    const next = history.future.pop()
    if (!next) return
    history.past.push(structuredClone(canvas))
    applyDocument(next)
  }

  function copySelection() {
    if (!canvas || selectedIds.length === 0) return
    const ids = new Set(selectedIds)
    const copied = new Map<string, CanvasNode>()
    for (const node of canvas.nodes) {
      if (!ids.has(node.id)) continue
      copied.set(node.id, node)
      for (const child of collectDescendants(node, canvas.nodes)) {
        copied.set(child.id, child)
      }
    }
    clipboardRef.current = {
      nodes: [...copied.values()].map((node) => structuredClone(node)),
      edges: canvas.edges
        .filter((edge) => copied.has(edge.fromNode) && copied.has(edge.toNode))
        .map((edge) => structuredClone(edge)),
    }
    pasteCountRef.current = 0
  }

  function pasteClipboard() {
    if (!canvas || !clipboardRef.current) return
    const clipboard = clipboardRef.current
    recordHistory()
    pasteCountRef.current += 1
    const offset = PASTE_OFFSET * pasteCountRef.current
    const existing = new Set<string>([
      ...canvas.nodes.map((node) => node.id),
      ...canvas.edges.map((edge) => edge.id),
    ])
    const idMap = new Map<string, string>()
    const nodes = clipboard.nodes.map((node) => {
      const clone = structuredClone(node)
      clone.id = nextId(existing, node.id)
      clone.x = node.x + offset
      clone.y = node.y + offset
      idMap.set(node.id, clone.id)
      return clone
    })
    for (const node of nodes) {
      const extension = node['x-superboard']
      if (!extension?.groupId) continue
      const mapped = idMap.get(extension.groupId)
      if (mapped) extension.groupId = mapped
      else delete extension.groupId
    }
    const edges = clipboard.edges.map((edge) => {
      const clone = structuredClone(edge)
      clone.id = nextId(existing, edge.id)
      clone.fromNode = idMap.get(edge.fromNode) ?? edge.fromNode
      clone.toNode = idMap.get(edge.toNode) ?? edge.toNode
      return clone
    })
    applyDocument({
      ...canvas,
      nodes: [...canvas.nodes, ...nodes],
      edges: [...canvas.edges, ...edges],
    })
    const clonedIds = new Set(nodes.map((node) => node.id))
    const roots = nodes.filter((node) => {
      const groupId = node['x-superboard']?.groupId
      return !groupId || !clonedIds.has(groupId)
    })
    if (roots.length > 0) setSelectedIds(roots.map((node) => node.id))
  }

  function duplicateSelection() {
    if (!canvas || selectedIds.length === 0) return
    const selected = new Set(selectedIds)
    const copied = new Map<string, CanvasNode>()
    for (const node of canvas.nodes) {
      if (!selected.has(node.id)) continue
      copied.set(node.id, node)
      for (const child of collectDescendants(node, canvas.nodes)) {
        copied.set(child.id, child)
      }
    }
    if (copied.size === 0) return
    recordHistory()
    const offset = 24
    const existing = new Set<string>([
      ...canvas.nodes.map((node) => node.id),
      ...canvas.edges.map((edge) => edge.id),
    ])
    const idMap = new Map<string, string>()
    const nodes = [...copied.values()].map((node) => {
      const clone = structuredClone(node)
      clone.id = nextId(existing, node.id)
      clone.x = node.x + offset
      clone.y = node.y + offset
      idMap.set(node.id, clone.id)
      return clone
    })
    for (const node of nodes) {
      const extension = node['x-superboard']
      if (!extension?.groupId) continue
      const mapped = idMap.get(extension.groupId)
      if (mapped) extension.groupId = mapped
      else delete extension.groupId
    }
    const edges = canvas.edges
      .filter((edge) => copied.has(edge.fromNode) && copied.has(edge.toNode))
      .map((edge) => {
        const clone = structuredClone(edge)
        clone.id = nextId(existing, edge.id)
        clone.fromNode = idMap.get(edge.fromNode) ?? edge.fromNode
        clone.toNode = idMap.get(edge.toNode) ?? edge.toNode
        return clone
      })
    applyDocument({
      ...canvas,
      nodes: [...canvas.nodes, ...nodes],
      edges: [...canvas.edges, ...edges],
    })
    const clonedIds = new Set(nodes.map((node) => node.id))
    const roots = nodes.filter((node) => {
      const groupId = node['x-superboard']?.groupId
      return !groupId || !clonedIds.has(groupId)
    })
    if (roots.length > 0) setSelectedIds(roots.map((node) => node.id))
  }

  function deleteSelection(
    ids: string[] = selectedIds,
    edgeId: string | null = selectedEdgeId,
  ) {
    if (!canvas) return
    if (edgeId) {
      recordHistory()
      applyDocument({
        ...canvas,
        edges: canvas.edges.filter((edge) => edge.id !== edgeId),
      })
      setSelectedEdgeId(null)
      return
    }
    if (ids.length === 0) return
    const map = nodeMapOf(canvas.nodes)
    const selected = new Set(ids)
    const deleted = new Set<string>()
    for (const node of canvas.nodes) {
      if (!selected.has(node.id) || isLocked(node, map)) continue
      deleted.add(node.id)
      for (const child of collectDescendants(node, canvas.nodes)) deleted.add(child.id)
    }
    if (deleted.size === 0) return
    recordHistory()
    const nodes = canvas.nodes.filter((node) => !deleted.has(node.id))
    for (const node of nodes) {
      const groupId = node['x-superboard']?.groupId
      if (groupId && deleted.has(groupId)) delete node['x-superboard']?.groupId
    }
    applyDocument({
      ...canvas,
      nodes,
      edges: canvas.edges.filter(
        (edge) => !deleted.has(edge.fromNode) && !deleted.has(edge.toNode),
      ),
    })
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

  function groupSelection() {
    if (!canvas) return
    const map = nodeMapOf(canvas.nodes)
    const selected = new Set(selectedIds)
    const roots = canvas.nodes.filter(
      (node) =>
        selected.has(node.id) &&
        !hasSelectedAncestor(node, map, selected) &&
        !isLocked(node, map),
    )
    if (roots.length < 2) return
    recordHistory()
    const existing = new Set(canvas.nodes.map((node) => node.id))
    const groupId = nextFreeId(existing, 'group')
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    for (const node of roots) {
      minX = Math.min(minX, node.x)
      minY = Math.min(minY, node.y)
      maxX = Math.max(maxX, node.x + node.width)
      maxY = Math.max(maxY, node.y + node.height)
    }
    const groupNode: CanvasNode = {
      id: groupId,
      type: 'group',
      x: minX,
      y: minY,
      width: Math.max(1, maxX - minX),
      height: Math.max(1, maxY - minY),
      'x-superboard': { kind: 'group' },
    }
    for (const node of roots) ensureExtension(node).groupId = groupId
    const minimumIndex = Math.min(...roots.map((node) => canvas.nodes.indexOf(node)))
    const nodes = [...canvas.nodes]
    nodes.splice(minimumIndex, 0, groupNode)
    applyDocument({ ...canvas, nodes })
    setSelectedIds([groupId])
  }

  function ungroupSelection() {
    if (!canvas) return
    const map = nodeMapOf(canvas.nodes)
    const selected = new Set(selectedIds)
    const groups = canvas.nodes.filter(
      (node) =>
        selected.has(node.id) &&
        node['x-superboard']?.kind === 'group' &&
        !isLocked(node, map),
    )
    if (groups.length === 0) return
    recordHistory()
    const groupIds = new Set(groups.map((node) => node.id))
    const released = new Set<string>()
    for (const node of canvas.nodes) {
      const groupId = node['x-superboard']?.groupId
      if (!groupId || !groupIds.has(groupId)) continue
      delete node['x-superboard']?.groupId
      released.add(node.id)
    }
    applyDocument({
      ...canvas,
      nodes: canvas.nodes.filter((node) => !groupIds.has(node.id)),
      edges: canvas.edges.filter(
        (edge) => !groupIds.has(edge.fromNode) && !groupIds.has(edge.toNode),
      ),
    })
    const remaining = selectedIds.filter((id) => !groupIds.has(id))
    setSelectedIds([...new Set([...remaining, ...released])])
  }

  function enterGroup() {
    if (!canvas || selectedIds.length !== 1) return
    const map = nodeMapOf(canvas.nodes)
    const node = map.get(selectedIds[0])
    if (!node || node['x-superboard']?.kind !== 'group' || isLocked(node, map)) return
    const children = canvas.nodes.filter(
      (item) =>
        item['x-superboard']?.groupId === node.id && !isLocked(item, map),
    )
    setFocusedGroupId(node.id)
    setSelectedEdgeId(null)
    setSelectedIds(children.map((item) => item.id))
  }

  function toggleGroup() {
    if (canvas && selectedIds.length === 1) {
      const node = canvas.nodes.find((item) => item.id === selectedIds[0])
      if (node?.['x-superboard']?.kind === 'group') {
        ungroupSelection()
        return
      }
    }
    groupSelection()
  }

  function toggleLockSelection() {
    if (!canvas || selectedIds.length === 0) return
    const selected = new Set(selectedIds)
    const targets = canvas.nodes.filter((node) => selected.has(node.id))
    if (targets.length === 0) return
    const allLocked = targets.every((node) => node['x-superboard']?.locked)
    recordHistory()
    for (const node of targets) {
      const extension = ensureExtension(node)
      if (allLocked) delete extension.locked
      else extension.locked = true
    }
    markDirty()
    setSelectedIds([...selectedIds])
  }

  function unlockAllLocked() {
    if (!canvas) return
    const locked = canvas.nodes.filter((node) => node['x-superboard']?.locked)
    if (locked.length === 0) return
    recordHistory()
    for (const node of locked) delete node['x-superboard']?.locked
    markDirty()
    setSelectedIds([])
  }

  function reorderSelection(mode: 'front' | 'back' | 'forward' | 'backward') {
    if (!canvas || selectedIds.length === 0) return
    const blocks = collectBlocks(canvas.nodes)
    const selected = new Set(selectedIds)
    const isSelected = (block: (typeof blocks)[number]) =>
      block.nodes.some((node) => selected.has(node.id))
    const before = blocks.map((block) => block.root.id).join('|')
    let ordered = [...blocks]
    if (mode === 'front' || mode === 'back') {
      const chosen = ordered.filter(isSelected)
      if (chosen.length === 0) return
      const rest = ordered.filter((block) => !isSelected(block))
      ordered = mode === 'front' ? [...rest, ...chosen] : [...chosen, ...rest]
    } else if (mode === 'forward') {
      for (let index = ordered.length - 2; index >= 0; index -= 1) {
        if (isSelected(ordered[index]) && !isSelected(ordered[index + 1])) {
          const temp = ordered[index]
          ordered[index] = ordered[index + 1]
          ordered[index + 1] = temp
        }
      }
    } else {
      for (let index = 1; index < ordered.length; index += 1) {
        if (isSelected(ordered[index]) && !isSelected(ordered[index - 1])) {
          const temp = ordered[index]
          ordered[index] = ordered[index - 1]
          ordered[index - 1] = temp
        }
      }
    }
    const after = ordered.map((block) => block.root.id).join('|')
    if (before === after) return
    recordHistory()
    applyDocument({ ...canvas, nodes: ordered.flatMap((block) => block.nodes) })
    setSelectedIds(selectedIds)
  }

  function selectAllUnlocked() {
    if (!canvas) return
    const map = nodeMapOf(canvas.nodes)
    const ids = canvas.nodes
      .filter((node) => {
        const groupId = node['x-superboard']?.groupId
        if (groupId && map.has(groupId)) return false
        return !isLocked(node, map)
      })
      .map((node) => node.id)
    setSelectedIds(ids)
  }

  function handleKeyDown(event: KeyboardEvent) {
    const target = event.target as HTMLElement | null
    if (target?.closest('input, textarea, select, [contenteditable="true"]')) return
    if (event.key === 'Escape' && presentation) {
      event.preventDefault()
      exitPresentation()
      return
    }
    const mod = event.ctrlKey || event.metaKey
    const key = event.key.toLowerCase()
    if (mod && key === 's') {
      event.preventDefault()
      void save()
      return
    }
    if (mod && key === 'z') {
      event.preventDefault()
      if (event.shiftKey) redo()
      else undo()
      return
    }
    if (mod && key === 'y') {
      event.preventDefault()
      redo()
      return
    }
    if (mod && key === 'c') {
      copySelection()
      return
    }
    if (mod && key === 'v') {
      event.preventDefault()
      pasteClipboard()
      return
    }
    if (mod && key === 'd') {
      event.preventDefault()
      duplicateSelection()
      return
    }
    if (mod && key === 'x') {
      event.preventDefault()
      copySelection()
      deleteSelection()
      return
    }
    if (mod && key === 'a') {
      event.preventDefault()
      selectAllUnlocked()
      return
    }
    if (mod && key === 'g') {
      event.preventDefault()
      if (event.shiftKey) ungroupSelection()
      else toggleGroup()
      return
    }
    if (!mod && event.shiftKey && key === 'l') {
      event.preventDefault()
      toggleLockSelection()
      return
    }
    if (!mod && !event.altKey && !event.shiftKey) {
      const nextTool = TOOL_SHORTCUTS[key]
      if (nextTool) {
        event.preventDefault()
        setTool(nextTool)
        return
      }
    }
    if (!mod && event.key === ']') {
      event.preventDefault()
      reorderSelection(event.altKey ? 'forward' : 'front')
      return
    }
    if (!mod && event.key === '[') {
      event.preventDefault()
      reorderSelection(event.altKey ? 'backward' : 'back')
      return
    }
    if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault()
      deleteSelection()
      return
    }
    if (event.key === 'Enter' && !mod && !event.shiftKey) {
      if (target?.closest('button, a')) return
      event.preventDefault()
      enterGroup()
      return
    }
    if (event.key === 'Escape' && focusedGroupId) {
      event.preventDefault()
      const group = canvas?.nodes.find((node) => node.id === focusedGroupId)
      setSelectedIds([focusedGroupId])
      setSelectedEdgeId(null)
      setFocusedGroupId(group?.['x-superboard']?.groupId ?? null)
      return
    }
    if (event.key === 'Escape') {
      setSelectedIds([])
      setSelectedEdgeId(null)
      setTool('select')
    }
  }
  keydownHandlerRef.current = handleKeyDown

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => keydownHandlerRef.current(event)
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

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

  async function fetchCanvasDocument(item: CanvasListItem) {
    return readBoard(item)
  }

  function activateCanvas(item: CanvasListItem, next: CanvasDocument) {
    historyRef.current = { past: [], future: [] }
    historyMergeRef.current = null
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

  async function handleCreate(values: BoardFormValues) {
    if (saveState !== 'saved') {
      const ok = await save()
      if (!ok) throw new Error('当前白板保存失败，无法新建')
    }
    const data = await createBoard({
      title: values.title,
      slug: values.slug,
      folder: values.folder || undefined,
      scope,
    })
    const list = await refreshItems()
    const item = list.find(
      (entry) => entry.slug === data.canvas['x-superboard']!.meta.slug && entry.scope === scope,
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
      if (!ok) throw new Error('当前白板保存失败，无法重命名')
    }
    const data = await updateBoard(
      { ...target, scope: target.scope ?? scope },
      {
        title: values.title,
        slug: values.slug,
        folder: values.folder,
      },
    )
    await refreshItems()
    expandPath(data.path)
    if (isCurrent) {
      setCanvas(data.canvas)
      setSelectedSlug(data.canvas['x-superboard']!.meta.slug)
      updateEditorUrl(data.canvas['x-superboard']!.meta.slug, scope, treeMode)
    }
  }

  async function handleDelete(slug: string) {
    if (savingRef.current) throw new Error('正在保存，请稍后再删除')
    const item = items.find(
      (entry) => entry.slug === slug && entry.scope === scope,
    )
    if (!item) return
    const isCurrent = slug === selectedSlug
    if (isCurrent) setSaveState('saved')
    await deleteBoard(item)
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
    await refreshItems()
    if (parent) expandPath(parent)
    setNewFolderParent(null)
  }

  async function handleRenameFolder(name: string, parent: string) {
    if (!folderDialog) return
    if (saveState !== 'saved') {
      const ok = await save()
      if (!ok) throw new Error('当前白板保存失败，无法重命名文件夹')
    }
    const data = await updateFolder({
      path: folderDialog.path,
      scope,
      name,
      parent,
    })
    await refreshItems()
    renameExpandedPath(folderDialog.path, data.path)
  }

  async function handleDeleteFolder(path: string) {
    if (saveState !== 'saved') {
      const ok = await save()
      if (!ok) throw new Error('当前白板保存失败，无法删除文件夹')
    }
    const currentPath = activeItem?.path
    const currentInside = Boolean(
      currentPath &&
        (currentPath === path || currentPath.startsWith(`${path}/`)),
    )
    await deleteFolder(path, scope)
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
  const activeItem = items.find(
    (entry) => entry.slug === selectedSlug && entry.scope === scope,
  )
  const railSaveLabel =
    saveState === 'error'
      ? '保存失败'
      : saveState === 'dirty'
        ? '点击保存'
        : saveState === 'saving'
          ? '保存中…'
          : '已保存'
  const menuNode = canvasMenu?.nodeId ? nodeMap.get(canvasMenu.nodeId) ?? null : null
  const menuDefinition = menuNode ? blockDefinition(menuNode) : null
  const menuEditable = Boolean(
    menuDefinition &&
      menuDefinition.editor !== 'schedule' &&
      !isLocked(menuNode!, nodeMap),
  )

  return (
    <div
      className={`sb-app sb-app-editor${directorMode ? ' is-director-mode' : ''}${presentation ? ' is-presenting' : ''}`}
    >
      <EditorRail
        mode="edit"
        treeMode={treeMode}
        treeOpen={treeOpen}
        sidebarLabel={treeMode && treeOpen ? '收起目录' : '展开目录'}
        onToggleTree={toggleTree}
        scopeLabel={scope === 'public' ? '切换到私有白板' : '切换到公开白板'}
        onSwitchScope={() => void switchScope(scope === 'public' ? 'private' : 'public')}
        saveLabel={railSaveLabel}
        saveState={saveState}
        canSave={Boolean(canvas) && saveState !== 'saving'}
        onSave={() => void save()}
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
      />

      <div className="sb-workspace">
        {treeMode ? (
          <BoardTreePanel
            nodes={treeNodes}
            title={`SuperBoard-${scope}`}
            collapsed={!treeOpen}
            selectedSlug={selectedSlug}
            expanded={expanded}
            onToggle={toggleFolder}
            onSelect={(slug) => {
              void openBoard(slug, scope)
              if (window.matchMedia('(max-width: 860px)').matches) setTreeOpen(false)
            }}
            onContextMenu={(event, target) => openContextMenu(event, target)}
            onRootContextMenu={openRootContextMenu}
            emptyLabel="还没有白板，在空白处右键新建"
          />
        ) : null}

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
      </div>

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

      {canvasMenu ? (
        <div
          className="sb-canvas-context-menu"
          style={{
            left: Math.max(8, Math.min(canvasMenu.x, window.innerWidth - 200)),
            top: Math.max(8, Math.min(canvasMenu.y, window.innerHeight - 340)),
          }}
          onPointerDown={(event) => event.stopPropagation()}
          onContextMenu={(event) => event.preventDefault()}
        >
          {canvasMenu.edgeId ? (
            <>
              <button
                type="button"
                onClick={() => {
                  deleteSelection()
                  setCanvasMenu(null)
                }}
              >
                删除箭头
              </button>
              <div className="sb-canvas-menu-sep" />
            </>
          ) : null}
          {menuNode ? (
            <>
              {menuEditable && selectedIds.length === 1 ? (
                <button
                  type="button"
                  onClick={() => {
                    openBlockEditor(menuNode.id)
                    setCanvasMenu(null)
                  }}
                >
                  编辑内容
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => {
                  duplicateSelection()
                  setCanvasMenu(null)
                }}
              >
                生成副本
              </button>
              <button
                type="button"
                onClick={() => {
                  deleteSelection()
                  setCanvasMenu(null)
                }}
              >
                删除
              </button>
              <button
                type="button"
                disabled={!canGroup && !canUngroup}
                onClick={() => {
                  toggleGroup()
                  setCanvasMenu(null)
                }}
              >
                {canUngroup ? '解组' : '编组'}
              </button>
              <button
                type="button"
                onClick={() => {
                  toggleLockSelection()
                  setCanvasMenu(null)
                }}
              >
                {allSelectedLocked ? '解锁' : '锁定'}
              </button>
              <button
                type="button"
                onClick={() => {
                  reorderSelection('front')
                  setCanvasMenu(null)
                }}
              >
                移至最前
              </button>
              <button
                type="button"
                onClick={() => {
                  reorderSelection('back')
                  setCanvasMenu(null)
                }}
              >
                移至最后
              </button>
              <button
                type="button"
                onClick={() => {
                  reorderSelection('forward')
                  setCanvasMenu(null)
                }}
              >
                向前一层
              </button>
              <button
                type="button"
                onClick={() => {
                  reorderSelection('backward')
                  setCanvasMenu(null)
                }}
              >
                向后一层
              </button>
              <div className="sb-canvas-menu-sep" />
            </>
          ) : null}
          {!menuNode ? (
            <>
              <button
                type="button"
                onClick={() => {
                  insertTextBlock('text', {
                    x: canvasMenu.worldX,
                    y: canvasMenu.worldY,
                  })
                  setCanvasMenu(null)
                }}
              >
                输入文本
              </button>
              <button
                type="button"
                onClick={() => {
                  insertTextBlock('markdown', {
                    x: canvasMenu.worldX,
                    y: canvasMenu.worldY,
                  })
                  setCanvasMenu(null)
                }}
              >
                创建 Markdown 块
              </button>
              <button
                type="button"
                onClick={() => {
                  openPeleDialog({
                    x: canvasMenu.worldX,
                    y: canvasMenu.worldY,
                  })
                  setCanvasMenu(null)
                }}
              >
                创建图表
              </button>
              <button
                type="button"
                onClick={() => {
                  insertScheduleBlock({
                    x: canvasMenu.worldX,
                    y: canvasMenu.worldY,
                  })
                  setCanvasMenu(null)
                }}
              >
                创建日程表
              </button>
              {!canvasMenu.quick ? (
                <button
                  type="button"
                  onClick={() => {
                    openMediaDialog({ x: canvasMenu.worldX, y: canvasMenu.worldY })
                    setCanvasMenu(null)
                  }}
                >
                  插入媒体
                </button>
              ) : null}
            </>
          ) : null}
          {!canvasMenu.quick ? (
            <>
              <button
                type="button"
                style={{ display: selectedIds.length > 0 ? 'none' : undefined }}
                onClick={() => {
                  selectAllUnlocked()
                  setCanvasMenu(null)
                }}
              >
                全选
              </button>
              {hasLocked ? (
                <button
                  type="button"
                  onClick={() => {
                    unlockAllLocked()
                    setCanvasMenu(null)
                  }}
                >
                  解锁全部
                </button>
              ) : null}
            </>
          ) : null}
        </div>
      ) : null}

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
          onClose={() => setPeleDialog(null)}
          onSave={insertPele}
        />
      ) : null}

      {mediaDialogOpen ? (
        <InputDialog
          title="插入媒体"
          description="支持图片、视频链接，以及其他可嵌入的 iframe 地址。"
          initialValue={mediaUrl}
          placeholder="https://..."
          confirmText="插入"
          onConfirm={(value) => insertMedia(value)}
          onClose={() => {
            setMediaDialogOpen(false)
            setMediaInsertPoint(null)
          }}
        />
      ) : null}

      {preferencesOpen ? (
        <PreferencesDialog
          onClose={() => {
            setPreferencesOpen(false)
            viewerRef.current?.viewer?.refresh?.()
          }}
        />
      ) : null}

      {contextMenu ? (
        <BoardContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          target={contextMenu.target}
          onClose={() => setContextMenu(null)}
          onCreate={(folder) => setBoardDialog({ mode: 'create', folder })}
          onCreateFolder={(folder) => setNewFolderParent(folder)}
          onRename={(node) => setBoardDialog({ mode: 'rename', board: node })}
          onRenameFolder={(folder) => setFolderDialog(folder)}
          onDelete={(node) => setPendingDelete(node)}
          onDeleteFolder={(folder) => setPendingDeleteFolder(folder)}
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
          onClose={() => setBoardDialog(null)}
          onSubmit={boardDialog.mode === 'create' ? handleCreate : handleRename}
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
          onClose={() => setFolderDialog(null)}
          onSubmit={handleRenameFolder}
        />
      ) : null}

      {newFolderParent !== null ? (
        <InputDialog
          title="新建文件夹"
          description={
            newFolderParent
              ? `将创建在 ${newFolderParent} 下`
              : '将创建在根目录'
          }
          placeholder="文件夹名称"
          confirmText="创建"
          onConfirm={(value) => void handleCreateFolder(value)}
          onClose={() => setNewFolderParent(null)}
        />
      ) : null}

      {pendingDelete ? (
        <DeleteBoardDialog
          board={pendingDelete}
          onClose={() => setPendingDelete(null)}
          onConfirm={handleDelete}
        />
      ) : null}

      {pendingDeleteFolder ? (
        <DeleteFolderDialog
          folder={pendingDeleteFolder}
          scope={scope}
          onClose={() => setPendingDeleteFolder(null)}
          onConfirm={handleDeleteFolder}
        />
      ) : null}

      {deployDialogOpen ? (
        <DeployDialog
          onClose={() => setDeployDialogOpen(false)}
          onConfirm={() => {
            setDeployDialogOpen(false)
            void fetch('/__deploy', { method: 'POST' }).catch(() => {})
          }}
        />
      ) : null}
    </div>
  )
}

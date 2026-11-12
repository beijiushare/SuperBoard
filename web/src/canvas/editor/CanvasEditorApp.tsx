import { useCallback, useEffect, useRef, useState } from 'react'
import { internal } from '../../vendor/json-canvas-viewer/src/index.ts'
import {
  parseCanvas,
  type CanvasDocument,
  type CanvasEdge,
  type CanvasNode,
} from '../model'
import { CanvasViewer, type CanvasViewerHandle } from '../viewer/CanvasViewer'
import { CanvasEditorOverlay } from './CanvasEditorOverlay'
import { CanvasEditorTools } from './CanvasEditorTools'
import { CanvasStylePanel } from './CanvasStylePanel'
import { downloadCanvasPng, downloadCanvasSvg } from './export'
import { TOOL_SHORTCUTS, TOOLS, detectMediaKind, type EditorTool } from './tools'
import {
  collectBlocks,
  collectDescendants,
  hasSelectedAncestor,
  isLocked,
  nextFreeId,
  nodeMapOf,
  topAncestor,
} from './hierarchy'

interface CanvasListItem {
  slug: string
  title: string
  scope: 'public' | 'private'
  path: string
  updatedAt?: string
}

interface Viewport {
  offsetX: number
  offsetY: number
  scale: number
}

interface Clipboard {
  nodes: CanvasNode[]
  edges: CanvasEdge[]
}

type ViewerInternals = {
  container?: { get: (key: unknown) => unknown }
}

type DataManagerLike = {
  data: Viewport & { container: HTMLDivElement }
}

type ControllerLike = {
  refresh: () => void
}

const HISTORY_LIMIT = 100
const PASTE_OFFSET = 24
const AUTOSAVE_DELAY = 1200

type SaveState = 'saved' | 'dirty' | 'saving' | 'error'

function readViewport(handle: CanvasViewerHandle | null): Viewport | null {
  try {
    const viewer = handle?.viewer as ViewerInternals | undefined
    if (!viewer?.container) return null
    const dm = viewer.container.get(internal.DataManager as never) as DataManagerLike
    return { offsetX: dm.data.offsetX, offsetY: dm.data.offsetY, scale: dm.data.scale }
  } catch {
    return null
  }
}

function writeViewport(handle: CanvasViewerHandle | null, viewport: Viewport) {
  try {
    const viewer = handle?.viewer as ViewerInternals | undefined
    if (!viewer?.container) return
    const dm = viewer.container.get(internal.DataManager as never) as DataManagerLike
    const controller = viewer.container.get(internal.Controller as never) as ControllerLike
    dm.data.offsetX = viewport.offsetX
    dm.data.offsetY = viewport.offsetY
    dm.data.scale = viewport.scale
    controller.refresh()
  } catch {
    // 查看器尚未挂载，忽略
  }
}

function nextId(existing: Set<string>, base: string) {
  let id = `${base}-copy`
  let index = 1
  while (existing.has(id)) {
    index += 1
    id = `${base}-copy-${index}`
  }
  existing.add(id)
  return id
}

export function CanvasEditorApp() {
  const [items, setItems] = useState<CanvasListItem[]>([])
  const [selectedSlug, setSelectedSlug] = useState('')
  const [canvas, setCanvas] = useState<CanvasDocument | null>(null)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [tool, setTool] = useState<EditorTool>('select')
  const [editRequest, setEditRequest] = useState<{ id: string; nonce: number } | null>(null)
  const [mediaDialogOpen, setMediaDialogOpen] = useState(false)
  const [mediaUrl, setMediaUrl] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saveState, setSaveState] = useState<SaveState>('saved')
  const [historyState, setHistoryState] = useState({ canUndo: false, canRedo: false })
  const viewerRef = useRef<CanvasViewerHandle>(null)
  const shiftRef = useRef(false)
  const historyRef = useRef<{ past: CanvasDocument[]; future: CanvasDocument[] }>({
    past: [],
    future: [],
  })
  const clipboardRef = useRef<Clipboard | null>(null)
  const pasteCountRef = useRef(0)
  const pendingViewportRef = useRef<Viewport | null>(null)
  const revisionRef = useRef(0)
  const savingRef = useRef(false)

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      shiftRef.current = event.shiftKey
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
      const target = topAncestor(node, map)
      if (isLocked(target, map)) return
      setSelectedIds((current) => {
        if (!shiftRef.current) return [target.id]
        return current.includes(target.id)
          ? current.filter((item) => item !== target.id)
          : [...current, target.id]
      })
    },
    [canvas],
  )

  useEffect(() => {
    let cancelled = false
    fetch('/__canvases')
      .then((response) => response.json())
      .then((data: { canvases: CanvasListItem[] }) => {
        if (cancelled) return
        const list = data.canvases ?? []
        setItems(list)
        const requested = new URLSearchParams(window.location.search).get('board')
        const first = list.find((item) => item.slug === requested) ?? list[0]
        if (!first) {
          setLoading(false)
          return
        }
        setSelectedSlug(first.slug)
        return fetch(`/__canvases/${encodeURIComponent(first.slug)}?scope=${first.scope}`)
          .then((response) => response.text())
          .then((text) => parseCanvas(text))
          .then((next) => {
            if (!cancelled) {
              historyRef.current = { past: [], future: [] }
              setHistoryState({ canUndo: false, canRedo: false })
              setCanvas(next)
              setLoading(false)
            }
          })
      })
      .catch((loadError) => {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : String(loadError))
          setLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const viewport = pendingViewportRef.current
    if (!viewport) return
    pendingViewportRef.current = null
    writeViewport(viewerRef.current, viewport)
  }, [canvas])

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
      setSelectedIds([element.id])
      setTool('text')
      setEditRequest({ id: element.id, nonce: Date.now() })
    }
    container.addEventListener('dblclick', onDoubleClick)
    return () => container.removeEventListener('dblclick', onDoubleClick)
  }, [canvas])

  function syncHistoryState() {
    setHistoryState({
      canUndo: historyRef.current.past.length > 0,
      canRedo: historyRef.current.future.length > 0,
    })
  }

  function recordHistory() {
    if (!canvas) return
    const history = historyRef.current
    history.past.push(structuredClone(canvas))
    if (history.past.length > HISTORY_LIMIT) history.past.shift()
    history.future.length = 0
    syncHistoryState()
  }

  function markDirty() {
    revisionRef.current += 1
    setSaveState('dirty')
  }

  function applyDocument(next: CanvasDocument, selection: string[] = []) {
    pendingViewportRef.current = readViewport(viewerRef.current)
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

  function insertTextBlock(kind: 'markdown' | 'pele') {
    if (!canvas) return
    const id = nextFreeId(new Set(canvas.nodes.map((node) => node.id)), kind)
    const position = viewportCenter(360, 220)
    const code = 'flowchart LR\n    A[开始] --> B[结束]'
    const node: CanvasNode =
      kind === 'markdown'
        ? {
            id,
            type: 'text',
            x: position.x,
            y: position.y,
            width: 360,
            height: 220,
            text: '# 新 Markdown\n\n在这里输入内容。',
            'x-superboard': { kind: 'markdown' },
          }
        : {
            id,
            type: 'text',
            x: position.x,
            y: position.y,
            width: 360,
            height: 220,
            text: `\`\`\`mermaid\n${code}\n\`\`\``,
            'x-superboard': { kind: 'pele', diagram: 'flowchart', code },
          }
    recordHistory()
    applyDocument({ ...canvas, nodes: [...canvas.nodes, node] }, [id])
    setTool('text')
    setEditRequest({ id, nonce: Date.now() })
  }

  function insertMedia() {
    if (!canvas) return
    const url = mediaUrl.trim()
    if (!url) return
    const id = nextFreeId(new Set(canvas.nodes.map((node) => node.id)), 'media')
    const position = viewportCenter(480, 320)
    const node: CanvasNode = {
      id,
      type: 'link',
      url,
      x: position.x,
      y: position.y,
      width: 480,
      height: 320,
      'x-superboard': {
        kind: 'media',
        media: { kind: detectMediaKind(url), url },
      },
    }
    recordHistory()
    applyDocument({ ...canvas, nodes: [...canvas.nodes, node] }, [id])
    setMediaDialogOpen(false)
    setMediaUrl('')
  }

  function undo() {
    if (!canvas) return
    const history = historyRef.current
    const previous = history.past.pop()
    if (!previous) return
    history.future.push(structuredClone(canvas))
    syncHistoryState()
    applyDocument(previous)
  }

  function redo() {
    if (!canvas) return
    const history = historyRef.current
    const next = history.future.pop()
    if (!next) return
    history.past.push(structuredClone(canvas))
    syncHistoryState()
    applyDocument(next)
  }

  function copySelection() {
    if (!canvas || selectedIds.length === 0) return
    const ids = new Set(selectedIds)
    const copied = new Map<string, CanvasNode>()
    for (const node of canvas.nodes) {
      if (!ids.has(node.id)) continue
      copied.set(node.id, node)
      for (const child of collectDescendants(node, canvas.nodes)) copied.set(child.id, child)
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
    copySelection()
    pasteClipboard()
  }

  function deleteSelection() {
    if (!canvas || selectedIds.length === 0) return
    const map = nodeMapOf(canvas.nodes)
    const selected = new Set(selectedIds)
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
    setSelectedIds(allLocked ? [...selectedIds] : [])
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

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target?.closest('input, textarea, select, [contenteditable="true"]')) return
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
      if (event.key === 'Escape') {
        setSelectedIds([])
        setTool('select')
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  })

  useEffect(() => {
    if (saveState !== 'dirty') return
    const timer = window.setTimeout(() => {
      void save()
    }, AUTOSAVE_DELAY)
    return () => window.clearTimeout(timer)
  }, [saveState, canvas, selectedSlug])

  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (saveState === 'saved') return
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [saveState])

  async function save() {
    if (!canvas || savingRef.current) return
    const meta = canvas['x-superboard']?.meta
    if (!meta) return
    const item = items.find((entry) => entry.slug === selectedSlug)
    if (!item) return
    const revision = revisionRef.current
    savingRef.current = true
    setSaveState('saving')
    try {
      const response = await fetch(
        `/__canvases/${encodeURIComponent(item.slug)}?scope=${item.scope}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(canvas),
        },
      )
      if (!response.ok) {
        setSaveState('error')
        return
      }
      setSaveState(revisionRef.current === revision ? 'saved' : 'dirty')
    } catch {
      setSaveState('error')
    } finally {
      savingRef.current = false
    }
  }

  async function openBoard(slug: string) {
    if (!slug || slug === selectedSlug) return
    const item = items.find((entry) => entry.slug === slug)
    if (!item) return
    if (savingRef.current) {
      window.alert('正在保存，请稍候再切换白板。')
      return
    }
    if (
      saveState !== 'saved' &&
      !window.confirm('当前白板有未保存的修改，切换后会丢失，继续？')
    ) {
      return
    }
    setSaveState('saved')
    setLoading(true)
    try {
      const response = await fetch(
        `/__canvases/${encodeURIComponent(item.slug)}?scope=${item.scope}`,
      )
      if (!response.ok) throw new Error(`加载失败（${response.status}）`)
      const next = await parseCanvas(await response.text())
      historyRef.current = { past: [], future: [] }
      setHistoryState({ canUndo: false, canRedo: false })
      clipboardRef.current = null
      setSelectedIds([])
      setTool('select')
      setSelectedSlug(item.slug)
      setCanvas(next)
      setSaveState('saved')
      setLoading(false)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : String(loadError))
      setLoading(false)
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
  if (!canvas) {
    return (
      <div className="sb-screen-message">
        <h1>还没有 .canvas</h1>
        <p>先运行 `npm run convert:canvas` 或在 `whiteboards/` 中放入 `.canvas` 文件。</p>
      </div>
    )
  }

  const nodeMap = nodeMapOf(canvas.nodes)
  const canGroup =
    selectedIds.filter((id) => {
      const node = nodeMap.get(id)
      return node && !isLocked(node, nodeMap)
    }).length >= 2
  const canUngroup = selectedIds.some((id) => {
    const node = nodeMap.get(id)
    return node?.['x-superboard']?.kind === 'group' && !isLocked(node, nodeMap)
  })
  const hasLocked = canvas.nodes.some((node) => isLocked(node, nodeMap))
  const activeItem = items.find((entry) => entry.slug === selectedSlug)
  const saveLabel =
    saveState === 'saving'
      ? '保存中…'
      : saveState === 'dirty'
        ? '保存'
        : saveState === 'error'
          ? '重试保存'
          : '已保存'

  return (
    <div className="canvas-editor">
      <header className="canvas-editor-toolbar">
        <strong>{canvas['x-superboard']?.meta.title}</strong>
        <select
          className="canvas-editor-board-select"
          value={selectedSlug}
          title="切换白板"
          onChange={(event) => void openBoard(event.target.value)}
        >
          {items.map((item) => (
            <option key={item.slug} value={item.slug}>
              {item.title || item.slug}
              {item.scope === 'private' ? '（私有）' : ''}
            </option>
          ))}
        </select>
        <span className="canvas-editor-meta">
          {selectedIds.length > 0
            ? `已选 ${selectedIds.length} 项`
            : activeItem?.scope === 'private'
              ? '私有'
              : '公开'}
        </span>
        <div className="canvas-editor-actions">
          <button type="button" onClick={undo} disabled={!historyState.canUndo}>
            撤销
          </button>
          <button type="button" onClick={redo} disabled={!historyState.canRedo}>
            重做
          </button>
          <button type="button" onClick={toggleGroup} disabled={!canGroup && !canUngroup} title="Ctrl+G / Ctrl+Shift+G">
            编组
          </button>
          <button type="button" onClick={ungroupSelection} disabled={!canUngroup} title="Ctrl+Shift+G">
            解组
          </button>
          <button type="button" onClick={toggleLockSelection} disabled={selectedIds.length === 0} title="Shift+L">
            锁定
          </button>
          <button type="button" onClick={() => reorderSelection('front')} disabled={selectedIds.length === 0} title="]">
            置顶
          </button>
          <button type="button" onClick={() => reorderSelection('back')} disabled={selectedIds.length === 0} title="[">
            置底
          </button>
          <button type="button" onClick={unlockAllLocked} disabled={!hasLocked} title="解锁全部锁定元素">
            解锁全部
          </button>
          <button type="button" onClick={() => downloadCanvasSvg(canvas)}>
            导出 SVG
          </button>
          <button type="button" onClick={() => downloadCanvasPng(canvas)}>
            导出 PNG
          </button>
          <button
            type="button"
            onClick={() => void save()}
            disabled={saveState === 'saved' || saveState === 'saving'}
            title="Ctrl+S"
          >
            {saveLabel}
          </button>
        </div>
      </header>
      <div className="canvas-editor-toolstrip">
        {TOOLS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={tool === item.id ? 'is-active' : undefined}
            title={`${item.label}（${item.shortcut}）`}
            onClick={() => setTool(item.id)}
          >
            {item.label}
          </button>
        ))}
        <span className="canvas-editor-tool-sep" />
        <button type="button" onClick={() => insertTextBlock('markdown')}>
          插入 Markdown
        </button>
        <button type="button" onClick={() => insertTextBlock('pele')}>
          插入 Pele
        </button>
        <button type="button" onClick={() => setMediaDialogOpen(true)}>
          插入媒体
        </button>
      </div>
      <main className="canvas-editor-stage">
        <CanvasViewer
          ref={viewerRef}
          canvas={canvas}
          onNodeSelect={handleNodeSelect}
          style={{ width: '100%', height: '100%' }}
        />
        <CanvasEditorOverlay
          canvas={canvas}
          viewerRef={viewerRef}
          selectedIds={selectedIds}
          onSelect={setSelectedIds}
          onChange={markDirty}
          onBeforeChange={recordHistory}
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
        />
        <CanvasStylePanel
          canvas={canvas}
          selectedIds={selectedIds}
          onBeforeChange={recordHistory}
          onApply={applyDocument}
        />
      </main>
      {mediaDialogOpen ? (
        <div className="canvas-editor-dialog-backdrop" onClick={() => setMediaDialogOpen(false)}>
          <div className="canvas-editor-dialog" onClick={(event) => event.stopPropagation()}>
            <h2>插入媒体</h2>
            <p>支持图片、视频链接，以及其他可嵌入的 iframe 地址。</p>
            <input
              autoFocus
              value={mediaUrl}
              placeholder="https://..."
              onChange={(event) => setMediaUrl(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') insertMedia()
                if (event.key === 'Escape') setMediaDialogOpen(false)
              }}
            />
            <div className="canvas-editor-dialog-actions">
              <button type="button" onClick={() => setMediaDialogOpen(false)}>
                取消
              </button>
              <button type="button" onClick={insertMedia} disabled={!mediaUrl.trim()}>
                插入
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

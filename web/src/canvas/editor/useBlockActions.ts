import type { RefObject } from 'react'
import type { CanvasDocument, CanvasNode } from '../model'
import type { CanvasViewerHandle } from '../viewer/CanvasViewer'
import {
  DEFAULT_BLOCK_SIZES,
  SHAPE_DEFAULT_SIZE,
  blockEditor,
  blockKind,
  isActionableNode,
  isRatioLocked,
  isShapeNode,
} from './blocks'
import type { EditorTool } from './tools'
import { nodeFilePath, openWorkspaceFile } from './workspacePlatform'

interface UseBlockActionsOptions {
  canvasRef: RefObject<CanvasDocument | null>
  viewerRef: RefObject<CanvasViewerHandle | null>
  textEditingId: string | null
  captureViewport: () => void
  recordHistory: (mergeKey?: string) => void
  markDirty: () => void
  setCanvas: (canvas: CanvasDocument) => void
  setSelectedIds: (ids: string[]) => void
  setTool: (tool: EditorTool) => void
  setEditRequest: (request: { id: string; nonce: number } | null) => void
  closeTextEditing: () => void
  openMarkdownEditor: (id: string) => void
  toggleMarkdownEdit: (id: string) => void
  closeMarkdownEditor: () => void
  openPeleEditor: (id: string) => void
  ensureExtension: (node: CanvasNode) => NonNullable<CanvasNode['x-superboard']>
}

export function useBlockActions({
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
}: UseBlockActionsOptions) {
  function openBlockEditor(id: string) {
    const document = canvasRef.current
    const node = document?.nodes.find((item) => item.id === id)
    const editor = node ? blockEditor(node) : null
    if (!editor) return
    if (editor === 'media') {
      closeTextEditing()
      closeMarkdownEditor()
      setSelectedIds([id])
      setTool('select')
      const path = nodeFilePath(node ?? undefined)
      if (path) void openWorkspaceFile(path)
      return
    }
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

  return {
    openBlockEditor,
    toggleBlockEdit,
    toggleRatioLock,
    resetBlockSize,
    handleMarkdownCommit,
  }
}

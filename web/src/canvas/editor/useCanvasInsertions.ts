import type { RefObject } from 'react'
import i18n from '../../i18n'
import type { CanvasDocument, CanvasNode } from '../model'
import {
  TREE_DRAFT_HEIGHT,
  emptyTreeData,
  layoutTree,
  newTreeNodeId,
  treeBlockSize,
} from '../model'
import type { CanvasViewerHandle } from '../viewer/CanvasViewer'
import type { BoardScope } from '../../shared/board/types'
import { DEFAULT_BLOCK_SIZES } from './blocks'
import { nextFreeId } from './hierarchy'
import { blockStyleFromPreferences, textStyleFromPreferences } from './preferences'
import type { EditorTool } from './tools'
import { peleBlockSize } from '../../shared/pele/size'
import { estimateMarkdownHeight } from './markdownSize'
import {
  defaultBlockSize as blockSizeFor,
  sizeWithNaturalRatio,
} from './insertionSizing'
import { viewportCenter } from './insertionViewport'
import { useMediaInsertions } from './useMediaInsertions'

interface UseCanvasInsertionsOptions {
  canvas: CanvasDocument | null
  canvasRef: RefObject<CanvasDocument | null>
  scope: BoardScope
  viewerRef: RefObject<CanvasViewerHandle | null>
  peleDialog:
    | { mode: 'create'; point?: { x: number; y: number } }
    | { mode: 'edit'; nodeId: string }
    | null
  setPeleDialog: (
    value:
      | { mode: 'create'; point?: { x: number; y: number } }
      | { mode: 'edit'; nodeId: string }
      | null,
  ) => void
  mediaUrl: string
  mediaInsertPoint: { x: number; y: number } | null
  setMediaDialogOpen: (open: boolean) => void
  setMediaUrl: (url: string) => void
  setMediaInsertPoint: (point: { x: number; y: number } | null) => void
  applyDocument: (next: CanvasDocument, selection?: string[]) => void
  recordHistory: (mergeKey?: string) => void
  setSelectedIds: (ids: string[]) => void
  setTool: (tool: EditorTool) => void
  setEditRequest: (request: { id: string; nonce: number } | null) => void
  setTextCreateRequest: (
    request: { x: number; y: number; nonce: number } | null,
  ) => void
  startMarkdownEditing: (id: string) => void
  closeTextEditing: () => void
  closeMarkdownEditor: () => void
  ensureExtension: (node: CanvasNode) => NonNullable<CanvasNode['x-superboard']>
}

export function useCanvasInsertions({
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
  startMarkdownEditing,
  closeTextEditing,
  closeMarkdownEditor,
  ensureExtension,
}: UseCanvasInsertionsOptions) {
  const media = useMediaInsertions({
    canvas,
    canvasRef,
    scope,
    viewerRef,
    mediaUrl,
    mediaInsertPoint,
    setMediaDialogOpen,
    setMediaUrl,
    setMediaInsertPoint,
    applyDocument,
    recordHistory,
  })

  function defaultBlockSize(kind: keyof typeof DEFAULT_BLOCK_SIZES) {
    return blockSizeFor(kind, canvasRef.current?.['x-superboard']?.settings)
  }

  async function peleSize(code: string, narrow = false) {
    const measured = await peleBlockSize(code, narrow)
    return measured
      ? sizeWithNaturalRatio(
          measured,
          canvasRef.current?.['x-superboard']?.settings,
        )
      : defaultBlockSize('pele')
  }

  function markdownSize(text: string, width: number) {
    return { width, height: estimateMarkdownHeight(text, width) }
  }

  async function insertTextBlock(
    kind: 'text' | 'markdown' | 'pele',
    point?: { x: number; y: number },
  ) {
    if (!canvas) return
    const code = i18n.t('editor:insert.defaultPele')
    const size =
      kind === 'pele'
        ? await peleSize(code)
        : kind === 'markdown'
          ? markdownSize(
              i18n.t('editor:insert.defaultMarkdown'),
              defaultBlockSize('markdown').width,
            )
          : defaultBlockSize(kind)
    const position = point
      ? {
          x: Math.round(point.x - size.width / 2),
          y: Math.round(point.y - size.height / 2),
        }
      : viewportCenter(viewerRef, size.width, size.height)
    if (kind === 'text') {
      const id = nextFreeId(
        new Set(canvas.nodes.map((node) => node.id)),
        'text',
      )
      const node: CanvasNode = {
        id,
        type: 'text',
        x: position.x,
        y: position.y,
        width: size.width,
        height: size.height,
        text: '',
        'x-superboard': {
          kind: 'text',
          style: textStyleFromPreferences(),
        },
      }
      recordHistory()
      applyDocument({ ...canvas, nodes: [...canvas.nodes, node] }, [id])
      setTool('text')
      setEditRequest({ id, nonce: Date.now() })
      return
    }
    const base = canvasRef.current ?? canvas
    const id = nextFreeId(new Set(base.nodes.map((node) => node.id)), kind)
    const node: CanvasNode =
      kind === 'markdown'
        ? {
            id,
            type: 'text',
            x: position.x,
            y: position.y,
            width: size.width,
            height: size.height,
            text: i18n.t('editor:insert.defaultMarkdown'),
            'x-superboard': {
              kind: 'markdown',
              // The floating Markdown editor covers the block, so the block can
              // keep rendering its preview instead of an empty placeholder.
              markdownLocked: true,
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
    const latest = canvasRef.current ?? canvas
    applyDocument({ ...latest, nodes: [...latest.nodes, node] }, [id])
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

  async function insertPele({ code, diagram }: { code: string; diagram: string }) {
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
    const narrow = false
    const createdFor = peleDialog
    const size = await peleSize(code, narrow)
    const current = canvasRef.current
    if (!current) return
    const id = nextFreeId(new Set(current.nodes.map((node) => node.id)), 'pele')
    const offset = (current.nodes.length % 6) * 24
    const position = createdFor.point
      ? {
          x: Math.round(createdFor.point.x - size.width / 2),
          y: Math.round(createdFor.point.y - size.height / 2),
        }
      : (() => {
          const center = viewportCenter(viewerRef, size.width, size.height)
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
    applyDocument({ ...current, nodes: [...current.nodes, node] }, [id])
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
      : viewportCenter(viewerRef, size.width, size.height)
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

  function insertTreeBlock(point?: { x: number; y: number }) {
    if (!canvas) return
    const id = nextFreeId(new Set(canvas.nodes.map((node) => node.id)), 'tree')
    const tree = emptyTreeData(newTreeNodeId(), new Date().toISOString())
    // Size the block to its single draft card up front; otherwise the node
    // would appear at the default size and snap smaller on the next frame.
    const size = treeBlockSize(
      layoutTree(tree, { [tree.rootId]: TREE_DRAFT_HEIGHT }),
    )
    const position = point
      ? {
          x: Math.round(point.x - size.width / 2),
          y: Math.round(point.y - size.height / 2),
        }
      : viewportCenter(viewerRef, size.width, size.height)
    const node: CanvasNode = {
      id,
      type: 'text',
      x: position.x,
      y: position.y,
      width: size.width,
      height: size.height,
      text: '',
      'x-superboard': {
        kind: 'tree',
        tree,
      },
    }
    recordHistory()
    applyDocument({ ...canvas, nodes: [...canvas.nodes, node] }, [id])
    setTool('select')
  }

  return {
    insertTextBlock,
    openPeleDialog,
    openPeleEditor,
    insertPele,
    insertScheduleBlock,
    insertTreeBlock,
    insertMedia: media.insertMedia,
    insertLocalFile: media.insertLocalFile,
    pickLocalFilesFromDialog: media.pickLocalFilesFromDialog,
    openMediaDialog: media.openMediaDialog,
  }
}

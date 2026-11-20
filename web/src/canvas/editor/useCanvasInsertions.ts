import type { RefObject } from 'react'
import type { CanvasDocument, CanvasNode } from '../model'
import type { CanvasViewerHandle } from '../viewer/CanvasViewer'
import {
  normalizeMediaUrl,
  type DataManagerLike,
  type ViewerInternals,
} from './appUtils'
import { DEFAULT_BLOCK_SIZES } from './blocks'
import { nextFreeId } from './hierarchy'
import { importLocalFile } from './workspacePlatform'
import type { BoardScope } from '../../shared/board/types'
import { blockStyleFromPreferences, textStyleFromPreferences } from './preferences'
import { detectMediaKind, type EditorTool } from './tools'
import { internal } from '../../vendor/json-canvas-viewer/src/index.ts'

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
  function viewportCenter(width: number, height: number) {
    try {
      const viewer = viewerRef.current?.viewer as ViewerInternals | undefined
      if (viewer?.container) {
        const dm = viewer.container.get(internal.DataManager as never) as DataManagerLike
        const { offsetX, offsetY, scale } = dm.data
        const container = dm.data.container
        return {
          x: Math.round(
            (container.clientWidth / 2 - offsetX) / scale - width / 2,
          ),
          y: Math.round(
            (container.clientHeight / 2 - offsetY) / scale - height / 2,
          ),
        }
      }
    } catch {
      // ignore
    }
    return { x: -width / 2, y: -height / 2 }
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

  async function insertLocalFile(file: File) {
    if (!canvas) return
    const imported = await importLocalFile(file, scope)
    const id = nextFreeId(new Set(canvas.nodes.map((node) => node.id)), 'file')
    const size = defaultBlockSize('media')
    const position = mediaInsertPoint
      ? {
          x: Math.round(mediaInsertPoint.x - size.width / 2),
          y: Math.round(mediaInsertPoint.y - size.height / 2),
        }
      : viewportCenter(size.width, size.height)
    const node: CanvasNode = {
      id,
      type: 'file',
      file: imported.path,
      x: position.x,
      y: position.y,
      width: size.width,
      height: size.height,
      'x-superboard': {
        kind: 'media',
        media: {
          kind: 'file',
          url: imported.path,
          file: imported.path,
          name: imported.name,
          mime: imported.mime,
          size: imported.size,
        },
        style: blockStyleFromPreferences(),
      },
    }
    recordHistory()
    applyDocument({ ...canvas, nodes: [...canvas.nodes, node] }, [id])
    setMediaDialogOpen(false)
    setMediaUrl('')
    setMediaInsertPoint(null)
  }

  function openMediaDialog(point?: { x: number; y: number }) {
    setMediaInsertPoint(point ?? null)
    setMediaDialogOpen(true)
  }

  return {
    insertTextBlock,
    openPeleDialog,
    openPeleEditor,
    insertPele,
    insertScheduleBlock,
    insertMedia,
    insertLocalFile,
    openMediaDialog,
  }
}

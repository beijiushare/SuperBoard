import type { RefObject } from 'react'
import type { CanvasDocument, CanvasNode } from '../model'
import type { CanvasViewerHandle } from '../viewer/CanvasViewer'
import type { BoardScope } from '../../shared/board/types'
import type { ImportedFile } from '../../desktop/platform'
import { normalizeMediaUrl } from './appUtils'
import { nextFreeId } from './hierarchy'
import { importLocalFile, pickLocalFiles as pickWorkspaceFiles } from './workspacePlatform'
import { blockStyleFromPreferences } from './preferences'
import { detectMediaKind } from './tools'
import { fitMediaSize, measureMediaFile, measureMediaUrl } from './mediaSize'
import { defaultBlockSize, sizeWithNaturalRatio } from './insertionSizing'
import { viewportCenter } from './insertionViewport'

interface UseMediaInsertionsOptions {
  canvas: CanvasDocument | null
  canvasRef: RefObject<CanvasDocument | null>
  scope: BoardScope
  viewerRef: RefObject<CanvasViewerHandle | null>
  mediaUrl: string
  mediaInsertPoint: { x: number; y: number } | null
  setMediaDialogOpen: (open: boolean) => void
  setMediaUrl: (url: string) => void
  setMediaInsertPoint: (point: { x: number; y: number } | null) => void
  applyDocument: (next: CanvasDocument, selection?: string[]) => void
  recordHistory: (mergeKey?: string) => void
}

/** Media, file cards and workspace file picking. */
export function useMediaInsertions({
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
}: UseMediaInsertionsOptions) {
  const boardSettings = () => canvasRef.current?.['x-superboard']?.settings

  function mediaSize(natural: { width: number; height: number } | null) {
    if (!natural) return defaultBlockSize('media', boardSettings())
    return sizeWithNaturalRatio(fitMediaSize(natural), boardSettings())
  }

  async function insertMedia(value = mediaUrl) {
    if (!canvas) return
    const url = normalizeMediaUrl(value)
    if (!url) return
    const kind = detectMediaKind(url)
    // Close first so a slow image cannot be submitted twice while measuring.
    const point = mediaInsertPoint
    setMediaDialogOpen(false)
    setMediaUrl('')
    setMediaInsertPoint(null)
    const natural = await measureMediaUrl(url, kind)
    const size = mediaSize(natural)
    const current = canvasRef.current
    if (!current) return
    const id = nextFreeId(new Set(current.nodes.map((node) => node.id)), 'media')
    const position = point
      ? {
          x: Math.round(point.x - size.width / 2),
          y: Math.round(point.y - size.height / 2),
        }
      : viewportCenter(viewerRef, size.width, size.height)
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
        media: { kind, url },
        style: blockStyleFromPreferences(),
      },
    }
    recordHistory()
    applyDocument({ ...current, nodes: [...current.nodes, node] }, [id])
  }

  function fileNode(
    id: string,
    imported: ImportedFile,
    index: number,
    natural?: { width: number; height: number } | null,
  ) {
    const source =
      natural ??
      (imported.width && imported.height
        ? { width: imported.width, height: imported.height }
        : null)
    const size = mediaSize(source)
    const base = mediaInsertPoint
      ? {
          x: Math.round(mediaInsertPoint.x - size.width / 2),
          y: Math.round(mediaInsertPoint.y - size.height / 2),
        }
      : viewportCenter(viewerRef, size.width, size.height)
    const node: CanvasNode = {
      id,
      type: 'file',
      file: imported.path,
      x: base.x + index * 24,
      y: base.y + index * 24,
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
    return node
  }

  async function insertLocalFile(file: File) {
    if (!canvas) return
    const imported = await importLocalFile(file, scope)
    const natural =
      imported.width && imported.height
        ? { width: imported.width, height: imported.height }
        : await measureMediaFile(file)
    const current = canvasRef.current
    if (!current) return
    const id = nextFreeId(new Set(current.nodes.map((node) => node.id)), 'file')
    recordHistory()
    applyDocument(
      {
        ...current,
        nodes: [...current.nodes, fileNode(id, imported, 0, natural)],
      },
      [id],
    )
    setMediaDialogOpen(false)
    setMediaUrl('')
    setMediaInsertPoint(null)
  }

  async function pickLocalFilesFromDialog() {
    if (!canvas) return
    const imported = await pickWorkspaceFiles(scope)
    if (imported.length === 0) return
    // The native picker can stay open for a while; re-read the document so
    // edits made meanwhile are not replaced by the stale closure copy.
    const current = canvasRef.current
    if (!current) return
    const ids = new Set(current.nodes.map((node) => node.id))
    const added: string[] = []
    const nodes = imported.map((item, index) => {
      const id = nextFreeId(ids, 'file')
      ids.add(id)
      added.push(id)
      return fileNode(id, item, index)
    })
    recordHistory()
    applyDocument({ ...current, nodes: [...current.nodes, ...nodes] }, added)
    setMediaDialogOpen(false)
    setMediaUrl('')
    setMediaInsertPoint(null)
  }

  function openMediaDialog(point?: { x: number; y: number }) {
    setMediaInsertPoint(point ?? null)
    setMediaDialogOpen(true)
  }

  return { insertMedia, insertLocalFile, pickLocalFilesFromDialog, openMediaDialog }
}

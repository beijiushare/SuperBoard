import { createHash } from 'node:crypto'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { parseCanvas, serializeCanvas, type CanvasDocument, type CanvasMeta } from '../../canvas/model'
import { convertTldrawBoard } from '../../canvas/migrate/fromTldraw'
import type { BoardFile, BoardScope } from '../../shared/board/types'
import { resolveScopeDir } from '../boardFs/paths'

export interface ScannedCanvas {
  file: string
  folder: string
  canvas: CanvasDocument
  meta: CanvasMeta
  legacy?: boolean
}

export interface CanvasListItem extends CanvasMeta {
  path: string
  scope: BoardScope
}

function canvasMeta(canvas: CanvasDocument, slug: string): CanvasMeta {
  const meta = canvas['x-superboard']?.meta
  return {
    title: meta?.title ?? slug,
    slug: meta?.slug ?? slug,
    summary: meta?.summary,
    order: meta?.order,
    draft: meta?.draft,
    aliases: meta?.aliases,
    updatedAt: meta?.updatedAt,
  }
}

export async function scanCanvasFiles(root: string, scope: BoardScope): Promise<ScannedCanvas[]> {
  const dir = resolveScopeDir(root, scope)
  const files: Array<{ file: string; folder: string }> = []

  async function visit(current: string, folder: string) {
    let entries
    try {
      entries = await fs.readdir(current, { withFileTypes: true })
    } catch {
      return
    }

    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue
      const fullPath = path.join(current, entry.name)
      if (entry.isDirectory()) {
        await visit(fullPath, folder ? `${folder}/${entry.name}` : entry.name)
        continue
      }
      if (entry.isFile() && entry.name.endsWith('.canvas')) files.push({ file: fullPath, folder })
    }
  }

  await visit(dir, '')

  const canvases: ScannedCanvas[] = []
  for (const item of files) {
    try {
      const canvas = parseCanvas(await fs.readFile(item.file, 'utf8'))
      const fallbackSlug = path.basename(item.file, '.canvas')
      const meta = canvasMeta(canvas, fallbackSlug)
      canvases.push({ ...item, canvas, meta })
    } catch {
      // Ignore malformed canvases in the picker.
    }
  }
  return canvases
}

async function scanLegacyFiles(root: string, scope: BoardScope): Promise<ScannedCanvas[]> {
  const dir = resolveScopeDir(root, scope)
  const files: Array<{ file: string; folder: string }> = []

  async function visit(current: string, folder: string) {
    let entries
    try {
      entries = await fs.readdir(current, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue
      const fullPath = path.join(current, entry.name)
      if (entry.isDirectory()) {
        await visit(fullPath, folder ? `${folder}/${entry.name}` : entry.name)
        continue
      }
      if (entry.isFile() && entry.name.endsWith('.tldr.json')) {
        files.push({ file: fullPath, folder })
      }
    }
  }

  await visit(dir, '')

  const canvases: ScannedCanvas[] = []
  for (const item of files) {
    try {
      const board = JSON.parse(await fs.readFile(item.file, 'utf8')) as BoardFile
      const canvas = convertTldrawBoard(board)
      const fallbackSlug = path.basename(item.file, '.tldr.json')
      canvases.push({
        ...item,
        canvas,
        meta: canvasMeta(canvas, fallbackSlug),
        legacy: true,
      })
    } catch {
      // Ignore malformed legacy boards.
    }
  }
  return canvases
}

async function scanAllFiles(root: string, scope: BoardScope) {
  const canvases = await scanCanvasFiles(root, scope)
  const slugs = new Set(canvases.map((item) => item.meta.slug))
  const legacy = await scanLegacyFiles(root, scope)
  return [
    ...canvases,
    ...legacy.filter((item) => !slugs.has(item.meta.slug)),
  ]
}

export async function listCanvases(root: string) {
  const items: CanvasListItem[] = []
  for (const scope of ['public', 'private'] as const) {
    const scanned = await scanAllFiles(root, scope)
    items.push(
      ...scanned.map(({ folder, meta }) => ({
        ...meta,
        path: folder,
        scope,
      })),
    )
  }
  return items.sort((a, b) => {
    const ai = a.order ?? Number.MAX_SAFE_INTEGER
    const bi = b.order ?? Number.MAX_SAFE_INTEGER
    return ai - bi || a.title.localeCompare(b.title, 'zh-CN')
  })
}

export async function findCanvasFile(root: string, scope: BoardScope, slug: string) {
  return (await scanAllFiles(root, scope)).find((item) => item.meta.slug === slug) ?? null
}

export function canvasContentHash(canvas: CanvasDocument) {
  return createHash('sha256')
    .update(JSON.stringify({ nodes: canvas.nodes, edges: canvas.edges }))
    .digest('hex')
}

export async function writeCanvasFile(file: string, canvas: CanvasDocument) {
  await fs.mkdir(path.dirname(file), { recursive: true })
  const tempFile = `${file}.${process.pid}.${Date.now()}.tmp`
  await fs.writeFile(tempFile, serializeCanvas(canvas), 'utf8')
  await fs.rename(tempFile, file)
}

export function blankCanvas(meta: CanvasMeta): CanvasDocument {
  return {
    nodes: [],
    edges: [],
    'x-superboard': {
      version: 1,
      meta: {
        ...meta,
        updatedAt: meta.updatedAt ?? new Date().toISOString(),
      },
    },
  }
}

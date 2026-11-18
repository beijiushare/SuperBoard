import { createHash } from 'node:crypto'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { parseCanvas, stringifyCanvas, type CanvasDocument, type CanvasMeta } from '../../canvas/model'
import type { BoardScope } from '../../shared/board/types'
import { resolveScopeDir } from '../boardFs/paths'

export interface ScannedCanvas {
  file: string
  folder: string
  canvas: CanvasDocument
  meta: CanvasMeta
  hash: string
}

export interface CanvasListItem extends CanvasMeta {
  path: string
  scope: BoardScope
}

interface CachedCanvasFile {
  mtimeMs: number
  ctimeMs: number
  size: number
  scan: ScannedCanvas
}

const canvasFileCache = new Map<string, CachedCanvasFile>()

function cacheKey(file: string) {
  return path.resolve(file)
}

function sameFile(
  cached: CachedCanvasFile,
  stats: { mtimeMs: number; ctimeMs: number; size: number },
) {
  return (
    cached.mtimeMs === stats.mtimeMs &&
    cached.ctimeMs === stats.ctimeMs &&
    cached.size === stats.size
  )
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
  const seen = new Set<string>()
  for (const item of files) {
    const key = cacheKey(item.file)
    seen.add(key)
    try {
      const stats = await fs.stat(key)
      const cached = canvasFileCache.get(key)
      if (cached && sameFile(cached, stats)) {
        canvases.push(cached.scan)
        continue
      }
      const canvas = parseCanvas(await fs.readFile(key, 'utf8'))
      const fallbackSlug = path.basename(key, '.canvas')
      const meta = canvasMeta(canvas, fallbackSlug)
      const scan = {
        ...item,
        file: key,
        canvas,
        meta,
        hash: canvasContentHash(canvas),
      }
      canvasFileCache.set(key, {
        mtimeMs: stats.mtimeMs,
        ctimeMs: stats.ctimeMs,
        size: stats.size,
        scan,
      })
      canvases.push(scan)
    } catch {
      canvasFileCache.delete(key)
    }
  }

  const prefix = `${path.resolve(dir)}${path.sep}`
  for (const key of canvasFileCache.keys()) {
    if (key.startsWith(prefix) && !seen.has(key)) canvasFileCache.delete(key)
  }
  return canvases
}

export async function listCanvases(root: string) {
  const items: CanvasListItem[] = []
  for (const scope of ['public', 'private'] as const) {
    const scanned = await scanCanvasFiles(root, scope)
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
  return (await scanCanvasFiles(root, scope)).find((item) => item.meta.slug === slug) ?? null
}

export function canvasContentHash(canvas: CanvasDocument) {
  return createHash('sha256')
    .update(JSON.stringify({ nodes: canvas.nodes, edges: canvas.edges }))
    .digest('hex')
}

export async function writeCanvasFile(
  file: string,
  canvas: CanvasDocument,
  folder = '',
  hash = canvasContentHash(canvas),
) {
  await fs.mkdir(path.dirname(file), { recursive: true })
  const tempFile = `${file}.${process.pid}.${Date.now()}.tmp`
  await fs.writeFile(tempFile, stringifyCanvas(canvas), 'utf8')
  await fs.rename(tempFile, file)
  const key = cacheKey(file)
  try {
    const fallbackSlug = path.basename(key, '.canvas')
    const meta = canvasMeta(canvas, fallbackSlug)
    const stats = await fs.stat(key)
    canvasFileCache.set(key, {
      mtimeMs: stats.mtimeMs,
      ctimeMs: stats.ctimeMs,
      size: stats.size,
      scan: { file: key, folder, canvas, meta, hash },
    })
  } catch {
    canvasFileCache.delete(key)
  }
}

export function forgetCanvasFile(file: string) {
  canvasFileCache.delete(cacheKey(file))
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

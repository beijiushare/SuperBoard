import type { IncomingMessage, ServerResponse } from 'node:http'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { validateCanvas, type CanvasDocument } from '../../canvas/model'
import { isValidSlug } from '../../shared/board/types'
import { HttpError, readJsonBody, sendJson } from '../boardFs/http'
import { normalizeFolder, normalizeScope, resolveCanvasFile } from '../boardFs/paths'
import { removeEmptyParents } from '../boardFs/folders'
import {
  blankCanvas,
  canvasContentHash,
  findCanvasFile,
  forgetCanvasFile,
  listCanvases,
  writeCanvasFile,
} from './files'
import {
  appendDevHistory,
  clearAllDevHistory,
  devHistoryContentHash,
  devHistoryStats,
  listDevHistory,
  moveDevHistory,
  readDevHistoryEntry,
  removeDevHistory,
  snapshotDevHistory,
} from './history'

interface CreateCanvasBody {
  title?: string
  slug?: string
  folder?: string
  scope?: string
}

interface PatchCanvasBody {
  title?: string
  slug?: string
  folder?: string
  summary?: string
}

function requireMeta(canvas: CanvasDocument) {
  const meta = canvas['x-superboard']?.meta
  if (!meta) throw new HttpError(400, 'Missing x-superboard.meta')
  return meta
}

async function replaceMeta(canvas: CanvasDocument, patch: Partial<CanvasDocument['x-superboard']>) {
  return {
    ...canvas,
    'x-superboard': {
      ...(canvas['x-superboard'] ?? { version: 1, meta: { title: '', slug: '' } }),
      ...patch,
    } as CanvasDocument['x-superboard'],
  }
}

export async function handleCanvasFsRequest(
  root: string,
  req: IncomingMessage,
  res: ServerResponse,
  next: () => void,
) {
  const url = new URL(req.url || '/', 'http://superboard.local')
  if (
    !url.pathname.startsWith('/__canvases') &&
    url.pathname !== '/__history'
  ) {
    next()
    return
  }

  try {
    if (url.pathname === '/__history') {
      if (req.method === 'GET') {
        sendJson(res, 200, await devHistoryStats(root))
        return
      }
      if (req.method === 'DELETE') {
        await clearAllDevHistory(root)
        sendJson(res, 200, { ok: true })
        return
      }
      sendJson(res, 405, { error: 'method not allowed' })
      return
    }
    if (url.pathname === '/__canvases' && req.method === 'GET') {
      sendJson(res, 200, { canvases: await listCanvases(root) })
      return
    }

    if (url.pathname === '/__canvases' && req.method === 'POST') {
      const body = await readJsonBody<CreateCanvasBody>(req)
      if (typeof body.title !== 'string' || !body.title.trim()) {
        throw new HttpError(400, 'title must not be empty')
      }
      if (typeof body.slug !== 'string' || !isValidSlug(body.slug)) {
        throw new HttpError(400, 'Invalid slug')
      }

      const scope = normalizeScope(body.scope)
      const folder = normalizeFolder(body.folder)
      if (await findCanvasFile(root, scope, body.slug)) {
        throw new HttpError(409, `Slug already exists: ${body.slug}`)
      }

      const file = resolveCanvasFile(root, scope, folder, body.slug)
      try {
        await fs.access(file)
        throw new HttpError(409, `File already exists: ${path.relative(root, file)}`)
      } catch (error) {
        if (error instanceof HttpError) throw error
      }

      const canvas = blankCanvas({
        title: body.title.trim(),
        slug: body.slug,
        updatedAt: new Date().toISOString(),
      })
      await writeCanvasFile(file, canvas, folder)
      sendJson(res, 201, {
        ok: true,
        canvas,
        path: folder,
        scope,
      })
      return
    }

    const historyMatch = url.pathname.match(
      /^\/__canvases\/([a-z0-9][a-z0-9-]*)\/history$/,
    )
    if (historyMatch) {
      const historySlug = historyMatch[1]
      const historyScope = normalizeScope(url.searchParams.get('scope'))
      if (req.method === 'GET') {
        sendJson(res, 200, await listDevHistory(root, historyScope, historySlug))
        return
      }
      if (req.method === 'DELETE') {
        await removeDevHistory(root, historyScope, historySlug)
        sendJson(res, 200, { ok: true })
        return
      }
      sendJson(res, 405, { error: 'method not allowed' })
      return
    }

    const entryMatch = url.pathname.match(
      /^\/__canvases\/([a-z0-9][a-z0-9-]*)\/history\/([0-9]{13}-[a-f0-9]{10})$/,
    )
    if (entryMatch) {
      if (req.method !== 'GET') {
        sendJson(res, 405, { error: 'method not allowed' })
        return
      }
      const entrySlug = entryMatch[1]
      const entryId = entryMatch[2]
      const entryScope = normalizeScope(url.searchParams.get('scope'))
      try {
        const raw = await readDevHistoryEntry(
          root,
          entryScope,
          entrySlug,
          entryId,
        )
        const canvas = validateCanvas(JSON.parse(raw))
        if (requireMeta(canvas).slug !== entrySlug) {
          throw new HttpError(400, 'History version belongs to another board')
        }
        sendJson(res, 200, canvas)
      } catch (error) {
        if (error instanceof HttpError) throw error
        sendJson(res, 404, { error: 'History version not found' })
      }
      return
    }

    const restoreMatch = url.pathname.match(
      /^\/__canvases\/([a-z0-9][a-z0-9-]*)\/history\/([0-9]{13}-[a-f0-9]{10})\/restore$/,
    )
    if (restoreMatch) {
      if (req.method !== 'POST') {
        sendJson(res, 405, { error: 'method not allowed' })
        return
      }
      const restoreSlug = restoreMatch[1]
      const entryId = restoreMatch[2]
      const restoreScope = normalizeScope(url.searchParams.get('scope'))
      let restored
      try {
        const raw = await readDevHistoryEntry(
          root,
          restoreScope,
          restoreSlug,
          entryId,
        )
        restored = validateCanvas(JSON.parse(raw))
      } catch {
        sendJson(res, 404, { error: 'History version not found' })
        return
      }
      const restoredMeta = requireMeta(restored)
      if (restoredMeta.slug !== restoreSlug) {
        throw new HttpError(400, 'History version belongs to another board')
      }
      const foundBoard = await findCanvasFile(root, restoreScope, restoreSlug)
      if (!foundBoard) {
        sendJson(res, 404, { error: 'Board not found' })
        return
      }
      const limitRaw = Number(url.searchParams.get('historyLimit') ?? '50')
      const limit =
        Number.isFinite(limitRaw) && limitRaw > 0 ? Math.round(limitRaw) : 50
      try {
        const current = await fs.readFile(foundBoard.file, 'utf8')
        const { entries } = await listDevHistory(
          root,
          restoreScope,
          restoreSlug,
        )
        if (
          entries.length === 0 ||
          !entries[0].id.endsWith(devHistoryContentHash(current))
        ) {
          await appendDevHistory(
            root,
            restoreScope,
            restoreSlug,
            current,
            limit,
          )
        }
      } catch {
        // Keep restoring even if the replaced version cannot be stored.
      }
      restoredMeta.updatedAt = new Date().toISOString()
      const nextHash = canvasContentHash(restored)
      await writeCanvasFile(
        foundBoard.file,
        restored,
        foundBoard.folder,
        nextHash,
      )
      sendJson(res, 200, { ok: true, canvas: restored })
      return
    }

    const match = url.pathname.match(/^\/__canvases\/([a-z0-9][a-z0-9-]*)$/)
    if (!match) {
      sendJson(res, 404, { error: 'not found' })
      return
    }

    const slug = match[1]
    const scope = normalizeScope(url.searchParams.get('scope'))
    const found = await findCanvasFile(root, scope, slug)
    if (!found) {
      sendJson(res, 404, { error: 'Board not found' })
      return
    }

    if (req.method === 'GET') {
      sendJson(res, 200, found.canvas)
      return
    }

    if (req.method === 'PUT') {
      const payload = validateCanvas(await readJsonBody<unknown>(req))
      const meta = requireMeta(payload)
      if (meta.slug !== slug) throw new HttpError(409, 'meta.slug does not match the URL')

      const nextHash = canvasContentHash(payload)
      if (nextHash === found.hash) {
        meta.updatedAt = found.meta.updatedAt
      } else {
        meta.updatedAt = new Date().toISOString()
      }

      await writeCanvasFile(found.file, payload, found.folder, nextHash)
      const interval = Number(url.searchParams.get('historyInterval') ?? '0')
      const limit = Number(url.searchParams.get('historyLimit') ?? '0')
      try {
        const text = await fs.readFile(found.file, 'utf8')
        await snapshotDevHistory(
          root,
          scope,
          slug,
          text,
          Number.isFinite(interval) ? interval : 0,
          Number.isFinite(limit) ? limit : 0,
        )
      } catch {
        // History is best effort; the save already succeeded.
      }
      sendJson(res, 200, {
        ok: true,
        hash: nextHash,
        meta,
        path: found.folder,
        scope,
      })
      return
    }

    if (req.method === 'PATCH') {
      const body = await readJsonBody<PatchCanvasBody>(req)
      const meta = requireMeta(found.canvas)
      const title =
        body.title === undefined
          ? meta.title
          : typeof body.title === 'string' && body.title.trim()
            ? body.title.trim()
            : null
      if (!title) throw new HttpError(400, 'title must not be empty')

      const nextSlug =
        body.slug === undefined
          ? slug
          : typeof body.slug === 'string' && isValidSlug(body.slug)
            ? body.slug
            : null
      if (!nextSlug) throw new HttpError(400, 'Invalid slug')
      if (nextSlug !== slug && (await findCanvasFile(root, scope, nextSlug))) {
        throw new HttpError(409, `Slug already exists: ${nextSlug}`)
      }

      const nextFolder = body.folder === undefined ? found.folder : normalizeFolder(body.folder)
      const nextMeta = {
        ...meta,
        title,
        slug: nextSlug,
        summary: body.summary === undefined ? meta.summary : body.summary.trim() || undefined,
        updatedAt: new Date().toISOString(),
      }
      const nextCanvas = await replaceMeta(found.canvas, { meta: nextMeta })
      const nextFile = resolveCanvasFile(root, scope, nextFolder, nextSlug)

      if (nextFile !== found.file) {
        try {
          await fs.access(nextFile)
          throw new HttpError(409, `File already exists: ${path.relative(root, nextFile)}`)
        } catch (error) {
          if (error instanceof HttpError) throw error
        }
      }

      await writeCanvasFile(nextFile, nextCanvas, nextFolder, found.hash)
      if (nextSlug !== slug) {
        await moveDevHistory(root, scope, slug, nextSlug)
      }
      if (nextFile !== found.file) {
        await fs.unlink(found.file)
        forgetCanvasFile(found.file)
        await removeEmptyParents(root, scope, found.file)
      }
      sendJson(res, 200, {
        ok: true,
        canvas: nextCanvas,
        meta: nextMeta,
        path: nextFolder,
        scope,
      })
      return
    }

    if (req.method === 'DELETE') {
      await fs.unlink(found.file)
      forgetCanvasFile(found.file)
      await removeDevHistory(root, scope, slug)
      await removeEmptyParents(root, scope, found.file)
      sendJson(res, 200, { ok: true })
      return
    }

    sendJson(res, 405, { error: 'method not allowed' })
  } catch (error) {
    sendJson(res, error instanceof HttpError ? error.status : 500, {
      error: error instanceof Error ? error.message : String(error),
    })
  }
}

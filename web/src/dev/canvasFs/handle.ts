import type { IncomingMessage, ServerResponse } from 'node:http'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { validateCanvas, type CanvasDocument } from '../../canvas/model'
import { isValidSlug } from '../../shared/board/types'
import { HttpError, readJsonBody, sendJson } from '../boardFs/http'
import { normalizeFolder, normalizeScope, resolveCanvasFile } from '../boardFs/paths'
import { removeEmptyParents } from '../boardFs/files'
import {
  blankCanvas,
  canvasContentHash,
  findCanvasFile,
  listCanvases,
  writeCanvasFile,
} from './files'

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
  if (!meta) throw new HttpError(400, '缺少 x-superboard.meta')
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
  if (!url.pathname.startsWith('/__canvases')) {
    next()
    return
  }

  try {
    if (url.pathname === '/__canvases' && req.method === 'GET') {
      sendJson(res, 200, { canvases: await listCanvases(root) })
      return
    }

    if (url.pathname === '/__canvases' && req.method === 'POST') {
      const body = await readJsonBody<CreateCanvasBody>(req)
      if (typeof body.title !== 'string' || !body.title.trim()) {
        throw new HttpError(400, 'title 不能为空')
      }
      if (typeof body.slug !== 'string' || !isValidSlug(body.slug)) {
        throw new HttpError(400, 'slug 非法')
      }

      const scope = normalizeScope(body.scope)
      const folder = normalizeFolder(body.folder)
      if (await findCanvasFile(root, scope, body.slug)) {
        throw new HttpError(409, `slug 已存在: ${body.slug}`)
      }

      const file = resolveCanvasFile(root, scope, folder, body.slug)
      try {
        await fs.access(file)
        throw new HttpError(409, `文件已存在: ${path.relative(root, file)}`)
      } catch (error) {
        if (error instanceof HttpError) throw error
      }

      const canvas = blankCanvas({
        title: body.title.trim(),
        slug: body.slug,
        updatedAt: new Date().toISOString(),
      })
      await writeCanvasFile(file, canvas)
      sendJson(res, 201, {
        ok: true,
        canvas,
        path: folder,
        scope,
      })
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
      sendJson(res, 404, { error: '白板不存在' })
      return
    }

    if (req.method === 'GET') {
      sendJson(res, 200, found.canvas)
      return
    }

    if (req.method === 'PUT') {
      const payload = validateCanvas(await readJsonBody<unknown>(req))
      const meta = requireMeta(payload)
      if (meta.slug !== slug) throw new HttpError(409, 'meta.slug 与 URL 不一致')

      const nextHash = canvasContentHash(payload)
      const currentHash = canvasContentHash(found.canvas)
      if (nextHash === currentHash) {
        meta.updatedAt = found.meta.updatedAt
      } else {
        meta.updatedAt = new Date().toISOString()
      }

      await writeCanvasFile(found.file, payload)
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
      if (!title) throw new HttpError(400, 'title 不能为空')

      const nextSlug =
        body.slug === undefined
          ? slug
          : typeof body.slug === 'string' && isValidSlug(body.slug)
            ? body.slug
            : null
      if (!nextSlug) throw new HttpError(400, 'slug 非法')
      if (nextSlug !== slug && (await findCanvasFile(root, scope, nextSlug))) {
        throw new HttpError(409, `slug 已存在: ${nextSlug}`)
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
          throw new HttpError(409, `文件已存在: ${path.relative(root, nextFile)}`)
        } catch (error) {
          if (error instanceof HttpError) throw error
        }
      }

      await writeCanvasFile(nextFile, nextCanvas)
      if (nextFile !== found.file) {
        await fs.unlink(found.file)
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

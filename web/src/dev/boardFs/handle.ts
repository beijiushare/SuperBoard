import type { IncomingMessage, ServerResponse } from 'node:http'
import { isValidSlug, type BoardFile } from '../../shared/board/types'
import { createBoard, deleteBoard, patchBoard } from './boards'
import { contentHash, findBoardFile, listBoards, writeBoardFile } from './files'
import { renameFolder, deleteFolder } from './folders'
import { HttpError, readJsonBody, sendJson } from './http'
import { normalizeScope } from './paths'
import type { CreateBoardBody, PatchBoardBody, RenameFolderBody } from './types'

function validateBoardPayload(value: unknown): asserts value is BoardFile {
  if (!value || typeof value !== 'object') throw new HttpError(400, 'body 必须是对象')
  const board = value as Partial<BoardFile>
  if (board.version !== 1) throw new HttpError(400, '只支持 version 1')
  if (!board.meta || typeof board.meta !== 'object') throw new HttpError(400, '缺少 meta')
  if (typeof board.meta.title !== 'string' || !board.meta.title.trim()) {
    throw new HttpError(400, 'meta.title 不能为空')
  }
  if (typeof board.meta.slug !== 'string' || !isValidSlug(board.meta.slug)) {
    throw new HttpError(400, 'meta.slug 非法')
  }
  if (!board.document || typeof board.document !== 'object' || !('store' in board.document)) {
    throw new HttpError(400, 'document 必须是 tldraw snapshot')
  }
}

export async function handleBoardFsRequest(
  root: string,
  req: IncomingMessage,
  res: ServerResponse,
  next: () => void,
) {
  const url = new URL(req.url || '/', 'http://superboard.local')
  if (!url.pathname.startsWith('/__boards') && !url.pathname.startsWith('/__folders')) {
    next()
    return
  }

  try {
    if (url.pathname === '/__folders') {
      if (req.method === 'PATCH') {
        const body = await readJsonBody<RenameFolderBody>(req)
        const renamed = await renameFolder(root, body)
        sendJson(res, 200, { ok: true, path: renamed.path })
      } else if (req.method === 'DELETE') {
        const folder = await deleteFolder(root, {
          path: url.searchParams.get('path') ?? undefined,
          scope: url.searchParams.get('scope') ?? undefined,
        })
        sendJson(res, 200, { ok: true, path: folder.path })
      } else {
        sendJson(res, 405, { error: 'method not allowed' })
      }
      return
    }

    if (url.pathname === '/__boards' && req.method === 'GET') {
      sendJson(res, 200, { boards: await listBoards(root) })
      return
    }

    if (url.pathname === '/__boards' && req.method === 'POST') {
      const body = await readJsonBody<CreateBoardBody>(req)
      const created = await createBoard(root, body)
      sendJson(res, 201, { ok: true, board: created.board, path: created.folder, scope: created.scope })
      return
    }

    const match = url.pathname.match(/^\/__boards\/([a-z0-9][a-z0-9-]*)$/)
    if (!match) {
      sendJson(res, 404, { error: 'not found' })
      return
    }

    const slug = match[1]
    if (!isValidSlug(slug)) {
      sendJson(res, 400, { error: '非法 slug' })
      return
    }

    const scope = normalizeScope(url.searchParams.get('scope'))
    const found = await findBoardFile(root, scope, slug)
    if (!found) {
      sendJson(res, 404, { error: '白板不存在' })
      return
    }

    if (req.method === 'GET') {
      sendJson(res, 200, found.board)
      return
    }

    if (req.method === 'PUT') {
      const payload = await readJsonBody<unknown>(req)
      validateBoardPayload(payload)
      if (payload.meta.slug !== slug) {
        throw new HttpError(409, 'body 的 meta.slug 与 URL 不一致')
      }

      const nextHash = contentHash(payload.document)
      const currentHash = contentHash(found.board.document)
      if (nextHash === currentHash) {
        payload.meta.updatedAt = found.board.meta.updatedAt
      }

      await writeBoardFile(found.file, payload)
      sendJson(res, 200, {
        ok: true,
        hash: nextHash,
        meta: payload.meta,
        path: found.folder,
        scope,
      })
      return
    }

    if (req.method === 'PATCH') {
      const body = await readJsonBody<PatchBoardBody>(req)
      const updated = await patchBoard(root, scope, slug, body)
      sendJson(res, 200, {
        ok: true,
        meta: updated.board.meta,
        path: updated.folder,
        board: updated.board,
        scope,
      })
      return
    }

    if (req.method === 'DELETE') {
      await deleteBoard(root, scope, slug)
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

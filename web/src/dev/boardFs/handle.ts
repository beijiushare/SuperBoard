import type { IncomingMessage, ServerResponse } from 'node:http'
import { deleteFolder, renameFolder } from './folders'
import { HttpError, readJsonBody, sendJson } from './http'
import type { RenameFolderBody } from './types'

export async function handleBoardFsRequest(
  root: string,
  req: IncomingMessage,
  res: ServerResponse,
  next: () => void,
) {
  const url = new URL(req.url || '/', 'http://superboard.local')
  if (url.pathname !== '/__folders') {
    next()
    return
  }

  try {
    if (req.method === 'PATCH') {
      const body = await readJsonBody<RenameFolderBody>(req)
      const renamed = await renameFolder(root, body)
      sendJson(res, 200, { ok: true, path: renamed.path })
      return
    }
    if (req.method === 'DELETE') {
      const folder = await deleteFolder(root, {
        path: url.searchParams.get('path') ?? undefined,
        scope: url.searchParams.get('scope') ?? undefined,
      })
      sendJson(res, 200, { ok: true, path: folder.path })
      return
    }
    sendJson(res, 405, { error: 'method not allowed' })
  } catch (error) {
    sendJson(res, error instanceof HttpError ? error.status : 500, {
      error: error instanceof Error ? error.message : String(error),
    })
  }
}

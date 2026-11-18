import type { IncomingMessage, ServerResponse } from 'node:http'
import { createFolder, deleteFolder, listFolders, renameFolder } from './folders'
import { HttpError, readJsonBody, sendJson } from './http'
import type { CreateFolderBody, RenameFolderBody } from './types'

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
    if (req.method === 'GET') {
      sendJson(res, 200, { folders: await listFolders(root) })
      return
    }
    if (req.method === 'POST') {
      const body = await readJsonBody<CreateFolderBody>(req)
      const folder = await createFolder(root, body)
      sendJson(res, 201, { ok: true, path: folder.path })
      return
    }
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

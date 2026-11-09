import type { IncomingMessage, ServerResponse } from 'node:http'
import { createHash } from 'node:crypto'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import type { Plugin, ViteDevServer } from 'vite'
import { isValidSlug, type BoardFile, type BoardListItem } from '../shared/board/types'

const BOARDS_DIR = 'whiteboards'

async function readJson(file: string): Promise<BoardFile> {
  return JSON.parse(await fs.readFile(file, 'utf8')) as BoardFile
}

async function listBoards(root: string) {
  const dir = path.join(root, BOARDS_DIR)
  let entries
  try {
    entries = await fs.readdir(dir, { withFileTypes: true })
  } catch {
    return []
  }

  const boards: BoardListItem[] = []
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.tldr.json')) continue
    try {
      const board = await readJson(path.join(dir, entry.name))
      if (!board?.meta?.slug) continue
      boards.push({
        slug: board.meta.slug,
        title: board.meta.title,
        summary: board.meta.summary,
        order: board.meta.order,
        updatedAt: board.meta.updatedAt,
      })
    } catch {
      // ignore malformed boards in the picker
    }
  }

  return boards.sort((a, b) => {
    const ai = a.order ?? Number.MAX_SAFE_INTEGER
    const bi = b.order ?? Number.MAX_SAFE_INTEGER
    return ai - bi || a.title.localeCompare(b.title, 'zh-CN')
  })
}

async function findBoardFile(root: string, slug: string) {
  const dir = path.join(root, BOARDS_DIR)
  let entries
  try {
    entries = await fs.readdir(dir, { withFileTypes: true })
  } catch {
    return null
  }

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.tldr.json')) continue
    const file = path.join(dir, entry.name)
    try {
      const board = await readJson(file)
      if (board.meta.slug === slug) return { file, board }
    } catch {
      // ignore malformed files
    }
  }
  return null
}

function contentHash(value: unknown) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex')
}

function sendJson(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(body))
}

async function readBody(req: IncomingMessage) {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    size += buffer.length
    if (size > 20 * 1024 * 1024) throw new Error('请求体超过 20MB')
    chunks.push(buffer)
  }
  return Buffer.concat(chunks).toString('utf8')
}

function validateBoardPayload(value: unknown): asserts value is BoardFile {
  if (!value || typeof value !== 'object') throw new Error('body 必须是对象')
  const board = value as Partial<BoardFile>
  if (board.version !== 1) throw new Error('只支持 version 1')
  if (!board.meta || typeof board.meta !== 'object') throw new Error('缺少 meta')
  if (typeof board.meta.title !== 'string' || !board.meta.title.trim()) throw new Error('meta.title 不能为空')
  if (typeof board.meta.slug !== 'string' || !isValidSlug(board.meta.slug)) throw new Error('meta.slug 非法')
  if (!board.document || typeof board.document !== 'object' || !('store' in board.document)) {
    throw new Error('document 必须是 tldraw snapshot')
  }
}

async function handle(
  root: string,
  req: IncomingMessage,
  res: ServerResponse,
  next: () => void,
) {
  const url = new URL(req.url || '/', 'http://superboard.local')
  if (!url.pathname.startsWith('/__boards')) {
    next()
    return
  }

  try {
    if (url.pathname === '/__boards' && req.method === 'GET') {
      sendJson(res, 200, { boards: await listBoards(root) })
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

    const found = await findBoardFile(root, slug)
    if (!found) {
      sendJson(res, 404, { error: '白板不存在' })
      return
    }

    if (req.method === 'GET') {
      sendJson(res, 200, found.board)
      return
    }

    if (req.method === 'PUT') {
      const raw = await readBody(req)
      let payload: unknown
      try {
        payload = JSON.parse(raw)
      } catch {
        sendJson(res, 400, { error: 'JSON 解析失败' })
        return
      }
      validateBoardPayload(payload)
      if (payload.meta.slug !== slug) {
        sendJson(res, 409, { error: 'body 的 meta.slug 与 URL 不一致' })
        return
      }

      const nextHash = contentHash(payload.document)
      const currentHash = contentHash(found.board.document)
      if (nextHash === currentHash) {
        payload.meta.updatedAt = found.board.meta.updatedAt
      }

      const tempFile = `${found.file}.${process.pid}.tmp`
      await fs.writeFile(tempFile, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
      await fs.rename(tempFile, found.file)

      sendJson(res, 200, {
        ok: true,
        hash: nextHash,
        meta: payload.meta,
      })
      return
    }

    sendJson(res, 405, { error: 'method not allowed' })
  } catch (error) {
    sendJson(res, 500, { error: error instanceof Error ? error.message : String(error) })
  }
}

export function boardFsPlugin(): Plugin {
  return {
    name: 'superboard-board-fs',
    configureServer(server: ViteDevServer) {
      const root = server.config.root
      server.middlewares.use((req, res, next) => {
        void handle(root, req, res, next)
      })
    },
  }
}

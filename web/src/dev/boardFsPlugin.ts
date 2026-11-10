import type { IncomingMessage, ServerResponse } from 'node:http'
import { createHash } from 'node:crypto'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import type { TLStoreSnapshot } from 'tldraw'
import type { Plugin, ViteDevServer } from 'vite'
import { isValidSlug, type BoardFile, type BoardListItem } from '../shared/board/types'
import blankDocumentData from '../shared/board/blank-document.json'

const BOARDS_DIR = 'whiteboards'
const BLANK_DOCUMENT = blankDocumentData as unknown as TLStoreSnapshot
const RESERVED_FOLDER_NAMES = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i

interface ScannedBoard {
  file: string
  folder: string
  board: BoardFile
}

interface CreateBoardBody {
  title?: unknown
  slug?: unknown
  folder?: unknown
  summary?: unknown
}

interface PatchBoardBody {
  title?: unknown
  slug?: unknown
  folder?: unknown
  summary?: unknown
}

interface RenameFolderBody {
  path?: unknown
  name?: unknown
}

class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message)
  }
}

async function readJson(file: string): Promise<BoardFile> {
  return JSON.parse(await fs.readFile(file, 'utf8')) as BoardFile
}

async function scanBoardFiles(root: string): Promise<ScannedBoard[]> {
  const dir = path.join(root, BOARDS_DIR)
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

  const boards: ScannedBoard[] = []
  for (const item of files) {
    try {
      const board = await readJson(item.file)
      if (!board?.meta?.slug) continue
      boards.push({ ...item, board })
    } catch {
      // ignore malformed boards in the picker
    }
  }
  return boards
}

async function listBoards(root: string) {
  const boards: BoardListItem[] = (await scanBoardFiles(root)).map(({ folder, board }) => ({
    slug: board.meta.slug,
    title: board.meta.title,
    summary: board.meta.summary,
    order: board.meta.order,
    updatedAt: board.meta.updatedAt,
    path: folder,
  }))

  return boards.sort((a, b) => {
    const ai = a.order ?? Number.MAX_SAFE_INTEGER
    const bi = b.order ?? Number.MAX_SAFE_INTEGER
    return ai - bi || a.title.localeCompare(b.title, 'zh-CN')
  })
}

async function findBoardFile(root: string, slug: string) {
  const found = (await scanBoardFiles(root)).find((item) => item.board.meta.slug === slug)
  return found ?? null
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
    if (size > 20 * 1024 * 1024) throw new HttpError(413, '请求体超过 20MB')
    chunks.push(buffer)
  }
  return Buffer.concat(chunks).toString('utf8')
}

async function readJsonBody<T>(req: IncomingMessage): Promise<T> {
  const raw = await readBody(req)
  try {
    return JSON.parse(raw) as T
  } catch {
    throw new HttpError(400, 'JSON 解析失败')
  }
}

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

function validateFolderName(part: string) {
  if (!part || part === '.' || part === '..') {
    throw new HttpError(400, `非法文件夹名: ${JSON.stringify(part)}`)
  }
  if (part.startsWith('.')) throw new HttpError(400, '文件夹名不能以点开头')
  if (/[<>:"|?*\u0000-\u001f]/.test(part)) throw new HttpError(400, `文件夹名包含非法字符: ${part}`)
  if (/[. ]$/.test(part)) throw new HttpError(400, '文件夹名不能以点或空格结尾')
  if (RESERVED_FOLDER_NAMES.test(part)) throw new HttpError(400, `文件夹名不可用: ${part}`)
  if (part.length > 80) throw new HttpError(400, '文件夹名过长')
}

function normalizeFolder(value: unknown): string {
  if (value === undefined || value === null || value === '') return ''
  if (typeof value !== 'string') throw new HttpError(400, 'folder 必须是字符串')

  const raw = value.trim().replaceAll('\\', '/')
  if (!raw) return ''

  const parts = raw.split('/')
  for (const part of parts) validateFolderName(part)
  return parts.join('/')
}

function normalizeFolderName(value: unknown): string {
  if (typeof value !== 'string') throw new HttpError(400, '文件夹名必须是字符串')
  const name = value.trim()
  if (!name) throw new HttpError(400, '文件夹名不能为空')
  if (name.includes('/') || name.includes('\\')) throw new HttpError(400, '文件夹名不能包含路径分隔符')
  validateFolderName(name)
  return name
}

function resolveBoardFile(root: string, folder: string, slug: string) {
  const boardsRoot = path.resolve(root, BOARDS_DIR)
  const dir = path.join(boardsRoot, ...folder.split('/').filter(Boolean))
  const file = path.join(dir, `${slug}.tldr.json`)
  const resolved = path.resolve(file)
  if (resolved !== boardsRoot && !resolved.startsWith(`${boardsRoot}${path.sep}`)) {
    throw new HttpError(400, '白板路径越界')
  }
  return file
}

function resolveFolderDir(root: string, folder: string) {
  const boardsRoot = path.resolve(root, BOARDS_DIR)
  const resolved = path.resolve(boardsRoot, ...folder.split('/').filter(Boolean))
  if (resolved === boardsRoot || !resolved.startsWith(`${boardsRoot}${path.sep}`)) {
    throw new HttpError(400, '文件夹路径越界')
  }
  return resolved
}

async function writeBoardFile(file: string, board: BoardFile) {
  await fs.mkdir(path.dirname(file), { recursive: true })
  const tempFile = `${file}.${process.pid}.${Date.now()}.tmp`
  await fs.writeFile(tempFile, `${JSON.stringify(board, null, 2)}\n`, 'utf8')
  await fs.rename(tempFile, file)
}

async function removeEmptyParents(root: string, file: string) {
  const boardsRoot = path.resolve(root, BOARDS_DIR)
  let dir = path.dirname(file)
  while (dir !== boardsRoot && dir.startsWith(`${boardsRoot}${path.sep}`)) {
    let entries
    try {
      entries = await fs.readdir(dir)
    } catch {
      return
    }
    if (entries.length > 0) return
    await fs.rmdir(dir)
    dir = path.dirname(dir)
  }
}

function createBlankBoard(title: string, slug: string, summary?: string): BoardFile {
  return {
    version: 1,
    meta: {
      title,
      slug,
      summary,
      updatedAt: new Date().toISOString(),
    },
    document: structuredClone(BLANK_DOCUMENT),
  }
}

async function createBoard(root: string, body: CreateBoardBody) {
  if (typeof body.title !== 'string' || !body.title.trim()) {
    throw new HttpError(400, 'title 不能为空')
  }
  if (typeof body.slug !== 'string' || !isValidSlug(body.slug)) {
    throw new HttpError(400, 'slug 非法')
  }
  if (body.summary !== undefined && typeof body.summary !== 'string') {
    throw new HttpError(400, 'summary 必须是字符串')
  }

  const folder = normalizeFolder(body.folder)
  const existing = await findBoardFile(root, body.slug)
  if (existing) throw new HttpError(409, `slug 已存在: ${body.slug}`)

  const file = resolveBoardFile(root, folder, body.slug)
  try {
    await fs.access(file)
    throw new HttpError(409, `文件已存在: ${path.relative(root, file)}`)
  } catch (error) {
    if (error instanceof HttpError) throw error
  }

  const board = createBlankBoard(body.title.trim(), body.slug, body.summary?.trim() || undefined)
  await writeBoardFile(file, board)
  return { board, folder }
}

async function patchBoard(root: string, slug: string, body: PatchBoardBody) {
  const found = await findBoardFile(root, slug)
  if (!found) throw new HttpError(404, '白板不存在')

  if (
    body.title === undefined &&
    body.slug === undefined &&
    body.folder === undefined &&
    body.summary === undefined
  ) {
    throw new HttpError(400, '没有需要修改的字段')
  }

  const title =
    body.title === undefined
      ? found.board.meta.title
      : typeof body.title === 'string' && body.title.trim()
        ? body.title.trim()
        : null
  if (title === null) throw new HttpError(400, 'title 不能为空')

  const nextSlug =
    body.slug === undefined
      ? slug
      : typeof body.slug === 'string' && isValidSlug(body.slug)
        ? body.slug
        : null
  if (nextSlug === null) throw new HttpError(400, 'slug 非法')

  const summary =
    body.summary === undefined
      ? found.board.meta.summary
      : typeof body.summary === 'string'
        ? body.summary.trim() || undefined
        : null
  if (summary === null) throw new HttpError(400, 'summary 必须是字符串')

  const nextFolder = body.folder === undefined ? found.folder : normalizeFolder(body.folder)

  if (nextSlug !== slug) {
    const conflict = await findBoardFile(root, nextSlug)
    if (conflict) throw new HttpError(409, `slug 已存在: ${nextSlug}`)
  }

  const board: BoardFile = {
    ...found.board,
    meta: {
      ...found.board.meta,
      title,
      slug: nextSlug,
      summary,
      updatedAt: new Date().toISOString(),
    },
  }

  const nextFile = resolveBoardFile(root, nextFolder, nextSlug)
  if (nextFile !== found.file) {
    try {
      await fs.access(nextFile)
      throw new HttpError(409, `文件已存在: ${path.relative(root, nextFile)}`)
    } catch (error) {
      if (error instanceof HttpError) throw error
    }
  }

  await writeBoardFile(nextFile, board)
  if (nextFile !== found.file) {
    await fs.unlink(found.file)
    await removeEmptyParents(root, found.file)
  }

  return { board, folder: nextFolder }
}

async function deleteBoard(root: string, slug: string) {
  const found = await findBoardFile(root, slug)
  if (!found) throw new HttpError(404, '白板不存在')
  await fs.unlink(found.file)
  await removeEmptyParents(root, found.file)
}

async function renameFolder(root: string, body: RenameFolderBody) {
  if (typeof body.path !== 'string') throw new HttpError(400, 'path 必须是字符串')
  const folder = normalizeFolder(body.path)
  if (!folder) throw new HttpError(400, '不能重命名根目录')
  const name = normalizeFolderName(body.name)

  const source = resolveFolderDir(root, folder)
  const target = path.resolve(path.dirname(source), name)
  const boardsRoot = path.resolve(root, BOARDS_DIR)
  if (!target.startsWith(`${boardsRoot}${path.sep}`)) throw new HttpError(400, '文件夹路径越界')

  let stat
  try {
    stat = await fs.stat(source)
  } catch {
    throw new HttpError(404, '文件夹不存在')
  }
  if (!stat.isDirectory()) throw new HttpError(404, '文件夹不存在')
  if (source === target) return { path: folder }

  const caseOnly = source.toLowerCase() === target.toLowerCase()
  if (!caseOnly) {
    try {
      await fs.access(target)
      throw new HttpError(409, `文件夹已存在: ${name}`)
    } catch (error) {
      if (error instanceof HttpError) throw error
    }
  }

  if (caseOnly) {
    const temp = `${source}.renaming-${process.pid}-${Date.now()}`
    await fs.rename(source, temp)
    await fs.rename(temp, target)
  } else {
    await fs.rename(source, target)
  }

  return { path: path.relative(boardsRoot, target).split(path.sep).join('/') }
}

async function handle(
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
      sendJson(res, 201, { ok: true, board: created.board, path: created.folder })
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
      })
      return
    }

    if (req.method === 'PATCH') {
      const body = await readJsonBody<PatchBoardBody>(req)
      const updated = await patchBoard(root, slug, body)
      sendJson(res, 200, {
        ok: true,
        meta: updated.board.meta,
        path: updated.folder,
        board: updated.board,
      })
      return
    }

    if (req.method === 'DELETE') {
      await deleteBoard(root, slug)
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

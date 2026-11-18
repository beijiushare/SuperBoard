import { parseCanvas, serializeCanvas, type CanvasDocument } from '../model'
import type { BoardScope } from '../../shared/board/types'

type DirHandle = FileSystemDirectoryHandle

interface OpenFilePickerWindow extends Window {
  showDirectoryPicker?: (options?: {
    mode?: 'read' | 'readwrite'
  }) => Promise<DirHandle>
}

const DB_NAME = 'superboard-workspace'
const STORE_NAME = 'handles'
const HANDLE_KEY = 'root'

let root: DirHandle | null = null
let installed = false

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  })
}

function normalizeFolder(value: unknown) {
  return String(value ?? '')
    .trim()
    .replaceAll('\\', '/')
    .split('/')
    .filter(Boolean)
    .join('/')
}

function normalizeScope(value: unknown): BoardScope {
  return value === 'private' ? 'private' : 'public'
}

async function database() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME)
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function storeHandle(handle: DirHandle) {
  try {
    const db = await database()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      tx.objectStore(STORE_NAME).put(handle, HANDLE_KEY)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } catch {
    // Handle persistence is optional.
  }
}

async function readStoredHandle() {
  try {
    const db = await database()
    return await new Promise<DirHandle | null>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const request = tx.objectStore(STORE_NAME).get(HANDLE_KEY)
      request.onsuccess = () => resolve((request.result as DirHandle) ?? null)
      request.onerror = () => reject(request.error)
    })
  } catch {
    return null
  }
}

function isDirectoryHandle(
  entry: FileSystemHandle,
): entry is FileSystemDirectoryHandle {
  return entry.kind === 'directory'
}

function isFileHandle(entry: FileSystemHandle): entry is FileSystemFileHandle {
  return entry.kind === 'file'
}

function directoryValues(dir: DirHandle): AsyncIterable<FileSystemHandle> {
  return (
    dir as unknown as {
      values: () => AsyncIterable<FileSystemHandle>
    }
  ).values()
}

async function ensureDirectory(
  parent: DirHandle,
  name: string,
  create = false,
) {
  return parent.getDirectoryHandle(name, { create })
}

async function scopeDirectory(scope: BoardScope, create = false) {
  if (!root) throw new Error('尚未打开工作区')
  const boards = await ensureDirectory(root, 'whiteboards', create)
  return ensureDirectory(boards, scope, create)
}

async function folderDirectory(
  scope: BoardScope,
  folder: string,
  create = false,
) {
  let current = await scopeDirectory(scope, create)
  for (const part of normalizeFolder(folder).split('/').filter(Boolean)) {
    current = await ensureDirectory(current, part, create)
  }
  return current
}

async function listFoldersIn(
  dir: DirHandle,
  scope: BoardScope,
  prefix = '',
): Promise<Array<{ path: string; scope: BoardScope }>> {
  const result: Array<{ path: string; scope: BoardScope }> = []
  for await (const entry of directoryValues(dir)) {
    if (!isDirectoryHandle(entry) || entry.name.startsWith('.')) continue
    const path = prefix ? `${prefix}/${entry.name}` : entry.name
    result.push({ path, scope })
    result.push(...(await listFoldersIn(entry, scope, path)))
  }
  return result
}

async function scanBoards(
  dir: DirHandle,
  scope: BoardScope,
  folder = '',
): Promise<Array<Record<string, unknown>>> {
  const rows: Array<Record<string, unknown>> = []
  for await (const entry of directoryValues(dir)) {
    if (entry.name.startsWith('.')) continue
    if (isDirectoryHandle(entry)) {
      rows.push(
        ...(await scanBoards(
          entry,
          scope,
          folder ? `${folder}/${entry.name}` : entry.name,
        )),
      )
      continue
    }
    if (!isFileHandle(entry) || !entry.name.endsWith('.canvas')) continue
    try {
      const file = await entry.getFile()
      const canvas = parseCanvas(await file.text())
      const meta = canvas['x-superboard']?.meta
      if (!meta) continue
      rows.push({ ...meta, path: folder, scope })
    } catch {
      // Skip malformed files until the editor reports them.
    }
  }
  return rows
}

async function listBoards() {
  return [...(await scanBoards(await scopeDirectory('public'), 'public')), ...(await scanBoards(await scopeDirectory('private'), 'private'))]
}

async function findBoard(scope: BoardScope, slug: string) {
  const boards = await scanBoards(await scopeDirectory(scope), scope)
  return boards.find((board) => board.slug === slug) ?? null
}

async function boardFile(scope: BoardScope, slug: string) {
  const current = await scopeDirectory(scope)
  const find = async (dir: DirHandle): Promise<FileSystemFileHandle | null> => {
    for await (const entry of directoryValues(dir)) {
      if (entry.name.startsWith('.')) continue
      if (isDirectoryHandle(entry)) {
        const found = await find(entry)
        if (found) return found
      } else if (isFileHandle(entry) && entry.name === `${slug}.canvas`) {
        return entry
      }
    }
    return null
  }
  return find(current)
}

async function writeFile(
  scope: BoardScope,
  folder: string,
  slug: string,
  canvas: CanvasDocument,
) {
  const dir = await folderDirectory(scope, folder, true)
  const file = await dir.getFileHandle(`${slug}.canvas`, { create: true })
  const writable = await file.createWritable()
  await writable.write(serializeCanvas(canvas))
  await writable.close()
}

function blankCanvas(title: string, slug: string): CanvasDocument {
  return {
    nodes: [],
    edges: [],
    'x-superboard': {
      version: 1,
      meta: {
        title,
        slug,
        updatedAt: new Date().toISOString(),
      },
    },
  }
}

async function handleCanvases(url: URL, init?: RequestInit) {
  const method = init?.method ?? 'GET'
  if (url.pathname === '/__canvases' && method === 'GET') {
    return response({ canvases: await listBoards() })
  }
  if (url.pathname === '/__canvases' && method === 'POST') {
    const body = JSON.parse(String(init?.body ?? '{}')) as {
      title?: string
      slug?: string
      folder?: string
      scope?: string
    }
    const title = String(body.title ?? '').trim()
    const slug = String(body.slug ?? '').trim()
    if (!title || !/^[a-z0-9][a-z0-9-]*$/.test(slug)) {
      return response({ error: '参数不正确' }, 400)
    }
    const scope = normalizeScope(body.scope)
    const folder = normalizeFolder(body.folder)
    if (await findBoard(scope, slug)) {
      return response({ error: `slug 已存在: ${slug}` }, 409)
    }
    const canvas = blankCanvas(title, slug)
    await writeFile(scope, folder, slug, canvas)
    return response({ ok: true, canvas, path: folder, scope }, 201)
  }

  const match = url.pathname.match(/^\/__canvases\/([a-z0-9][a-z0-9-]*)$/)
  if (!match) return response({ error: 'not found' }, 404)
  const slug = match[1]
  const scope = normalizeScope(url.searchParams.get('scope'))
  const file = await boardFile(scope, slug)
  if (!file) return response({ error: '白板不存在' }, 404)
  const canvas = parseCanvas(await (await file.getFile()).text())
  if (method === 'GET') return response(canvas)
  if (method === 'PUT') {
    const next = parseCanvas(String(init?.body ?? ''))
    const meta = next['x-superboard']?.meta
    if (!meta || meta.slug !== slug) return response({ error: 'slug 不一致' }, 409)
    meta.updatedAt = new Date().toISOString()
    const board = await findBoard(scope, slug)
    await writeFile(scope, String(board?.path ?? ''), slug, next)
    return response({ ok: true, meta, path: board?.path ?? '', scope })
  }
  if (method === 'PATCH') {
    const body = JSON.parse(String(init?.body ?? '{}')) as {
      title?: string
      slug?: string
      folder?: string
      summary?: string
    }
    const meta = canvas['x-superboard']?.meta
    if (!meta) return response({ error: '缺少 meta' }, 400)
    const nextSlug = body.slug === undefined ? slug : String(body.slug)
    if (!/^[a-z0-9][a-z0-9-]*$/.test(nextSlug)) return response({ error: 'slug 非法' }, 400)
    const board = await findBoard(scope, slug)
    const nextFolder = body.folder === undefined ? String(board?.path ?? '') : normalizeFolder(body.folder)
    const nextCanvas: CanvasDocument = {
      ...canvas,
      'x-superboard': {
        ...canvas['x-superboard'],
        version: 1,
        meta: {
          ...meta,
          title: body.title?.trim() || meta.title,
          slug: nextSlug,
          summary: body.summary?.trim() || undefined,
          updatedAt: new Date().toISOString(),
        },
      },
    }
    await writeFile(scope, nextFolder, nextSlug, nextCanvas)
    if (nextFolder !== String(board?.path ?? '') || nextSlug !== slug) {
      const oldDir = await folderDirectory(scope, String(board?.path ?? ''))
      await oldDir.removeEntry(`${slug}.canvas`).catch(() => {})
    }
    return response({ ok: true, canvas: nextCanvas, meta: nextCanvas['x-superboard']?.meta, path: nextFolder, scope })
  }
  if (method === 'DELETE') {
    const board = await findBoard(scope, slug)
    const dir = await folderDirectory(scope, String(board?.path ?? ''))
    await dir.removeEntry(`${slug}.canvas`)
    return response({ ok: true })
  }
  return response({ error: 'method not allowed' }, 405)
}

async function copyDirectory(source: DirHandle, target: DirHandle) {
  for await (const entry of directoryValues(source)) {
    if (isDirectoryHandle(entry)) {
      const child = await target.getDirectoryHandle(entry.name, { create: true })
      await copyDirectory(entry, child)
    } else if (isFileHandle(entry)) {
      const file = await entry.getFile()
      const next = await target.getFileHandle(entry.name, { create: true })
      const writable = await next.createWritable()
      await writable.write(file)
      await writable.close()
    }
  }
}

async function handleFolders(url: URL, init?: RequestInit) {
  const method = init?.method ?? 'GET'
  if (url.pathname === '/__folders' && method === 'GET') {
    return response({
      folders: [
        ...(await listFoldersIn(await scopeDirectory('public'), 'public')),
        ...(await listFoldersIn(await scopeDirectory('private'), 'private')),
      ],
    })
  }
  if (url.pathname === '/__folders' && method === 'POST') {
    const body = JSON.parse(String(init?.body ?? '{}')) as {
      parent?: string
      name?: string
      scope?: string
    }
    const scope = normalizeScope(body.scope)
    const parent = normalizeFolder(body.parent)
    const name = String(body.name ?? '').trim()
    if (!name || name.includes('/') || name.includes('\\')) {
      return response({ error: '文件夹名不合法' }, 400)
    }
    const dir = await folderDirectory(scope, parent, true)
    await dir.getDirectoryHandle(name, { create: true })
    return response({ ok: true, path: parent ? `${parent}/${name}` : name }, 201)
  }
  if (url.pathname === '/__folders' && method === 'PATCH') {
    const body = JSON.parse(String(init?.body ?? '{}')) as {
      path?: string
      name?: string
      parent?: string
      scope?: string
    }
    const scope = normalizeScope(body.scope)
    const sourcePath = normalizeFolder(body.path)
    const currentParent = sourcePath.split('/').slice(0, -1).join('/')
    const parent = body.parent === undefined ? currentParent : normalizeFolder(body.parent)
    const name = String(body.name ?? '').trim()
    if (!sourcePath || !name) return response({ error: '参数不完整' }, 400)
    const targetPath = parent ? `${parent}/${name}` : name
    if (targetPath === sourcePath) {
      return response({ ok: true, path: sourcePath })
    }
    if (parent === sourcePath || parent.startsWith(`${sourcePath}/`)) {
      return response({ error: '不能移动到自身或子目录' }, 400)
    }
    const sourceParent = await folderDirectory(scope, currentParent)
    const source = await sourceParent.getDirectoryHandle(sourcePath.split('/').pop()!)
    const targetParent = await folderDirectory(scope, parent, true)
    const target = await targetParent.getDirectoryHandle(name, { create: true })
    await copyDirectory(source, target)
    await sourceParent.removeEntry(sourcePath.split('/').pop()!, { recursive: true })
    return response({ ok: true, path: parent ? `${parent}/${name}` : name })
  }
  if (url.pathname === '/__folders' && method === 'DELETE') {
    const scope = normalizeScope(url.searchParams.get('scope'))
    const path = normalizeFolder(url.searchParams.get('path'))
    if (!path) return response({ error: '不能删除根目录' }, 400)
    const parent = await folderDirectory(scope, path.split('/').slice(0, -1).join('/'))
    await parent.removeEntry(path.split('/').pop()!, { recursive: true })
    return response({ ok: true })
  }
  return response({ error: 'method not allowed' }, 405)
}

export async function openBrowserWorkspace() {
  const picker = (window as OpenFilePickerWindow).showDirectoryPicker
  if (!picker) throw new Error('当前浏览器不支持本地文件夹')
  const handle = await picker({ mode: 'readwrite' })
  root = handle
  await scopeDirectory('public', true)
  await scopeDirectory('private', true)
  await storeHandle(handle)
  return handle
}

export async function restoreBrowserWorkspace() {
  const handle = await readStoredHandle()
  if (!handle) return null
  const permission = await (handle as unknown as {
    queryPermission: (options: { mode: 'readwrite' }) => Promise<PermissionState>
  }).queryPermission({ mode: 'readwrite' })
  if (permission !== 'granted') return null
  root = handle
  await scopeDirectory('public', true)
  await scopeDirectory('private', true)
  return handle
}

export function installBrowserFolderBackend() {
  if (installed) return
  installed = true
  const originalFetch = window.fetch.bind(window)
  window.fetch = async (input, init) => {
    const rawUrl = typeof input === 'string' ? input : input instanceof Request ? input.url : input.toString()
    const url = new URL(rawUrl, window.location.href)
    if (url.pathname.startsWith('/__canvases')) return handleCanvases(url, init)
    if (url.pathname.startsWith('/__folders')) return handleFolders(url, init)
    return originalFetch(input, init)
  }
}

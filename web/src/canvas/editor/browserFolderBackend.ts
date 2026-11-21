import i18n from '../../i18n'
import { parseCanvas, serializeCanvas, type CanvasDocument } from '../model'
import type { BoardScope } from '../../shared/board/types'
import { configureWorkspaceFetcher } from './workspaceApi'
import {
  beginFolderMove,
  finishFolderMove,
  isFolderMoveCancelled,
  reportFolderMoveProgress,
} from './folderMove'

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

// Baseline file text observed by this tab. A mismatch means another tab (or
// an external editor) changed the file after we read it.
const versions = new Map<string, string>()

let boardsCache: { at: number; rows: Array<Record<string, unknown>> } | null = null
const BOARDS_CACHE_MS = 1500

function invalidateBoardCache() {
  boardsCache = null
}

if (typeof window !== 'undefined') {
  window.addEventListener('focus', invalidateBoardCache)
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) invalidateBoardCache()
  })
}

function versionKey(scope: BoardScope, slug: string) {
  return `${scope}/${slug}`
}

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

type RecentWorkspaceEntry = {
  id: string
  handle: DirHandle
  name: string
  lastOpened: string
}

const RECENT_KEY = 'recent'
const recentHandles = new Map<string, DirHandle>()

async function readRecentEntries() {
  try {
    const db = await database()
    return await new Promise<RecentWorkspaceEntry[]>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const request = tx.objectStore(STORE_NAME).get(RECENT_KEY)
      request.onsuccess = () =>
        resolve((request.result as RecentWorkspaceEntry[] | undefined) ?? [])
      request.onerror = () => reject(request.error)
    })
  } catch {
    return []
  }
}

async function writeRecentEntries(entries: RecentWorkspaceEntry[]) {
  try {
    const db = await database()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      tx.objectStore(STORE_NAME).put(entries, RECENT_KEY)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } catch {
    // Recent list is best effort.
  }
}

async function rememberHandle(handle: DirHandle) {
  try {
    const entries = await readRecentEntries()
    const existing = entries.find((entry) => entry.name === handle.name)
    const id = existing?.id ?? crypto.randomUUID()
    const next = [
      {
        id,
        handle,
        name: handle.name,
        lastOpened: new Date().toISOString(),
      },
      ...entries.filter((entry) => entry.id !== id),
    ].slice(0, 8)
    await writeRecentEntries(next)
    recentHandles.set(id, handle)
  } catch {
    // Ignore persistence errors.
  }
}

async function permissionOf(handle: DirHandle) {
  try {
    return await (
      handle as unknown as {
        queryPermission: (options: {
          mode: 'readwrite'
        }) => Promise<PermissionState>
      }
    ).queryPermission({ mode: 'readwrite' })
  } catch {
    return 'denied' as PermissionState
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
  if (!root) throw new Error(i18n.t('errors:workspace.noWorkspace'))
  // New layout: <workspace>/public and <workspace>/private.
  // Legacy layout: <workspace>/whiteboards/<scope>.
  try {
    const legacy = await root.getDirectoryHandle('whiteboards')
    return await legacy.getDirectoryHandle(scope, { create })
  } catch {
    return root.getDirectoryHandle(scope, { create })
  }
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
  if (boardsCache && Date.now() - boardsCache.at < BOARDS_CACHE_MS) {
    return boardsCache.rows
  }
  const rows = [
    ...(await scanBoards(await scopeDirectory('public'), 'public')),
    ...(await scanBoards(await scopeDirectory('private'), 'private')),
  ]
  boardsCache = { at: Date.now(), rows }
  return rows
}

async function findBoard(scope: BoardScope, slug: string) {
  const boards = await scanBoards(await scopeDirectory(scope), scope)
  return boards.find((board) => board.slug === slug) ?? null
}

async function boardLocation(scope: BoardScope, slug: string) {
  const current = await scopeDirectory(scope)
  const find = async (
    dir: DirHandle,
    prefix: string,
  ): Promise<{ file: FileSystemFileHandle; path: string } | null> => {
    for await (const entry of directoryValues(dir)) {
      if (entry.name.startsWith('.')) continue
      if (isDirectoryHandle(entry)) {
        const found = await find(
          entry,
          prefix ? `${prefix}/${entry.name}` : entry.name,
        )
        if (found) return found
      } else if (isFileHandle(entry) && entry.name === `${slug}.canvas`) {
        return { file: entry, path: prefix }
      }
    }
    return null
  }
  return find(current, '')
}

async function writeTextFile(
  dir: DirHandle,
  name: string,
  text: string,
) {
  const file = await dir.getFileHandle(name, { create: true })
  const writable = await file.createWritable()
  await writable.write(text)
  await writable.close()
}

async function writeFile(
  scope: BoardScope,
  folder: string,
  slug: string,
  canvas: CanvasDocument,
) {
  const text = serializeCanvas(canvas)
  parseCanvas(text)
  const dir = await folderDirectory(scope, folder, true)
  let backup: string | null = null
  try {
    const current = await dir.getFileHandle(`${slug}.canvas`)
    backup = await (await current.getFile()).text()
    await writeTextFile(dir, `${slug}.canvas.bak`, backup)
  } catch {
    backup = null
  }
  try {
    await writeTextFile(dir, `${slug}.canvas`, text)
  } catch (error) {
    if (backup !== null) {
      await writeTextFile(dir, `${slug}.canvas`, backup).catch(() => {})
    }
    throw error
  }
  versions.set(versionKey(scope, slug), text)
  invalidateBoardCache()
  return text
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
      return response({ error: i18n.t('errors:workspace.badParams') }, 400)
    }
    const scope = normalizeScope(body.scope)
    const folder = normalizeFolder(body.folder)
    if (await findBoard(scope, slug)) {
      return response({ error: i18n.t('errors:workspace.slugExists', { slug }) }, 409)
    }
    const canvas = blankCanvas(title, slug)
    await writeFile(scope, folder, slug, canvas)
    return response({ ok: true, canvas, path: folder, scope }, 201)
  }

  const match = url.pathname.match(/^\/__canvases\/([a-z0-9][a-z0-9-]*)$/)
  if (!match) return response({ error: 'not found' }, 404)
  const slug = match[1]
  const scope = normalizeScope(url.searchParams.get('scope'))
  const location = await boardLocation(scope, slug)
  if (!location) return response({ error: i18n.t('errors:workspace.boardMissing') }, 404)
  const file = location.file
  const text = await (await file.getFile()).text()
  const canvas = parseCanvas(text)
  const key = versionKey(scope, slug)
  if (method === 'GET') {
    versions.set(key, text)
    return response(canvas)
  }
  if (method === 'PUT') {
    const bodyText = String(init?.body ?? '')
    const next = parseCanvas(bodyText)
    const meta = next['x-superboard']?.meta
    if (!meta || meta.slug !== slug) {
      return response({ error: i18n.t('errors:workspace.slugMismatch') }, 409)
    }
    const force = new Headers(init?.headers).get('x-superboard-force') === '1'
    const baseline = versions.get(key)
    if (!force && baseline !== undefined && baseline !== text && bodyText !== text) {
      return response(
        { error: i18n.t('errors:workspace.conflictOtherTab') },
        409,
      )
    }
    meta.updatedAt = new Date().toISOString()
    await writeFile(scope, location.path, slug, next)
    return response({ ok: true, meta, path: location.path, scope })
  }
  if (method === 'PATCH') {
    const body = JSON.parse(String(init?.body ?? '{}')) as {
      title?: string
      slug?: string
      folder?: string
      summary?: string
    }
    const meta = canvas['x-superboard']?.meta
    if (!meta) return response({ error: i18n.t('errors:workspace.missingMeta') }, 400)
    const nextSlug = body.slug === undefined ? slug : String(body.slug)
    if (!/^[a-z0-9][a-z0-9-]*$/.test(nextSlug)) {
      return response({ error: i18n.t('errors:workspace.badSlug') }, 400)
    }
    const nextFolder =
      body.folder === undefined ? location.path : normalizeFolder(body.folder)
    if (nextSlug !== slug || nextFolder !== location.path) {
      try {
        const targetDir = await folderDirectory(scope, nextFolder)
        await targetDir.getFileHandle(`${nextSlug}.canvas`)
        return response(
          { error: i18n.t('errors:workspace.slugExists', { slug: nextSlug }) },
          409,
        )
      } catch (error) {
        if (!(error instanceof DOMException) || error.name !== 'NotFoundError') {
          throw error
        }
      }
    }
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
    if (nextSlug !== slug) versions.delete(key)
    if (nextFolder !== location.path || nextSlug !== slug) {
      const oldDir = await folderDirectory(scope, location.path)
      await oldDir.removeEntry(`${slug}.canvas`).catch(() => {})
    }
    return response({ ok: true, canvas: nextCanvas, meta: nextCanvas['x-superboard']?.meta, path: nextFolder, scope })
  }
  if (method === 'DELETE') {
    const dir = await folderDirectory(scope, location.path)
    await dir.removeEntry(`${slug}.canvas`)
    versions.delete(key)
    invalidateBoardCache()
    return response({ ok: true })
  }
  return response({ error: 'method not allowed' }, 405)
}

async function countFiles(dir: DirHandle): Promise<number> {
  let total = 0
  for await (const entry of directoryValues(dir)) {
    if (isDirectoryHandle(entry)) total += await countFiles(entry)
    else if (isFileHandle(entry)) total += 1
  }
  return total
}

async function copyDirectory(
  source: DirHandle,
  target: DirHandle,
  onFile?: () => void,
) {
  for await (const entry of directoryValues(source)) {
    if (isFolderMoveCancelled()) {
      throw new DOMException(
        i18n.t('errors:workspace.moveCancelled'),
        'AbortError',
      )
    }
    if (isDirectoryHandle(entry)) {
      const child = await target.getDirectoryHandle(entry.name, { create: true })
      await copyDirectory(entry, child, onFile)
    } else if (isFileHandle(entry)) {
      const file = await entry.getFile()
      const next = await target.getFileHandle(entry.name, { create: true })
      const writable = await next.createWritable()
      await writable.write(file)
      await writable.close()
      onFile?.()
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
      return response({ error: i18n.t('errors:workspace.badFolderName') }, 400)
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
    if (!sourcePath || !name) {
      return response({ error: i18n.t('errors:workspace.badParams') }, 400)
    }
    const targetPath = parent ? `${parent}/${name}` : name
    if (targetPath === sourcePath) {
      return response({ ok: true, path: sourcePath })
    }
    if (parent === sourcePath || parent.startsWith(`${sourcePath}/`)) {
      return response({ error: i18n.t('errors:workspace.moveIntoSelf') }, 400)
    }
    const sourceParent = await folderDirectory(scope, currentParent)
    const source = await sourceParent.getDirectoryHandle(sourcePath.split('/').pop()!)
    const targetParent = await folderDirectory(scope, parent, true)
    try {
      await targetParent.getDirectoryHandle(name)
      return response(
        { error: i18n.t('errors:workspace.folderExists', { name }) },
        409,
      )
    } catch (error) {
      if (!(error instanceof DOMException) || error.name !== 'NotFoundError') {
        throw error
      }
    }
    beginFolderMove()
    reportFolderMoveProgress({ phase: 'start', copied: 0, total: 0 })
    try {
      const move = (source as DirHandle & {
        move?: (parent: DirHandle, name?: string) => Promise<void>
      }).move
      if (typeof move === 'function') {
        await move.call(source, targetParent, name)
      } else {
        const target = await targetParent.getDirectoryHandle(name, {
          create: true,
        })
        const total = await countFiles(source)
        let copied = 0
        reportFolderMoveProgress({ phase: 'progress', copied, total })
        await copyDirectory(source, target, () => {
          copied += 1
          reportFolderMoveProgress({ phase: 'progress', copied, total })
        })
        if (isFolderMoveCancelled()) {
          throw new DOMException(
            i18n.t('errors:workspace.moveCancelled'),
            'AbortError',
          )
        }
        await sourceParent.removeEntry(sourcePath.split('/').pop()!, {
          recursive: true,
        })
      }
    } catch (error) {
      await targetParent.removeEntry(name, { recursive: true }).catch(() => {})
      if (error instanceof DOMException && error.name === 'AbortError') {
        return response({ error: i18n.t('errors:workspace.moveCancelled') }, 409)
      }
      throw error
    } finally {
      finishFolderMove()
      reportFolderMoveProgress({ phase: 'end', copied: 0, total: 0 })
    }
    invalidateBoardCache()
    return response({ ok: true, path: parent ? `${parent}/${name}` : name })
  }
  if (url.pathname === '/__folders' && method === 'DELETE') {
    const scope = normalizeScope(url.searchParams.get('scope'))
    const path = normalizeFolder(url.searchParams.get('path'))
    if (!path) return response({ error: i18n.t('errors:workspace.deleteRoot') }, 400)
    const parent = await folderDirectory(scope, path.split('/').slice(0, -1).join('/'))
    await parent.removeEntry(path.split('/').pop()!, { recursive: true })
    invalidateBoardCache()
    return response({ ok: true })
  }
  return response({ error: 'method not allowed' }, 405)
}

export async function openBrowserWorkspace() {
  const picker = (window as OpenFilePickerWindow).showDirectoryPicker
  if (!picker) throw new Error(i18n.t('errors:workspace.noFolderSupport'))
  const handle = await picker({ mode: 'readwrite' })
  root = handle
  await scopeDirectory('public', true)
  await scopeDirectory('private', true)
  await storeHandle(handle)
  await rememberHandle(handle)
  return handle
}

export async function restoreBrowserWorkspace() {
  const handle = await readStoredHandle()
  if (!handle) return null
  await rememberHandle(handle)
  const permission = await permissionOf(handle)
  if (permission !== 'granted') return null
  root = handle
  await scopeDirectory('public', true)
  await scopeDirectory('private', true)
  return handle
}

async function directoryAccessible(handle: DirHandle) {
  const iterable = handle as DirHandle & {
    values?: () => AsyncIterableIterator<FileSystemHandle>
  }
  if (!iterable.values) return true
  try {
    await iterable.values().next()
    return true
  } catch {
    return false
  }
}

export async function listBrowserRecent() {
  const entries = await readRecentEntries()
  const rows = []
  const live: RecentWorkspaceEntry[] = []
  for (const entry of entries) {
    const permission = await permissionOf(entry.handle)
    if (permission === 'denied') continue
    if (permission === 'granted' && !(await directoryAccessible(entry.handle))) {
      continue
    }
    live.push(entry)
    recentHandles.set(entry.id, entry.handle)
    rows.push({
      id: entry.id,
      name: entry.name,
      lastOpened: entry.lastOpened,
      permission,
      available: true,
    })
  }
  if (live.length !== entries.length) {
    await writeRecentEntries(live)
  }
  return rows.sort((left, right) =>
    right.lastOpened.localeCompare(left.lastOpened),
  )
}

export async function openBrowserRecent(id: string) {
  let handle = recentHandles.get(id)
  if (!handle) {
    const entries = await readRecentEntries()
    handle = entries.find((entry) => entry.id === id)?.handle
  }
  if (!handle) throw new Error(i18n.t('errors:workspace.recentMissing'))
  const permission = await (
    handle as unknown as {
      requestPermission: (options: {
        mode: 'readwrite'
      }) => Promise<PermissionState>
    }
  ).requestPermission({ mode: 'readwrite' })
  if (permission !== 'granted') throw new Error(i18n.t('errors:workspace.permissionDenied'))
  root = handle
  await scopeDirectory('public', true)
  await scopeDirectory('private', true)
  await storeHandle(handle)
  await rememberHandle(handle)
  return handle.name
}

export async function forgetBrowserRecent(id: string) {
  const entries = await readRecentEntries()
  await writeRecentEntries(entries.filter((entry) => entry.id !== id))
  recentHandles.delete(id)
}

export function isBrowserFolderMode() {
  return installed
}

export function browserWorkspaceName() {
  return root?.name ?? ''
}

function sanitizeFileName(name: string) {
  const cleaned = name
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_')
    .replace(/[. ]+$/g, '')
    .trim()
  return cleaned || 'file'
}

async function uniqueFileName(dir: DirHandle, name: string) {
  const dot = name.lastIndexOf('.')
  const stem = dot > 0 ? name.slice(0, dot) : name
  const extension = dot > 0 ? name.slice(dot) : ''
  for (let index = 1; index < 10000; index += 1) {
    const candidate = index === 1 ? name : `${stem}-${index}${extension}`
    try {
      await dir.getFileHandle(candidate)
    } catch (error) {
      if (error instanceof DOMException && error.name === 'NotFoundError') {
        return candidate
      }
      throw error
    }
  }
  throw new Error(i18n.t('errors:workspace.uniqueNameFailed'))
}

export async function importBrowserFile(file: File, scope: BoardScope) {
  if (!root) throw new Error(i18n.t('errors:workspace.noWorkspace'))
  const dir = await folderDirectory(scope, 'assets/files', true)
  const name = await uniqueFileName(dir, sanitizeFileName(file.name))
  const handle = await dir.getFileHandle(name, { create: true })
  const writable = await handle.createWritable()
  await writable.write(file)
  await writable.close()
  invalidateBoardCache()
  return `${scope}/assets/files/${name}`
}

export async function browserFileUrl(path: string) {
  if (!root) return null
  const parts = path.split('/').filter(Boolean)
  const scope = normalizeScope(parts.shift())
  const fileName = parts.pop()
  if (!fileName) return null
  let dir = await scopeDirectory(scope)
  for (const part of parts) {
    dir = await dir.getDirectoryHandle(part)
  }
  const file = await (await dir.getFileHandle(fileName)).getFile()
  return URL.createObjectURL(file)
}

export async function browserRequest(
  input: RequestInfo | URL,
  init?: RequestInit,
) {
  const rawUrl =
    typeof input === 'string'
      ? input
      : input instanceof Request
        ? input.url
        : input.toString()
  const url = new URL(rawUrl, window.location.href)
  if (url.pathname.startsWith('/__canvases')) return handleCanvases(url, init)
  if (url.pathname.startsWith('/__folders')) return handleFolders(url, init)
  return new Response(JSON.stringify({ error: 'not found' }), {
    status: 404,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  })
}

export function installBrowserFolderBackend() {
  if (installed) return
  installed = true
  configureWorkspaceFetcher(browserRequest)
}

import type { BoardScope } from '../../shared/board/types'

type DirHandle = FileSystemDirectoryHandle

export interface BrowserHistoryEntry {
  id: string
  createdAt: string
  size: number
}

const HISTORY_MAX_BYTES = 2 * 1024 * 1024
const ENTRY_PATTERN = /^\d{13}-[a-f0-9]{10}$/

function directoryValues(dir: DirHandle): AsyncIterable<FileSystemHandle> {
  return (
    dir as unknown as {
      values: () => AsyncIterable<FileSystemHandle>
    }
  ).values()
}

function isDirectoryHandle(
  entry: FileSystemHandle,
): entry is FileSystemDirectoryHandle {
  return entry.kind === 'directory'
}

function isFileHandle(entry: FileSystemHandle): entry is FileSystemFileHandle {
  return entry.kind === 'file'
}

/** Short deterministic digest; only used to skip identical snapshots. */
export function historyContentHash(text: string) {
  let first = 5381
  let second = 52711
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index)
    first = ((first * 33) ^ code) >>> 0
    second = ((second * 31) + code) >>> 0
  }
  return `${first.toString(16).padStart(8, '0')}${second
    .toString(16)
    .padStart(8, '0')}`.slice(0, 10)
}

export function historyTimestamp(id: string) {
  const value = Number.parseInt(id.slice(0, 13), 10)
  return Number.isFinite(value) ? value : 0
}

async function historyRoot(root: DirHandle, create: boolean) {
  const base = await root.getDirectoryHandle('.superboard', { create })
  return base.getDirectoryHandle('history', { create })
}

async function historyDir(
  root: DirHandle,
  scope: BoardScope,
  slug: string,
  create: boolean,
) {
  const base = await historyRoot(root, create)
  const scoped = await base.getDirectoryHandle(scope, { create })
  return scoped.getDirectoryHandle(slug, { create })
}

async function tryHistoryDir(
  root: DirHandle,
  scope: BoardScope,
  slug: string,
) {
  try {
    return await historyDir(root, scope, slug, false)
  } catch {
    return null
  }
}

async function writeTextFile(dir: DirHandle, name: string, text: string) {
  const file = await dir.getFileHandle(name, { create: true })
  const writable = await file.createWritable()
  await writable.write(text)
  await writable.close()
}

export async function listBrowserHistory(
  root: DirHandle,
  scope: BoardScope,
  slug: string,
) {
  const dir = await tryHistoryDir(root, scope, slug)
  const entries: BrowserHistoryEntry[] = []
  let totalSize = 0
  if (!dir) return { entries, totalSize }
  for await (const entry of directoryValues(dir)) {
    if (!isFileHandle(entry) || !entry.name.endsWith('.canvas')) continue
    const id = entry.name.slice(0, -'.canvas'.length)
    if (!ENTRY_PATTERN.test(id)) continue
    const file = await entry.getFile()
    const millis = historyTimestamp(id)
    entries.push({
      id,
      createdAt: new Date(millis).toISOString(),
      size: file.size,
    })
    totalSize += file.size
  }
  entries.sort((left, right) => (left.id < right.id ? 1 : -1))
  return { entries, totalSize }
}

export async function readBrowserHistoryEntry(
  root: DirHandle,
  scope: BoardScope,
  slug: string,
  id: string,
) {
  if (!ENTRY_PATTERN.test(id)) throw new Error('history.badEntry')
  const dir = await tryHistoryDir(root, scope, slug)
  if (!dir) throw new Error('history.missing')
  const file = await dir.getFileHandle(`${id}.canvas`)
  return (await file.getFile()).text()
}

async function trimBrowserHistory(
  dir: DirHandle,
  limit: number,
) {
  const entries: string[] = []
  for await (const entry of directoryValues(dir)) {
    if (!isFileHandle(entry) || !entry.name.endsWith('.canvas')) continue
    const id = entry.name.slice(0, -'.canvas'.length)
    if (ENTRY_PATTERN.test(id)) entries.push(id)
  }
  entries.sort((left, right) => (left < right ? 1 : -1))
  for (const id of entries.slice(limit)) {
    await dir.removeEntry(`${id}.canvas`).catch(() => {})
  }
}

export async function appendBrowserHistory(
  root: DirHandle,
  scope: BoardScope,
  slug: string,
  text: string,
  limit: number,
) {
  if (limit <= 0 || text.length > HISTORY_MAX_BYTES) return
  const dir = await historyDir(root, scope, slug, true)
  let millis = Date.now()
  const hash = historyContentHash(text)
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const id = `${String(millis + attempt).padStart(13, '0')}-${hash}`
    try {
      await dir.getFileHandle(`${id}.canvas`)
      continue
    } catch {
      await writeTextFile(dir, `${id}.canvas`, text)
      await trimBrowserHistory(dir, limit)
      return
    }
  }
}

/** Samples written content: first change after a gap, then at most once per interval. */
export async function snapshotBrowserHistory(
  root: DirHandle,
  scope: BoardScope,
  slug: string,
  text: string,
  intervalSeconds: number,
  limit: number,
) {
  if (intervalSeconds <= 0 || limit <= 0 || text.length > HISTORY_MAX_BYTES) {
    return
  }
  const { entries } = await listBrowserHistory(root, scope, slug)
  const hash = historyContentHash(text)
  if (entries.length > 0) {
    const newest = entries[0]
    if (newest.id.endsWith(hash)) return
    if (Date.now() - historyTimestamp(newest.id) < intervalSeconds * 1000) {
      return
    }
  }
  await appendBrowserHistory(root, scope, slug, text, limit)
}

export async function moveBrowserHistory(
  root: DirHandle,
  scope: BoardScope,
  from: string,
  to: string,
) {
  if (from === to) return
  const source = await tryHistoryDir(root, scope, from)
  if (!source) return
  const target = await historyDir(root, scope, to, true)
  for await (const entry of directoryValues(source)) {
    if (!isFileHandle(entry)) continue
    const file = await entry.getFile()
    await writeTextFile(target, entry.name, await file.text())
  }
  await removeBrowserHistory(root, scope, from)
}

export async function removeBrowserHistory(
  root: DirHandle,
  scope: BoardScope,
  slug: string,
) {
  const base = await historyRoot(root, true).catch(() => null)
  if (!base) return
  const scoped = await base.getDirectoryHandle(scope, { create: false }).catch(() => null)
  if (!scoped) return
  await scoped.removeEntry(slug, { recursive: true }).catch(() => {})
}

export async function removeBrowserFolderHistory(
  root: DirHandle,
  scope: BoardScope,
  dir: DirHandle,
) {
  for await (const entry of directoryValues(dir)) {
    if (isDirectoryHandle(entry)) {
      await removeBrowserFolderHistory(root, scope, entry)
      continue
    }
    if (!isFileHandle(entry) || !entry.name.endsWith('.canvas')) continue
    const slug = entry.name.slice(0, -'.canvas'.length)
    if (/^[a-z0-9][a-z0-9-]*$/.test(slug)) {
      await removeBrowserHistory(root, scope, slug)
    }
  }
}

export async function clearAllBrowserHistory(root: DirHandle) {
  await root.removeEntry('.superboard', { recursive: true }).catch(() => {})
}

export async function browserHistoryStats(root: DirHandle) {
  let totalSize = 0
  let count = 0
  const walk = async (dir: DirHandle) => {
    for await (const entry of directoryValues(dir)) {
      if (isDirectoryHandle(entry)) {
        await walk(entry)
        continue
      }
      if (!isFileHandle(entry) || !entry.name.endsWith('.canvas')) continue
      const file = await entry.getFile()
      totalSize += file.size
      count += 1
    }
  }
  try {
    const base = await historyRoot(root, false)
    await walk(base)
  } catch {
    return { totalSize: 0, count: 0 }
  }
  return { totalSize, count }
}

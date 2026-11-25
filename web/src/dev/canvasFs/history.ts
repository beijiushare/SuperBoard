import { createHash } from 'node:crypto'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import type { BoardScope } from '../../shared/board/types'

const HISTORY_MAX_BYTES = 2 * 1024 * 1024
const ENTRY_PATTERN = /^\d{13}-[a-f0-9]{10}$/

export interface DevHistoryEntry {
  id: string
  createdAt: string
  size: number
}

function historyRoot(root: string) {
  return path.join(root, '.superboard', 'history')
}

function historyDir(root: string, scope: BoardScope, slug: string) {
  return path.join(historyRoot(root), scope, slug)
}

function contentHash(text: string) {
  return createHash('sha1').update(text).digest('hex').slice(0, 10)
}

export const devHistoryContentHash = contentHash

function entryTimestamp(id: string) {
  const value = Number.parseInt(id.slice(0, 13), 10)
  return Number.isFinite(value) ? value : 0
}

export async function listDevHistory(
  root: string,
  scope: BoardScope,
  slug: string,
) {
  const entries: DevHistoryEntry[] = []
  let totalSize = 0
  let names: string[] = []
  try {
    names = await fs.readdir(historyDir(root, scope, slug))
  } catch {
    return { entries, totalSize }
  }
  for (const name of names) {
    if (!name.endsWith('.canvas')) continue
    const id = name.slice(0, -'.canvas'.length)
    if (!ENTRY_PATTERN.test(id)) continue
    const stats = await fs.stat(path.join(historyDir(root, scope, slug), name))
    entries.push({
      id,
      createdAt: new Date(entryTimestamp(id)).toISOString(),
      size: stats.size,
    })
    totalSize += stats.size
  }
  entries.sort((left, right) => (left.id < right.id ? 1 : -1))
  return { entries, totalSize }
}

export async function readDevHistoryEntry(
  root: string,
  scope: BoardScope,
  slug: string,
  id: string,
) {
  if (!ENTRY_PATTERN.test(id)) throw new Error('history.badEntry')
  return fs.readFile(path.join(historyDir(root, scope, slug), `${id}.canvas`), 'utf8')
}

async function trimDevHistory(
  root: string,
  scope: BoardScope,
  slug: string,
  limit: number,
) {
  const { entries } = await listDevHistory(root, scope, slug)
  for (const entry of entries.slice(limit)) {
    await fs
      .unlink(path.join(historyDir(root, scope, slug), `${entry.id}.canvas`))
      .catch(() => {})
  }
}

export async function appendDevHistory(
  root: string,
  scope: BoardScope,
  slug: string,
  text: string,
  limit: number,
) {
  if (limit <= 0 || text.length > HISTORY_MAX_BYTES) return
  const dir = historyDir(root, scope, slug)
  await fs.mkdir(dir, { recursive: true })
  const hash = contentHash(text)
  let millis = Date.now()
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const id = `${String(millis + attempt).padStart(13, '0')}-${hash}`
    const target = path.join(dir, `${id}.canvas`)
    try {
      await fs.access(target)
      continue
    } catch {
      const temp = path.join(dir, `.${id}.canvas.tmp`)
      await fs.writeFile(temp, text, 'utf8')
      await fs.rename(temp, target)
      await trimDevHistory(root, scope, slug, limit)
      return
    }
  }
}

export async function snapshotDevHistory(
  root: string,
  scope: BoardScope,
  slug: string,
  text: string,
  intervalSeconds: number,
  limit: number,
) {
  if (intervalSeconds <= 0 || limit <= 0 || text.length > HISTORY_MAX_BYTES) {
    return
  }
  const { entries } = await listDevHistory(root, scope, slug)
  const hash = contentHash(text)
  if (entries.length > 0) {
    const newest = entries[0]
    if (newest.id.endsWith(hash)) return
    if (Date.now() - entryTimestamp(newest.id) < intervalSeconds * 1000) {
      return
    }
  }
  await appendDevHistory(root, scope, slug, text, limit)
}

export async function removeDevHistory(
  root: string,
  scope: BoardScope,
  slug: string,
) {
  await fs.rm(historyDir(root, scope, slug), { recursive: true, force: true })
}

export async function moveDevHistory(
  root: string,
  scope: BoardScope,
  from: string,
  to: string,
) {
  if (from === to) return
  const source = historyDir(root, scope, from)
  const target = historyDir(root, scope, to)
  try {
    await fs.access(source)
  } catch {
    return
  }
  await fs.rm(target, { recursive: true, force: true })
  await fs.mkdir(path.dirname(target), { recursive: true })
  await fs.rename(source, target)
}

export async function removeDevFolderHistory(
  root: string,
  scope: BoardScope,
  dir: string,
) {
  const walk = async (current: string) => {
    let entries: Array<import('node:fs').Dirent> = []
    try {
      entries = await fs.readdir(current, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      const full = path.join(current, entry.name)
      if (entry.isDirectory()) {
        await walk(full)
        continue
      }
      if (!entry.name.endsWith('.canvas')) continue
      const slug = entry.name.slice(0, -'.canvas'.length)
      if (/^[a-z0-9][a-z0-9-]*$/.test(slug)) {
        await removeDevHistory(root, scope, slug)
      }
    }
  }
  await walk(dir)
}

export async function devHistoryStats(root: string) {
  let totalSize = 0
  let count = 0
  const walk = async (dir: string) => {
    let entries: Array<import('node:fs').Dirent> = []
    try {
      entries = await fs.readdir(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        await walk(full)
        continue
      }
      if (!entry.name.endsWith('.canvas')) continue
      const stats = await fs.stat(full).catch(() => null)
      if (!stats) continue
      totalSize += stats.size
      count += 1
    }
  }
  await walk(historyRoot(root))
  return { totalSize, count }
}

export async function clearAllDevHistory(root: string) {
  await fs.rm(historyRoot(root), { recursive: true, force: true })
}

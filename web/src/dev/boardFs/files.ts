import { createHash } from 'node:crypto'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import type { BoardFile, BoardListItem, BoardScope } from '../../shared/board/types'
import { BOARD_SCOPES } from '../../shared/board/types'
import { BLANK_DOCUMENT } from './constants'
import { resolveScopeDir } from './paths'
import type { ScannedBoard } from './types'

async function readJson(file: string): Promise<BoardFile> {
  return JSON.parse(await fs.readFile(file, 'utf8')) as BoardFile
}

export async function scanBoardFiles(root: string, scope: BoardScope): Promise<ScannedBoard[]> {
  const dir = resolveScopeDir(root, scope)
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

export async function listBoards(root: string) {
  const boards: BoardListItem[] = []

  for (const scope of BOARD_SCOPES) {
    const scanned = await scanBoardFiles(root, scope)
    boards.push(
      ...scanned.map(({ folder, board }) => ({
        slug: board.meta.slug,
        title: board.meta.title,
        summary: board.meta.summary,
        order: board.meta.order,
        updatedAt: board.meta.updatedAt,
        path: folder,
        scope,
      })),
    )
  }

  return boards.sort((a, b) => {
    const ai = a.order ?? Number.MAX_SAFE_INTEGER
    const bi = b.order ?? Number.MAX_SAFE_INTEGER
    return ai - bi || a.title.localeCompare(b.title, 'zh-CN')
  })
}

export async function findBoardFile(root: string, scope: BoardScope, slug: string) {
  const found = (await scanBoardFiles(root, scope)).find((item) => item.board.meta.slug === slug)
  return found ?? null
}

export function contentHash(value: unknown) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex')
}

export async function writeBoardFile(file: string, board: BoardFile) {
  await fs.mkdir(path.dirname(file), { recursive: true })
  const tempFile = `${file}.${process.pid}.${Date.now()}.tmp`
  await fs.writeFile(tempFile, `${JSON.stringify(board, null, 2)}\n`, 'utf8')
  await fs.rename(tempFile, file)
}

export async function removeEmptyParents(root: string, scope: BoardScope, file: string) {
  const boardsRoot = resolveScopeDir(root, scope)
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

export function createBlankBoard(title: string, slug: string, summary?: string): BoardFile {
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

import { promises as fs } from 'node:fs'
import path from 'node:path'
import type { BoardScope } from '../../shared/board/types'
import { isValidSlug, type BoardFile } from '../../shared/board/types'
import {
  createBlankBoard,
  findBoardFile,
  removeEmptyParents,
  writeBoardFile,
} from './files'
import { HttpError } from './http'
import { normalizeFolder, normalizeScope, resolveBoardFile } from './paths'
import type { CreateBoardBody, PatchBoardBody } from './types'

export async function createBoard(root: string, body: CreateBoardBody) {
  if (typeof body.title !== 'string' || !body.title.trim()) {
    throw new HttpError(400, 'title 不能为空')
  }
  if (typeof body.slug !== 'string' || !isValidSlug(body.slug)) {
    throw new HttpError(400, 'slug 非法')
  }
  if (body.summary !== undefined && typeof body.summary !== 'string') {
    throw new HttpError(400, 'summary 必须是字符串')
  }

  const scope = normalizeScope(body.scope)
  const folder = normalizeFolder(body.folder)
  const existing = await findBoardFile(root, scope, body.slug)
  if (existing) throw new HttpError(409, `slug 已存在: ${body.slug}`)

  const file = resolveBoardFile(root, scope, folder, body.slug)
  try {
    await fs.access(file)
    throw new HttpError(409, `文件已存在: ${path.relative(root, file)}`)
  } catch (error) {
    if (error instanceof HttpError) throw error
  }

  const board = createBlankBoard(body.title.trim(), body.slug, body.summary?.trim() || undefined)
  await writeBoardFile(file, board)
  return { board, folder, scope }
}

export async function patchBoard(root: string, scope: BoardScope, slug: string, body: PatchBoardBody) {
  const found = await findBoardFile(root, scope, slug)
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
    const conflict = await findBoardFile(root, scope, nextSlug)
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

  const nextFile = resolveBoardFile(root, scope, nextFolder, nextSlug)
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
    await removeEmptyParents(root, scope, found.file)
  }

  return { board, folder: nextFolder }
}

export async function deleteBoard(root: string, scope: BoardScope, slug: string) {
  const found = await findBoardFile(root, scope, slug)
  if (!found) throw new HttpError(404, '白板不存在')
  await fs.unlink(found.file)
  await removeEmptyParents(root, scope, found.file)
}

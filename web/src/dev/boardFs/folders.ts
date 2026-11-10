import { promises as fs } from 'node:fs'
import path from 'node:path'
import { HttpError } from './http'
import {
  normalizeFolder,
  normalizeFolderName,
  normalizeScope,
  resolveFolderDir,
  resolveScopeDir,
} from './paths'
import type { DeleteFolderBody, RenameFolderBody } from './types'

export async function renameFolder(root: string, body: RenameFolderBody) {
  if (typeof body.path !== 'string') throw new HttpError(400, 'path 必须是字符串')
  const scope = normalizeScope(body.scope)
  const folder = normalizeFolder(body.path)
  if (!folder) throw new HttpError(400, '不能重命名根目录')
  const name = normalizeFolderName(body.name)

  const source = resolveFolderDir(root, scope, folder)
  const target = path.resolve(path.dirname(source), name)
  const boardsRoot = resolveScopeDir(root, scope)
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

export async function deleteFolder(root: string, body: DeleteFolderBody) {
  if (typeof body.path !== 'string') throw new HttpError(400, 'path 必须是字符串')
  const scope = normalizeScope(body.scope)
  const folder = normalizeFolder(body.path)
  if (!folder) throw new HttpError(400, '不能删除根目录')

  const dir = resolveFolderDir(root, scope, folder)
  let stat
  try {
    stat = await fs.stat(dir)
  } catch {
    throw new HttpError(404, '文件夹不存在')
  }
  if (!stat.isDirectory()) throw new HttpError(404, '文件夹不存在')

  await fs.rm(dir, { recursive: true })
  return { path: folder }
}

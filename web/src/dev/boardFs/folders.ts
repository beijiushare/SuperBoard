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
import type { BoardScope } from '../../shared/board/types'
import type {
  CreateFolderBody,
  DeleteFolderBody,
  RenameFolderBody,
} from './types'

export async function removeEmptyParents(
  root: string,
  scope: BoardScope,
  file: string,
) {
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

export async function listFolders(root: string) {
  const folders: Array<{ scope: BoardScope; path: string }> = []
  for (const scope of ['public', 'private'] as const) {
    const scopeDir = resolveScopeDir(root, scope)
    async function visit(dir: string, folder: string) {
      let entries
      try {
        entries = await fs.readdir(dir, { withFileTypes: true })
      } catch {
        return
      }
      for (const entry of entries) {
        if (!entry.isDirectory() || entry.name.startsWith('.')) continue
        const next = folder ? `${folder}/${entry.name}` : entry.name
        folders.push({ scope, path: next })
        await visit(path.join(dir, entry.name), next)
      }
    }
    await visit(scopeDir, '')
  }
  return folders.sort((a, b) => a.scope.localeCompare(b.scope) || a.path.localeCompare(b.path, 'zh-CN'))
}

export async function createFolder(root: string, body: CreateFolderBody) {
  if (typeof body.name !== 'string') throw new HttpError(400, 'name 必须是字符串')
  const scope = normalizeScope(body.scope)
  const parent = normalizeFolder(body.parent)
  const name = normalizeFolderName(body.name)
  const parentDir = parent
    ? resolveFolderDir(root, scope, parent)
    : resolveScopeDir(root, scope)
  const target = path.join(parentDir, name)
  const boardsRoot = resolveScopeDir(root, scope)
  if (!target.startsWith(`${boardsRoot}${path.sep}`)) throw new HttpError(400, '文件夹路径越界')
  try {
    await fs.access(target)
    throw new HttpError(409, `文件夹已存在: ${name}`)
  } catch (error) {
    if (error instanceof HttpError) throw error
  }
  await fs.mkdir(target)
  return { path: parent ? `${parent}/${name}` : name }
}

export async function renameFolder(root: string, body: RenameFolderBody) {
  if (typeof body.path !== 'string') throw new HttpError(400, 'path 必须是字符串')
  const scope = normalizeScope(body.scope)
  const folder = normalizeFolder(body.path)
  if (!folder) throw new HttpError(400, '不能重命名根目录')
  const name = normalizeFolderName(body.name)
  const currentParent = folder.split('/').slice(0, -1).join('/')
  const parent =
    body.parent === undefined ? currentParent : normalizeFolder(body.parent)

  const source = resolveFolderDir(root, scope, folder)
  const parentDir = parent
    ? resolveFolderDir(root, scope, parent)
    : resolveScopeDir(root, scope)
  const target = path.resolve(parentDir, name)
  const boardsRoot = resolveScopeDir(root, scope)
  if (!target.startsWith(`${boardsRoot}${path.sep}`)) throw new HttpError(400, '文件夹路径越界')
  if (target === source || target.startsWith(`${source}${path.sep}`)) {
    throw new HttpError(400, '不能把文件夹移动到自身或子目录中')
  }

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

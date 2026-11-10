import path from 'node:path'
import { BOARDS_DIR, RESERVED_FOLDER_NAMES } from './constants'
import { HttpError } from './http'

export function validateFolderName(part: string) {
  if (!part || part === '.' || part === '..') {
    throw new HttpError(400, `非法文件夹名: ${JSON.stringify(part)}`)
  }
  if (part.startsWith('.')) throw new HttpError(400, '文件夹名不能以点开头')
  if (/[<>:"|?*\u0000-\u001f]/.test(part)) throw new HttpError(400, `文件夹名包含非法字符: ${part}`)
  if (/[. ]$/.test(part)) throw new HttpError(400, '文件夹名不能以点或空格结尾')
  if (RESERVED_FOLDER_NAMES.test(part)) throw new HttpError(400, `文件夹名不可用: ${part}`)
  if (part.length > 80) throw new HttpError(400, '文件夹名过长')
}

export function normalizeFolder(value: unknown): string {
  if (value === undefined || value === null || value === '') return ''
  if (typeof value !== 'string') throw new HttpError(400, 'folder 必须是字符串')

  const raw = value.trim().replaceAll('\\', '/')
  if (!raw) return ''

  const parts = raw.split('/')
  for (const part of parts) validateFolderName(part)
  return parts.join('/')
}

export function normalizeFolderName(value: unknown): string {
  if (typeof value !== 'string') throw new HttpError(400, '文件夹名必须是字符串')
  const name = value.trim()
  if (!name) throw new HttpError(400, '文件夹名不能为空')
  if (name.includes('/') || name.includes('\\')) throw new HttpError(400, '文件夹名不能包含路径分隔符')
  validateFolderName(name)
  return name
}

export function resolveBoardFile(root: string, folder: string, slug: string) {
  const boardsRoot = path.resolve(root, BOARDS_DIR)
  const dir = path.join(boardsRoot, ...folder.split('/').filter(Boolean))
  const file = path.join(dir, `${slug}.tldr.json`)
  const resolved = path.resolve(file)
  if (resolved !== boardsRoot && !resolved.startsWith(`${boardsRoot}${path.sep}`)) {
    throw new HttpError(400, '白板路径越界')
  }
  return file
}

export function resolveFolderDir(root: string, folder: string) {
  const boardsRoot = path.resolve(root, BOARDS_DIR)
  const resolved = path.resolve(boardsRoot, ...folder.split('/').filter(Boolean))
  if (resolved === boardsRoot || !resolved.startsWith(`${boardsRoot}${path.sep}`)) {
    throw new HttpError(400, '文件夹路径越界')
  }
  return resolved
}

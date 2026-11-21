import path from 'node:path'
import { isBoardScope, type BoardScope } from '../../shared/board/types'
import { BOARDS_DIR, RESERVED_FOLDER_NAMES } from './constants'
import { HttpError } from './http'

export function normalizeScope(value: unknown): BoardScope {
  if (value === undefined || value === null || value === '') return 'public'
  if (isBoardScope(value)) return value
  throw new HttpError(400, 'scope must be public or private')
}

export function resolveScopeDir(root: string, scope: BoardScope) {
  return path.resolve(root, BOARDS_DIR, scope)
}

export function validateFolderName(part: string) {
  if (!part || part === '.' || part === '..') {
    throw new HttpError(400, `Invalid folder name: ${JSON.stringify(part)}`)
  }
  if (part.startsWith('.')) throw new HttpError(400, 'Folder names cannot start with a dot')
  if (/[<>:"|?*\u0000-\u001f]/.test(part)) throw new HttpError(400, `Folder name contains invalid characters: ${part}`)
  if (/[. ]$/.test(part)) throw new HttpError(400, 'Folder names cannot end with a dot or space')
  if (RESERVED_FOLDER_NAMES.test(part)) throw new HttpError(400, `Folder name is reserved: ${part}`)
  if (part.length > 80) throw new HttpError(400, 'Folder name is too long')
}

export function normalizeFolder(value: unknown): string {
  if (value === undefined || value === null || value === '') return ''
  if (typeof value !== 'string') throw new HttpError(400, 'folder must be a string')

  const raw = value.trim().replaceAll('\\', '/')
  if (!raw) return ''

  const parts = raw.split('/')
  for (const part of parts) validateFolderName(part)
  return parts.join('/')
}

export function normalizeFolderName(value: unknown): string {
  if (typeof value !== 'string') throw new HttpError(400, 'Folder name must be a string')
  const name = value.trim()
  if (!name) throw new HttpError(400, 'Folder name cannot be empty')
  if (name.includes('/') || name.includes('\\')) throw new HttpError(400, 'Folder name cannot contain path separators')
  validateFolderName(name)
  return name
}

export function resolveCanvasFile(root: string, scope: BoardScope, folder: string, slug: string) {
  return resolveScopedFile(root, scope, folder, `${slug}.canvas`)
}

function resolveScopedFile(
  root: string,
  scope: BoardScope,
  folder: string,
  fileName: string,
) {
  const boardsRoot = resolveScopeDir(root, scope)
  const dir = path.join(boardsRoot, ...folder.split('/').filter(Boolean))
  const file = path.join(dir, fileName)
  const resolved = path.resolve(file)
  if (resolved !== boardsRoot && !resolved.startsWith(`${boardsRoot}${path.sep}`)) {
    throw new HttpError(400, 'Board path escapes the workspace')
  }
  return file
}

export function resolveFolderDir(root: string, scope: BoardScope, folder: string) {
  const boardsRoot = resolveScopeDir(root, scope)
  const resolved = path.resolve(boardsRoot, ...folder.split('/').filter(Boolean))
  if (resolved === boardsRoot || !resolved.startsWith(`${boardsRoot}${path.sep}`)) {
    throw new HttpError(400, 'Folder path escapes the workspace')
  }
  return resolved
}

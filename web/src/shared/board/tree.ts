import type { BoardListItem, BoardTreeNode } from './types'

interface FolderBuilder {
  name: string
  path: string
  folders: Map<string, FolderBuilder>
  files: BoardListItem[]
}

function createFolder(name: string, path: string): FolderBuilder {
  return { name, path, folders: new Map(), files: [] }
}

export function normalizeFolderPath(value: string): string {
  return value
    .split('/')
    .map((part) => part.trim())
    .filter(Boolean)
    .join('/')
}

export function ancestorFolderPaths(value: string): string[] {
  const parts = normalizeFolderPath(value).split('/').filter(Boolean)
  const paths: string[] = []
  for (let index = 0; index < parts.length; index += 1) {
    paths.push(parts.slice(0, index + 1).join('/'))
  }
  return paths
}

function compareBoards(a: BoardListItem, b: BoardListItem) {
  const ai = a.order ?? Number.MAX_SAFE_INTEGER
  const bi = b.order ?? Number.MAX_SAFE_INTEGER
  if (ai !== bi) return ai - bi
  return a.title.localeCompare(b.title, 'zh-CN')
}

function finalize(folder: FolderBuilder): BoardTreeNode[] {
  const folders = [...folder.folders.values()]
    .sort((a, b) => a.name.localeCompare(b.name, 'zh-CN', { numeric: true }))
    .map((child) => ({
      type: 'folder' as const,
      name: child.name,
      path: child.path,
      children: finalize(child),
    }))

  const files = [...folder.files].sort(compareBoards).map((board) => ({
    ...board,
    type: 'file' as const,
    name: board.title,
  }))

  return [...folders, ...files]
}

export function buildBoardTree(boards: BoardListItem[]): BoardTreeNode[] {
  const root = createFolder('', '')

  for (const board of boards) {
    const parts = normalizeFolderPath(board.path).split('/').filter(Boolean)
    let current = root
    for (const part of parts) {
      const childPath = current.path ? `${current.path}/${part}` : part
      let child = current.folders.get(part)
      if (!child) {
        child = createFolder(part, childPath)
        current.folders.set(part, child)
      }
      current = child
    }
    current.files.push(board)
  }

  return finalize(root)
}

export function findTreeFile(nodes: BoardTreeNode[], slug: string): BoardTreeNode | null {
  for (const node of nodes) {
    if (node.type === 'file') {
      if (node.slug === slug) return node
      continue
    }
    const found = findTreeFile(node.children, slug)
    if (found) return found
  }
  return null
}

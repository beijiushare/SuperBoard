import { useMemo } from 'react'
import type { BoardScope } from '../../shared/board/types'
import { buildBoardTree } from '../../shared/board/tree'
import type { CanvasListItem } from './appUtils'

interface UseBoardTreeDataOptions {
  items: CanvasListItem[]
  folders: Array<{ path: string; scope: BoardScope }>
  scope: BoardScope
}

export function useBoardTreeData({
  items,
  folders,
  scope,
}: UseBoardTreeDataOptions) {
  const scopedItems = useMemo(
    () => items.filter((item) => item.scope === scope),
    [items, scope],
  )
  const scopedFolders = useMemo(
    () => folders.filter((folder) => folder.scope === scope),
    [folders, scope],
  )
  const folderPaths = useMemo(
    () =>
      scopedFolders
        .map((folder) => folder.path)
        .sort((a, b) => a.localeCompare(b, 'zh-CN')),
    [scopedFolders],
  )
  const treeNodes = useMemo(
    () => buildBoardTree(scopedItems, scopedFolders),
    [scopedItems, scopedFolders],
  )
  return { scopedItems, scopedFolders, folderPaths, treeNodes }
}

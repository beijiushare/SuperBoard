import { useCallback, useEffect, useState } from 'react'
import { ancestorFolderPaths } from './tree'
import type { BoardListItem } from './types'

const TREE_EXPANDED_KEY = 'superboard.tree.expanded'

function loadExpandedFolders(): Set<string> | null {
  try {
    const raw = window.localStorage.getItem(TREE_EXPANDED_KEY)
    if (raw === null) return null
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return null
    return new Set(parsed.filter((value): value is string => typeof value === 'string'))
  } catch {
    return null
  }
}

function storeExpandedFolders(expanded: Set<string>) {
  try {
    window.localStorage.setItem(TREE_EXPANDED_KEY, JSON.stringify([...expanded]))
  } catch {
    // localStorage may be unavailable in private mode
  }
}

export function useTreeExpansion(boards: BoardListItem[]) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [expandedReady, setExpandedReady] = useState(false)

  useEffect(() => {
    if (expandedReady || boards.length === 0) return
    const saved = loadExpandedFolders()
    if (saved) {
      setExpanded(saved)
    } else {
      const next = new Set<string>()
      for (const item of boards) {
        for (const path of ancestorFolderPaths(item.path)) next.add(path)
      }
      setExpanded(next)
    }
    setExpandedReady(true)
  }, [boards, expandedReady])

  useEffect(() => {
    if (!expandedReady) return
    storeExpandedFolders(expanded)
  }, [expanded, expandedReady])

  const toggleFolder = useCallback((path: string) => {
    setExpanded((current) => {
      const next = new Set(current)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }, [])

  const expandPath = useCallback((path: string) => {
    if (!path) return
    setExpanded((current) => {
      const next = new Set(current)
      for (const item of ancestorFolderPaths(path)) next.add(item)
      return next
    })
  }, [])

  const renameExpandedPath = useCallback((from: string, to: string) => {
    if (from === to) return
    setExpanded((current) => {
      const next = new Set<string>()
      const prefix = `${from}/`
      for (const path of current) {
        if (path === from) next.add(to)
        else if (path.startsWith(prefix)) next.add(`${to}${path.slice(from.length)}`)
        else next.add(path)
      }
      return next
    })
  }, [])

  return {
    expanded,
    expandedReady,
    toggleFolder,
    expandPath,
    renameExpandedPath,
  }
}

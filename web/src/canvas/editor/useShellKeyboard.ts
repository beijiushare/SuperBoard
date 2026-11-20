import { useEffect } from 'react'

interface UseShellKeyboardOptions {
  treeMode: boolean
  treeOpen: boolean
  onOpenTree: () => void
}

function isTypingTarget(target: Element | null) {
  return Boolean(
    target?.closest('input, textarea, select, [contenteditable="true"]'),
  )
}

export function useShellKeyboard({
  treeMode,
  treeOpen,
  onOpenTree,
}: UseShellKeyboardOptions) {
  useEffect(() => {
    function focusRail() {
      document
        .querySelector<HTMLButtonElement>('.sb-rail button:not([disabled])')
        ?.focus()
    }

    function focusTree() {
      if (!treeMode) return
      if (!treeOpen) onOpenTree()
      const focusRow = () => {
        const tree = document.querySelector('.sb-tree')
        if (!tree) return false
        const row =
          tree.querySelector<HTMLButtonElement>(
            '[data-tree-row][aria-selected="true"]',
          ) ?? tree.querySelector<HTMLButtonElement>('[data-tree-row]')
        row?.focus()
        return true
      }
      if (focusRow()) return
      requestAnimationFrame(() => {
        if (!focusRow()) requestAnimationFrame(focusRow)
      })
    }

    function moveRail(delta: number) {
      const buttons = Array.from(
        document.querySelectorAll<HTMLButtonElement>(
          '.sb-rail button:not([disabled])',
        ),
      )
      const index = buttons.indexOf(document.activeElement as HTMLButtonElement)
      if (index < 0) return
      const next = buttons[index + delta]
      next?.focus()
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return
      if (isTypingTarget(document.activeElement)) return
      const active = document.activeElement as HTMLElement | null
      const inRail = Boolean(active?.closest('.sb-rail'))
      const inTree = Boolean(active?.closest('.sb-tree'))

      if (event.key === 'ArrowRight' && inRail) {
        event.preventDefault()
        focusTree()
        return
      }
      if (event.key === 'ArrowLeft' && inTree) {
        event.preventDefault()
        focusRail()
        return
      }
      if (event.key === 'Tab' && treeMode && (inRail || inTree)) {
        event.preventDefault()
        if (inRail) focusTree()
        else focusRail()
        return
      }
      if ((event.key === 'ArrowUp' || event.key === 'ArrowDown') && inRail) {
        event.preventDefault()
        moveRail(event.key === 'ArrowDown' ? 1 : -1)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [treeMode, treeOpen, onOpenTree])
}

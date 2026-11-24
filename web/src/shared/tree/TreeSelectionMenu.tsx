import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'

interface TreeSelectionMenuProps {
  anchor: { left: number; top: number }
  onExplain: () => void
  onAsk: () => void
  onClose: () => void
}

/** Actions offered when a card has selected text and the user right-clicks. */
export function TreeSelectionMenu({
  anchor,
  onExplain,
  onAsk,
  onClose,
}: TreeSelectionMenuProps) {
  const { t } = useTranslation(['editor'])

  useEffect(() => {
    const close = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null
      if (target?.closest('.sb-kt-quote-menu')) return
      onClose()
    }
    window.addEventListener('pointerdown', close, true)
    return () => window.removeEventListener('pointerdown', close, true)
  }, [onClose])

  return createPortal(
    <div
      className="sb-kt-quote-menu"
      style={{
        left: Math.min(anchor.left, window.innerWidth - 220),
        top: Math.min(anchor.top, window.innerHeight - 110),
      }}
      onPointerDown={(event) => event.stopPropagation()}
      onContextMenu={(event) => event.preventDefault()}
    >
      <button
        type="button"
        onClick={() => {
          onExplain()
          onClose()
        }}
      >
        {t('editor:tree.explainQuote')}
      </button>
      <button
        type="button"
        onClick={() => {
          onAsk()
          onClose()
        }}
      >
        {t('editor:tree.askQuote')}
      </button>
    </div>,
    document.body,
  )
}

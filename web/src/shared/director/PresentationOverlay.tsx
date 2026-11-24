import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'

interface PresentationOverlayProps {
  menu: { x: number; y: number } | null
  onMenu: (menu: { x: number; y: number }) => void
  onAdvance: () => void
  onExit: () => void
}

export function PresentationOverlay({
  menu,
  onMenu,
  onAdvance,
  onExit,
}: PresentationOverlayProps) {
  const { t } = useTranslation(['editor'])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === ' ' || event.key === 'Spacebar') {
        event.preventDefault()
        onAdvance()
        return
      }
      if (event.key === 'Escape') {
        event.preventDefault()
        onExit()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onAdvance, onExit])

  return (
    <div
      className="sb-presentation-overlay"
      onClick={onAdvance}
      onContextMenu={(event) => {
        event.preventDefault()
        event.stopPropagation()
        onMenu({ x: event.clientX, y: event.clientY })
      }}
    >
      {menu ? (
        <div
          className="sb-presentation-menu"
          style={{ left: menu.x, top: menu.y }}
          onClick={(event) => event.stopPropagation()}
        >
          <button type="button" onClick={onExit}>
            {t('editor:director.stop')}
          </button>
        </div>
      ) : null}
    </div>
  )
}

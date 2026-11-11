interface PresentationOverlayProps {
  menu: { x: number; y: number } | null
  onMenu: (menu: { x: number; y: number }) => void
  onAdvance: () => void
  onExit: () => void
}

export function PresentationOverlay({ menu, onMenu, onAdvance, onExit }: PresentationOverlayProps) {
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
            停止播放
          </button>
        </div>
      ) : null}
    </div>
  )
}

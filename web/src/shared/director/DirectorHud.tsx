interface DirectorHudProps {
  onPlay: () => void
  onExit: () => void
}

export function DirectorHud({ onPlay, onExit }: DirectorHudProps) {
  return (
    <div className="sb-director-hud">
      <button className="sb-button sb-button-primary" type="button" onClick={onPlay}>
        从头播放
      </button>
      <button className="sb-button" type="button" onClick={onExit}>
        退出导演幕布
      </button>
    </div>
  )
}

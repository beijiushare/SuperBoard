import { useTranslation } from 'react-i18next'

interface DirectorHudProps {
  onPlay: () => void
  onExit: () => void
}

export function DirectorHud({ onPlay, onExit }: DirectorHudProps) {
  const { t } = useTranslation(['editor'])
  return (
    <div className="sb-director-hud">
      <button className="sb-button sb-button-primary" type="button" onClick={onPlay}>
        {t('editor:director.playFromStart')}
      </button>
      <button className="sb-button" type="button" onClick={onExit}>
        {t('editor:director.exit')}
      </button>
    </div>
  )
}

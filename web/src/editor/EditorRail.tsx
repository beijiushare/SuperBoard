import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ApertureIcon,
  CheckCircleIcon,
  CloseWindowIcon,
  CommandIcon,
  FilmIcon,
  FocusIcon,
  GitBranchIcon,
  MaximiseIcon,
  SettingsIcon,
  SidebarIcon,
  UploadCloudIcon,
} from './EditorRailIcons'
import type { SaveState } from './saveState'
import { Window as WailsWindow } from '@wailsio/runtime'
import { desktopMode } from '../desktop/platform'

interface EditorRailProps {
  mode?: 'edit' | 'view'
  treeMode: boolean
  treeOpen: boolean
  sidebarLabel: string
  onToggleTree: () => void
  scopeLabel?: string
  onSwitchScope?: () => void
  saveLabel?: string
  saveState?: SaveState
  canSave?: boolean
  onSave?: () => void
  stylePanelOpen?: boolean
  onToggleStylePanel?: () => void
  menuPanelOpen?: boolean
  menuPanelLabel?: string
  onToggleMenuPanel?: () => void
  directorMode: boolean
  onToggleDirector: () => void
  onExport?: () => void
  onOpenPreferences?: () => void
}

export function EditorRail({
  mode = 'edit',
  treeMode,
  treeOpen,
  sidebarLabel,
  onToggleTree,
  scopeLabel = '',
  onSwitchScope,
  saveLabel = '',
  saveState = 'saved',
  canSave = false,
  onSave,
  stylePanelOpen = false,
  onToggleStylePanel,
  menuPanelOpen = false,
  menuPanelLabel = '',
  onToggleMenuPanel,
  directorMode,
  onToggleDirector,
  onExport,
  onOpenPreferences,
}: EditorRailProps) {
  const { t } = useTranslation(['editor'])
  const editing = mode === 'edit'
  const desktop = desktopMode()
  const [focusMode, setFocusMode] = useState(false)

  useEffect(() => {
    if (!desktop) return
    let alive = true
    void WailsWindow.IsFullscreen().then((value) => {
      if (alive) setFocusMode(value)
    })
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      const active = document.activeElement
      if (
        active instanceof HTMLElement &&
        active.closest('.sb-rail-window-controls')
      ) {
        active.blur()
      }
      if (
        document.querySelector(
          '.sb-modal-backdrop, .canvas-editor-dialog-backdrop',
        )
      ) {
        return
      }
      void WailsWindow.IsFullscreen().then((value) => {
        if (!value) return
        void WailsWindow.UnFullscreen()
        setFocusMode(false)
      })
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      alive = false
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [desktop])

  return (
    <aside
      className="sb-rail"
      aria-label={editing ? t('editor:rail.editorActions') : t('editor:rail.boardActions')}
    >
      <button
        type="button"
        className="sb-rail-button"
        data-tooltip={sidebarLabel}
        aria-label={sidebarLabel}
        aria-pressed={treeMode && treeOpen}
        onClick={onToggleTree}
      >
        <SidebarIcon size={16} />
      </button>

      {editing ? (
        <button
          type="button"
          className="sb-rail-button"
          data-tooltip={scopeLabel}
          aria-label={scopeLabel}
          onClick={onSwitchScope}
        >
          <GitBranchIcon size={22} />
        </button>
      ) : null}

      {editing ? (
        <button
          type="button"
          className={`sb-rail-button sb-rail-save is-${saveState}`}
          data-tooltip={saveLabel}
          aria-label={saveLabel}
          disabled={!canSave}
          onClick={onSave}
        >
          <CheckCircleIcon size={21} />
        </button>
      ) : null}

      {editing ? (
        <button
          type="button"
          className="sb-rail-button"
          data-tooltip={
            stylePanelOpen ? t('editor:rail.hideStylePanel') : t('editor:rail.showStylePanel')
          }
          aria-label={
            stylePanelOpen ? t('editor:rail.hideStylePanel') : t('editor:rail.showStylePanel')
          }
          aria-pressed={stylePanelOpen}
          onClick={onToggleStylePanel}
        >
          <ApertureIcon size={21} />
        </button>
      ) : null}

      {editing ? (
        <button
          type="button"
          className="sb-rail-button"
          data-tooltip={menuPanelLabel}
          aria-label={menuPanelLabel}
          aria-pressed={menuPanelOpen}
          onClick={onToggleMenuPanel}
        >
          <CommandIcon size={21} />
        </button>
      ) : null}

      <button
        type="button"
        className="sb-rail-button"
        data-tooltip={t('editor:rail.director')}
        aria-label={t('editor:rail.director')}
        aria-pressed={directorMode}
        onClick={onToggleDirector}
      >
        <FilmIcon size={21} />
      </button>

      {editing && onExport ? (
        <button
          type="button"
          className="sb-rail-button"
          data-tooltip={t('editor:export.title')}
          aria-label={t('editor:export.title')}
          onClick={onExport}
        >
          <UploadCloudIcon size={21} />
        </button>
      ) : null}

      {onOpenPreferences ? (
        <button
          type="button"
          className="sb-rail-button"
          data-tooltip={t('editor:rail.settings')}
          aria-label={t('editor:rail.settings')}
          onClick={onOpenPreferences}
        >
          <SettingsIcon size={21} />
        </button>
      ) : null}

      {desktop ? (
        <div className="sb-rail-window-controls">
          <button
            type="button"
            className="sb-rail-button sb-rail-window-button"
            data-tooltip={t('editor:rail.maximise')}
            aria-label={t('editor:rail.maximise')}
            onMouseDown={(event) => event.preventDefault()}
            onClick={(event) => {
              event.currentTarget.blur()
              void WailsWindow.Maximise()
            }}
          >
            <MaximiseIcon size={17} />
          </button>
          <button
            type="button"
            className="sb-rail-button sb-rail-window-button"
            data-tooltip={
              focusMode ? t('editor:rail.exitFocusTooltip') : t('editor:rail.focusTooltip')
            }
            aria-label={
              focusMode ? t('editor:rail.exitFocus') : t('editor:rail.focus')
            }
            aria-pressed={focusMode}
            onMouseDown={(event) => event.preventDefault()}
            onClick={(event) => {
              event.currentTarget.blur()
              void WailsWindow.IsFullscreen().then(async (value) => {
                if (value) await WailsWindow.UnFullscreen()
                else await WailsWindow.Fullscreen()
                setFocusMode(!value)
              })
            }}
          >
            <FocusIcon size={17} />
          </button>
          <button
            type="button"
            className="sb-rail-button sb-rail-window-button sb-rail-window-close"
            data-tooltip={t('editor:rail.quit')}
            aria-label={t('editor:rail.quit')}
            onMouseDown={(event) => event.preventDefault()}
            onClick={(event) => {
              event.currentTarget.blur()
              void WailsWindow.Close()
            }}
          >
            <CloseWindowIcon size={18} />
          </button>
        </div>
      ) : null}
    </aside>
  )
}

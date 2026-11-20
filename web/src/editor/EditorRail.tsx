import { useEffect, useState } from 'react'
import {
  ApertureIcon,
  CheckCircleIcon,
  CloseWindowIcon,
  CommandIcon,
  FilmIcon,
  FocusIcon,
  GitBranchIcon,
  MinimiseIcon,
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
    <aside className="sb-rail" aria-label={editing ? '编辑器操作' : '白板操作'}>
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
          data-tooltip={stylePanelOpen ? '隐藏样式面板' : '显示样式面板'}
          aria-label={stylePanelOpen ? '隐藏样式面板' : '显示样式面板'}
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
        data-tooltip="导演幕布"
        aria-label="导演幕布"
        aria-pressed={directorMode}
        onClick={onToggleDirector}
      >
        <FilmIcon size={21} />
      </button>

      {editing && onExport ? (
        <button
          type="button"
          className="sb-rail-button"
          data-tooltip="导出"
          aria-label="导出"
          onClick={onExport}
        >
          <UploadCloudIcon size={21} />
        </button>
      ) : null}

      {onOpenPreferences ? (
        <button
          type="button"
          className="sb-rail-button"
          data-tooltip="设置"
          aria-label="设置"
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
            data-tooltip="最小化"
            aria-label="最小化"
            onMouseDown={(event) => event.preventDefault()}
            onClick={(event) => {
              event.currentTarget.blur()
              void WailsWindow.Minimise()
            }}
          >
            <MinimiseIcon size={17} />
          </button>
          <button
            type="button"
            className="sb-rail-button sb-rail-window-button"
            data-tooltip={focusMode ? '退出专注模式（Esc）' : '专注模式（Esc 退出）'}
            aria-label={focusMode ? '退出专注模式' : '专注模式'}
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
            data-tooltip="退出"
            aria-label="退出"
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

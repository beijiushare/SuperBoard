import {
  ApertureIcon,
  CheckCircleIcon,
  CommandIcon,
  FilmIcon,
  GitBranchIcon,
  SidebarIcon,
  UploadCloudIcon,
} from './EditorRailIcons'
import type { SaveState } from './saveState'

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
  onDeploy?: () => void
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
  onDeploy,
}: EditorRailProps) {
  const editing = mode === 'edit'

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
        <SidebarIcon size={17} />
      </button>

      {editing ? (
        <button
          type="button"
          className="sb-rail-button"
          data-tooltip={scopeLabel}
          aria-label={scopeLabel}
          onClick={onSwitchScope}
        >
          <GitBranchIcon size={21} />
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

      {editing ? (
        <button
          type="button"
          className="sb-rail-button"
          data-tooltip="提交并推送"
          aria-label="提交并推送"
          onClick={onDeploy}
        >
          <UploadCloudIcon size={21} />
        </button>
      ) : null}
    </aside>
  )
}

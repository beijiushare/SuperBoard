import UseAnimations from 'react-useanimations'
import aperture from 'react-useanimations/lib/aperture'
import checkCircle from 'react-useanimations/lib/checkCircle'
import command from 'react-useanimations/lib/command'
import film from 'react-useanimations/lib/film'
import gitBranch from 'react-useanimations/lib/gitBranch'
import sidebar from 'react-useanimations/lib/sidebar'
import uploadCloud from 'react-useanimations/lib/uploadCloud'
import type { SaveState } from './useAutoSave'

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
        onClick={onToggleTree}
      >
        <UseAnimations
          animation={sidebar}
          size={32}
          interaction="click-toggle"
          active={treeMode && treeOpen}
        />
      </button>

      {editing ? (
        <button
          type="button"
          className="sb-rail-button"
          data-tooltip={scopeLabel}
          aria-label={scopeLabel}
          onClick={onSwitchScope}
        >
          <UseAnimations animation={gitBranch} size={32} />
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
          <UseAnimations animation={checkCircle} size={32} />
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
          <UseAnimations animation={aperture} size={32} interaction="click-replay" />
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
          <UseAnimations animation={command} size={32} interaction="click-replay" />
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
        <UseAnimations animation={film} size={32} interaction="click-toggle" active={directorMode} />
      </button>

      {editing ? (
        <button
          type="button"
          className="sb-rail-button"
          data-tooltip="提交并推送"
          aria-label="提交并推送"
          onClick={onDeploy}
        >
          <UseAnimations animation={uploadCloud} size={32} />
        </button>
      ) : null}
    </aside>
  )
}

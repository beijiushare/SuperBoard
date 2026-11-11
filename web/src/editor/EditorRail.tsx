import UseAnimations from 'react-useanimations'
import aperture from 'react-useanimations/lib/aperture'
import checkCircle from 'react-useanimations/lib/checkCircle'
import command from 'react-useanimations/lib/command'
import gitBranch from 'react-useanimations/lib/gitBranch'
import sidebar from 'react-useanimations/lib/sidebar'
import uploadCloud from 'react-useanimations/lib/uploadCloud'
import type { SaveState } from './useAutoSave'

interface EditorRailProps {
  treeMode: boolean
  treeOpen: boolean
  sidebarLabel: string
  onToggleTree: () => void
  scopeLabel: string
  onSwitchScope: () => void
  saveLabel: string
  saveState: SaveState
  canSave: boolean
  onSave: () => void
  stylePanelOpen: boolean
  onToggleStylePanel: () => void
  menuPanelOpen: boolean
  menuPanelLabel: string
  onToggleMenuPanel: () => void
  onDeploy: () => void
}

export function EditorRail({
  treeMode,
  treeOpen,
  sidebarLabel,
  onToggleTree,
  scopeLabel,
  onSwitchScope,
  saveLabel,
  saveState,
  canSave,
  onSave,
  stylePanelOpen,
  onToggleStylePanel,
  menuPanelOpen,
  menuPanelLabel,
  onToggleMenuPanel,
  onDeploy,
}: EditorRailProps) {
  return (
    <aside className="sb-rail" aria-label="编辑器操作">
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
      <button
        type="button"
        className="sb-rail-button"
        data-tooltip={scopeLabel}
        aria-label={scopeLabel}
        onClick={onSwitchScope}
      >
        <UseAnimations animation={gitBranch} size={32} />
      </button>
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
      <button
        type="button"
        className="sb-rail-button"
        data-tooltip="提交并推送"
        aria-label="提交并推送"
        onClick={onDeploy}
      >
        <UseAnimations animation={uploadCloud} size={32} />
      </button>
    </aside>
  )
}

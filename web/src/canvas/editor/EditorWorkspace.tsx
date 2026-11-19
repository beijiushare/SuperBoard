import type { ReactNode } from 'react'
import type { MouseEvent as ReactMouseEvent } from 'react'
import { EditorRail } from '../../editor/EditorRail'
import type { SaveState } from '../../editor/saveState'
import { BoardTreePanel } from '../../shared/board/BoardTreePanel'
import type { BoardTreeContextTarget } from '../../shared/board/BoardTree'
import type { BoardTreeNode } from '../../shared/board/types'

interface EditorTreeConfig {
  nodes: BoardTreeNode[]
  title: string
  collapsed: boolean
  selectedSlug: string
  expanded: Set<string>
  emptyLabel: string
  onToggle: (path: string) => void
  onSelect: (slug: string) => void
  onContextMenu: (
    event: ReactMouseEvent<HTMLElement>,
    target: BoardTreeContextTarget,
  ) => void
  onRootContextMenu: (event: ReactMouseEvent<HTMLDivElement>) => void
}

interface EditorWorkspaceProps {
  treeMode: boolean
  treeOpen: boolean
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
  directorMode: boolean
  onToggleDirector: () => void
  onDeploy?: () => void
  onOpenPreferences: () => void
  tree?: EditorTreeConfig
  children: ReactNode
}

export function EditorWorkspace({
  treeMode,
  treeOpen,
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
  directorMode,
  onToggleDirector,
  onDeploy,
  onOpenPreferences,
  tree,
  children,
}: EditorWorkspaceProps) {
  return (
    <>
      <EditorRail
        mode="edit"
        treeMode={treeMode}
        treeOpen={treeOpen}
        sidebarLabel={treeMode && treeOpen ? '收起目录' : '展开目录'}
        onToggleTree={onToggleTree}
        scopeLabel={scopeLabel}
        onSwitchScope={onSwitchScope}
        saveLabel={saveLabel}
        saveState={saveState}
        canSave={canSave}
        onSave={onSave}
        stylePanelOpen={stylePanelOpen}
        onToggleStylePanel={onToggleStylePanel}
        menuPanelOpen={menuPanelOpen}
        menuPanelLabel={menuPanelLabel}
        onToggleMenuPanel={onToggleMenuPanel}
        directorMode={directorMode}
        onToggleDirector={onToggleDirector}
        onDeploy={onDeploy}
        onOpenPreferences={onOpenPreferences}
      />

      <div className="sb-workspace">
        {treeMode && tree ? (
          <BoardTreePanel
            nodes={tree.nodes}
            title={tree.title}
            collapsed={tree.collapsed}
            selectedSlug={tree.selectedSlug}
            expanded={tree.expanded}
            onToggle={tree.onToggle}
            onSelect={tree.onSelect}
            onContextMenu={tree.onContextMenu}
            onRootContextMenu={tree.onRootContextMenu}
            emptyLabel={tree.emptyLabel}
          />
        ) : null}
        {children}
      </div>
    </>
  )
}

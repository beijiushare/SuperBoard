import { useTranslation } from 'react-i18next'
import type { CanvasDocument } from '../model'
import type { CanvasMenuState } from './appUtils'
import { CanvasBlockMenu } from './CanvasBlockMenu'
import {
  deleteWorkspaceFile,
  nodeFilePath,
  openWorkspaceFile,
  revealWorkspaceFile,
  supportsDesktopFileActions,
} from './workspacePlatform'

interface CanvasContextMenuLayerProps {
  menu: CanvasMenuState | null
  canvas: CanvasDocument | null
  selectedIds: string[]
  canGroup: boolean
  canUngroup: boolean
  allSelectedLocked: boolean
  hasLocked: boolean
  onClose: () => void
  onDuplicate: () => void
  onDelete: () => void
  onToggleGroup: () => void
  onToggleLock: () => void
  onReorder: (mode: 'front' | 'back' | 'forward' | 'backward') => void
  onUnlockAll: () => void
  onSelectAll: () => void
  onEditBlock: (id: string) => void
  onInsertText: (point: { x: number; y: number }) => void
  onInsertMarkdown: (point: { x: number; y: number }) => void
  onInsertPele: (point: { x: number; y: number }) => void
  onInsertSchedule: (point: { x: number; y: number }) => void
  onInsertMedia: (point: { x: number; y: number }) => void
}

/**
 * Renders the canvas context menu and resolves file actions for the node under
 * the pointer, keeping that wiring out of the editor orchestrator.
 */
export function CanvasContextMenuLayer({
  menu,
  canvas,
  selectedIds,
  canGroup,
  canUngroup,
  allSelectedLocked,
  hasLocked,
  onClose,
  onDuplicate,
  onDelete,
  onToggleGroup,
  onToggleLock,
  onReorder,
  onUnlockAll,
  onSelectAll,
  onEditBlock,
  onInsertText,
  onInsertMarkdown,
  onInsertPele,
  onInsertSchedule,
  onInsertMedia,
}: CanvasContextMenuLayerProps) {
  const { t } = useTranslation(['editor'])
  if (!menu || !canvas) return null

  const point = { x: menu.worldX, y: menu.worldY }
  const filePath = (id: string) =>
    nodeFilePath(canvas.nodes.find((node) => node.id === id))

  return (
    <CanvasBlockMenu
      canvas={canvas}
      menu={menu}
      selectedIds={selectedIds}
      canGroup={canGroup}
      canUngroup={canUngroup}
      allSelectedLocked={allSelectedLocked}
      hasLocked={hasLocked}
      onClose={onClose}
      onDuplicate={onDuplicate}
      onDelete={onDelete}
      onDeleteEdge={onDelete}
      onToggleGroup={onToggleGroup}
      onToggleLock={onToggleLock}
      onReorder={onReorder}
      onUnlockAll={onUnlockAll}
      onSelectAll={onSelectAll}
      onEditBlock={onEditBlock}
      onOpenFile={(id) => {
        const path = filePath(id)
        if (path) void openWorkspaceFile(path)
      }}
      onRevealFile={
        supportsDesktopFileActions()
          ? (id) => {
              const path = filePath(id)
              if (path) void revealWorkspaceFile(path)
            }
          : undefined
      }
      onDeleteFile={
        supportsDesktopFileActions()
          ? (id) => {
              const path = filePath(id)
              if (!path) return
              if (!window.confirm(t('editor:file.deleteConfirm'))) return
              void deleteWorkspaceFile(path)
            }
          : undefined
      }
      onInsertText={() => onInsertText(point)}
      onInsertMarkdown={() => onInsertMarkdown(point)}
      onInsertPele={() => onInsertPele(point)}
      onInsertSchedule={() => onInsertSchedule(point)}
      onInsertMedia={() => onInsertMedia(point)}
    />
  )
}

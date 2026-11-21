import type { CanvasDocument } from '../model'
import { useTranslation } from 'react-i18next'
import type { CanvasMenuState } from './appUtils'
import { blockDefinition } from './blocks'
import { isLocked, nodeMapOf } from './hierarchy'

interface CanvasBlockMenuProps {
  canvas: CanvasDocument
  menu: CanvasMenuState
  selectedIds: string[]
  canGroup: boolean
  canUngroup: boolean
  allSelectedLocked: boolean
  hasLocked: boolean
  onClose: () => void
  onDuplicate: () => void
  onDelete: () => void
  onDeleteEdge: () => void
  onToggleGroup: () => void
  onToggleLock: () => void
  onReorder: (mode: 'front' | 'back' | 'forward' | 'backward') => void
  onUnlockAll: () => void
  onSelectAll: () => void
  onEditBlock: (id: string) => void
  onOpenFile?: (id: string) => void
  onRevealFile?: (id: string) => void
  onDeleteFile?: (id: string) => void
  onInsertText: () => void
  onInsertMarkdown: () => void
  onInsertPele: () => void
  onInsertSchedule: () => void
  onInsertMedia: () => void
}

export function CanvasBlockMenu({
  canvas,
  menu,
  selectedIds,
  canGroup,
  canUngroup,
  allSelectedLocked,
  hasLocked,
  onClose,
  onDuplicate,
  onDelete,
  onDeleteEdge,
  onToggleGroup,
  onToggleLock,
  onReorder,
  onUnlockAll,
  onSelectAll,
  onEditBlock,
  onOpenFile,
  onRevealFile,
  onDeleteFile,
  onInsertText,
  onInsertMarkdown,
  onInsertPele,
  onInsertSchedule,
  onInsertMedia,
}: CanvasBlockMenuProps) {
  const { t } = useTranslation(['editor'])
  const nodeMap = nodeMapOf(canvas.nodes)
  const node = menu.nodeId ? nodeMap.get(menu.nodeId) ?? null : null
  const definition = node ? blockDefinition(node) : null
  const editable = Boolean(
    definition && definition.editor !== 'schedule' && !isLocked(node!, nodeMap),
  )

  return (
    <div
      className="sb-canvas-context-menu"
      style={{
        left: Math.max(8, Math.min(menu.x, window.innerWidth - 200)),
        top: Math.max(8, Math.min(menu.y, window.innerHeight - 340)),
      }}
      onPointerDown={(event) => event.stopPropagation()}
      onContextMenu={(event) => event.preventDefault()}
    >
      {menu.edgeId ? (
        <>
          <button
            type="button"
            onClick={() => {
              onDeleteEdge()
              onClose()
            }}
          >
              {t('editor:menu.deleteEdge')}
          </button>
          <div className="sb-canvas-menu-sep" />
        </>
      ) : null}
      {node ? (
        <>
          {editable && selectedIds.length === 1 ? (
            <button
              type="button"
              onClick={() => {
                onEditBlock(node.id)
                onClose()
              }}
            >
              {t('editor:menu.editContent')}
            </button>
          ) : null}
          {(node.type === 'file' ||
            node['x-superboard']?.media?.kind === 'file') &&
          onOpenFile ? (
            <>
              <button
                type="button"
                onClick={() => {
                  onOpenFile(node.id)
                  onClose()
                }}
              >
                {t('editor:menu.openFile')}
              </button>
              {onRevealFile ? (
                <button
                  type="button"
                  onClick={() => {
                    onRevealFile(node.id)
                    onClose()
                  }}
                >
                  {t('editor:menu.revealFile')}
                </button>
              ) : null}
              {onDeleteFile ? (
                <button
                  type="button"
                  onClick={() => {
                    onDeleteFile(node.id)
                    onClose()
                  }}
                >
                  {t('editor:menu.deleteFile')}
                </button>
              ) : null}
            </>
          ) : null}
          <button
            type="button"
            onClick={() => {
              onDuplicate()
              onClose()
            }}
          >
            {t('editor:menu.duplicate')}
          </button>
          <button
            type="button"
            onClick={() => {
              onDelete()
              onClose()
            }}
          >
            {t('editor:menu.delete')}          </button>
          <button
            type="button"
            disabled={!canGroup && !canUngroup}
            onClick={() => {
              onToggleGroup()
              onClose()
            }}
          >
            {canUngroup ? t('editor:menu.ungroup') : t('editor:menu.group')}
          </button>
          <button
            type="button"
            onClick={() => {
              onToggleLock()
              onClose()
            }}
          >
            {allSelectedLocked ? t('editor:menu.unlock') : t('editor:menu.lock')}
          </button>
          <button
            type="button"
            onClick={() => {
              onReorder('front')
              onClose()
            }}
          >
            {t('editor:menu.front')}
          </button>
          <button
            type="button"
            onClick={() => {
              onReorder('back')
              onClose()
            }}
          >
            {t('editor:menu.back')}
          </button>
          <button
            type="button"
            onClick={() => {
              onReorder('forward')
              onClose()
            }}
          >
            {t('editor:menu.forward')}
          </button>
          <button
            type="button"
            onClick={() => {
              onReorder('backward')
              onClose()
            }}
          >
            {t('editor:menu.backward')}
          </button>
          <div className="sb-canvas-menu-sep" />
        </>
      ) : null}
      {!node ? (
        <>
          <button
            type="button"
            onClick={() => {
              onInsertText()
              onClose()
            }}
          >
            {t('editor:menu.insertText')}
          </button>
          <button
            type="button"
            onClick={() => {
              onInsertMarkdown()
              onClose()
            }}
          >
            {t('editor:menu.insertMarkdown')}
          </button>
          <button
            type="button"
            onClick={() => {
              onInsertPele()
              onClose()
            }}
          >
            {t('editor:menu.insertPele')}
          </button>
          <button
            type="button"
            onClick={() => {
              onInsertSchedule()
              onClose()
            }}
          >
            {t('editor:menu.insertSchedule')}
          </button>
          {!menu.quick ? (
            <button
              type="button"
              onClick={() => {
                onInsertMedia()
                onClose()
              }}
            >
              {t('editor:menu.insertMedia')}
            </button>
          ) : null}
        </>
      ) : null}
      {!menu.quick ? (
        <>
          <button
            type="button"
            style={{ display: selectedIds.length > 0 ? 'none' : undefined }}
            onClick={() => {
              onSelectAll()
              onClose()
            }}
          >
            {t('editor:menu.selectAll')}
          </button>
          {hasLocked ? (
            <button
              type="button"
              onClick={() => {
                onUnlockAll()
                onClose()
              }}
            >
              {t('editor:menu.unlockAll')}
            </button>
          ) : null}
        </>
      ) : null}
    </div>
  )
}

import type { CanvasDocument } from '../model'
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
  onInsertText,
  onInsertMarkdown,
  onInsertPele,
  onInsertSchedule,
  onInsertMedia,
}: CanvasBlockMenuProps) {
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
            删除箭头
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
              编辑内容
            </button>
          ) : null}
          {node['x-superboard']?.media?.kind === 'file' && onOpenFile ? (
            <button
              type="button"
              onClick={() => {
                onOpenFile(node.id)
                onClose()
              }}
            >
              打开文件
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => {
              onDuplicate()
              onClose()
            }}
          >
            生成副本
          </button>
          <button
            type="button"
            onClick={() => {
              onDelete()
              onClose()
            }}
          >
            删除
          </button>
          <button
            type="button"
            disabled={!canGroup && !canUngroup}
            onClick={() => {
              onToggleGroup()
              onClose()
            }}
          >
            {canUngroup ? '解组' : '编组'}
          </button>
          <button
            type="button"
            onClick={() => {
              onToggleLock()
              onClose()
            }}
          >
            {allSelectedLocked ? '解锁' : '锁定'}
          </button>
          <button
            type="button"
            onClick={() => {
              onReorder('front')
              onClose()
            }}
          >
            移至最前
          </button>
          <button
            type="button"
            onClick={() => {
              onReorder('back')
              onClose()
            }}
          >
            移至最后
          </button>
          <button
            type="button"
            onClick={() => {
              onReorder('forward')
              onClose()
            }}
          >
            向前一层
          </button>
          <button
            type="button"
            onClick={() => {
              onReorder('backward')
              onClose()
            }}
          >
            向后一层
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
            输入文本
          </button>
          <button
            type="button"
            onClick={() => {
              onInsertMarkdown()
              onClose()
            }}
          >
            创建 Markdown 块
          </button>
          <button
            type="button"
            onClick={() => {
              onInsertPele()
              onClose()
            }}
          >
            创建图表
          </button>
          <button
            type="button"
            onClick={() => {
              onInsertSchedule()
              onClose()
            }}
          >
            创建日程表
          </button>
          {!menu.quick ? (
            <button
              type="button"
              onClick={() => {
                onInsertMedia()
                onClose()
              }}
            >
              插入媒体
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
            全选
          </button>
          {hasLocked ? (
            <button
              type="button"
              onClick={() => {
                onUnlockAll()
                onClose()
              }}
            >
              解锁全部
            </button>
          ) : null}
        </>
      ) : null}
    </div>
  )
}

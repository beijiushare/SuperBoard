import { useLayoutEffect, useRef, useState } from 'react'
import type { CanvasNode } from '../model'
import { HashIcon, LockIcon, RefreshIcon, TrashIcon, TypeIcon } from './BlockActionIcons'
import { blockDefinition, isRatioLocked } from './blocks'

interface BlockActionsProps {
  node: CanvasNode
  offsetX: number
  offsetY: number
  scale: number
  stageWidth: number
  stageHeight: number
  editing: boolean
  onToggleBlockEdit?: (id: string) => void
  onFocusBlockEdit?: (id: string) => void
  onDeleteBlock?: (id: string) => void
  onResetBlockSize?: (id: string) => void
  onToggleRatioLock?: (id: string) => void
}

export function BlockActions({
  node,
  offsetX,
  offsetY,
  scale,
  stageWidth,
  stageHeight,
  editing,
  onToggleBlockEdit,
  onFocusBlockEdit,
  onDeleteBlock,
  onResetBlockSize,
  onToggleRatioLock,
}: BlockActionsProps) {
  const [actionsSize, setActionsSize] = useState({ width: 0, height: 0 })
  const actionsRef = useRef<HTMLDivElement>(null)
  const definition = blockDefinition(node)
  const ratioLocked = isRatioLocked(node)
  const markdownBlock = definition?.focusable ?? false
  const canEdit = definition ? definition.editor !== 'schedule' : false

  useLayoutEffect(() => {
    const element = actionsRef.current
    if (!element) return
    const width = element.offsetWidth
    const height = element.offsetHeight
    setActionsSize((current) =>
      current.width === width && current.height === height
        ? current
        : { width, height },
    )
  })

  const position = (() => {
    const centerX = offsetX + (node.x + node.width / 2) * scale
    const centerY = offsetY + (node.y + node.height / 2) * scale
    const displayRotation = node['x-superboard']?.rotation ?? 0
    const radians = (displayRotation * Math.PI) / 180
    const distance = (node.height / 2) * scale + 32
    let left = centerX + Math.sin(radians) * distance
    let top = Math.max(8, centerY - Math.cos(radians) * distance)
    if (actionsSize.width > 0 && stageWidth > 0 && stageHeight > 0) {
      const margin = 8
      const cos = Math.cos(radians)
      const sin = Math.sin(radians)
      const halfWidth =
        (Math.abs(actionsSize.width * cos) + Math.abs(actionsSize.height * sin)) /
        2
      const halfHeight =
        (Math.abs(actionsSize.width * sin) + Math.abs(actionsSize.height * cos)) /
        2
      const centerBarX = left
      const centerBarY = top + actionsSize.height / 2
      left = Math.min(
        Math.max(centerBarX, margin + halfWidth),
        stageWidth - margin - halfWidth,
      )
      top =
        Math.min(
          Math.max(centerBarY, margin + halfHeight),
          stageHeight - margin - halfHeight,
        ) -
        actionsSize.height / 2
    }
    return {
      left,
      top,
      transform: `translateX(-50%) rotate(${displayRotation}deg) scale(var(--sb-actions-inverse, 1))`,
    }
  })()

  return (
    <div
      ref={actionsRef}
      className="sb-block-actions"
      style={position}
      onPointerDown={(event) => {
        event.preventDefault()
        event.stopPropagation()
      }}
      onContextMenu={(event) => {
        event.preventDefault()
        event.stopPropagation()
      }}
    >
      <button
        type="button"
        className={`sb-block-action${ratioLocked ? ' is-active' : ''}`}
        title={ratioLocked ? '解锁比例' : '锁定比例'}
        onClick={(event) => {
          event.stopPropagation()
          onToggleRatioLock?.(node.id)
        }}
      >
        <span className={`sb-block-check${ratioLocked ? ' is-checked' : ''}`} />
        <LockIcon size={14} />
      </button>
      {canEdit ? (
        <button
          type="button"
          className={`sb-block-action${editing ? ' is-active' : ''}`}
          title={editing ? '退出编辑' : '编辑'}
          onClick={(event) => {
            event.stopPropagation()
            onToggleBlockEdit?.(node.id)
          }}
        >
          <span className={`sb-block-check${editing ? ' is-checked' : ''}`} />
          <TypeIcon size={14} />
        </button>
      ) : null}
      {markdownBlock ? (
        <button
          type="button"
          className="sb-block-action"
          title="专注编辑"
          onClick={(event) => {
            event.stopPropagation()
            onFocusBlockEdit?.(node.id)
          }}
        >
          <HashIcon size={14} />
        </button>
      ) : null}
      <button
        type="button"
        className="sb-block-action"
        title="恢复大小"
        onClick={(event) => {
          event.stopPropagation()
          onResetBlockSize?.(node.id)
        }}
      >
        <RefreshIcon size={14} />
      </button>
      <button
        type="button"
        className="sb-block-action"
        title="删除"
        onClick={(event) => {
          event.stopPropagation()
          onDeleteBlock?.(node.id)
        }}
      >
        <TrashIcon size={14} />
      </button>
    </div>
  )
}

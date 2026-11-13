import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from 'react'
import UseAnimations from 'react-useanimations'
import hash from 'react-useanimations/lib/hash'
import lock from 'react-useanimations/lib/lock'
import trash2 from 'react-useanimations/lib/trash2'
import typeIcon from 'react-useanimations/lib/type'
import type { CanvasNode, MarkdownTheme } from '../model'
import { blockKind, isRatioLocked } from './blocks'
import { MarkdownThemeIcon } from './MarkdownThemeIcon'

const MARKDOWN_THEMES: MarkdownTheme[] = ['purple', 'orange', 'mint']
const MARKDOWN_THEME_COLORS: Record<MarkdownTheme, string> = {
  purple: '#8064a9',
  orange: '#ef7060',
  mint: '#4eb289',
}

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
  onSetMarkdownTheme?: (id: string, theme: MarkdownTheme) => void
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
  onSetMarkdownTheme,
  onToggleRatioLock,
}: BlockActionsProps) {
  const [actionsSize, setActionsSize] = useState({ width: 0, height: 0 })
  const [themeMenuOpen, setThemeMenuOpen] = useState(false)
  const actionsRef = useRef<HTMLDivElement>(null)
  const ratioLocked = isRatioLocked(node)
  const markdownBlock = blockKind(node) === 'markdown'
  const markdownTheme = node['x-superboard']?.markdownTheme

  useEffect(() => {
    if (!themeMenuOpen) return
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null
      if (target?.closest('.sb-md-theme-popover, .sb-md-theme-action')) return
      setThemeMenuOpen(false)
    }
    window.addEventListener('pointerdown', onPointerDown, true)
    return () => window.removeEventListener('pointerdown', onPointerDown, true)
  }, [themeMenuOpen])

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
      transform: `translateX(-50%) rotate(${displayRotation}deg)`,
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
        <UseAnimations
          animation={lock}
          size={16}
          active={ratioLocked}
          interaction="click-replay"
        />
      </button>
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
        <UseAnimations
          animation={typeIcon}
          size={16}
          active={editing}
          interaction="click-replay"
        />
      </button>
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
          <UseAnimations animation={hash} size={16} interaction="click-replay" />
        </button>
      ) : null}
      {markdownBlock ? (
        <button
          type="button"
          className={`sb-block-action sb-md-theme-action${
            themeMenuOpen ? ' is-active' : ''
          }`}
          title="设置颜色"
          onClick={(event) => {
            event.stopPropagation()
            setThemeMenuOpen((current) => !current)
          }}
        >
          <MarkdownThemeIcon />
        </button>
      ) : null}
      <button
        type="button"
        className="sb-block-action"
        title="删除"
        onClick={(event) => {
          event.stopPropagation()
          onDeleteBlock?.(node.id)
        }}
      >
        <UseAnimations animation={trash2} size={16} interaction="click-replay" />
      </button>
      {markdownBlock && themeMenuOpen ? (
        <div
          className="sb-md-theme-popover"
          onPointerDown={(event) => event.stopPropagation()}
        >
          {MARKDOWN_THEMES.map((theme) => (
            <button
              key={theme}
              type="button"
              className={`sb-md-theme-option${
                markdownTheme === theme ? ' is-active' : ''
              }`}
              style={
                {
                  '--sb-theme-color': MARKDOWN_THEME_COLORS[theme],
                } as CSSProperties
              }
              title={theme}
              aria-label={theme}
              onClick={(event) => {
                event.stopPropagation()
                onSetMarkdownTheme?.(node.id, theme)
                setThemeMenuOpen(false)
              }}
            >
              <span />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}

import { lazy, Suspense, useEffect, type ReactNode } from 'react'
import { usePreferences } from '../editor/preferences'
import type { Hook, JSONCanvasLinkNode, JSONCanvasTextNode } from '../../vendor/json-canvas-viewer/src/index.ts'
import { MarkdownVditorPreview } from '../../shared/markdown/MarkdownVditorPreview'
import {
  resolveNodeStyle,
  TEXT_LINE_HEIGHT,
  TEXT_PADDING_X,
  TEXT_PADDING_Y,
  type SuperBoardMedia,
  type SuperBoardNodeExtension,
  type SuperBoardScheduleEvent,
} from '../model'
import '../../styles/markdown.css'
import '../../styles/pele.css'

const PeleView = lazy(() =>
  import('../../shared/pele/PeleView').then((module) => ({
    default: module.PeleView,
  })),
)

const ScheduleBlock = lazy(() =>
  import('../../shared/schedule/ScheduleBlock').then((module) => ({
    default: module.ScheduleBlock,
  })),
)

function extension(node: object) {
  return (node as { 'x-superboard'?: SuperBoardNodeExtension })['x-superboard']
}

function textStyle(
  node: JSONCanvasTextNode,
  defaults: {
    fontFamily: string
    fontSize: number
    color: string
    opacity: number
    textAlign: 'left' | 'center' | 'right'
  },
) {
  const style = extension(node)?.style
  return {
    padding: `${TEXT_PADDING_Y}px ${TEXT_PADDING_X}px`,
    color: style?.color ?? defaults.color,
    opacity: style?.opacity ?? defaults.opacity,
    fontFamily: style?.fontFamily ?? defaults.fontFamily,
    fontSize: style?.fontSize ?? defaults.fontSize,
    fontWeight: style?.fontWeight,
    fontStyle: style?.fontStyle,
    textDecoration: style?.textDecoration,
    textAlign: style?.textAlign ?? defaults.textAlign,
    lineHeight: style?.lineHeight ?? TEXT_LINE_HEIGHT,
    whiteSpace: 'pre-wrap' as const,
    overflowWrap: 'anywhere' as const,
  }
}

function useNodeSelection(
  id: string,
  onActive: Hook | undefined,
  onSelect: ((id: string) => void) | undefined,
) {
  useEffect(() => {
    if (!onActive || !onSelect) return
    return onActive.subscribe(() => onSelect(id))
  }, [id, onActive, onSelect])
}

function BlockSurface({
  node,
  plain = false,
  children,
}: {
  node: object
  plain?: boolean
  children: ReactNode
}) {
  const ext = extension(node)
  const markdown = ext?.kind === 'markdown'
  const style = resolveNodeStyle(ext?.style)
  const preferences = usePreferences()
  const blockDefaults = preferences.block
  const background = style.background ?? blockDefaults.backgroundColor
  const backgroundOpacity = style.background
    ? style.backgroundOpacity
    : blockDefaults.backgroundOpacity
  const borderColor = style.borderColor ?? blockDefaults.borderColor
  const borderWidth = style.borderWidth ?? blockDefaults.borderWidth
  const borderOpacity = style.borderColor
    ? style.borderOpacity
    : blockDefaults.borderOpacity
  const borderStyle = style.borderColor
    ? style.borderStyle
    : blockDefaults.borderStyle
  return (
    <div
      className={`sb-block-scale${markdown ? ' sb-markdown-block-scale' : ''}`}
      style={
        plain
          ? undefined
          : {
              border: borderWidth
                ? `${borderWidth}px ${borderStyle} color-mix(in srgb, ${borderColor} ${
                    borderOpacity * 100
                  }%, transparent)`
                : undefined,
              backgroundColor: background
                ? `color-mix(in srgb, ${background} ${
                    backgroundOpacity * 100
                  }%, transparent)`
                : undefined,
              opacity: style.opacity,
              ...(background
                ? {
                    ['--sb-block-bg-color' as string]: background,
                    ['--sb-block-bg-opacity' as string]: `${backgroundOpacity * 100}%`,
                  }
                : {}),
            }
      }
    >
      {children}
    </div>
  )
}

export function TextSlot({
  node,
  onActive,
  onSelect,
  onScheduleEventsChange,
}: {
  node: JSONCanvasTextNode
  onActive?: Hook
  onSelect?: (id: string) => void
  onScheduleEventsChange?: (events: SuperBoardScheduleEvent[]) => void
}) {
  useNodeSelection(node.id, onActive, onSelect)
  const ext = extension(node)
  const preferences = usePreferences()
  const content =
    ext?.kind === 'markdown' && ext.markdownLocked === false ? (
      <div className="sb-md-editing-placeholder" />
    ) :     ext?.kind === 'markdown' ? (
      <MarkdownVditorPreview source={node.text} />
    ) : ext?.kind === 'pele' ? (
      <div className="sb-card sb-card-pele">
        <Suspense fallback={<div className="sb-pele-loading">渲染中...</div>}>
          <PeleView code={typeof ext.code === 'string' ? ext.code : node.text} />
        </Suspense>
      </div>
    ) : ext?.kind === 'schedule' ? (
      <Suspense fallback={<div className="sb-schedule" />}>
        <ScheduleBlock
          events={ext.scheduleEvents}
          onEventsChange={onScheduleEventsChange}
        />
      </Suspense>
    ) : (
      <div className="sb-plain-text" style={textStyle(node, preferences.text)}>
        {node.text}
      </div>
    )
  return (
    <BlockSurface node={node} plain={!ext?.kind || ext.kind === 'text'}>
      {content}
    </BlockSurface>
  )
}

function clampPercent(value: number | undefined, fallback: number) {
  const next = value ?? fallback
  return Math.max(0, Math.min(100, next))
}

function mediaClipPath(media: SuperBoardMedia, width: number, height: number) {
  if (media.crop === 'circle') {
    const radius = (Math.min(width, height) * clampPercent(media.cropRadius, 50)) / 100
    return `circle(${radius}px at ${clampPercent(media.cropCx, 50)}% ${clampPercent(
      media.cropCy,
      50,
    )}%)`
  }
  const x = clampPercent(media.cropX, 0)
  const y = clampPercent(media.cropY, 0)
  const cropWidth = clampPercent(media.cropW, 100)
  const cropHeight = clampPercent(media.cropH, 100)
  const right = clampPercent(100 - x - cropWidth, 0)
  const bottom = clampPercent(100 - y - cropHeight, 0)
  const inset = `inset(${y}% ${right}% ${bottom}% ${x}%`
  if (media.crop === 'rounded') {
    const pixelWidth = (width * cropWidth) / 100
    const pixelHeight = (height * cropHeight) / 100
    const radius =
      (Math.min(pixelWidth, pixelHeight) * Math.min(50, clampPercent(media.cropCorner, 8))) /
      100
    return `${inset} round ${radius}px)`
  }
  return `${inset})`
}

export function LinkSlot({
  node,
  onActive,
  onSelect,
}: {
  node: JSONCanvasLinkNode
  onActive?: Hook
  onSelect?: (id: string) => void
}) {
  useNodeSelection(node.id, onActive, onSelect)
  const media = extension(node)?.media
  if (!media) {
    return (
      <BlockSurface node={node}>
        <a
          href={node.url}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'block',
            width: '100%',
            height: '100%',
            padding: '12px',
            overflow: 'hidden',
            color: 'inherit',
            boxSizing: 'border-box',
          }}
        >
          {node.url}
        </a>
      </BlockSurface>
    )
  }

  const style = { width: '100%', height: '100%', border: 0, display: 'block' } as const
  const clipPath = mediaClipPath(media, node.width, node.height)
  return (
    <BlockSurface node={node}>
      <div style={{ width: '100%', height: '100%', clipPath }}>
        {media.kind === 'image' ? (
          <img src={media.url} alt="" style={{ ...style, objectFit: 'cover' }} loading="lazy" />
        ) : media.kind === 'video' ? (
          <video src={media.url} controls style={{ ...style, objectFit: 'cover' }} />
        ) : (
          <iframe
            src={media.url}
            title="media"
            sandbox="allow-scripts allow-same-origin allow-presentation"
            referrerPolicy="no-referrer"
            loading="lazy"
            style={style}
          />
        )}
      </div>
    </BlockSurface>
  )
}

import { useEffect } from 'react'
import type { Hook, JSONCanvasLinkNode, JSONCanvasTextNode } from '../../vendor/json-canvas-viewer/src/index.ts'
import { MarkdownVditorPreview } from '../../shared/markdown/MarkdownVditorPreview'
import { PeleView } from '../../shared/pele/PeleView'
import { ScheduleBlock } from '../../shared/schedule/ScheduleBlock'
import type {
  SuperBoardMedia,
  SuperBoardNodeExtension,
  SuperBoardScheduleEvent,
} from '../model'
import '../../styles/markdown.css'
import '../../styles/pele.css'

function extension(node: object) {
  return (node as { 'x-superboard'?: SuperBoardNodeExtension })['x-superboard']
}

function textStyle(node: JSONCanvasTextNode) {
  const style = extension(node)?.style
  return {
    padding: '14px 16px',
    color: style?.color,
    fontFamily: style?.fontFamily,
    fontSize: style?.fontSize,
    textAlign: style?.textAlign,
    lineHeight: style?.lineHeight,
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
  const content =
    ext?.kind === 'markdown' && ext.markdownLocked === false ? (
      <div className="sb-md-editing-placeholder" />
    ) :     ext?.kind === 'markdown' ? (
      <MarkdownVditorPreview source={node.text} />
    ) : ext?.kind === 'pele' ? (
      <div className="sb-card sb-card-pele">
        <PeleView code={typeof ext.code === 'string' ? ext.code : node.text} />
      </div>
    ) : ext?.kind === 'schedule' ? (
      <ScheduleBlock
        events={ext.scheduleEvents}
        onEventsChange={onScheduleEventsChange}
      />
    ) : (
      <div style={textStyle(node)}>{node.text}</div>
    )
  return (
    <div
      className={`sb-block-scale${
        ext?.kind === 'markdown' ? ' sb-markdown-block-scale' : ''
      }`}
    >
      {content}
    </div>
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
      <a href={node.url} target="_blank" rel="noopener noreferrer">
        {node.url}
      </a>
    )
  }

  const style = { width: '100%', height: '100%', border: 0, display: 'block' } as const
  const clipPath = mediaClipPath(media, node.width, node.height)
  return (
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
  )
}

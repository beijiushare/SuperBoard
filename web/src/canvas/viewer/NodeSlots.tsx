import { lazy, Suspense, useEffect, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { DEFAULT_PREFERENCES } from '../editor/preferences'
import type { Hook, JSONCanvasFileNode, JSONCanvasLinkNode, JSONCanvasTextNode } from '../../vendor/json-canvas-viewer/src/index.ts'
import { MarkdownVditorPreview } from '../../shared/markdown/MarkdownVditorPreview'
import { KnowledgeTree } from '../../shared/tree/KnowledgeTree'
import {
  colorWithOpacity,
  resolveNodeStyle,
  TEXT_LINE_HEIGHT,
  TEXT_PADDING_X,
  TEXT_PADDING_Y,
  type SuperBoardMedia,
  type SuperBoardNodeExtension,
  type SuperBoardScheduleEvent,
  type SuperBoardTreeData,
} from '../model'
import '../../styles/markdown.css'
import '../../styles/pele.css'
import { resolveFileUrl, openResolvedFile } from './fileResolver'

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
  const blockDefaults = DEFAULT_PREFERENCES.block
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
                ? `${borderWidth}px ${borderStyle} ${colorWithOpacity(
                    borderColor,
                    borderOpacity,
                  )}`
                : undefined,
              backgroundColor: background
                ? colorWithOpacity(background, backgroundOpacity)
                : undefined,
              opacity: style.opacity,
              ...(style.padding
                ? { padding: `${style.padding}px` }
                : {}),
              ...(borderWidth
                ? {
                    ['--sb-block-border-width' as string]: `${borderWidth}px`,
                  }
                : {}),
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
  onTreeSize,
  onTreeChange,
}: {
  node: JSONCanvasTextNode
  onActive?: Hook
  onSelect?: (id: string) => void
  onScheduleEventsChange?: (events: SuperBoardScheduleEvent[]) => void
  onTreeSize?: (size: { width: number; height: number }) => void
  onTreeChange?: (data: SuperBoardTreeData) => void
}) {
  const { t } = useTranslation(['common'])
  useNodeSelection(node.id, onActive, onSelect)
  const ext = extension(node)
  const content =
    ext?.kind === 'markdown' && ext.markdownLocked === false ? (
      <div className="sb-md-editing-placeholder" />
    ) :     ext?.kind === 'markdown' ? (
      <MarkdownVditorPreview source={node.text} />
    ) : ext?.kind === 'pele' ? (
      <div className="sb-card sb-card-pele">
        <Suspense fallback={<div className="sb-pele-loading">{t('common:status.rendering')}</div>}>
          <PeleView
            code={typeof ext.code === 'string' ? ext.code : node.text}
            narrow={ext.narrow === true}
          />
        </Suspense>
      </div>
    ) : ext?.kind === 'schedule' ? (
      <Suspense fallback={<div className="sb-schedule" />}>
        <ScheduleBlock
          events={ext.scheduleEvents}
          onEventsChange={onScheduleEventsChange}
        />
      </Suspense>
    ) : ext?.kind === 'tree' && ext.tree ? (
      <KnowledgeTree
        data={ext.tree}
        onSize={onTreeSize}
        onChange={onTreeChange}
        onActivate={() => onSelect?.(node.id)}
      />
    ) : (
      <div
        className="sb-plain-text"
        style={textStyle(node, DEFAULT_PREFERENCES.text)}
      >
        {node.text}
      </div>
    )
  const blockStyle = ext?.style
  const hasTextSurface = Boolean(
    blockStyle?.backgroundColor ||
      blockStyle?.fill ||
      blockStyle?.borderColor ||
      blockStyle?.stroke,
  )
  return (
    <BlockSurface
      node={node}
      plain={
        ext?.kind === 'tree'
          ? true
          : (!ext?.kind || ext.kind === 'text') && !hasTextSurface
      }
    >
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

const FILE_ICON_PATH =
  'M186.181818 837.818182l325.818182 0 0 46.545455-325.818182 0 0-46.545455ZM837.818182 837.818182 837.818182 884.363636 930.909091 884.363636 930.909091 0 232.727273 0 232.727273 93.090909 279.272727 93.090909 279.272727 46.545455 884.363636 46.545455 884.363636 837.818182ZM186.181818 698.181818l512 0 0 46.545455-512 0 0-46.545455ZM93.090909 149.410909l0 864.814545C93.090909 1019.624727 97.373091 1024 102.679273 1024l678.958545 0C786.990545 1024 791.272727 1019.671273 791.272727 1014.225455L791.272727 149.410909C791.272727 144.011636 786.990545 139.636364 781.684364 139.636364L102.679273 139.636364C97.373091 139.636364 93.090909 143.965091 93.090909 149.410909zM139.636364 186.181818l605.090909 0 0 791.272727L139.636364 977.454545 139.636364 186.181818zM186.181818 279.272727l512 0 0 46.545455-512 0 0-46.545455ZM186.181818 418.909091l512 0 0 46.545455-512 0 0-46.545455ZM186.181818 558.545455l512 0 0 46.545455-512 0 0-46.545455Z'

function guessMime(name: string) {
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'avif', 'bmp', 'ico'].includes(ext)) {
    return `image/${ext === 'jpg' ? 'jpeg' : ext}`
  }
  if (['mp4', 'webm', 'ogv', 'mov'].includes(ext)) return `video/${ext}`
  if (['mp3', 'wav', 'ogg', 'flac', 'm4a'].includes(ext)) return `audio/${ext}`
  return ''
}

function FileCard({ media }: { media: SuperBoardMedia }) {
  const { t } = useTranslation(['common', 'editor'])
  const [url, setUrl] = useState<string | null>(null)
  const [missing, setMissing] = useState(false)
  const mime = media.mime || guessMime(media.name ?? media.file ?? '')
  useEffect(() => {
    if (!media.file) return
    let alive = true
    setMissing(false)
    void resolveFileUrl(media.file).then((next) => {
      if (!alive) return
      setUrl(next)
      setMissing(!next)
    })
    return () => {
      alive = false
    }
  }, [media.file])
  if (url && mime.startsWith('image/')) {
    return <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
  }
  if (url && mime.startsWith('video/')) {
    return <video src={url} controls style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
  }
  return (
    <button
      type="button"
      className={`sb-file-card${missing ? ' sb-file-card-missing' : ''}`}
      onDoubleClick={(event) => {
        event.preventDefault()
        event.stopPropagation()
        if (media.file) void openResolvedFile(media.file)
      }}
      title={media.name ?? media.file}
    >
      <svg viewBox="0 0 1024 1024" width="72" height="72" aria-hidden="true">
        <path d={FILE_ICON_PATH} fill="currentColor" />
      </svg>
      <span>{media.name ?? media.file}</span>
      {missing ? <small>{t('editor:file.missing')}</small> : null}
    </button>
  )
}

export function FileSlot({
  node,
  onActive,
  onSelect,
}: {
  node: JSONCanvasFileNode
  onActive?: Hook
  onSelect?: (id: string) => void
}) {
  useNodeSelection(node.id, onActive, onSelect)
  const stored = extension(node)?.media
  const media: SuperBoardMedia = stored ?? {
    kind: 'file',
    url: node.file,
    file: node.file,
    name: node.file.split('/').pop() || node.file,
  }
  return (
    <BlockSurface node={node} plain>
      <FileCard media={media} />
    </BlockSurface>
  )
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
  if (media?.kind === 'file') {
    return (
      <BlockSurface node={node} plain>
        <FileCard media={media} />
      </BlockSurface>
    )
  }
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

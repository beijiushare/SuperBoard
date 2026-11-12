import { useEffect } from 'react'
import type { Hook, JSONCanvasLinkNode, JSONCanvasTextNode } from '../../vendor/json-canvas-viewer/src/index.ts'
import { MarkdownView } from '../../shared/markdown/MarkdownView'
import { PeleView } from '../../shared/pele/PeleView'
import type { SuperBoardNodeExtension } from '../model'
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
}: {
  node: JSONCanvasTextNode
  onActive?: Hook
  onSelect?: (id: string) => void
}) {
  useNodeSelection(node.id, onActive, onSelect)
  const ext = extension(node)
  if (ext?.kind === 'markdown') {
    return <MarkdownView source={node.text} />
  }
  if (ext?.kind === 'pele') {
    return <PeleView code={typeof ext.code === 'string' ? ext.code : node.text} />
  }
  return <div style={textStyle(node)}>{node.text}</div>
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
  if (media.kind === 'image') {
    return <img src={media.url} alt="" style={{ ...style, objectFit: 'cover' }} loading="lazy" />
  }
  if (media.kind === 'video') {
    return <video src={media.url} controls style={{ ...style, objectFit: 'cover' }} />
  }
  return (
    <iframe
      src={media.url}
      title="media"
      sandbox="allow-scripts allow-same-origin allow-presentation"
      referrerPolicy="no-referrer"
      loading="lazy"
      style={style}
    />
  )
}

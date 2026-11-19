import type { CSSProperties, RefObject } from 'react'
import { TEXT_MIN_HEIGHT } from '../model'

interface TextEditingOverlayProps {
  style: CSSProperties
  value: string
  textareaRef: RefObject<HTMLTextAreaElement | null>
  getScale: () => number
  onChange: (value: string, height: number) => void
  onCommit: () => void
  onExitTool: () => void
}

export function TextEditingOverlay({
  style,
  value,
  textareaRef,
  getScale,
  onChange,
  onCommit,
  onExitTool,
}: TextEditingOverlayProps) {
  return (
    <textarea
      ref={textareaRef}
      autoFocus
      className="sb-editor-text-input"
      style={style}
      value={value}
      onChange={(event) => {
        const scale = getScale()
        const height = Math.max(
          TEXT_MIN_HEIGHT,
          event.currentTarget.scrollHeight / scale,
        )
        onChange(event.target.value, height)
      }}
      onBlur={onCommit}
      onPointerDown={(event) => event.stopPropagation()}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault()
          event.stopPropagation()
          onCommit()
          onExitTool()
          return
        }
        if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
          event.preventDefault()
          onCommit()
          onExitTool()
        }
      }}
    />
  )
}

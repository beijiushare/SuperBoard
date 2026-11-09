import { useEffect, useRef, useState } from 'react'
import type { TLShapeId } from 'tldraw'
import { KanbanView } from '../shared/kanban/KanbanView'
import { MarkdownView } from '../shared/markdown/MarkdownView'
import { PeleView } from '../shared/pele/PeleView'
import {
  PELE_DIAGRAM_OPTIONS,
  SB_KANBAN_TYPE,
  SB_MARKDOWN_TYPE,
  SB_PELE_TYPE,
} from '../shared/shapes/types'

export interface EditingShape {
  id: TLShapeId
  type: typeof SB_MARKDOWN_TYPE | typeof SB_KANBAN_TYPE | typeof SB_PELE_TYPE
  props: Record<string, unknown>
}

interface ShapeEditorProps {
  shape: EditingShape
  onClose: () => void
  onSave: (patch: Record<string, unknown>) => void
}

const TITLES = {
  [SB_MARKDOWN_TYPE]: '编辑 Markdown',
  [SB_KANBAN_TYPE]: '编辑看板',
  [SB_PELE_TYPE]: '编辑图表',
} as const

export function ShapeEditor({ shape, onClose, onSave }: ShapeEditorProps) {
  const [text, setText] = useState(String(shape.props.text ?? ''))
  const [code, setCode] = useState(String(shape.props.code ?? ''))
  const [diagram, setDiagram] = useState(String(shape.props.diagram ?? 'flowchart'))
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)

  useEffect(() => {
    textareaRef.current?.focus()
  }, [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
      }
      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
        event.preventDefault()
        save()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  })

  function save() {
    if (shape.type === SB_PELE_TYPE) {
      onSave({ code, diagram })
    } else {
      onSave({ text })
    }
  }

  const isPele = shape.type === SB_PELE_TYPE

  return (
    <div className="sb-modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="sb-modal" role="dialog" aria-modal="true" aria-label={TITLES[shape.type]}>
        <header className="sb-modal-header">
          <div>
            <h2>{TITLES[shape.type]}</h2>
            <p>{isPele ? '编辑 Mermaid 源码，右侧实时预览' : '编辑源码，右侧使用与画布相同的渲染器'}</p>
          </div>
          <button className="sb-icon-button" type="button" onClick={onClose} aria-label="关闭">
            ×
          </button>
        </header>

        <div className="sb-modal-body">
          <div className="sb-editor-pane">
            {isPele ? (
              <div className="sb-pele-toolbar">
                <label>
                  图表类型
                  <select value={diagram} onChange={(event) => setDiagram(event.target.value)}>
                    {PELE_DIAGRAM_OPTIONS.map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            ) : null}
            <textarea
              ref={textareaRef}
              className="sb-source-input"
              value={isPele ? code : text}
              onChange={(event) => (isPele ? setCode(event.target.value) : setText(event.target.value))}
              spellCheck={false}
              placeholder={isPele ? '输入 Mermaid 图表源码' : '输入内容'}
            />
          </div>

          <div className="sb-preview-pane">
            {shape.type === SB_MARKDOWN_TYPE ? <MarkdownView source={text} /> : null}
            {shape.type === SB_KANBAN_TYPE ? <KanbanView source={text} /> : null}
            {isPele ? <PeleView code={code} /> : null}
          </div>
        </div>

        <footer className="sb-modal-footer">
          <span className="sb-shortcut">Esc 关闭 · Ctrl/⌘ + Enter 保存</span>
          <div className="sb-modal-actions">
            <button className="sb-button sb-button-ghost" type="button" onClick={onClose}>
              取消
            </button>
            <button className="sb-button sb-button-primary" type="button" onClick={save}>
              保存
            </button>
          </div>
        </footer>
      </section>
    </div>
  )
}

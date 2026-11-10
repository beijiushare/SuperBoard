import { useEffect, useRef, useState } from 'react'
import { MarkdownView } from '../../shared/markdown/MarkdownView'
import { PELE_EXAMPLE_GROUPS, type PeleExample, type PeleExampleGroup } from '../../shared/pele/examples'
import { PeleView } from '../../shared/pele/PeleView'
import { SB_MARKDOWN_TYPE, SB_PELE_TYPE } from '../../shared/shapes/types'
import { PeleExampleGallery, PeleTypeGallery } from './PeleGalleries'
import type { EditingShape } from './types'

interface ShapeEditorProps {
  shape: EditingShape
  onClose: () => void
  onSave: (patch: Record<string, unknown>) => void
}

type PeleStep = 'types' | 'examples' | 'editor'

const SHAPE_NAMES = {
  [SB_MARKDOWN_TYPE]: 'Markdown',
  [SB_PELE_TYPE]: '图表',
} as const

export function ShapeEditor({ shape, onClose, onSave }: ShapeEditorProps) {
  const isPele = shape.type === SB_PELE_TYPE
  const isNew = shape.mode === 'create'
  const [peleStep, setPeleStep] = useState<PeleStep>(isPele && isNew ? 'types' : 'editor')
  const [activeGroup, setActiveGroup] = useState<PeleExampleGroup | null>(null)
  const [text, setText] = useState(String(shape.props.text ?? ''))
  const [code, setCode] = useState(String(shape.props.code ?? ''))
  const [diagram, setDiagram] = useState(String(shape.props.diagram ?? 'flowchart'))
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)

  useEffect(() => {
    if (peleStep === 'editor') textareaRef.current?.focus()
  }, [peleStep])

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
    if (isPele && peleStep !== 'editor') return
    if (isPele) {
      onSave({ code, diagram })
    } else {
      onSave({ text })
    }
  }

  function selectType(group: PeleExampleGroup) {
    setActiveGroup(group)
    setPeleStep('examples')
  }

  function selectExample(example: PeleExample) {
    if (activeGroup) setDiagram(activeGroup.type)
    setCode(example.source)
    setPeleStep('editor')
  }

  const title =
    isPele && isNew
      ? peleStep === 'types'
        ? '新建图表'
        : peleStep === 'examples' && activeGroup
          ? `${activeGroup.label}（${activeGroup.title}）`
          : '编辑图表'
      : `${isNew ? '新建' : '编辑'} ${SHAPE_NAMES[shape.type]}`

  const description =
    isPele && isNew
      ? peleStep === 'types'
        ? `从 ${PELE_EXAMPLE_GROUPS.length} 种 Pele 官方图表中选择一种`
        : peleStep === 'examples' && activeGroup
          ? '选择一个官方示例进入编辑'
          : '编辑 Mermaid 源码，右侧实时预览'
      : isPele
        ? '编辑 Mermaid 源码，右侧实时预览'
        : '编辑源码，右侧使用与画布相同的渲染器'

  const previewWidth = typeof shape.props.w === 'number' ? shape.props.w : 580
  const previewHeight = typeof shape.props.h === 'number' ? shape.props.h : 380
  const showGallery = isPele && peleStep !== 'editor'

  return (
    <div className="sb-modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section
        className={`sb-modal${showGallery ? ' sb-modal-gallery' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <header className="sb-modal-header">
          <div>
            <h2>{title}</h2>
            <p>{description}</p>
          </div>
          <button className="sb-icon-button" type="button" onClick={onClose} aria-label="关闭">
            ×
          </button>
        </header>

        {isPele && peleStep === 'types' ? <PeleTypeGallery onSelect={selectType} /> : null}

        {isPele && peleStep === 'examples' && activeGroup ? (
          <PeleExampleGallery
            group={activeGroup}
            onBack={() => {
              setActiveGroup(null)
              setPeleStep('types')
            }}
            onSelect={selectExample}
          />
        ) : null}

        {!showGallery ? (
          <div className="sb-modal-body">
            <div className="sb-editor-pane">
              <textarea
                ref={textareaRef}
                className="sb-source-input"
                value={isPele ? code : text}
                onChange={(event) => (isPele ? setCode(event.target.value) : setText(event.target.value))}
                spellCheck={false}
                placeholder={isPele ? '输入 Mermaid 图表源码' : '输入内容'}
              />
            </div>

            <div className={`sb-preview-pane${isPele ? ' sb-preview-pane-pele' : ''}`}>
              {shape.type === SB_MARKDOWN_TYPE ? <MarkdownView source={text} /> : null}
              {isPele ? (
                <div
                  className="sb-card sb-card-pele sb-preview-card"
                  style={{ width: previewWidth, height: previewHeight }}
                >
                  <PeleView code={code} />
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        <footer className="sb-modal-footer">
          {isPele && isNew ? (
            peleStep === 'editor' ? (
              <button className="sb-button sb-button-ghost" type="button" onClick={() => setPeleStep('examples')}>
                ← 返回示例
              </button>
            ) : (
              <span className="sb-shortcut">
                {peleStep === 'types'
                  ? '选择类型后浏览该类型的全部官方示例'
                  : `${activeGroup?.examples.length ?? 0} 个示例，点选后进入编辑`}
              </span>
            )
          ) : (
            <span className="sb-shortcut">Esc 关闭 · Ctrl/⌘ + Enter 保存</span>
          )}
          <div className="sb-modal-actions">
            <button className="sb-button sb-button-ghost" type="button" onClick={onClose}>
              取消
            </button>
            {!showGallery ? (
              <button className="sb-button sb-button-primary" type="button" onClick={save}>
                保存
              </button>
            ) : null}
          </div>
        </footer>
      </section>
    </div>
  )
}

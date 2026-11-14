import { useEffect, useRef, useState } from 'react'
import {
  PELE_EXAMPLE_GROUPS,
  type PeleExample,
  type PeleExampleGroup,
} from '../../shared/pele/examples'
import { PeleView } from '../../shared/pele/PeleView'
import { PeleExampleGallery, PeleTypeGallery } from './PeleGalleries'

type PeleStep = 'types' | 'examples' | 'editor'

interface PeleCreateDialogProps {
  mode?: 'create' | 'edit'
  initialCode?: string
  initialDiagram?: string
  onClose: () => void
  onSave: (payload: { code: string; diagram: string }) => void
}

export function PeleCreateDialog({
  mode = 'create',
  initialCode = '',
  initialDiagram = 'flowchart',
  onClose,
  onSave,
}: PeleCreateDialogProps) {
  const editing = mode === 'edit'
  const [peleStep, setPeleStep] = useState<PeleStep>(editing ? 'editor' : 'types')
  const [activeGroup, setActiveGroup] = useState<PeleExampleGroup | null>(null)
  const [code, setCode] = useState(initialCode)
  const [diagram, setDiagram] = useState(initialDiagram)
  const [previewCode, setPreviewCode] = useState(initialCode)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)

  useEffect(() => {
    if (peleStep !== 'editor') {
      setPreviewCode(code)
      return
    }
    const timer = window.setTimeout(() => setPreviewCode(code), 300)
    return () => window.clearTimeout(timer)
  }, [code, peleStep])

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
        if (peleStep === 'editor') onSave({ code, diagram })
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [code, diagram, onClose, onSave, peleStep])

  function selectType(group: PeleExampleGroup) {
    setActiveGroup(group)
    setPeleStep('examples')
  }

  function selectExample(example: PeleExample) {
    if (activeGroup) setDiagram(activeGroup.type)
    setCode(example.source)
    setPreviewCode(example.source)
    setPeleStep('editor')
  }

  const title = editing
    ? '编辑图表'
    : peleStep === 'types'
      ? '新建图表'
      : peleStep === 'examples' && activeGroup
        ? `${activeGroup.label}（${activeGroup.title}）`
        : '编辑图表'

  const description = editing
    ? '编辑 Mermaid 源码，右侧实时预览'
    : peleStep === 'types'
      ? `从 ${PELE_EXAMPLE_GROUPS.length} 种 Pele 官方图表中选择一种`
      : peleStep === 'examples' && activeGroup
        ? '选择一个官方示例进入编辑'
        : '编辑 Mermaid 源码，右侧实时预览'

  const showGallery = peleStep !== 'editor'

  return (
    <div
      className="sb-modal-backdrop"
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
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

        {peleStep === 'types' ? <PeleTypeGallery onSelect={selectType} /> : null}

        {peleStep === 'examples' && activeGroup ? (
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
                value={code}
                onChange={(event) => setCode(event.target.value)}
                spellCheck={false}
                placeholder="输入 Mermaid 图表源码"
              />
            </div>

            <div className="sb-preview-pane sb-preview-pane-pele">
              <div
                className="sb-card sb-card-pele sb-preview-card"
                style={{ width: 580, height: 380 }}
              >
                <PeleView code={previewCode} />
              </div>
            </div>
          </div>
        ) : null}

        <footer className="sb-modal-footer">
          {!editing && peleStep === 'editor' ? (
            <button
              className="sb-button sb-button-ghost"
              type="button"
              onClick={() => setPeleStep('examples')}
            >
              ← 返回示例
            </button>
          ) : (
            <span className="sb-shortcut">
              {editing
                ? 'Esc 关闭 · Ctrl/⌘ + Enter 保存'
                : peleStep === 'types'
                  ? '选择类型后浏览该类型的全部官方示例'
                  : `${activeGroup?.examples.length ?? 0} 个示例，点选后进入编辑`}
            </span>
          )}
          <div className="sb-modal-actions">
            <button className="sb-button sb-button-ghost" type="button" onClick={onClose}>
              取消
            </button>
            {!showGallery ? (
              <button
                className="sb-button sb-button-primary"
                type="button"
                onClick={() => onSave({ code, diagram })}
              >
                保存
              </button>
            ) : null}
          </div>
        </footer>
      </section>
    </div>
  )
}

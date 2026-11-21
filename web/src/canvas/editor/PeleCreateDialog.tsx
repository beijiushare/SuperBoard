import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
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
  const { t } = useTranslation(['editor', 'common'])
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
    ? t('editor:pele.edit')
    : peleStep === 'types'
      ? t('editor:pele.create')
      : peleStep === 'examples' && activeGroup
        ? `${activeGroup.label}（${activeGroup.title}）`
        : t('editor:pele.edit')

  const description = editing
    ? t('editor:pele.editDescription')
    : peleStep === 'types'
      ? t('editor:pele.chooseType', { total: PELE_EXAMPLE_GROUPS.length })
      : peleStep === 'examples' && activeGroup
        ? t('editor:pele.chooseExample')
        : t('editor:pele.editDescription')

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
          <button
            className="sb-icon-button"
            type="button"
            onClick={onClose}
            aria-label={t('common:actions.close')}
          >
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
                placeholder={t('editor:pele.sourcePlaceholder')}
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
              {t('editor:pele.backToExamples')}
            </button>
          ) : (
            <span className="sb-shortcut">
              {editing
                ? t('editor:pele.editShortcut')
                : peleStep === 'types'
                  ? t('editor:pele.typesHint')
                  : t('editor:pele.examplesHint', {
                      total: activeGroup?.examples.length ?? 0,
                    })}
            </span>
          )}
          <div className="sb-modal-actions">
            <button className="sb-button sb-button-ghost" type="button" onClick={onClose}>
              {t('common:actions.cancel')}
            </button>
            {!showGallery ? (
              <button
                className="sb-button sb-button-primary"
                type="button"
                onClick={() => onSave({ code, diagram })}
              >
                {t('editor:dialog.save')}
              </button>
            ) : null}
          </div>
        </footer>
      </section>
    </div>
  )
}

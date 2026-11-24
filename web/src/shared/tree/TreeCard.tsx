import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import {
  TREE_CARD_MAX_HEIGHT,
  TREE_CARD_WIDTH,
  colorWithOpacity,
  type SuperBoardTreeNode,
} from '../../canvas/model'
import type { BlockStyleDefaults } from '../../canvas/editor/preferences'
import { MarkdownVditorPreview } from '../markdown/MarkdownVditorPreview'

export interface TreeContextPreview {
  /** Ancestor titles, root first. */
  path: string[]
  tokens: number
}

interface TreeCardProps {
  node: SuperBoardTreeNode
  hasChildren: boolean
  canDelete: boolean
  exiting: boolean
  position: { x: number; y: number }
  defaults: BlockStyleDefaults
  register: (element: HTMLElement | null) => void
  onActivate: () => void
  onAddChild: () => void
  onSubmitQuestion: (text: string) => void
  onCancelDraft: () => void
  onToggleBody: () => void
  onHover: (hovering: boolean) => void
  onRename: (title: string) => void
  onDelete: (mode: 'branch' | 'promote') => void
  onRetry: () => void
  onOpenMenu: (anchor: { left: number; top: number }) => void
  onTextMenu: (payload: {
    left: number
    top: number
    text: string
  }) => void
  /** What would be sent if this card asked the given question. */
  contextFor?: (question: string) => TreeContextPreview
}

function CardBody({
  node,
  onRetry,
}: {
  node: SuperBoardTreeNode
  onRetry: () => void
}) {
  const { t } = useTranslation(['editor'])
  if (node.status === 'error') {
    return (
      <div className="sb-kt-card-error">
        <span>{node.error || t('editor:tree.failed')}</span>
        <button
          type="button"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation()
            onRetry()
          }}
        >
          {t('editor:tree.retry')}
        </button>
      </div>
    )
  }
  if (node.status === 'draft' || !node.answer.trim()) {
    return (
      <div className="sb-kt-card-empty">
        {node.status === 'draft'
          ? t('editor:tree.draftHint')
          : node.status === 'generating'
            ? t('editor:tree.generating')
            : t('editor:tree.noAnswer')}
      </div>
    )
  }
  return <MarkdownVditorPreview source={node.answer} />
}

function ContextPreview({ context }: { context?: TreeContextPreview }) {
  const { t } = useTranslation(['editor'])
  if (!context) return null
  const line =
    context.path.length > 0
      ? context.path.join(' → ')
      : t('editor:tree.contextNone')
  return (
    <div className="sb-kt-context" title={line}>
      <span className="sb-kt-context-path">{line}</span>
      {context.tokens > 0 ? (
        <span className="sb-kt-context-tokens">
          {t('editor:tree.contextTokens', { tokens: context.tokens })}
        </span>
      ) : null}
    </div>
  )
}

/** A single card: title, optional quote, question and the answer body. */
export function TreeCard({
  node,
  hasChildren,
  canDelete,
  exiting,
  position,
  defaults,
  register,
  onActivate,
  onAddChild,
  onSubmitQuestion,
  onCancelDraft,
  onToggleBody,
  onHover,
  onRename,
  onDelete,
  onRetry,
  onOpenMenu,
  onTextMenu,
  contextFor,
}: TreeCardProps) {
  const { t } = useTranslation(['editor'])
  const draft = node.status === 'draft'
  const [draftText, setDraftText] = useState('')
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState('')
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const titleRef = useRef<HTMLInputElement>(null)
  const cardRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!draft) return
    const element = textareaRef.current
    if (!element) return
    // Focusing without scrolling: the canvas would jump when the new card sits
    // outside the current viewport.
    element.focus({ preventScroll: true })
    element.setSelectionRange(element.value.length, element.value.length)
  }, [draft])

  useEffect(() => {
    if (!editingTitle) return
    const element = titleRef.current
    if (!element) return
    element.focus({ preventScroll: true })
    element.select()
  }, [editingTitle])

  const commitTitle = () => {
    setEditingTitle(false)
    const next = titleDraft.trim()
    if (next && next !== node.title) onRename(next)
  }

  const requestDelete = () => {
    if (!canDelete) return
    if (!hasChildren) {
      onDelete('branch')
      return
    }
    setConfirmingDelete(true)
  }

  const hasTitle = node.title.trim().length > 0

  return (
    <article
      ref={(element) => {
        cardRef.current = element
        register(element)
      }}
      data-tree-node-id={node.id}
      className={`sb-kt-card${node.bodyCollapsed ? ' is-collapsed' : ''}${
        draft ? ' is-draft' : ''
      }${exiting ? ' is-exiting' : ''}${
        hasTitle || editingTitle ? '' : ' is-headless'
      }`}
      onPointerDown={(event) => {
        if (event.button === 0) onActivate()
      }}
      onPointerEnter={() => onHover(true)}
      onPointerLeave={() => onHover(false)}
      onContextMenu={(event) => {
        event.preventDefault()
        event.stopPropagation()
        const selection = window.getSelection()
        const text =
          selection && !selection.isCollapsed
            ? selection.toString().trim()
            : ''
        // A right-click on selected text asks what to do with it; everywhere
        // else it opens the card style menu.
        if (text && cardRef.current?.contains(selection?.anchorNode ?? null)) {
          onTextMenu({
            left: event.clientX,
            top: event.clientY,
            text: text.slice(0, 2000),
          })
          return
        }
        onOpenMenu({ left: event.clientX, top: event.clientY })
      }}
      style={{
        ...({
          '--sb-kt-x': `${position.x}px`,
          '--sb-kt-y': `${position.y}px`,
        } as CSSProperties),
        width: TREE_CARD_WIDTH,
        maxHeight: TREE_CARD_MAX_HEIGHT,
        // Cards follow the shared block defaults unless they carry an explicit
        // colour, exactly like a normal block surface.
        background: colorWithOpacity(
          node.style?.background ?? defaults.backgroundColor,
          defaults.backgroundOpacity,
        ),
        borderColor: colorWithOpacity(
          node.style?.border ?? defaults.borderColor,
          defaults.borderOpacity,
        ),
        borderWidth: `${defaults.borderWidth}px`,
        borderStyle: defaults.borderStyle,
      }}
    >
      <div className="sb-kt-tools">
        {node.answer.trim() ? (
          <button
            type="button"
            className="sb-kt-tool"
            aria-label={
              node.bodyCollapsed
                ? t('editor:tree.expandBody')
                : t('editor:tree.collapseBody')
            }
            title={
              node.bodyCollapsed
                ? t('editor:tree.expandBody')
                : t('editor:tree.collapseBody')
            }
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation()
              onToggleBody()
            }}
          >
            <svg viewBox="0 0 16 16" width="11" height="11" aria-hidden="true">
              <path
                d={
                  node.bodyCollapsed ? 'M3.5 6 8 10.5 12.5 6' : 'M3.5 10 8 5.5 12.5 10'
                }
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        ) : null}
        <button
          type="button"
          className="sb-kt-tool"
          aria-label={t('editor:tree.addChild')}
          title={t('editor:tree.addChild')}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation()
            onAddChild()
          }}
        >
          ＋
        </button>
        {canDelete ? (
          <button
            type="button"
            className="sb-kt-tool sb-kt-tool-delete"
            aria-label={t('editor:tree.delete')}
            title={t('editor:tree.delete')}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation()
              requestDelete()
            }}
          >
            ×
          </button>
        ) : null}
      </div>

      {hasTitle || editingTitle ? (
        <header className="sb-kt-head">
          {editingTitle ? (
            <input
              ref={titleRef}
              className="sb-kt-title-input"
              value={titleDraft}
              onPointerDown={(event) => event.stopPropagation()}
              onChange={(event) => setTitleDraft(event.target.value)}
              onBlur={commitTitle}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  commitTitle()
                }
                if (event.key === 'Escape') {
                  event.preventDefault()
                  setEditingTitle(false)
                }
              }}
            />
          ) : (
            <span
              className="sb-kt-title"
              title={t('editor:tree.renameHint')}
              onDoubleClick={(event) => {
                if (draft) return
                event.stopPropagation()
                setTitleDraft(node.title)
                setEditingTitle(true)
              }}
            >
              {node.title}
            </span>
          )}
        </header>
      ) : null}

      {node.quote ? (
        <blockquote className="sb-kt-quote">
          {node.quote.title ? (
            <span className="sb-kt-quote-source">{node.quote.title}</span>
          ) : null}
          {node.quote.text}
        </blockquote>
      ) : null}

      {confirmingDelete ? (
        <div className="sb-kt-confirm">
          <span>{t('editor:tree.deleteAsk')}</span>
          <div>
            <button
              type="button"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation()
                setConfirmingDelete(false)
                onDelete('branch')
              }}
            >
              {t('editor:tree.deleteBranch')}
            </button>
            <button
              type="button"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation()
                setConfirmingDelete(false)
                onDelete('promote')
              }}
            >
              {t('editor:tree.promoteChildren')}
            </button>
            <button
              type="button"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation()
                setConfirmingDelete(false)
              }}
            >
              {t('editor:tree.cancel')}
            </button>
          </div>
        </div>
      ) : null}

      {draft ? (
        <div className="sb-kt-draft">
          <textarea
            ref={textareaRef}
            value={draftText}
            rows={2}
            placeholder={t('editor:tree.questionPlaceholder')}
            onChange={(event) => setDraftText(event.target.value)}
            onPointerDown={(event) => event.stopPropagation()}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault()
                onSubmitQuestion(draftText)
                return
              }
              if (event.key === 'Escape') {
                event.preventDefault()
                onCancelDraft()
              }
            }}
          />
          <ContextPreview context={contextFor?.(draftText)} />
        </div>
      ) : (
        <>
          {node.question ? (
            <blockquote className="sb-kt-question">{node.question}</blockquote>
          ) : null}
          <div className="sb-kt-body">
            <CardBody node={node} onRetry={onRetry} />
          </div>
        </>
      )}
    </article>
  )
}

import { useEffect, useRef, useState } from 'react'
import {
  TREE_CARD_MAX_HEIGHT,
  TREE_CARD_WIDTH,
  colorWithOpacity,
  type SuperBoardTreeNode,
} from '../../canvas/model'
import type { BlockStyleDefaults } from '../../canvas/editor/preferences'
import { MarkdownVditorPreview } from '../markdown/MarkdownVditorPreview'

interface TreeCardProps {
  node: SuperBoardTreeNode
  hasChildren: boolean
  position: { x: number; y: number }
  defaults: BlockStyleDefaults
  register: (element: HTMLElement | null) => void
  onActivate: () => void
  onAddChild: () => void
  onSubmitQuestion: (text: string) => void
  onCancelDraft: () => void
  onToggleBranch: () => void
}

function CardBody({ node }: { node: SuperBoardTreeNode }) {
  if (node.status === 'draft' || !node.answer.trim()) {
    return (
      <div className="sb-kt-card-empty">
        {node.status === 'draft'
          ? '等待提问'
          : node.status === 'generating'
            ? '生成中…'
            : node.status === 'error'
              ? '生成失败'
              : '暂无回答'}
      </div>
    )
  }
  return <MarkdownVditorPreview source={node.answer} />
}

/** A single card: title, optional quote, question and the answer body. */
export function TreeCard({
  node,
  hasChildren,
  position,
  defaults,
  register,
  onActivate,
  onAddChild,
  onSubmitQuestion,
  onCancelDraft,
  onToggleBranch,
}: TreeCardProps) {
  const draft = node.status === 'draft'
  const [draftText, setDraftText] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (!draft) return
    const element = textareaRef.current
    if (!element) return
    element.focus()
    element.setSelectionRange(element.value.length, element.value.length)
  }, [draft])

  return (
    <article
      ref={register}
      data-tree-node-id={node.id}
      className={`sb-kt-card${node.bodyCollapsed ? ' is-collapsed' : ''}${
        draft ? ' is-draft' : ''
      }`}
      onPointerDown={(event) => {
        if (event.button === 0) onActivate()
      }}
      style={{
        left: position.x,
        top: position.y,
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
      <header className="sb-kt-head">
        {hasChildren ? (
          <button
            type="button"
            className={`sb-kt-toggle${node.branchCollapsed ? ' is-collapsed' : ''}`}
            aria-label={node.branchCollapsed ? '展开分支' : '折叠分支'}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation()
              onToggleBranch()
            }}
          >
            <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
              <path
                d="M5 3.5 10.5 8 5 12.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        ) : null}
        <span className="sb-kt-title">
          {node.title.trim() || node.question.trim() || '未命名'}
        </span>
        <button
          type="button"
          className="sb-kt-add"
          aria-label="新建子问题"
          title="新建子问题"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation()
            onAddChild()
          }}
        >
          ＋
        </button>
      </header>
      {node.quote ? (
        <blockquote className="sb-kt-quote">
          {node.quote.title ? (
            <span className="sb-kt-quote-source">{node.quote.title}</span>
          ) : null}
          {node.quote.text}
        </blockquote>
      ) : null}
      {draft ? (
        <div className="sb-kt-draft">
          <textarea
            ref={textareaRef}
            value={draftText}
            rows={2}
            placeholder="输入问题，回车提交"
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
        </div>
      ) : (
        <>
          {node.question ? (
            <blockquote className="sb-kt-question">{node.question}</blockquote>
          ) : null}
          <div className="sb-kt-body">
            <CardBody node={node} />
          </div>
        </>
      )}
    </article>
  )
}

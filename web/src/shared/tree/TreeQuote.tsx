import { useTranslation } from 'react-i18next'

interface TreeQuoteProps {
  text: string
  /** Where the excerpt came from. */
  source?: string
  /** `question` is what the user asked; `quote` is a borrowed excerpt. */
  tone: 'quote' | 'question'
  collapsed: boolean
  onToggle: () => void
}

/**
 * Quote blocks scroll with the answer, and can be folded to two lines so a long
 * question does not push the answer out of the card. The folded state lives on
 * the node, so it survives a reload.
 */
export function TreeQuote({
  text,
  source,
  tone,
  collapsed,
  onToggle,
}: TreeQuoteProps) {
  const { t } = useTranslation(['editor'])

  return (
    <div
      className={`sb-kt-quote-wrap is-${tone}${collapsed ? ' is-collapsed' : ''}`}
    >
      <button
        type="button"
        className="sb-kt-quote-toggle"
        aria-label={
          collapsed
            ? t('editor:tree.expandQuote')
            : t('editor:tree.collapseQuote')
        }
        title={
          collapsed
            ? t('editor:tree.expandQuote')
            : t('editor:tree.collapseQuote')
        }
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation()
          onToggle()
        }}
      >
        {collapsed ? '+' : '−'}
      </button>
      <blockquote
        className={tone === 'question' ? 'sb-kt-question' : 'sb-kt-quote'}
      >
        {source ? <span className="sb-kt-quote-source">{source}</span> : null}
        <span className="sb-kt-quote-text">{text}</span>
      </blockquote>
    </div>
  )
}

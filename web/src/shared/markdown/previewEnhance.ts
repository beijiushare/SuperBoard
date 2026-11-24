const CALLOUT_TYPES = ['NOTE', 'TIP', 'IMPORTANT', 'WARNING', 'CAUTION'] as const
type CalloutType = (typeof CALLOUT_TYPES)[number]

const CALLOUT_LABELS: Record<CalloutType, string> = {
  NOTE: 'Note',
  TIP: 'Tip',
  IMPORTANT: 'Important',
  WARNING: 'Warning',
  CAUTION: 'Caution',
}

const MARKER = /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*(.*)$/i

/**
 * Vditor's md2html does not reliably emit GitHub alerts, so a `> [!WARNING]`
 * would render as an ordinary quote. Rewriting the first paragraph is cheaper
 * (and far more predictable) than depending on the renderer's callout option.
 */
function decorateCallouts(host: HTMLElement) {
  host.querySelectorAll<HTMLElement>('blockquote').forEach((quote) => {
    if (quote.classList.contains('callout')) return
    const first = quote.querySelector<HTMLElement>('p')
    const text = first?.textContent?.trim() ?? ''
    const match = text.match(MARKER)
    if (!match || !first) return
    const type = match[1].toUpperCase() as CalloutType
    quote.classList.add('callout')
    quote.dataset.subtype = type

    const info = document.createElement('div')
    info.className = 'callout-info'
    const label = document.createElement('span')
    label.className = 'callout-label'
    label.textContent = CALLOUT_LABELS[type]
    info.append(label)
    quote.prepend(info)

    const rest = match[2].trim()
    if (rest) first.textContent = rest
    else first.remove()
  })
}

/** Tables scroll inside themselves instead of widening the whole reader. */
function wrapTables(host: HTMLElement) {
  host.querySelectorAll<HTMLTableElement>('table').forEach((table) => {
    const parent = table.parentElement
    if (parent?.classList.contains('sb-table-scroll')) return
    const wrapper = document.createElement('div')
    wrapper.className = 'sb-table-scroll'
    table.replaceWith(wrapper)
    wrapper.append(table)
  })
}

export function enhancePreview(host: HTMLElement) {
  decorateCallouts(host)
  wrapTables(host)
}

const MARKER = /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*(.*)$/i

/**
 * Vditor renders GitHub alerts itself (in the editor and in `md2html`), so the
 * preview must keep its markup instead of building a second structure. This
 * pass only repairs what sanitising can damage: a missing subtype or a leaked
 * `[!WARNING]` marker line.
 */
function normaliseCallouts(host: HTMLElement) {
  host.querySelectorAll<HTMLElement>('blockquote').forEach((quote) => {
    const first = quote.querySelector<HTMLElement>('p')
    const text = first?.textContent?.trim() ?? ''
    const match = text.match(MARKER)
    const isCallout = quote.classList.contains('callout')
    if (!isCallout && !match) return

    quote.classList.add('callout')
    if (!quote.dataset.subtype) {
      const type = match?.[1]?.toUpperCase()
      if (type) quote.dataset.subtype = type
    }
    if (match && first) {
      const rest = match[2].trim()
      if (rest) first.textContent = rest
      else first.remove()
    }
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
  normaliseCallouts(host)
  wrapTables(host)
}

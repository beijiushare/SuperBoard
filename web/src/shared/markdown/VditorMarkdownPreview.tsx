import { useEffect, useRef } from 'react'
import DOMPurify from 'dompurify'

const SANITIZE_OPTIONS = {
  USE_PROFILES: { html: true, svg: true, svgFilters: true },
  ADD_TAGS: ['iframe', 'style', 'foreignObject'],
  ADD_ATTR: [
    'style',
    'allowfullscreen',
    'referrerpolicy',
    'loading',
    'target',
    'rel',
    'sandbox',
  ],
  FORBID_TAGS: ['script'],
  FORBID_ATTR: ['onload', 'onerror', 'onclick'],
}

interface VditorMarkdownPreviewProps {
  source: string
  className?: string
}

export function VditorMarkdownPreview({
  source,
  className = '',
}: VditorMarkdownPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const element = containerRef.current
    if (!element) return
    let cancelled = false
    void import('vditor').then(async ({ default: VditorClass }) => {
      await import('vditor/dist/index.css')
      if (cancelled) return
      const preview = (
        VditorClass as unknown as {
          preview: (
            element: HTMLElement,
            markdown: string,
            options?: Record<string, unknown>,
          ) => Promise<void>
        }
      ).preview
      await preview(element, source, {
        cdn: '/__vditor',
        transform: (html: string) => DOMPurify.sanitize(html, SANITIZE_OPTIONS),
      })
    })
    return () => {
      cancelled = true
      element.innerHTML = ''
    }
  }, [source])

  return (
    <div
      ref={containerRef}
      className={`sb-md-preview vditor-reset ${className}`.trim()}
    />
  )
}

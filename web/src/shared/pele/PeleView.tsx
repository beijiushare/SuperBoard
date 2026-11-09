import DOMPurify from 'dompurify'
import { useEffect, useState } from 'react'
import { renderAsync } from 'pele/lazy'

const SVG_SANITIZE_OPTIONS = {
  USE_PROFILES: { svg: true, svgFilters: true },
  ADD_TAGS: ['foreignObject', 'style'],
  ADD_ATTR: ['xmlns', 'xmlns:xlink', 'style', 'dominant-baseline', 'text-anchor', 'marker-end', 'marker-start'],
  FORBID_TAGS: ['script'],
  FORBID_ATTR: ['onload', 'onerror', 'onclick'],
}

interface PeleViewProps {
  code: string
  className?: string
}

export function PeleView({ code, className = '' }: PeleViewProps) {
  const [svg, setSvg] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    setSvg('')
    setError('')

    if (!code.trim()) return

    renderAsync(code)
      .then((result) => {
        if (cancelled) return
        setSvg(DOMPurify.sanitize(result.svg, SVG_SANITIZE_OPTIONS))
      })
      .catch((reason: unknown) => {
        if (cancelled) return
        setError(reason instanceof Error ? reason.message : String(reason))
      })

    return () => {
      cancelled = true
    }
  }, [code])

  return (
    <div className={`sb-pele ${className}`.trim()}>
      {error ? (
        <pre className="sb-pele-error">{error}</pre>
      ) : svg ? (
        <div className="sb-pele-svg" dangerouslySetInnerHTML={{ __html: svg }} />
      ) : (
        <div className="sb-pele-loading">渲染中…</div>
      )}
    </div>
  )
}

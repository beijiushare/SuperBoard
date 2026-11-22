import DOMPurify from 'dompurify'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { renderAsync } from 'pele/lazy'
import { peleRenderOptions } from './size'
import { stripDiagramTitle } from './stripTitle'

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
  /** Draw the diagram narrow, the way it adapts to a small screen. */
  narrow?: boolean
}

export function PeleView({ code, className = '', narrow = false }: PeleViewProps) {
  const { t } = useTranslation(['common'])
  const [svg, setSvg] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    setSvg('')
    setError('')

    if (!code.trim()) return

    renderAsync(stripDiagramTitle(code), peleRenderOptions(narrow))
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
  }, [code, narrow])

  return (
    <div className={`sb-pele ${className}`.trim()}>
      {error ? (
        <pre className="sb-pele-error">{error}</pre>
      ) : svg ? (
        <div className="sb-pele-svg" dangerouslySetInnerHTML={{ __html: svg }} />
      ) : (
        <div className="sb-pele-loading">{t('common:status.rendering')}</div>
      )}
    </div>
  )
}

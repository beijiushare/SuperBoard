import DOMPurify from 'dompurify'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { renderAsync } from 'pele/lazy'
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
}

export function PeleView({ code, className = '' }: PeleViewProps) {
  const { t } = useTranslation(['common'])
  const [svg, setSvg] = useState('')
  const [error, setError] = useState('')
  const hostRef = useRef<HTMLDivElement | null>(null)
  const [renderScale, setRenderScale] = useState(1)

  // Render the SVG at a higher layout resolution when the canvas is zoomed in.
  // The CSS transform downscales it back into the block, so text is rasterized
  // at the zoomed size instead of being upscaled from a 1x bitmap.
  useEffect(() => {
    const layer = hostRef.current?.closest('.JCV-overlays') as HTMLElement | null
    if (!layer) return
    const update = () => {
      const match = /scale\(([^)]+)\)/.exec(layer.style.transform)
      const scale = match ? Number(match[1]) : 1
      const next = Math.min(4, Math.max(1, Math.ceil(Number.isFinite(scale) ? scale : 1)))
      setRenderScale((current) => (current === next ? current : next))
    }
    update()
    const observer = new MutationObserver(update)
    observer.observe(layer, { attributes: true, attributeFilter: ['style'] })
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    let cancelled = false
    setSvg('')
    setError('')

    if (!code.trim()) return

    renderAsync(stripDiagramTitle(code))
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
    <div ref={hostRef} className={`sb-pele ${className}`.trim()}>
      {error ? (
        <pre className="sb-pele-error">{error}</pre>
      ) : svg ? (
        <div
          className="sb-pele-svg"
          style={
            renderScale > 1
              ? {
                  width: `${renderScale * 100}%`,
                  height: `${renderScale * 100}%`,
                  transform: `scale(${1 / renderScale})`,
                  transformOrigin: 'top left',
                }
              : undefined
          }
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      ) : (
        <div className="sb-pele-loading">{t('common:status.rendering')}</div>
      )}
    </div>
  )
}

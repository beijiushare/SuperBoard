import DOMPurify from 'dompurify'
import { useEffect, useRef, useState, type RefObject } from 'react'
import { renderAsciiMath } from './mathjax'

const SANITIZE_OPTIONS = {
  USE_PROFILES: { svg: true, svgFilters: true },
  ADD_TAGS: ['mjx-container'],
  ADD_ATTR: ['xmlns', 'jax', 'display', 'style', 'width', 'height', 'viewBox', 'aria-hidden', 'focusable'],
}

interface MathSpanProps {
  expression: string
  display?: boolean
  className?: string
}

export function MathSpan({ expression, display = false, className = '' }: MathSpanProps) {
  const hostRef = useRef<HTMLDivElement | HTMLSpanElement | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')

  useEffect(() => {
    let cancelled = false
    setState('loading')

    renderAsciiMath(expression, display)
      .then((markup) => {
        if (cancelled || !hostRef.current) return
        hostRef.current.innerHTML = DOMPurify.sanitize(markup.html, SANITIZE_OPTIONS)
        setState('ready')
      })
      .catch(() => {
        if (cancelled) return
        setState('error')
      })

    return () => {
      cancelled = true
    }
  }, [expression, display])

  const fallback = state === 'ready' ? null : (
    <span className={state === 'error' ? 'sb-math-error' : 'sb-math-pending'} aria-label={expression}>
      {expression}
    </span>
  )

  const hostStyle = {
    display: state === 'ready' ? (display ? 'block' : 'inline') : 'none',
  }

  if (display) {
    return (
      <div className={`sb-math sb-math-display ${className}`.trim()}>
        {fallback}
        <div ref={hostRef as RefObject<HTMLDivElement>} className="sb-math-rendered" style={hostStyle} />
      </div>
    )
  }

  return (
    <span className={`sb-math ${className}`.trim()}>
      {fallback}
      <span ref={hostRef as RefObject<HTMLSpanElement>} className="sb-math-rendered" style={hostStyle} />
    </span>
  )
}

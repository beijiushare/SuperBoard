import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { loadMathJax } from './mathjax'
import { enhancePreview } from './previewEnhance'
import { vditorCdn } from './vditorAssets'
import { getAppLanguage } from '../../i18n'

const MarkdownView = lazy(() =>
  import('./MarkdownView').then((module) => ({ default: module.MarkdownView })),
)

const HTML_CACHE_LIMIT = 100
const htmlCache = new Map<string, Promise<string>>()

function cachedHtml(source: string) {
  const cached = htmlCache.get(source)
  if (!cached) return undefined
  htmlCache.delete(source)
  htmlCache.set(source, cached)
  return cached
}

function cacheHtml(source: string, promise: Promise<string>) {
  htmlCache.set(source, promise)
  while (htmlCache.size > HTML_CACHE_LIMIT) {
    const oldest = htmlCache.keys().next().value
    if (oldest === undefined) break
    htmlCache.delete(oldest)
  }
}

async function renderHtml(source: string) {
  const cached = cachedHtml(source)
  if (cached) return cached
  const promise = (async () => {
    await import('vditor/dist/index.css')
    const { default: Vditor } = await import('vditor')
    return Vditor.md2html(source, {
      cdn: vditorCdn,
      lang: getAppLanguage() === 'en-US' ? 'en_US' : 'zh_CN',
      mode: 'light',
      math: { engine: 'MathJax' },
      markdown: {
        inlineMath: true,
        mathBlockPreview: true,
        sanitize: true,
        // Alerts are rewritten from the `[!TYPE]` marker after rendering; the
        // renderer's own callout output is inconsistent (and sanitising can
        // strip the subtype), so leave the marker intact instead.
        callout: false,
      },
    })
  })()
  cacheHtml(source, promise)
  promise.catch(() => {
    if (htmlCache.get(source) === promise) htmlCache.delete(source)
  })
  return promise
}

interface MarkdownVditorPreviewProps {
  source: string
  className?: string
}

export function MarkdownVditorPreview({
  source,
  className = '',
}: MarkdownVditorPreviewProps) {
  const { t } = useTranslation(['common'])
  const hostRef = useRef<HTMLDivElement>(null)
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(false)
  const useLegacyRenderer = /<iframe\b/i.test(source)

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    let cancelled = false
    setReady(false)
    setFailed(false)
    if (!source.trim() || useLegacyRenderer) {
      setReady(true)
      return
    }

    void (async () => {
      try {
        await loadMathJax()
        const { default: Vditor } = await import('vditor')
        const html = await renderHtml(source)
        if (cancelled) return
        host.innerHTML = html
        host.classList.add('vditor-reset', 'sb-markdown')
        enhancePreview(host)
        Vditor.highlightRender(
          { enable: true, style: 'github' },
          host,
          vditorCdn,
        )
        Vditor.mathRender(host, {
          cdn: vditorCdn,
          math: { engine: 'MathJax' },
        })
        setReady(true)
      } catch (error) {
        if (!cancelled) {
          console.error('[SuperBoard] Vditor preview render failed', error)
          setFailed(true)
        }
      }
    })()

    return () => {
      cancelled = true
      host.innerHTML = ''
    }
  }, [source])

  if (!source.trim()) {
    return <p className="sb-empty">{t('common:markdown.empty')}</p>
  }

  if (useLegacyRenderer || failed) {
    return (
      <Suspense fallback={null}>
        <MarkdownView
          source={source}
          className={`sb-md-docs ${className}`.trim()}
        />
      </Suspense>
    )
  }

  return (
    <div
      ref={hostRef}
      className={`sb-markdown-vditor sb-md-docs ${className}`.trim()}
      style={{ visibility: ready ? 'visible' : 'hidden' }}
    />
  )
}

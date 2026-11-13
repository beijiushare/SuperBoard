import { useEffect, useRef, useState } from 'react'
import type { MarkdownTheme } from '../../canvas/model'
import { MarkdownView } from './MarkdownView'
import { loadMathJax } from './mathjax'
import { vditorCdn } from './vditorAssets'

const htmlCache = new Map<string, Promise<string>>()

async function renderHtml(source: string) {
  const cached = htmlCache.get(source)
  if (cached) return cached
  const promise = (async () => {
    await import('vditor/dist/index.css')
    const { default: Vditor } = await import('vditor')
    return Vditor.md2html(source, {
      cdn: vditorCdn,
      mode: 'light',
      math: { engine: 'MathJax' },
      markdown: {
        inlineMath: true,
        mathBlockPreview: true,
        sanitize: true,
      },
    })
  })()
  htmlCache.set(source, promise)
  promise.catch(() => htmlCache.delete(source))
  return promise
}

interface MarkdownVditorPreviewProps {
  source: string
  className?: string
  theme?: MarkdownTheme
}

export function MarkdownVditorPreview({
  source,
  className = '',
  theme,
}: MarkdownVditorPreviewProps) {
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
        Vditor.mathRender(host, {
          cdn: vditorCdn,
          math: { engine: 'MathJax' },
        })
        setReady(true)
      } catch (error) {
        if (!cancelled) {
          console.error('[SuperBoard] Vditor 预览渲染失败', error)
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
    return <p className="sb-empty">暂无内容</p>
  }

  if (useLegacyRenderer || failed) {
    return (
      <div className={theme ? `sb-md-theme-${theme}` : undefined}>
        <MarkdownView source={source} />
      </div>
    )
  }

  return (
    <div
      ref={hostRef}
      className={`sb-markdown-vditor ${
        theme ? `sb-md-theme-${theme}` : ''
      } ${className}`.trim()}
      style={{ visibility: ready ? 'visible' : 'hidden' }}
    />
  )
}

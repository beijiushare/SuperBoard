import { useEffect, useRef, useState } from 'react'
import {
  PELE_EXAMPLE_GROUPS,
  type PeleExample,
  type PeleExampleGroup,
} from '../../shared/pele/examples'
import { PeleView } from '../../shared/pele/PeleView'
import {
  PELE_EXAMPLE_SIZES,
  type PeleExampleSize,
} from '../../shared/pele/sizes.generated'

type ExampleSizeClass = 'complex' | 'normal' | 'simple'

function exampleSizeClass(size: PeleExampleSize | null | undefined): ExampleSizeClass {
  if (!size) return 'normal'
  const ratio = size.width / Math.max(1, size.height)
  if (size.width >= 1000 || size.height >= 520 || ratio >= 2.6) return 'complex'
  if (size.width >= 620 || size.height >= 300 || ratio >= 1.8) return 'normal'
  return 'simple'
}

function LazyPelePreview({ code }: { code: string }) {
  const ref = useRef<HTMLDivElement | null>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const node = ref.current
    if (!node) return
    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true)
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return
        setVisible(true)
        observer.disconnect()
      },
      { rootMargin: '320px' },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  return (
    <div ref={ref} className="sb-example-preview sb-pele-theme" aria-busy={!visible}>
      {visible ? <PeleView code={code} /> : null}
    </div>
  )
}

function resolveSvgHrefs(svg: SVGSVGElement, baseUrl: string) {
  for (const element of svg.querySelectorAll('image, use')) {
    for (const attribute of ['href', 'xlink:href']) {
      const value = element.getAttribute(attribute)
      if (!value || /^(?:[a-z]+:|\/|#)/i.test(value)) continue
      element.setAttribute(attribute, new URL(value, baseUrl).href)
    }
  }
}

export function PeleTypeGallery({
  onSelect,
}: {
  onSelect: (group: PeleExampleGroup) => void
}) {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const onSelectRef = useRef(onSelect)
  const [status, setStatus] = useState('加载一级画廊…')
  onSelectRef.current = onSelect

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    const controller = new AbortController()
    let cancelled = false
    const sourceUrl = new URL(
      `${import.meta.env.BASE_URL}pele-gallery/level1.svg`,
      window.location.href,
    )

    fetch(sourceUrl, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        return response.text()
      })
      .then((text) => {
        if (cancelled) return
        const doc = new DOMParser().parseFromString(text, 'image/svg+xml')
        const svg = doc.documentElement as unknown as SVGSVGElement
        if (!svg || svg.nodeName.toLowerCase() !== 'svg') {
          throw new Error('level1.svg 不是有效的 SVG')
        }
        resolveSvgHrefs(svg, sourceUrl.href)
        svg.classList.add('sb-level1-svg')
        const onClick = (event: MouseEvent) => {
          const target = (event.target as Element | null)?.closest('[data-sb-key]')
          if (!target) return
          const key = target.getAttribute('data-sb-key') ?? ''
          const match = /^pele:type:(.+)$/.exec(key)
          if (!match) return
          const group = PELE_EXAMPLE_GROUPS.find((item) => item.type === match[1])
          if (group) onSelectRef.current(group)
        }
        svg.addEventListener('click', onClick)
        host.replaceChildren(svg)
        setStatus('')
      })
      .catch((error: unknown) => {
        if (cancelled || controller.signal.aborted) return
        setStatus(
          `一级画廊加载失败：${error instanceof Error ? error.message : String(error)}`,
        )
      })

    return () => {
      cancelled = true
      controller.abort()
      host.replaceChildren()
    }
  }, [])

  return (
    <div className="sb-gallery-body sb-gallery-body--level1">
      <div ref={hostRef} className="sb-level1-gallery" />
      {status ? <p className="sb-gallery-status">{status}</p> : null}
    </div>
  )
}

export function PeleExampleGallery({
  group,
  onBack,
  onSelect,
}: {
  group: PeleExampleGroup
  onBack: () => void
  onSelect: (example: PeleExample) => void
}) {
  const sizes = PELE_EXAMPLE_SIZES[group.type] ?? []
  return (
    <div className="sb-gallery-body">
      <div className="sb-gallery-toolbar">
        <button className="sb-button sb-button-ghost" type="button" onClick={onBack}>
          ← 全部图表类型
        </button>
        <span className="sb-gallery-count">
          {group.label}（{group.title}） · {group.examples.length} 个官方示例
        </span>
      </div>
      <div className="sb-example-grid">
        {group.examples.map((example, index) => {
          const sizeClass = exampleSizeClass(sizes[index])
          return (
            <button
              key={`${group.type}-${index}`}
              className={`sb-example-card sb-example-card--${sizeClass}`}
              type="button"
              onClick={() => onSelect(example)}
            >
              <LazyPelePreview code={example.source} />
              <span className="sb-example-card-meta">
                <span className="sb-example-card-label">{example.label}</span>
                <span className="sb-example-card-action">使用此示例</span>
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

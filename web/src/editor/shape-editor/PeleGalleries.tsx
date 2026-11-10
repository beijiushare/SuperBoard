import { useEffect, useRef, useState } from 'react'
import { PELE_EXAMPLE_GROUPS, type PeleExample, type PeleExampleGroup } from '../../shared/pele/examples'
import { PeleView } from '../../shared/pele/PeleView'

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

export function PeleTypeGallery({ onSelect }: { onSelect: (group: PeleExampleGroup) => void }) {
  return (
    <div className="sb-gallery-body">
      <div className="sb-gallery-grid">
        {PELE_EXAMPLE_GROUPS.map((group) => {
          const example = group.examples[group.representativeIndex] ?? group.examples[0]
          return (
            <button key={group.type} className="sb-type-card" type="button" onClick={() => onSelect(group)}>
              <LazyPelePreview code={example.source} />
              <span className="sb-type-card-meta">
                <span className="sb-type-card-title">
                  {group.label}
                  <span className="sb-type-card-en">（{group.title}）</span>
                </span>
                <span className="sb-type-card-sub">
                  {group.examples.length} 个官方示例
                  {group.beta ? ' · Beta' : ''}
                </span>
              </span>
            </button>
          )
        })}
      </div>
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
        {group.examples.map((example, index) => (
          <button
            key={`${group.type}-${index}`}
            className="sb-example-card"
            type="button"
            onClick={() => onSelect(example)}
          >
            <LazyPelePreview code={example.source} />
            <span className="sb-example-card-meta">
              <span className="sb-example-card-label">{example.label}</span>
              <span className="sb-example-card-action">使用此示例</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

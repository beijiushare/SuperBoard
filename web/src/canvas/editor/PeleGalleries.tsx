import { useEffect, useRef, useState } from 'react'
import {
  PELE_EXAMPLE_GROUPS,
  type PeleExample,
  type PeleExampleGroup,
} from '../../shared/pele/examples'
import { PeleView } from '../../shared/pele/PeleView'
import {
  PELE_EXAMPLE_SIZES,
  PELE_THUMBNAILS,
  type PeleExampleSize,
  type PeleThumbnail,
} from '../../shared/pele/thumbnails.generated'

const TYPE_PREVIEW_HEIGHT = 180
const TYPE_CARD_MIN_WIDTH = 220
const TYPE_CARD_MAX_WIDTH = 420

type ExampleSizeClass = 'complex' | 'normal' | 'simple'

function typeCardWidth(thumb: PeleThumbnail | undefined) {
  if (!thumb || thumb.height <= 0) return 300
  const width = (thumb.width / thumb.height) * TYPE_PREVIEW_HEIGHT
  return Math.round(
    Math.min(TYPE_CARD_MAX_WIDTH, Math.max(TYPE_CARD_MIN_WIDTH, width)),
  )
}

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

export function PeleTypeGallery({
  onSelect,
}: {
  onSelect: (group: PeleExampleGroup) => void
}) {
  return (
    <div className="sb-gallery-body">
      <div className="sb-gallery-grid sb-gallery-grid--pele">
        {PELE_EXAMPLE_GROUPS.map((group) => {
          const example = group.examples[group.representativeIndex] ?? group.examples[0]
          const thumb = PELE_THUMBNAILS[group.type]
          return (
            <button
              key={group.type}
              className="sb-type-card"
              type="button"
              style={{ width: typeCardWidth(thumb) }}
              onClick={() => onSelect(group)}
            >
              {thumb ? (
                <div className="sb-example-preview sb-pele-theme">
                  <img
                    className="sb-example-thumb"
                    src={`${import.meta.env.BASE_URL}${thumb.src}`}
                    alt=""
                    loading="lazy"
                    decoding="async"
                  />
                </div>
              ) : (
                <LazyPelePreview code={example.source} />
              )}
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

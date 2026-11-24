import { defaultSchema } from 'hast-util-sanitize'
import { useEffect, useRef } from 'react'
import type { Components } from 'react-markdown'
import ReactMarkdown from 'react-markdown'
import rehypeHighlight from 'rehype-highlight'
import rehypeRaw from 'rehype-raw'
import rehypeSanitize from 'rehype-sanitize'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import { useTranslation } from 'react-i18next'
import { MathSpan } from './MathSpan'
import { enhancePreview } from './previewEnhance'
import { rehypeSafeEmbeds } from './safeEmbeds'
import { remarkAsciiMath } from './remarkAsciiMath'

const sanitizeSchema = {
  ...defaultSchema,
  tagNames: [...(defaultSchema.tagNames ?? []), 'iframe'],
  attributes: {
    ...defaultSchema.attributes,
    iframe: [
      'src',
      'title',
      'width',
      'height',
      'allow',
      'allowFullScreen',
      'frameBorder',
      'sandbox',
      'referrerPolicy',
      'loading',
    ],
    a: [...(defaultSchema.attributes?.a ?? []), 'target', 'rel'],
    img: [...(defaultSchema.attributes?.img ?? []), 'loading', 'referrerPolicy'],
  },
  protocols: {
    ...defaultSchema.protocols,
    src: ['http', 'https'],
  },
} as typeof defaultSchema

const components: Components = {
  a({ href, title, children }) {
    const math = title?.match(/^sbmath:(inline|block):(.+)$/)
    if (math) {
      try {
        return <MathSpan expression={decodeURIComponent(math[2])} display={math[1] === 'block'} />
      } catch {
        return <>{children}</>
      }
    }

    const external = typeof href === 'string' && /^https?:/i.test(href)
    return (
      <a href={href} title={title ?? undefined} target={external ? '_blank' : undefined} rel={external ? 'noopener noreferrer' : undefined}>
        {children}
      </a>
    )
  },
}

interface MarkdownViewProps {
  source: string
  className?: string
}

export function MarkdownView({ source, className = '' }: MarkdownViewProps) {
  const { t } = useTranslation(['common'])
  const hostRef = useRef<HTMLDivElement>(null)

  // This renderer is the fallback for content Vditor cannot handle (embeds),
  // so it needs the same alert and table post-processing.
  useEffect(() => {
    if (hostRef.current) enhancePreview(hostRef.current)
  }, [source])

  if (!source.trim()) {
    return <p className="sb-empty">{t('common:markdown.empty')}</p>
  }

  return (
    <div ref={hostRef} className={`sb-markdown ${className}`.trim()}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath, remarkAsciiMath]}
        rehypePlugins={[
          rehypeRaw,
          rehypeSafeEmbeds,
          [rehypeSanitize, sanitizeSchema],
          rehypeHighlight,
        ]}
        components={components}
      >
        {source}
      </ReactMarkdown>
    </div>
  )
}

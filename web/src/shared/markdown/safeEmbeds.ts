import { visit } from 'unist-util-visit'

type HastNode = {
  type: string
  tagName?: string
  value?: string
  properties?: Record<string, unknown>
  children?: HastNode[]
}

const ALLOWED_EMBED_HOSTS = new Set([
  'www.youtube.com',
  'youtube.com',
  'www.youtube-nocookie.com',
  'youtube-nocookie.com',
  'player.bilibili.com',
  'www.bilibili.com',
  'bilibili.com',
  'player.vimeo.com',
  'vimeo.com',
])

function normalizeEmbedSrc(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null
  const candidate = trimmed.startsWith('//') ? `https:${trimmed}` : trimmed
  try {
    const url = new URL(candidate, window.location.href)
    if (!ALLOWED_EMBED_HOSTS.has(url.hostname)) return null
    if (url.protocol === 'http:') {
      url.protocol = 'https:'
    }
    return url.protocol === 'https:' ? url.href : null
  } catch {
    return null
  }
}

export function rehypeSafeEmbeds() {
  return (tree: HastNode) => {
    visit(tree as never, (node: HastNode) => {
      if (node.type !== 'element') return

      if (node.tagName === 'iframe') {
        const src = node.properties?.src
        const normalizedSrc = normalizeEmbedSrc(src)
        if (!normalizedSrc) {
          node.tagName = 'a'
          node.properties = {
            href: typeof src === 'string' ? src : '#',
            target: '_blank',
            rel: 'noopener noreferrer',
          }
          node.children = [{ type: 'text', value: '不支持的嵌入内容' }]
          return
        }
        node.properties = {
          ...node.properties,
          src: normalizedSrc,
          loading: 'lazy',
          referrerPolicy: 'strict-origin-when-cross-origin',
          sandbox: 'allow-scripts allow-same-origin allow-presentation allow-popups',
          allow: 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share',
        }
      }

      if (node.tagName === 'a') {
        node.properties = {
          ...node.properties,
          rel: 'noopener noreferrer',
        }
      }

      if (node.tagName === 'img') {
        node.properties = {
          ...node.properties,
          loading: 'lazy',
          referrerPolicy: 'no-referrer',
        }
      }
    })
  }
}

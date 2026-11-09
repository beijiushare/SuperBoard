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
  'player.vimeo.com',
  'vimeo.com',
  'www.bilibili.com',
])

function isAllowedEmbed(value: unknown) {
  if (typeof value !== 'string') return false
  try {
    const url = new URL(value, window.location.href)
    return url.protocol === 'https:' && ALLOWED_EMBED_HOSTS.has(url.hostname)
  } catch {
    return false
  }
}

export function rehypeSafeEmbeds() {
  return (tree: HastNode) => {
    visit(tree as never, (node: HastNode) => {
      if (node.type !== 'element') return

      if (node.tagName === 'iframe') {
        const src = node.properties?.src
        if (!isAllowedEmbed(src)) {
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

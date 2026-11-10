import type { SbMediaKind } from '../../shared/shapes/types'

export interface MediaSource {
  url: string
  kind: SbMediaKind
}

const IMAGE_EXTENSIONS = /\.(png|jpe?g|gif|webp|avif|svg|bmp)(?:[?#]|$)/i
const VIDEO_EXTENSIONS = /\.(mp4|webm|ogv|ogg|mov|m4v)(?:[?#]|$)/i

function normalizeUrl(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return null
  const withProtocol = trimmed.startsWith('//') ? `https:${trimmed}` : trimmed
  try {
    const url = new URL(withProtocol)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
    return url.toString()
  } catch {
    return null
  }
}

export function parseMediaSource(value: string): MediaSource | null {
  const trimmed = value.trim()
  if (!trimmed) return null

  if (trimmed.startsWith('<')) {
    const doc = new DOMParser().parseFromString(trimmed, 'text/html')
    const iframe = doc.querySelector('iframe')
    const src = iframe?.getAttribute('src')
    const url = src ? normalizeUrl(src) : null
    return url ? { url, kind: 'iframe' } : null
  }

  const url = normalizeUrl(trimmed)
  if (!url) return null

  if (IMAGE_EXTENSIONS.test(url)) return { url, kind: 'image' }
  if (VIDEO_EXTENSIONS.test(url)) return { url, kind: 'video' }
  return { url, kind: 'iframe' }
}

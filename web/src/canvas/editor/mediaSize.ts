import type { SuperBoardMediaKind } from '../model'
import { fitNaturalSize } from '../../shared/fitSize'

export interface MediaSize {
  width: number
  height: number
}

/** New media blocks are fitted into this box, keeping the source ratio. */
const MEDIA_FIT_BOX = { width: 640, height: 640 } as const
const MEASURE_TIMEOUT = 5000

function imageSize(src: string): Promise<MediaSize | null> {
  return new Promise((resolve) => {
    const image = new Image()
    let settled = false
    const finish = (value: MediaSize | null) => {
      if (settled) return
      settled = true
      window.clearTimeout(timer)
      image.onload = null
      image.onerror = null
      resolve(value)
    }
    const timer = window.setTimeout(() => finish(null), MEASURE_TIMEOUT)
    image.onload = () =>
      finish(
        image.naturalWidth > 0 && image.naturalHeight > 0
          ? { width: image.naturalWidth, height: image.naturalHeight }
          : null,
      )
    image.onerror = () => finish(null)
    image.src = src
  })
}

function videoSize(src: string): Promise<MediaSize | null> {
  return new Promise((resolve) => {
    const video = document.createElement('video')
    let settled = false
    const finish = (value: MediaSize | null) => {
      if (settled) return
      settled = true
      window.clearTimeout(timer)
      video.onloadedmetadata = null
      video.onerror = null
      video.removeAttribute('src')
      video.load()
      resolve(value)
    }
    const timer = window.setTimeout(() => finish(null), MEASURE_TIMEOUT)
    video.preload = 'metadata'
    video.muted = true
    video.onloadedmetadata = () =>
      finish(
        video.videoWidth > 0 && video.videoHeight > 0
          ? { width: video.videoWidth, height: video.videoHeight }
          : null,
      )
    video.onerror = () => finish(null)
    video.src = src
  })
}

export function measureMediaUrl(
  url: string,
  kind: SuperBoardMediaKind,
): Promise<MediaSize | null> {
  if (kind === 'image') return imageSize(url)
  if (kind === 'video') return videoSize(url)
  return Promise.resolve(null)
}

export async function measureMediaFile(file: File): Promise<MediaSize | null> {
  const kind: SuperBoardMediaKind | null = file.type.startsWith('image/')
    ? 'image'
    : file.type.startsWith('video/')
      ? 'video'
      : null
  if (!kind) return null
  const url = URL.createObjectURL(file)
  try {
    return await measureMediaUrl(url, kind)
  } finally {
    URL.revokeObjectURL(url)
  }
}

/** Shrink into the fit box without changing the source ratio. */
export function fitMediaSize(natural: MediaSize): MediaSize {
  return fitNaturalSize(natural, MEDIA_FIT_BOX)
}

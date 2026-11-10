import type { SbMediaKind } from '../../shared/shapes/types'

export function getMediaAspect(url: string, kind: SbMediaKind): Promise<number | null> {
  if (kind === 'iframe' || !url) return Promise.resolve(null)

  return new Promise((resolve) => {
    let settled = false
    const finish = (ratio: number | null) => {
      if (settled) return
      settled = true
      resolve(ratio && Number.isFinite(ratio) && ratio > 0 ? ratio : null)
    }
    const timeout = window.setTimeout(() => finish(null), 5000)

    if (kind === 'image') {
      const image = new Image()
      image.onload = () => {
        window.clearTimeout(timeout)
        finish(image.naturalWidth / image.naturalHeight)
      }
      image.onerror = () => {
        window.clearTimeout(timeout)
        finish(null)
      }
      image.src = url
      return
    }

    const video = document.createElement('video')
    video.preload = 'metadata'
    video.onloadedmetadata = () => {
      window.clearTimeout(timeout)
      finish(video.videoWidth / video.videoHeight)
    }
    video.onerror = () => {
      window.clearTimeout(timeout)
      finish(null)
    }
    video.src = url
  })
}

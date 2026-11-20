type FileUrlResolver = (path: string) => Promise<string | null>
type FileOpener = (path: string) => Promise<void> | void

let resolver: FileUrlResolver | null = null
let opener: FileOpener | null = null
const cache = new Map<string, string>()

export function setFileUrlResolver(next: FileUrlResolver) {
  resolver = next
  cache.clear()
}

export function setFileOpener(next: FileOpener) {
  opener = next
}

export async function resolveFileUrl(path: string) {
  const cached = cache.get(path)
  if (cached) return cached
  if (!resolver) return null
  const url = await resolver(path)
  if (url) cache.set(path, url)
  return url
}

export async function openResolvedFile(path: string) {
  if (opener) {
    await opener(path)
    return
  }
  const url = await resolveFileUrl(path)
  if (url) window.open(url, '_blank', 'noopener,noreferrer')
}

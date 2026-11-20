type FileUrlResolver = (path: string) => Promise<string | null>

let resolver: FileUrlResolver | null = null
const cache = new Map<string, string>()

export function setFileUrlResolver(next: FileUrlResolver) {
  resolver = next
  cache.clear()
}

export async function resolveFileUrl(path: string) {
  const cached = cache.get(path)
  if (cached) return cached
  if (!resolver) return null
  const url = await resolver(path)
  if (url) cache.set(path, url)
  return url
}

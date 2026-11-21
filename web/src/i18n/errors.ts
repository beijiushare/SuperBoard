import i18n from './index'

/**
 * Translates a backend error identifier. Backends return either a plain
 * message or a `code|value` pair, where `code` is a key in the `errors`
 * namespace. Unknown values are returned unchanged so unexpected errors stay
 * debuggable.
 */
export function translateServerError(raw: string): string {
  if (!raw) return raw
  const separator = raw.indexOf('|')
  const code = separator >= 0 ? raw.slice(0, separator) : raw
  const value = separator >= 0 ? raw.slice(separator + 1) : undefined
  const key = `errors:${code}`
  if (!i18n.exists(key)) return raw
  return value === undefined
    ? i18n.t(key)
    : i18n.t(key, { value })
}

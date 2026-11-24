import { translateServerError } from '../i18n/errors'
import * as Updates from './bindings/superboard/desktop/services/updateservice'
import type { Result } from './bindings/superboard/desktop/services/models'

export interface UpdateStatus {
  update: boolean
  current: string
  version?: string
  notes?: string
  size?: number
  name?: string
}

function parse<T>(result: Result): T {
  return JSON.parse(result.body) as T
}

export async function desktopUpdateVersion() {
  try {
    return await Updates.Version()
  } catch {
    return ''
  }
}

export async function desktopCheckUpdate(): Promise<UpdateStatus> {
  const body = parse<UpdateStatus & { error?: string }>(await Updates.Check())
  if (body.error) throw new Error(translateServerError(body.error))
  return body
}

/** Open the folder that holds the executable and select it. */
export async function desktopRevealAppFolder() {
  const body = parse<{ ok?: boolean; path?: string; error?: string }>(
    await Updates.RevealAppFolder(),
  )
  if (body.error) throw new Error(translateServerError(body.error))
  return body.path ?? ''
}

export async function desktopOpenUpdatePage() {
  const body = parse<{ ok?: boolean; error?: string }>(
    await Updates.OpenDownloadPage(),
  )
  if (body.error) throw new Error(translateServerError(body.error))
}

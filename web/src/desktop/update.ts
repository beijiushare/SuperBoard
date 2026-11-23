import { translateServerError } from '../i18n/errors'
import * as Updates from './bindings/superboard/desktop/services/updateservice'
import type { Result } from './bindings/superboard/desktop/services/models'

export interface UpdateEnvironment {
  writable: boolean
  path?: string
  reason?: string
}

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

export async function desktopUpdateEnvironment(): Promise<UpdateEnvironment> {
  const body = parse<UpdateEnvironment & { error?: string }>(
    await Updates.CanAutoUpdate(),
  )
  if (body.error) throw new Error(translateServerError(body.error))
  return body
}

export async function desktopCheckUpdate(): Promise<UpdateStatus> {
  const body = parse<UpdateStatus & { error?: string }>(await Updates.Check())
  if (body.error) throw new Error(translateServerError(body.error))
  return body
}

export async function desktopInstallUpdate() {
  const body = parse<{ ready?: boolean; error?: string }>(await Updates.Install())
  if (body.error) throw new Error(translateServerError(body.error))
}

export async function desktopRestartUpdate() {
  const body = parse<{ restarting?: boolean; error?: string }>(
    await Updates.Restart(),
  )
  if (body.error) throw new Error(translateServerError(body.error))
}

export async function desktopOpenUpdatePage() {
  const body = parse<{ ok?: boolean; error?: string }>(
    await Updates.OpenDownloadPage(),
  )
  if (body.error) throw new Error(translateServerError(body.error))
}

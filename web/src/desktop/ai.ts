import i18n from '../i18n'
import * as AI from './bindings/superboard/desktop/services/aiservice'
import type { Result } from './bindings/superboard/desktop/services/models'
import { desktopMode } from './platform'

export interface AIRequestSettings {
  /** Credential-store name; the slot id. */
  keyName: string
  baseURL: string
  model: string
  /** Local runtimes do not need a key. */
  keyless: boolean
}

export interface AIChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface AIKeyStatus {
  hasKey: boolean
  masked?: string
}

function parse<T>(result: Result): T & { error?: string } {
  return JSON.parse(result.body) as T & { error?: string }
}

function throwIfError(body: { error?: string }) {
  if (body.error) throw new Error(body.error)
}

export function aiAvailable() {
  return desktopMode()
}

export async function aiKeyStatus(provider: string): Promise<AIKeyStatus> {
  if (!desktopMode()) return { hasKey: false }
  const body = parse<AIKeyStatus>(await AI.AIKeyStatus(provider))
  throwIfError(body)
  return { hasKey: Boolean(body.hasKey), masked: body.masked }
}

export async function aiSetKey(provider: string, key: string) {
  const body = parse<{ masked?: string }>(await AI.SetAIKey(provider, key))
  throwIfError(body)
}

export async function aiClearKey(provider: string) {
  throwIfError(parse(await AI.ClearAIKey(provider)))
}

export async function aiClearAllKeys() {
  throwIfError(parse(await AI.ClearAllAIKeys()))
}

export async function aiChat(
  settings: AIRequestSettings,
  messages: AIChatMessage[],
): Promise<string> {
  if (!desktopMode()) {
    throw new Error(i18n.t('editor:ai.desktopOnly'))
  }
  const body = parse<{ content?: string }>(
    await AI.AIChat(
      JSON.stringify({
        provider: settings.keyName,
        baseURL: settings.baseURL,
        model: settings.model,
        messages,
        keyless: settings.keyless,
      }),
    ),
  )
  throwIfError(body)
  return body.content ?? ''
}

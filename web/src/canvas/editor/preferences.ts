import { useSyncExternalStore } from 'react'
import { DEFAULT_TEXT_FONT, type SuperBoardStyle } from '../model'

export type BorderStyle = 'solid' | 'dashed' | 'dotted'
export type TextAlign = 'left' | 'center' | 'right'

export interface BlockStyleDefaults {
  backgroundColor: string
  backgroundOpacity: number
  borderColor: string
  borderOpacity: number
  borderWidth: number
  borderStyle: BorderStyle
}

export interface TextStyleDefaults {
  fontFamily: string
  fontSize: number
  color: string
  opacity: number
  textAlign: TextAlign
}

export interface EditorPreferences {
  block: BlockStyleDefaults
  text: TextStyleDefaults
  shapeCornerRadius: number
  /** Open the most recent workspace on launch instead of showing the picker. */
  autoOpenRecentWorkspace: boolean
  ai: AIPreferences
}

export interface AIPreferences {
  /** Credential-store namespace; also selects the provider preset. */
  provider: string
  baseURL: string
  model: string
}

export interface AIProviderPreset {
  id: string
  labelKey: string
  baseURL: string
  model: string
  keyless: boolean
}

export const AI_PROVIDERS: AIProviderPreset[] = [
  {
    id: 'openai',
    labelKey: 'settings:ai.providers.openai',
    baseURL: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini',
    keyless: false,
  },
  {
    id: 'compatible',
    labelKey: 'settings:ai.providers.compatible',
    baseURL: 'https://api.deepseek.com/v1',
    model: 'deepseek-chat',
    keyless: false,
  },
  {
    id: 'ollama',
    labelKey: 'settings:ai.providers.ollama',
    baseURL: 'http://127.0.0.1:11434/v1',
    model: 'llama3.2',
    keyless: true,
  },
  {
    id: 'lmstudio',
    labelKey: 'settings:ai.providers.lmstudio',
    baseURL: 'http://127.0.0.1:1234/v1',
    model: 'local-model',
    keyless: true,
  },
]

export function aiProviderPreset(id: string) {
  return AI_PROVIDERS.find((item) => item.id === id) ?? AI_PROVIDERS[0]
}

export function fontOptions(t: (key: string) => string) {
  return [
    { value: 'PingFang SC, Microsoft YaHei, sans-serif', label: t('editor:style.fontPingFang') },
    { value: 'Noto Sans SC, Source Han Sans SC, sans-serif', label: t('editor:style.fontNoto') },
    { value: 'Arial, Helvetica, sans-serif', label: 'Arial' },
    { value: "Georgia, 'Times New Roman', serif", label: 'Georgia' },
    { value: 'ui-monospace, Consolas, monospace', label: t('editor:style.fontMono') },
  ] as const
}

const STORAGE_KEY = 'superboard.preferences.v1'

export const DEFAULT_PREFERENCES: EditorPreferences = {
  block: {
    backgroundColor: '#ffffff',
    backgroundOpacity: 1,
    borderColor: '#b8b5aa',
    borderOpacity: 1,
    borderWidth: 1,
    borderStyle: 'solid',
  },
  text: {
    fontFamily: DEFAULT_TEXT_FONT,
    fontSize: 16,
    color: '#1f1e1c',
    opacity: 1,
    textAlign: 'left',
  },
  shapeCornerRadius: 0,
  autoOpenRecentWorkspace: true,
  ai: {
    provider: 'openai',
    baseURL: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini',
  },
}

let cached = loadPreferences()
const listeners = new Set<() => void>()

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function mergePreferences(value: unknown): EditorPreferences {
  if (!isRecord(value)) return DEFAULT_PREFERENCES
  const block = isRecord(value.block) ? value.block : {}
  const text = isRecord(value.text) ? value.text : {}
  const ai = isRecord(value.ai) ? value.ai : {}
  return {
    block: {
      ...DEFAULT_PREFERENCES.block,
      ...block,
    },
    text: {
      ...DEFAULT_PREFERENCES.text,
      ...text,
    },
    shapeCornerRadius:
      typeof value.shapeCornerRadius === 'number'
        ? value.shapeCornerRadius
        : DEFAULT_PREFERENCES.shapeCornerRadius,
    autoOpenRecentWorkspace:
      typeof value.autoOpenRecentWorkspace === 'boolean'
        ? value.autoOpenRecentWorkspace
        : DEFAULT_PREFERENCES.autoOpenRecentWorkspace,
    ai: {
      provider:
        typeof ai.provider === 'string'
          ? ai.provider
          : DEFAULT_PREFERENCES.ai.provider,
      baseURL:
        typeof ai.baseURL === 'string'
          ? ai.baseURL
          : DEFAULT_PREFERENCES.ai.baseURL,
      model:
        typeof ai.model === 'string' ? ai.model : DEFAULT_PREFERENCES.ai.model,
    },
  } as EditorPreferences
}

export function loadPreferences(): EditorPreferences {
  if (typeof window === 'undefined') return DEFAULT_PREFERENCES
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return raw ? mergePreferences(JSON.parse(raw)) : DEFAULT_PREFERENCES
  } catch {
    return DEFAULT_PREFERENCES
  }
}

export function getPreferences() {
  return cached
}

export function blockStyleFromPreferences(): Partial<SuperBoardStyle> {
  const block = getPreferences().block
  return {
    backgroundColor: block.backgroundColor,
    backgroundOpacity: block.backgroundOpacity,
    borderColor: block.borderColor,
    borderOpacity: block.borderOpacity,
    borderWidth: block.borderWidth,
    borderStyle: block.borderStyle,
  }
}

export function textStyleFromPreferences(): Partial<SuperBoardStyle> {
  const text = getPreferences().text
  return {
    fontFamily: text.fontFamily,
    fontSize: text.fontSize,
    color: text.color,
    opacity: text.opacity,
    textAlign: text.textAlign,
  }
}

export function savePreferences(next: EditorPreferences) {
  cached = mergePreferences(next)
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cached))
  } catch {
    // localStorage may be unavailable; keep the in-memory preference.
  }
  listeners.forEach((listener) => listener())
}

export function subscribePreferences(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function usePreferences() {
  return useSyncExternalStore(
    subscribePreferences,
    getPreferences,
    getPreferences,
  )
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key !== STORAGE_KEY) return
    cached = loadPreferences()
    listeners.forEach((listener) => listener())
  })
}

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

export type AISlotId = 'local' | 'online-a' | 'online-b'

export interface AISlot {
  baseURL: string
  model: string
}

export interface AIPreferences {
  active: AISlotId
  slots: Record<AISlotId, AISlot>
}

export interface AISlotDefinition {
  id: AISlotId
  labelKey: string
  keyless: boolean
}

/** One local runtime and two online endpoints: enough to switch without re-pasting a key. */
export const AI_SLOTS: AISlotDefinition[] = [
  { id: 'local', labelKey: 'settings:ai.slots.local', keyless: true },
  { id: 'online-a', labelKey: 'settings:ai.slots.onlineA', keyless: false },
  { id: 'online-b', labelKey: 'settings:ai.slots.onlineB', keyless: false },
]

export const AI_SLOT_DEFAULTS: Record<AISlotId, AISlot> = {
  local: { baseURL: 'http://127.0.0.1:11434/v1', model: 'llama3.2' },
  'online-a': { baseURL: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
  'online-b': { baseURL: 'https://api.deepseek.com/v1', model: 'deepseek-chat' },
}

export function aiSlotDefinition(id: string) {
  return AI_SLOTS.find((item) => item.id === id) ?? AI_SLOTS[0]
}

/** Resolved request settings for the active slot. */
export function activeAISettings(ai: AIPreferences = getPreferences().ai) {
  const slot = aiSlotDefinition(ai.active)
  const values = ai.slots[slot.id] ?? AI_SLOT_DEFAULTS[slot.id]
  return {
    // The credential name is the slot id, so renaming a slot never orphans a key.
    keyName: slot.id,
    baseURL: values.baseURL,
    model: values.model,
    keyless: slot.keyless,
  }
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
    active: 'online-a',
    slots: {
      local: { ...AI_SLOT_DEFAULTS.local },
      'online-a': { ...AI_SLOT_DEFAULTS['online-a'] },
      'online-b': { ...AI_SLOT_DEFAULTS['online-b'] },
    },
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
    ai: mergeAI(ai),
  } as EditorPreferences
}

/**
 * Migrates the first AI shape (`provider` + one baseURL/model) into the slot
 * layout, so existing installs keep their endpoint instead of losing it.
 */
function mergeAI(value: Record<string, unknown>): AIPreferences {
  const defaults = DEFAULT_PREFERENCES.ai
  const slots: Record<AISlotId, AISlot> = {
    local: { ...defaults.slots.local },
    'online-a': { ...defaults.slots['online-a'] },
    'online-b': { ...defaults.slots['online-b'] },
  }
  const rawSlots = isRecord(value.slots) ? value.slots : null
  if (rawSlots) {
    for (const definition of AI_SLOTS) {
      const raw = rawSlots[definition.id]
      if (!isRecord(raw)) continue
      slots[definition.id] = {
        baseURL:
          typeof raw.baseURL === 'string'
            ? raw.baseURL
            : defaults.slots[definition.id].baseURL,
        model:
          typeof raw.model === 'string'
            ? raw.model
            : defaults.slots[definition.id].model,
      }
    }
    const active = AI_SLOTS.some((item) => item.id === value.active)
      ? (value.active as AISlotId)
      : defaults.active
    return { active, slots }
  }

  // Legacy shape: { provider, baseURL, model }.
  const legacySlot: AISlotId =
    value.provider === 'compatible'
      ? 'online-b'
      : value.provider === 'ollama' || value.provider === 'lmstudio'
        ? 'local'
        : 'online-a'
  slots[legacySlot] = {
    baseURL:
      typeof value.baseURL === 'string'
        ? value.baseURL
        : defaults.slots[legacySlot].baseURL,
    model:
      typeof value.model === 'string'
        ? value.model
        : defaults.slots[legacySlot].model,
  }
  return { active: legacySlot, slots }
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

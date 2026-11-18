import { useSyncExternalStore } from 'react'

export interface CanvasUiState {
  stylePanelOpen: boolean
  toolPaletteOpen: boolean
  guides: boolean
  recentColors: string[]
}

const STORAGE_KEY = 'superboard.ui.v1'

export const DEFAULT_UI_STATE: CanvasUiState = {
  stylePanelOpen: true,
  toolPaletteOpen: true,
  guides: true,
  recentColors: [],
}

let cached = loadUiState()
const listeners = new Set<() => void>()

function mergeUiState(value: unknown): CanvasUiState {
  if (!value || typeof value !== 'object') return DEFAULT_UI_STATE
  const record = value as Partial<CanvasUiState>
  return {
    stylePanelOpen: record.stylePanelOpen ?? DEFAULT_UI_STATE.stylePanelOpen,
    toolPaletteOpen: record.toolPaletteOpen ?? DEFAULT_UI_STATE.toolPaletteOpen,
    guides: record.guides ?? DEFAULT_UI_STATE.guides,
    recentColors: Array.isArray(record.recentColors)
      ? record.recentColors.filter((item): item is string => typeof item === 'string').slice(0, 5)
      : [],
  }
}

export function loadUiState(): CanvasUiState {
  if (typeof window === 'undefined') return DEFAULT_UI_STATE
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return raw ? mergeUiState(JSON.parse(raw)) : DEFAULT_UI_STATE
  } catch {
    return DEFAULT_UI_STATE
  }
}

export function getUiState() {
  return cached
}

export function updateUiState(patch: Partial<CanvasUiState>) {
  cached = mergeUiState({ ...cached, ...patch })
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cached))
  } catch {
    // localStorage may be unavailable; keep the in-memory state.
  }
  listeners.forEach((listener) => listener())
}

export function rememberRecentColor(color: string) {
  if (!color || color === 'transparent') return
  const recent = cached.recentColors.filter(
    (item) => item.toLowerCase() !== color.toLowerCase(),
  )
  updateUiState({ recentColors: [color, ...recent].slice(0, 5) })
}

export function useUiState() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    getUiState,
    getUiState,
  )
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key !== STORAGE_KEY) return
    cached = loadUiState()
    listeners.forEach((listener) => listener())
  })
}

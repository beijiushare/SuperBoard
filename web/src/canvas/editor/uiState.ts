import { useSyncExternalStore } from 'react'

export interface BrushDefaults {
  size: number
  color: string
  opacity: number
  thinning: number
  smoothing: number
  streamline: number
  simulatePressure: boolean
  start: number
  end: number
}

export interface CanvasUiState {
  stylePanelOpen: boolean
  toolPaletteOpen: boolean
  guides: boolean
  recentColors: string[]
  brush: BrushDefaults
}

const STORAGE_KEY = 'superboard.ui.v1'

export const DEFAULT_UI_STATE: CanvasUiState = {
  stylePanelOpen: true,
  toolPaletteOpen: true,
  guides: true,
  recentColors: [],
  brush: {
    size: 4,
    color: '#1d1d1d',
    opacity: 1,
    thinning: 0.5,
    smoothing: 0.5,
    streamline: 0.5,
    simulatePressure: true,
    start: 0,
    end: 0,
  },
}

let cached = loadUiState()
const listeners = new Set<() => void>()

function mergeBrush(value: unknown): BrushDefaults {
  const base = DEFAULT_UI_STATE.brush
  if (!value || typeof value !== 'object') return base
  const record = value as Partial<BrushDefaults>
  const number = (input: unknown, fallback: number) =>
    typeof input === 'number' && Number.isFinite(input) ? input : fallback
  return {
    size: number(record.size, base.size),
    color: typeof record.color === 'string' && record.color ? record.color : base.color,
    opacity: number(record.opacity, base.opacity),
    thinning: number(record.thinning, base.thinning),
    smoothing: number(record.smoothing, base.smoothing),
    streamline: number(record.streamline, base.streamline),
    simulatePressure:
      typeof record.simulatePressure === 'boolean'
        ? record.simulatePressure
        : base.simulatePressure,
    start: number(record.start, base.start),
    end: number(record.end, base.end),
  }
}

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
    brush: mergeBrush(record.brush),
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

import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import zhCommon from './locales/zh-CN/common.json'
import zhStart from './locales/zh-CN/start.json'
import zhSettings from './locales/zh-CN/settings.json'
import enCommon from './locales/en-US/common.json'
import enStart from './locales/en-US/start.json'
import enSettings from './locales/en-US/settings.json'

export const SUPPORTED_LANGUAGES = ['zh-CN', 'en-US'] as const
export type AppLanguage = (typeof SUPPORTED_LANGUAGES)[number]
export const LANGUAGE_STORAGE_KEY = 'superboard.language'

const resources = {
  'zh-CN': {
    common: zhCommon,
    start: zhStart,
    settings: zhSettings,
  },
  'en-US': {
    common: enCommon,
    start: enStart,
    settings: enSettings,
  },
}

let initialized = false

export function detectLanguage(value?: string | null): AppLanguage {
  return value?.toLowerCase().startsWith('en') ? 'en-US' : 'zh-CN'
}

export function getAppLanguage(): AppLanguage {
  return detectLanguage(i18n.language)
}

export async function initI18n(language?: string | null) {
  let stored: string | null = null
  try {
    stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY)
  } catch {
    stored = null
  }
  const next = detectLanguage(
    language || stored || window.navigator.language,
  )
  if (!initialized) {
    await i18n.use(initReactI18next).init({
      resources,
      lng: next,
      fallbackLng: 'zh-CN',
      ns: ['common', 'start', 'settings'],
      defaultNS: 'common',
      interpolation: { escapeValue: false },
      returnNull: false,
    })
    initialized = true
  } else if (i18n.language !== next) {
    await i18n.changeLanguage(next)
  }
  document.documentElement.lang = next
  return next
}

export async function setAppLanguage(language: string) {
  const next = detectLanguage(language)
  if (i18n.language !== next) await i18n.changeLanguage(next)
  try {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, next)
  } catch {
    // Best effort.
  }
  document.documentElement.lang = next
  return next
}

export default i18n

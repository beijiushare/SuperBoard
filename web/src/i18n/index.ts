import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import zhCommon from './locales/zh-CN/common.json'
import zhStart from './locales/zh-CN/start.json'
import zhSettings from './locales/zh-CN/settings.json'
import zhEditor from './locales/zh-CN/editor.json'
import zhViewer from './locales/zh-CN/viewer.json'
import zhErrors from './locales/zh-CN/errors.json'
import zhTWCommon from './locales/zh-TW/common.json'
import zhTWStart from './locales/zh-TW/start.json'
import zhTWSettings from './locales/zh-TW/settings.json'
import zhTWEditor from './locales/zh-TW/editor.json'
import zhTWViewer from './locales/zh-TW/viewer.json'
import zhTWErrors from './locales/zh-TW/errors.json'
import enCommon from './locales/en-US/common.json'
import enStart from './locales/en-US/start.json'
import enSettings from './locales/en-US/settings.json'
import enEditor from './locales/en-US/editor.json'
import enViewer from './locales/en-US/viewer.json'
import enErrors from './locales/en-US/errors.json'
import jaCommon from './locales/ja-JP/common.json'
import jaStart from './locales/ja-JP/start.json'
import jaSettings from './locales/ja-JP/settings.json'
import jaEditor from './locales/ja-JP/editor.json'
import jaViewer from './locales/ja-JP/viewer.json'
import jaErrors from './locales/ja-JP/errors.json'
import koCommon from './locales/ko-KR/common.json'
import koStart from './locales/ko-KR/start.json'
import koSettings from './locales/ko-KR/settings.json'
import koEditor from './locales/ko-KR/editor.json'
import koViewer from './locales/ko-KR/viewer.json'
import koErrors from './locales/ko-KR/errors.json'

export const SUPPORTED_LANGUAGES = [
  'zh-CN',
  'zh-TW',
  'en-US',
  'ja-JP',
  'ko-KR',
] as const
export type AppLanguage = (typeof SUPPORTED_LANGUAGES)[number]
export const LANGUAGE_STORAGE_KEY = 'superboard.language'

const resources = {
  'zh-CN': {
    common: zhCommon,
    start: zhStart,
    settings: zhSettings,
    editor: zhEditor,
    viewer: zhViewer,
    errors: zhErrors,
  },
  'zh-TW': {
    common: zhTWCommon,
    start: zhTWStart,
    settings: zhTWSettings,
    editor: zhTWEditor,
    viewer: zhTWViewer,
    errors: zhTWErrors,
  },
  'en-US': {
    common: enCommon,
    start: enStart,
    settings: enSettings,
    editor: enEditor,
    viewer: enViewer,
    errors: enErrors,
  },
  'ja-JP': {
    common: jaCommon,
    start: jaStart,
    settings: jaSettings,
    editor: jaEditor,
    viewer: jaViewer,
    errors: jaErrors,
  },
  'ko-KR': {
    common: koCommon,
    start: koStart,
    settings: koSettings,
    editor: koEditor,
    viewer: koViewer,
    errors: koErrors,
  },
}

let initialized = false

export function detectLanguage(value?: string | null): AppLanguage {
  const tag = value?.toLowerCase().replaceAll('_', '-') ?? ''
  if (tag.startsWith('en')) return 'en-US'
  if (tag.startsWith('ja')) return 'ja-JP'
  if (tag.startsWith('ko')) return 'ko-KR'
  if (
    tag.startsWith('zh-tw') ||
    tag.startsWith('zh-hk') ||
    tag.startsWith('zh-mo') ||
    tag.startsWith('zh-hant')
  ) {
    return 'zh-TW'
  }
  return 'zh-CN'
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
      ns: ['common', 'start', 'settings', 'editor', 'viewer', 'errors'],
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

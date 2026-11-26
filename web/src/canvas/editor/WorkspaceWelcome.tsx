import type { MouseEvent } from 'react'
import { Browser } from '@wailsio/runtime'
import { useTranslation } from 'react-i18next'
import type { WorkspaceRecentItem } from './workspacePlatform'
import { changeAppLanguage } from './workspacePlatform'
import { APP_VERSION } from '../../shared/appVersion'
import { Select } from '../../components/ui/select'
import { getAppLanguage, SUPPORTED_LANGUAGES } from '../../i18n'
import wordmarkUrl from '../../assets/superboard-wordmark.svg?url'
import hashUrl from '../../assets/superboard-hash.svg?url'

function HashIcon({ size = 40 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 1024 1024"
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
      fill="currentColor"
    >
      <path d="M651.424 217.066667a32 32 0 0 1 62.485333 13.866666L682.261333 373.333333H800a32 32 0 0 1 31.946667 30.122667L832 405.333333a32 32 0 0 1-32 32H668.032l-33.184 149.333334H800a32 32 0 0 1 31.946667 30.122666L832 618.666667a32 32 0 0 1-32 32H620.629333l-34.72 156.266666a32 32 0 0 1-36.341333 24.661334l-1.845333-0.352a32 32 0 0 1-24.298667-38.186667L555.061333 650.666667H407.296l-34.72 156.288a32 32 0 0 1-36.341333 24.64l-1.845334-0.341334a32 32 0 0 1-24.298666-38.186666L341.728 650.666667 224 650.666667a32 32 0 0 1-31.946667-30.122667L192 618.666667a32 32 0 0 1 32-32h131.957333l33.184-149.333334H224a32 32 0 0 1-31.946667-30.122666L192 405.333333a32 32 0 0 1 32-32h179.36l34.730667-156.266666a32 32 0 0 1 36.341333-24.661334l1.845333 0.352a32 32 0 0 1 24.298667 38.186667l-31.648 142.378667h147.765333zM602.474667 437.333333H454.698667l-33.184 149.333334h147.776l33.184-149.333334z" />
    </svg>
  )
}

export function WelcomeLoading({ desktop }: { desktop: boolean }) {
  const { t } = useTranslation(['start'])
  return (
    <div className="sb-welcome sb-welcome-loading">
      <div className="sb-welcome-logo">
        <HashIcon size={40} />
      </div>
      <h1>SuperBoard</h1>
      <p>{t('start:loading')}</p>
      <span>
        {desktop ? t('start:loading.desktop') : t('start:loading.browser')}
      </span>
    </div>
  )
}

interface WorkspaceWelcomeProps {
  desktop: boolean
  busy: boolean
  error: string
  supported: boolean
  recent: WorkspaceRecentItem[]
  onOpenFolder: () => void
  onOpenRecent: (item: WorkspaceRecentItem) => void
}

export function WorkspaceWelcome({
  desktop,
  busy,
  error,
  supported,
  recent,
  onOpenFolder,
  onOpenRecent,
}: WorkspaceWelcomeProps) {
  const { t } = useTranslation(['start', 'common'])
  const language = getAppLanguage()
  const openExternal = (event: MouseEvent, url: string) => {
    if (!desktop) return
    event.preventDefault()
    void Browser.OpenURL(url)
  }

  return (
    <div
      className="sb-welcome"
      data-platform={desktop ? 'desktop' : 'browser'}
    >
      <div className="sb-welcome-inner">
        <header className="sb-welcome-brand">
          <img
            className="sb-start-hash"
            src={hashUrl}
            alt=""
            aria-hidden="true"
          />
          <img
            className="sb-start-wordmark"
            src={wordmarkUrl}
            alt={t('start:brand.alt')}
          />
        </header>

        <div className="sb-start-meta">
          <a
            href="https://github.com/beijiushare/SuperBoard"
            target="_blank"
            rel="noreferrer"
            title={`SuperBoard ${APP_VERSION}`}
            onClick={(event) =>
              openExternal(
                event,
                'https://github.com/beijiushare/SuperBoard',
              )
            }
          >
            {t('start:meta.version', { version: APP_VERSION })}
          </a>
          <span aria-hidden="true">·</span>
          <a
            href="https://beijiu.top/SuperBoard"
            target="_blank"
            rel="noreferrer"
            title="beijiu.top/SuperBoard"
            onClick={(event) =>
              openExternal(event, 'https://beijiu.top/SuperBoard')
            }
          >
            {t('start:meta.website')}
          </a>
        </div>

        <section className="sb-start-card" aria-label={t('start:page.aria')}>
          <div className="sb-start-row">
            <div className="sb-start-row-text">
              <h2>{t('start:open.title')}</h2>
              <p>{t('start:open.description')}</p>
            </div>
            <button
              type="button"
              className="sb-start-button"
              disabled={busy || !supported}
              onClick={onOpenFolder}
            >
              {busy ? t('start:open.busy') : t('start:open.action')}
            </button>
          </div>

          <div className="sb-start-row">
            <div className="sb-start-row-text">
              <h2>{t('start:recent.title')}</h2>
              <p>{t('start:recent.description')}</p>
            </div>
            <Select
              className="sb-start-select"
              value=""
              placeholder={t('start:recent.placeholder')}
              disabled={busy}
              ariaLabel={t('start:recent.aria')}
              onChange={(id) => {
                const item = recent.find((entry) => entry.id === id)
                if (item) onOpenRecent(item)
              }}
              options={recent.map((item) => ({
                value: item.id,
                label: item.kind === 'sample' ? t('start:sample.name') : item.name,
                disabled: !item.available,
                title:
                  item.kind === 'sample'
                    ? t('start:sample.hint')
                    : item.path ?? item.name,
                hint:
                  item.kind === 'sample'
                    ? t('start:sample.hint')
                    : !item.available
                      ? t('start:recent.missing')
                      : item.permission === 'prompt'
                        ? t('start:recent.permission')
                        : undefined,
              }))}
            />
          </div>

          <div className="sb-start-row">
            <div className="sb-start-row-text">
              <h2>{t('start:language.title')}</h2>
              <p>{t('start:language.description')}</p>
            </div>
            <Select
              className="sb-start-select"
              value={language}
              onChange={(value) => void changeAppLanguage(value)}
              ariaLabel={t('start:language.aria')}
              options={SUPPORTED_LANGUAGES.map((lang) => ({
                value: lang,
                label: t(`common:language.${lang}`),
              }))}
            />
          </div>
        </section>

        {!supported ? (
          <p className="sb-welcome-error">{t('start:unsupported')}</p>
        ) : null}
        {error ? <p className="sb-welcome-error">{error}</p> : null}
      </div>
    </div>
  )
}

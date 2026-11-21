import type { MouseEvent } from 'react'
import { Browser } from '@wailsio/runtime'
import type { WorkspaceRecentItem } from './workspacePlatform'
import { APP_VERSION } from '../../shared/appVersion'
import { Select } from '../../components/ui/select'
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
  return (
    <div className="sb-welcome sb-welcome-loading">
      <div className="sb-welcome-logo">
        <HashIcon size={40} />
      </div>
      <h1>SuperBoard</h1>
      <p>正在打开工作区…</p>
      <span>{desktop ? '桌面版' : '浏览器版'}</span>
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
            alt="SuperBoard"
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
            版本 {APP_VERSION}
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
            网站
          </a>
        </div>

        <section className="sb-start-card" aria-label="开始">
          <div className="sb-start-row">
            <div className="sb-start-row-text">
              <h2>打开文件夹</h2>
              <p>打开指定文件夹作为工作区。</p>
            </div>
            <button
              type="button"
              className="sb-start-button"
              disabled={busy || !supported}
              onClick={onOpenFolder}
            >
              {busy ? '正在…' : '打开'}
            </button>
          </div>

          <div className="sb-start-row">
            <div className="sb-start-row-text">
              <h2>最近打开</h2>
              <p>最近访问的工作区。</p>
            </div>
            <Select
              className="sb-start-select"
              value=""
              placeholder="选择"
              disabled={busy}
              ariaLabel="最近工作区"
              onChange={(id) => {
                const item = recent.find((entry) => entry.id === id)
                if (item) onOpenRecent(item)
              }}
              options={recent.map((item) => ({
                value: item.id,
                label: item.name,
                disabled: !item.available,
                title: item.path ?? item.name,
                hint: !item.available
                  ? '目录不存在'
                  : item.permission === 'prompt'
                    ? '需要授权'
                    : undefined,
              }))}
            />
          </div>

          <div className="sb-start-row">
            <div className="sb-start-row-text">
              <h2>语言</h2>
              <p>界面显示语言。</p>
            </div>
            <Select
              className="sb-start-select"
              value="zh-CN"
              onChange={() => undefined}
              ariaLabel="语言"
              options={[{ value: 'zh-CN', label: '简体中文' }]}
            />
          </div>
        </section>

        {!supported ? (
          <p className="sb-welcome-error">
            当前浏览器不支持 File System Access API，请使用 Edge / Chrome，
            或改用 SuperBoard 桌面端。
          </p>
        ) : null}
        {error ? <p className="sb-welcome-error">{error}</p> : null}
      </div>
    </div>
  )
}

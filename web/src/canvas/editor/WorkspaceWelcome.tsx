import { useEffect, useRef, useState, type MouseEvent } from 'react'
import { Browser } from '@wailsio/runtime'
import type { WorkspaceRecentItem } from './workspacePlatform'
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

function RecentSelect({
  items,
  disabled,
  onOpen,
}: {
  items: WorkspaceRecentItem[]
  disabled: boolean
  onOpen: (item: WorkspaceRecentItem) => void
}) {
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  const current = items.find((item) => item.id === selected)
  const label = current?.name ?? '选择'

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <div className="sb-start-recent" ref={ref}>
      <button
        type="button"
        className="sb-start-select sb-start-select-button"
        disabled={disabled || items.length === 0}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="sb-start-select-label">{label}</span>
        <span className="sb-start-select-arrow" aria-hidden="true">
          ⌄
        </span>
      </button>
      {open ? (
        <div className="sb-start-menu" role="listbox">
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              role="option"
              aria-selected={item.id === selected}
              className="sb-start-menu-item"
              disabled={!item.available}
              title={item.path ?? item.name}
              onClick={() => {
                setSelected(item.id)
                setOpen(false)
                onOpen(item)
              }}
            >
              <span className="sb-start-menu-name">{item.name}</span>
              {!item.available ? (
                <small>目录不存在</small>
              ) : item.permission === 'prompt' ? (
                <small>需要授权</small>
              ) : null}
            </button>
          ))}
        </div>
      ) : null}
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
            onClick={(event) =>
              openExternal(
                event,
                'https://github.com/beijiushare/SuperBoard',
              )
            }
          >
            版本 0.1.0
          </a>
          <span aria-hidden="true">·</span>
          <a
            href="https://beijiu.top/SuperBoard"
            target="_blank"
            rel="noreferrer"
            onClick={(event) =>
              openExternal(event, 'https://beijiu.top/SuperBoard')
            }
          >
            beijiu.top/SuperBoard
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
            <RecentSelect
              items={recent}
              disabled={busy}
              onOpen={onOpenRecent}
            />
          </div>

          <div className="sb-start-row">
            <div className="sb-start-row-text">
              <h2>语言</h2>
              <p>界面显示语言。</p>
            </div>
            <select
              className="sb-start-select sb-start-language"
              defaultValue="zh-CN"
              aria-label="语言"
            >
              <option value="zh-CN">简体中文</option>
            </select>
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

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

function formatTime(value?: string) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function recentDetail(item: WorkspaceRecentItem) {
  if (!item.available) return '目录不存在'
  if (item.permission === 'prompt') return '需要重新授权'
  return item.path ?? ''
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
  onForgetRecent: (item: WorkspaceRecentItem) => void
}

export function WorkspaceWelcome({
  desktop,
  busy,
  error,
  supported,
  recent,
  onOpenFolder,
  onOpenRecent,
  onForgetRecent,
}: WorkspaceWelcomeProps) {
  return (
    <div className="sb-welcome">
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

        <section className="sb-welcome-recent">
          <div className="sb-welcome-section-head">
            <h2>最近打开</h2>
          </div>
          {recent.length > 0 ? (
            <ul>
              {recent.map((item) => (
                <li key={item.id} className={item.available ? undefined : 'is-missing'}>
                  <button
                    type="button"
                    className="sb-welcome-recent-open"
                    disabled={!item.available}
                    onClick={() => onOpenRecent(item)}
                  >
                    <span className="sb-welcome-recent-name">{item.name}</span>
                    <span className="sb-welcome-recent-detail">
                      {recentDetail(item)}
                    </span>
                  </button>
                  <span className="sb-welcome-recent-time">
                    {formatTime(item.lastOpened)}
                  </span>
                  <button
                    type="button"
                    className="sb-welcome-recent-remove"
                    aria-label={`移除 ${item.name}`}
                    title="从最近列表移除"
                    onClick={() => onForgetRecent(item)}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="sb-welcome-empty">还没有最近的工作区记录。</p>
          )}
        </section>

        <div className="sb-welcome-actions">
          <button
            type="button"
            className="sb-welcome-primary"
            disabled={busy || !supported}
            onClick={onOpenFolder}
          >
            {busy ? '正在检查…' : '打开文件夹'}
          </button>
          <p>
            选择一个文件夹作为工作区，建议包含 <code>public</code> 和{' '}
            <code>private</code>；不存在会自动创建。
          </p>
          {!supported ? (
            <p className="sb-welcome-error">
              当前浏览器不支持 File System Access API，请使用 Edge / Chrome，
              或改用 SuperBoard 桌面端。
            </p>
          ) : null}
          {error ? <p className="sb-welcome-error">{error}</p> : null}
        </div>

        <footer className="sb-welcome-footer">
          版本 0.1.0 · {desktop ? '桌面版' : '浏览器版'}
        </footer>
      </div>
    </div>
  )
}

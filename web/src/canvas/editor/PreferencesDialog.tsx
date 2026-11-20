import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { RefreshIcon } from './BlockActionIcons'
import { ColorPicker } from './ColorPicker'
import {
  DEFAULT_PREFERENCES,
  FONT_OPTIONS,
  getPreferences,
  savePreferences,
  type EditorPreferences,
  type TextAlign,
} from './preferences'
import { BackgroundFields, BorderFields } from './StyleFieldGroups'
import { StyleNumberControl } from './StyleNumberControl'
import { desktopMode, desktopWorkspacePath } from '../../desktop/platform'
import {
  canOpenWorkspace,
  openWorkspace,
  workspaceName,
} from './workspacePlatform'

interface PreferencesDialogProps {
  onClose: () => void
}

export function PreferencesDialog({ onClose }: PreferencesDialogProps) {
  const [draft, setDraft] = useState<EditorPreferences>(() =>
    structuredClone(getPreferences()),
  )
  const [confirmReset, setConfirmReset] = useState(false)
  const [tab, setTab] = useState<'about' | 'general' | 'block' | 'text' | 'help'>(
    'general',
  )
  const [switching, setSwitching] = useState(false)
  const [workspacePath, setWorkspacePath] = useState('')

  useEffect(() => {
    if (!desktopMode()) return
    let alive = true
    void desktopWorkspacePath().then((path) => {
      if (alive) setWorkspacePath(path)
    })
    return () => {
      alive = false
    }
  }, [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      if (confirmReset) setConfirmReset(false)
      else onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [confirmReset, onClose])

  useEffect(() => {
    savePreferences(draft)
  }, [draft])

  function updateBlock(patch: Partial<EditorPreferences['block']>) {
    setDraft((current) => ({
      ...current,
      block: { ...current.block, ...patch },
    }))
  }

  function updateText(patch: Partial<EditorPreferences['text']>) {
    setDraft((current) => ({
      ...current,
      text: { ...current.text, ...patch },
    }))
  }

  return createPortal(
    <>
    <div
      className="canvas-editor-dialog-backdrop"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="canvas-editor-dialog sb-preferences-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="偏好设置"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="sb-preferences-header">
          <div>
            <h2>偏好设置</h2>
            <p className="sb-preferences-note">
              偏好保存在本机，只影响之后新建的块。
            </p>
          </div>
          <button
            type="button"
            className="sb-preferences-reset"
            title="恢复默认"
            aria-label="恢复默认"
            onClick={() => setConfirmReset(true)}
          >
            <RefreshIcon size={16} />
          </button>
        </div>

        <div className="sb-preferences-tabs" role="tablist" aria-label="设置分类">
          <input
            className="sb-settings-search"
            type="search"
            placeholder="搜索设置…"
            aria-label="搜索设置"
          />
          <p className="sb-settings-group">选项</p>
          {(
            [
              ['about', '关于'],
              ['general', '常规'],
              ['block', '默认块'],
              ['text', '文本'],
              ['help', '帮助'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={tab === value}
              className={tab === value ? 'is-active' : undefined}
              onClick={() => setTab(value)}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="sb-settings-content">
        {tab === 'about' ? (
          <section>
            <h3>版本</h3>
            <p className="sb-preferences-note">
              SuperBoard 0.1.0 · {desktopMode() ? '桌面版' : '浏览器版'}
            </p>
            <p className="sb-preferences-note">
              {desktopMode()
                ? '桌面端更新由安装包负责，设置中不检查更新。'
                : '浏览器端不提供检查更新；更新桌面安装包时会单独提示。'}
            </p>
          </section>
        ) : null}

        {tab === 'help' ? (
          <section>
            <h3>专注模式</h3>
            <p className="sb-preferences-note">
              点击侧栏底部的专注模式按钮进入全屏；按 <kbd>Esc</kbd> 退出。
            </p>
            <p className="sb-preferences-note">
              专注模式会隐藏任务栏，退出后恢复到之前的窗口状态。
            </p>
            <h3>窗口操作</h3>
            <p className="sb-preferences-note">
              侧栏底部从上到下依次是：最小化、专注模式、退出。
            </p>
            <p className="sb-preferences-note">
              窗口没有标题栏，可拖动侧栏空白区域移动窗口，拖动窗口边缘缩放。
            </p>
          </section>
        ) : null}

        {tab === 'general' ? (
          <section>
            <h3>工作区</h3>
            <p className="sb-preferences-note">
              当前目录：{workspacePath || workspaceName() || '未选择'}
            </p>
            {canOpenWorkspace() ? (
              <button
                type="button"
                className="sb-button"
                disabled={switching}
                onClick={() => {
                  setSwitching(true)
                  void openWorkspace()
                    .then(() => window.location.reload())
                    .catch(() => setSwitching(false))
                }}
              >
                {switching ? '正在切换…' : '重新选择文件夹'}
              </button>
            ) : null}
            <p className="sb-preferences-note">偏好保存在本机。</p>
          </section>
        ) : null}

        {tab === 'block' ? (
          <>
            <BackgroundFields
          color={draft.block.backgroundColor}
          opacity={Math.round(draft.block.backgroundOpacity * 100)}
          allowNone={false}
          onColor={(backgroundColor) => updateBlock({ backgroundColor })}
          onOpacity={(value) => updateBlock({ backgroundOpacity: value / 100 })}
        />
        <BorderFields
          color={draft.block.borderColor}
          opacity={Math.round(draft.block.borderOpacity * 100)}
          width={draft.block.borderWidth}
          style={draft.block.borderStyle}
          onColor={(borderColor) => updateBlock({ borderColor })}
          onOpacity={(value) => updateBlock({ borderOpacity: value / 100 })}
          onWidth={(borderWidth) => updateBlock({ borderWidth })}
          onStyle={(borderStyle) =>
            updateBlock({
              borderStyle: borderStyle as EditorPreferences['block']['borderStyle'],
            })
          }
        />
          </>
        ) : null}

        {tab === 'text' ? (
        <section>
          <h3>文本默认样式</h3>
          <div className="sb-style-row">
            <span>字体</span>
            <select
              className="sb-style-select"
              value={draft.text.fontFamily}
              onChange={(event) =>
                updateText({ fontFamily: event.target.value })
              }
            >
              {FONT_OPTIONS.map((font) => (
                <option key={font.value} value={font.value}>
                  {font.label}
                </option>
              ))}
            </select>
          </div>
          <StyleNumberControl
            label="字号"
            value={draft.text.fontSize}
            min={8}
            max={200}
            step={1}
            unit="px"
            onChange={(fontSize) => updateText({ fontSize })}
          />
          <ColorPicker
            label="颜色"
            value={draft.text.color}
            onChange={(color) => updateText({ color })}
          />
          <StyleNumberControl
            label="透明度"
            value={Math.round(draft.text.opacity * 100)}
            min={0}
            max={100}
            step={1}
            unit="%"
            slider
            onChange={(value) => updateText({ opacity: value / 100 })}
          />
          <div className="sb-style-row">
            <span>对齐</span>
            <div className="sb-style-buttons">
              {(
                [
                  ['left', '左'],
                  ['center', '中'],
                  ['right', '右'],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  className={
                    draft.text.textAlign === value ? 'is-active' : undefined
                  }
                  onClick={() => updateText({ textAlign: value as TextAlign })}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </section>
        ) : null}

        {tab === 'block' ? (
        <section>
          <h3>形状默认样式</h3>
          <StyleNumberControl
            label="圆角"
            value={draft.shapeCornerRadius}
            min={0}
            max={200}
            step={1}
            unit="px"
            onChange={(shapeCornerRadius) =>
              setDraft((current) => ({ ...current, shapeCornerRadius }))
            }
          />
        </section>
        ) : null}
        </div>
      </div>
    </div>
    {confirmReset ? (
      <div
        className="canvas-editor-dialog-backdrop is-nested"
        role="presentation"
        onClick={() => setConfirmReset(false)}
      >
        <div
          className="canvas-editor-dialog sb-confirm-dialog"
          role="dialog"
          aria-modal="true"
          aria-label="恢复默认设置"
          onClick={(event) => event.stopPropagation()}
        >
          <h2>恢复默认设置？</h2>
          <p>所有默认样式将恢复为初始值，已有块不会改变。</p>
          <div className="canvas-editor-dialog-actions">
            <button type="button" onClick={() => setConfirmReset(false)}>
              取消
            </button>
            <button
              type="button"
              onClick={() => {
                setDraft(structuredClone(DEFAULT_PREFERENCES))
                setConfirmReset(false)
              }}
            >
              恢复默认
            </button>
          </div>
        </div>
      </div>
    ) : null}
    </>,
    document.body,
  )
}

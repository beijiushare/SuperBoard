import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { desktopMode } from '../../desktop/platform'
import { aiChat, aiClearAllKeys, aiClearKey, aiKeyStatus, aiSetKey } from '../../desktop/ai'
import {
  AI_PROVIDERS,
  aiProviderPreset,
  type AIPreferences,
} from './preferences'

interface SettingsAITabProps {
  draft: AIPreferences
  onChange: (patch: Partial<AIPreferences>) => void
}

export function SettingsAITab({ draft, onChange }: SettingsAITabProps) {
  const { t } = useTranslation(['settings', 'editor'])
  const desktop = desktopMode()
  const preset = aiProviderPreset(draft.provider)
  const [keyInput, setKeyInput] = useState('')
  const [status, setStatus] = useState<{ hasKey: boolean; masked?: string }>({
    hasKey: false,
  })
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [confirmClearAll, setConfirmClearAll] = useState(false)

  useEffect(() => {
    if (!desktop) return
    let alive = true
    void aiKeyStatus(draft.provider)
      .then((next) => {
        if (alive) setStatus(next)
      })
      .catch(() => undefined)
    return () => {
      alive = false
    }
  }, [desktop, draft.provider])

  const chooseProvider = (id: string) => {
    const next = aiProviderPreset(id)
    onChange({
      provider: next.id,
      baseURL: next.baseURL,
      model: next.model,
    })
    setMessage('')
  }

  const saveKey = async () => {
    if (!keyInput.trim()) return
    setBusy(true)
    setMessage('')
    try {
      await aiSetKey(draft.provider, keyInput.trim())
      setKeyInput('')
      setStatus(await aiKeyStatus(draft.provider))
      setMessage(t('settings:ai.keySaved'))
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error))
    } finally {
      setBusy(false)
    }
  }

  const clearKey = async () => {
    setBusy(true)
    setMessage('')
    try {
      await aiClearKey(draft.provider)
      setStatus(await aiKeyStatus(draft.provider))
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error))
    } finally {
      setBusy(false)
    }
  }

  const clearAll = async () => {
    setBusy(true)
    setMessage('')
    try {
      await aiClearAllKeys()
      setStatus(await aiKeyStatus(draft.provider))
      setConfirmClearAll(false)
      setMessage(t('settings:ai.clearedAll'))
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error))
    } finally {
      setBusy(false)
    }
  }

  const testConnection = async () => {
    setBusy(true)
    setMessage('')
    try {
      const reply = await aiChat(
        {
          provider: draft.provider,
          baseURL: draft.baseURL,
          model: draft.model,
          keyless: preset.keyless,
        },
        [{ role: 'user', content: 'Reply with the single word: ok' }],
      )
      setMessage(reply.slice(0, 120) || t('settings:ai.testOk'))
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      {!desktop ? (
        <section className="sb-settings-card">
          <header className="sb-settings-card-head">
            <div>
              <h3>{t('settings:ai.title')}</h3>
              <p>{t('settings:ai.browserNote')}</p>
            </div>
          </header>
        </section>
      ) : null}

      <section className="sb-settings-card">
        <header className="sb-settings-card-head">
          <div>
            <h3>{t('settings:ai.provider')}</h3>
            <p>{t('settings:ai.providerNote')}</p>
          </div>
        </header>
        <div className="sb-settings-rows">
          <div className="sb-settings-row">
            <span>{t('settings:ai.provider')}</span>
            <select
              value={draft.provider}
              disabled={!desktop}
              onChange={(event) => chooseProvider(event.target.value)}
            >
              {AI_PROVIDERS.map((item) => (
                <option key={item.id} value={item.id}>
                  {t(item.labelKey)}
                </option>
              ))}
            </select>
          </div>
          <div className="sb-settings-row">
            <span>{t('settings:ai.baseURL')}</span>
            <input
              value={draft.baseURL}
              disabled={!desktop}
              spellCheck={false}
              placeholder={preset.baseURL}
              onChange={(event) => onChange({ baseURL: event.target.value })}
            />
          </div>
          <div className="sb-settings-row">
            <span>{t('settings:ai.model')}</span>
            <input
              value={draft.model}
              disabled={!desktop}
              spellCheck={false}
              placeholder={preset.model}
              onChange={(event) => onChange({ model: event.target.value })}
            />
          </div>
        </div>
      </section>

      <section className="sb-settings-card">
        <header className="sb-settings-card-head">
          <div>
            <h3>{t('settings:ai.key')}</h3>
            <p>
              {preset.keyless
                ? t('settings:ai.keylessNote')
                : t('settings:ai.keyNote')}
            </p>
          </div>
        </header>
        <div className="sb-settings-rows">
          {!preset.keyless ? (
            <>
              <div className="sb-settings-row">
                <span>{t('settings:ai.keyStatus')}</span>
                <span>
                  {status.hasKey
                    ? status.masked ?? t('settings:ai.keyPresent')
                    : t('settings:ai.keyMissing')}
                </span>
              </div>
              <div className="sb-settings-row">
                <span>{t('settings:ai.keyInput')}</span>
                <input
                  type="password"
                  value={keyInput}
                  disabled={!desktop || busy}
                  spellCheck={false}
                  autoComplete="off"
                  onChange={(event) => setKeyInput(event.target.value)}
                  placeholder="sk-..."
                />
              </div>
              <div className="canvas-editor-dialog-actions">
                <button
                  type="button"
                  disabled={!desktop || busy || !keyInput.trim()}
                  onClick={() => void saveKey()}
                >
                  {t('settings:ai.saveKey')}
                </button>
                <button
                  type="button"
                  disabled={!desktop || busy || !status.hasKey}
                  onClick={() => void clearKey()}
                >
                  {t('settings:ai.clearKey')}
                </button>
              </div>
            </>
          ) : null}
          <div className="canvas-editor-dialog-actions">
            <button
              type="button"
              disabled={!desktop || busy}
              onClick={() => void testConnection()}
            >
              {busy ? t('settings:ai.testing') : t('settings:ai.test')}
            </button>
          </div>
          {message ? <p className="sb-settings-note">{message}</p> : null}
        </div>
      </section>

      {desktop ? (
        <section className="sb-settings-card">
          <header className="sb-settings-card-head">
            <div>
              <h3>{t('settings:ai.clearAllTitle')}</h3>
              <p>{t('settings:ai.clearAllNote')}</p>
            </div>
          </header>
          <div className="sb-settings-rows">
            {confirmClearAll ? (
              <div className="canvas-editor-dialog-actions">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setConfirmClearAll(false)}
                >
                  {t('settings:ai.clearAllCancel')}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void clearAll()}
                >
                  {t('settings:ai.clearAllConfirm')}
                </button>
              </div>
            ) : (
              <div className="canvas-editor-dialog-actions">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setConfirmClearAll(true)}
                >
                  {t('settings:ai.clearAll')}
                </button>
              </div>
            )}
          </div>
        </section>
      ) : null}
    </>
  )
}

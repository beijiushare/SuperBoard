import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { desktopMode } from '../../desktop/platform'
import { aiChat, aiClearAllKeys, aiClearKey, aiKeyStatus, aiSetKey } from '../../desktop/ai'
import {
  AI_SLOTS,
  AI_SLOT_DEFAULTS,
  aiSlotDefinition,
  type AIPreferences,
  type AISlotId,
} from './preferences'

interface SettingsAITabProps {
  draft: AIPreferences
  onChange: (patch: Partial<AIPreferences>) => void
  onSlotChange: (id: AISlotId, patch: { baseURL?: string; model?: string }) => void
}

export function SettingsAITab({
  draft,
  onChange,
  onSlotChange,
}: SettingsAITabProps) {
  const { t } = useTranslation(['settings', 'editor'])
  const desktop = desktopMode()
  const slot = aiSlotDefinition(draft.active)
  const values = draft.slots[slot.id] ?? AI_SLOT_DEFAULTS[slot.id]
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
    setMessage('')
    void aiKeyStatus(slot.id)
      .then((next) => {
        if (alive) setStatus(next)
      })
      .catch(() => undefined)
    return () => {
      alive = false
    }
  }, [desktop, slot.id])

  const saveKey = async () => {
    if (!keyInput.trim()) return
    setBusy(true)
    setMessage('')
    try {
      await aiSetKey(slot.id, keyInput.trim())
      setKeyInput('')
      setStatus(await aiKeyStatus(slot.id))
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
      await aiClearKey(slot.id)
      setStatus(await aiKeyStatus(slot.id))
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
      setStatus(await aiKeyStatus(slot.id))
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
          keyName: slot.id,
          baseURL: values.baseURL,
          model: values.model,
          keyless: slot.keyless,
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
            <h3>{t('settings:ai.endpoint')}</h3>
            <p>{t('settings:ai.endpointNote')}</p>
          </div>
        </header>
        <div className="sb-settings-rows">
          <div className="sb-settings-row">
            <span>{t('settings:ai.active')}</span>
            <select
              value={draft.active}
              disabled={!desktop}
              onChange={(event) =>
                onChange({ active: event.target.value as AISlotId })
              }
            >
              {AI_SLOTS.map((item) => (
                <option key={item.id} value={item.id}>
                  {t(item.labelKey)}
                  {item.keyless ? ` · ${t('settings:ai.noKey')}` : ''}
                </option>
              ))}
            </select>
          </div>
          <div className="sb-settings-row">
            <span>{t('settings:ai.baseURL')}</span>
            <input
              value={values.baseURL}
              disabled={!desktop}
              spellCheck={false}
              placeholder={AI_SLOT_DEFAULTS[slot.id].baseURL}
              onChange={(event) =>
                onSlotChange(slot.id, { baseURL: event.target.value })
              }
            />
          </div>
          <div className="sb-settings-row">
            <span>{t('settings:ai.model')}</span>
            <input
              value={values.model}
              disabled={!desktop}
              spellCheck={false}
              placeholder={AI_SLOT_DEFAULTS[slot.id].model}
              onChange={(event) =>
                onSlotChange(slot.id, { model: event.target.value })
              }
            />
          </div>
          {slot.id === 'local' ? (
            <p className="sb-settings-note">{t('settings:ai.localNote')}</p>
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

      <section className="sb-settings-card">
        <header className="sb-settings-card-head">
          <div>
            <h3>{t('settings:ai.key')}</h3>
            <p>
              {slot.keyless
                ? t('settings:ai.keylessNote')
                : t('settings:ai.keyNote')}
            </p>
          </div>
        </header>
        <div className="sb-settings-rows">
          {!slot.keyless ? (
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
          ) : (
            <p className="sb-settings-note">{t('settings:ai.keylessBody')}</p>
          )}
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

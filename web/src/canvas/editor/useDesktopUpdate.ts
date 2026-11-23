import { useEffect, useState } from 'react'
import {
  desktopCheckUpdate,
  desktopInstallUpdate,
  desktopOpenUpdatePage,
  desktopRestartUpdate,
  desktopUpdateEnvironment,
  desktopUpdateVersion,
  type UpdateStatus,
} from '../../desktop/platform'

export type UpdatePhase = 'idle' | 'checking' | 'installing' | 'restarting'

/** Desktop update state for the settings dialog. */
export function useDesktopUpdate() {
  const [writable, setWritable] = useState<boolean | null>(null)
  const [phase, setPhase] = useState<UpdatePhase>('idle')
  const [checked, setChecked] = useState(false)
  const [info, setInfo] = useState<UpdateStatus | null>(null)
  const [error, setError] = useState('')
  const [version, setVersion] = useState('')

  useEffect(() => {
    let alive = true
    void desktopUpdateEnvironment()
      .then((env) => {
        if (alive) setWritable(env.writable)
      })
      .catch(() => {
        if (alive) setWritable(null)
      })
    void desktopUpdateVersion()
      .then((value) => {
        if (alive) setVersion(value)
      })
      .catch(() => undefined)
    return () => {
      alive = false
    }
  }, [])

  function message(reason: unknown) {
    return reason instanceof Error ? reason.message : String(reason)
  }

  function check() {
    setPhase('checking')
    setError('')
    void desktopCheckUpdate()
      .then((status) => {
        setChecked(true)
        setInfo(status.update ? status : null)
      })
      .catch((reason: unknown) => {
        setChecked(true)
        setInfo(null)
        setError(message(reason))
      })
      .finally(() => setPhase('idle'))
  }

  function install() {
    setPhase('installing')
    setError('')
    void desktopInstallUpdate()
      .then(() => {
        setPhase('restarting')
        return desktopRestartUpdate()
      })
      .catch((reason: unknown) => {
        setPhase('idle')
        setError(message(reason))
      })
  }

  function openPage() {
    void desktopOpenUpdatePage().catch((reason: unknown) => {
      setError(message(reason))
    })
  }

  return { writable, phase, checked, info, error, version, check, install, openPage }
}

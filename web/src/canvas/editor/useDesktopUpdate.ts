import { useEffect, useState } from 'react'
import {
  desktopCheckUpdate,
  desktopOpenUpdatePage,
  desktopRevealAppFolder,
  desktopUpdateVersion,
  type UpdateStatus,
} from '../../desktop/update'

export type UpdatePhase = 'idle' | 'checking'

/** Desktop update state for the settings dialog. */
export function useDesktopUpdate() {
  const [phase, setPhase] = useState<UpdatePhase>('idle')
  const [checked, setChecked] = useState(false)
  const [info, setInfo] = useState<UpdateStatus | null>(null)
  const [error, setError] = useState('')
  const [version, setVersion] = useState('')

  useEffect(() => {
    let alive = true
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

  function openPage() {
    void desktopOpenUpdatePage().catch((reason: unknown) => {
      setError(message(reason))
    })
  }

  function reveal() {
    void desktopRevealAppFolder().catch((reason: unknown) => {
      setError(message(reason))
    })
  }

  return { phase, checked, info, error, version, check, openPage, reveal }
}

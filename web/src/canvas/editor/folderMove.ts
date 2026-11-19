export interface FolderMoveProgress {
  copied: number
  total: number
  phase?: 'start' | 'progress' | 'end'
}

const PROGRESS_EVENT = 'superboard:folder-move-progress'

let cancelled = false
let moving = false

export function beginFolderMove() {
  cancelled = false
  moving = true
}

export function finishFolderMove() {
  moving = false
}

export function isFolderMoveActive() {
  return moving
}

export function requestCancelFolderMove() {
  cancelled = true
}

export function isFolderMoveCancelled() {
  return cancelled
}

export function reportFolderMoveProgress(progress: FolderMoveProgress) {
  if (typeof window === 'undefined') return
  if (progress.phase === 'start') moving = true
  if (progress.phase === 'end') moving = false
  window.dispatchEvent(
    new CustomEvent<FolderMoveProgress>(PROGRESS_EVENT, { detail: progress }),
  )
}

export function subscribeFolderMoveProgress(
  listener: (progress: FolderMoveProgress) => void,
) {
  if (typeof window === 'undefined') return () => {}
  const handler = (event: Event) => {
    listener((event as CustomEvent<FolderMoveProgress>).detail)
  }
  window.addEventListener(PROGRESS_EVENT, handler)
  return () => window.removeEventListener(PROGRESS_EVENT, handler)
}

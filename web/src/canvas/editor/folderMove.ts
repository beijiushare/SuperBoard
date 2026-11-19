export interface FolderMoveProgress {
  copied: number
  total: number
}

const PROGRESS_EVENT = 'superboard:folder-move-progress'

let cancelled = false

export function beginFolderMove() {
  cancelled = false
}

export function requestCancelFolderMove() {
  cancelled = true
}

export function isFolderMoveCancelled() {
  return cancelled
}

export function reportFolderMoveProgress(progress: FolderMoveProgress) {
  if (typeof window === 'undefined') return
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

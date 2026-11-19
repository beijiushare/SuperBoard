import { useEffect, useState } from 'react'
import {
  requestCancelFolderMove,
  subscribeFolderMoveProgress,
  type FolderMoveProgress,
} from './folderMove'

export function FolderMoveOverlay() {
  const [progress, setProgress] = useState<FolderMoveProgress | null>(null)

  useEffect(() => {
    const unsubscribe = subscribeFolderMoveProgress((next) => {
      if (next.phase === 'end') {
        setProgress(null)
        return
      }
      setProgress(next)
    })
    return unsubscribe
  }, [])

  useEffect(() => {
    if (!progress) return
    document.body.classList.add('is-folder-moving')
    ;(document.activeElement as HTMLElement | null)?.blur()
    return () => document.body.classList.remove('is-folder-moving')
  }, [progress])

  if (!progress) return null
  const copying = progress.total > 0

  return (
    <div className="sb-folder-moving" role="alertdialog" aria-busy="true">
      <div className="sb-folder-moving-card">
        <strong>正在移动中</strong>
        <span>
          {copying
            ? `已复制 ${progress.copied} / ${progress.total} 个文件`
            : '请稍候，移动完成前不要关闭页面'}
        </span>
        {copying ? (
          <button type="button" onClick={requestCancelFolderMove}>
            取消移动
          </button>
        ) : null}
      </div>
    </div>
  )
}

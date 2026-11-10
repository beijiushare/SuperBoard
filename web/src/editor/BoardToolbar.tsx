import type { BoardFile, BoardListItem } from '../shared/board/types'
import { SAVE_STATUS_LABEL, type SaveState } from './useAutoSave'

interface BoardToolbarProps {
  board: BoardFile | null
  boards: BoardListItem[]
  treeMode: boolean
  treeOpen: boolean
  saveState: SaveState
  saveError: string
  onToggleTree: () => void
  onSwitchBoard: (slug: string) => void
  onAddMarkdown: () => void
  onAddPele: () => void
  onSaveNow: () => void
}

export function BoardToolbar({
  board,
  boards,
  treeMode,
  treeOpen,
  saveState,
  saveError,
  onToggleTree,
  onSwitchBoard,
  onAddMarkdown,
  onAddPele,
  onSaveNow,
}: BoardToolbarProps) {
  return (
    <header className="sb-toolbar">
      <div className="sb-brand">
        <span className="sb-brand-mark">SB</span>
        <span>SuperBoard</span>
      </div>

      <div className="sb-toolbar-divider" />

      <button
        className="sb-button sb-button-ghost sb-tree-toggle"
        type="button"
        onClick={onToggleTree}
        aria-expanded={treeMode && treeOpen}
        title={treeMode ? (treeOpen ? '收起目录' : '展开目录') : '打开目录视图'}
      >
        {treeMode && treeOpen ? '收起目录' : '目录'}
      </button>

      <div className="sb-toolbar-divider" />

      {treeMode ? (
        <span className="sb-current-board" title={board ? `${board.meta.title} (${board.meta.slug})` : undefined}>
          {board?.meta.title ?? '未选择白板'}
        </span>
      ) : (
        <label className="sb-board-select">
          <span>白板</span>
          <select value={board?.meta.slug ?? ''} onChange={(event) => onSwitchBoard(event.target.value)}>
            {boards.map((item) => (
              <option key={item.slug} value={item.slug}>
                {item.title}
              </option>
            ))}
          </select>
        </label>
      )}

      <div className="sb-toolbar-divider" />

      <div className="sb-add-group">
        <button className="sb-button" type="button" onClick={onAddMarkdown} disabled={!board}>
          + Markdown
        </button>
        <button className="sb-button" type="button" onClick={onAddPele} disabled={!board}>
          + 图表
        </button>
      </div>

      <div className="sb-toolbar-spacer" />

      <button
        className={`sb-save-status sb-save-${saveState}`}
        type="button"
        onClick={onSaveNow}
        title={saveError || '点击立即保存'}
        disabled={!board}
      >
        <span className="sb-save-dot" />
        {SAVE_STATUS_LABEL[saveState]}
      </button>
    </header>
  )
}

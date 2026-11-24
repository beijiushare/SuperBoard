import type {
  MouseEvent as ReactMouseEvent,
  RefObject,
} from 'react'
import type { BoardScope } from '../../shared/board/types'
import { Trans, useTranslation } from 'react-i18next'
import type {
  CanvasDocument,
  CanvasFrame,
  CanvasNode,
  SuperBoardScheduleEvent,
} from '../model'
import { CanvasViewer, type CanvasViewerHandle } from '../viewer/CanvasViewer'
import { CanvasEditorOverlay } from './CanvasEditorOverlay'
import { CanvasEditorTools } from './CanvasEditorTools'
import { CanvasStylePanel } from './CanvasStylePanel'
import { CanvasToolPalette } from './CanvasToolPalette'
import { CanvasMarkdownLayer } from './CanvasMarkdownLayer'
import { CanvasDirectorLayer } from './CanvasDirectorLayer'
import type { EditorTool } from './tools'

interface StageSelection {
  selectedIds: string[]
  onSelect: (ids: string[]) => void
  selectedEdgeId: string | null
  onSelectEdge: (id: string | null) => void
  focusedGroupId: string | null
  interactive: boolean
  activeEditingId: string | null
  guidesEnabled: boolean
  onBeforeChange: () => void
  onChange: () => void
  onToggleBlockEdit: (id: string) => void
  onFocusBlockEdit: (id: string) => void
  onDeleteBlock: (id: string) => void
  onResetBlockSize: (id: string) => void
  onToggleRatioLock: (id: string) => void
}

interface StageTools {
  tool: EditorTool
  onChangeTool: (tool: EditorTool) => void
  onApply: (next: CanvasDocument, selection?: string[]) => void
  onExitTool: () => void
  editRequest: { id: string; nonce: number } | null
  onEditRequestHandled: () => void
  createRequest: { x: number; y: number; nonce: number } | null
  onCreateRequestHandled: () => void
  onEditMarkdown: (id: string) => void
  onEditingChange: (id: string | null) => void
  onRequestEdit: (id: string) => void
}

interface StageMarkdown {
  editingId: string | null
  focusId: string | null
  focusNode: CanvasNode | null
  onInput: (id: string, value: string) => void
  onCommit: (id: string, value: string) => void
  onRequestClose: () => void
  onCloseFocus: () => void
}

interface StageDirector {
  mode: boolean
  presentation: boolean
  selectedFrameId: string | null
  onSelectFrame: (id: string | null) => void
  frames: CanvasFrame[]
  onChangeFrames: (frames: CanvasFrame[]) => void
  onPlayFrame: (frame: CanvasFrame) => void
  controllerOpen: boolean
  onOpenController: () => void
  onCloseController: () => void
}

interface StagePalette {
  open: boolean
  onInsertMarkdown: () => void
  onInsertPele: () => void
  onInsertSchedule: () => void
  onInsertMedia: () => void
  onInsertTree: () => void
}

interface CanvasEditorStageProps {
  canvas: CanvasDocument | null
  scope: BoardScope
  stageRef: RefObject<HTMLDivElement | null>
  viewerRef: RefObject<CanvasViewerHandle | null>
  onContextMenu: (event: ReactMouseEvent<HTMLDivElement>) => void
  onDoubleClick: (event: ReactMouseEvent<HTMLDivElement>) => void
  onNodeSelect: (id: string) => void
  onScheduleEventsChange: (
    id: string,
    events: SuperBoardScheduleEvent[],
  ) => void
  onTreeSize?: (id: string, size: { width: number; height: number }) => void
  selection: StageSelection
  tools: StageTools
  markdown: StageMarkdown
  stylePanelOpen: boolean
  onRememberColor: (color: string) => void
  director: StageDirector
  palette: StagePalette
}

export function CanvasEditorStage({
  canvas,
  scope,
  stageRef,
  viewerRef,
  onContextMenu,
  onDoubleClick,
  onNodeSelect,
  onScheduleEventsChange,
  onTreeSize,
  selection,
  tools,
  markdown,
  stylePanelOpen,
  onRememberColor,
  director,
  palette,
}: CanvasEditorStageProps) {
  const { t } = useTranslation(['editor'])
  return (
    <main className="sb-canvas">
      <div className="canvas-editor">
        <div
          ref={stageRef}
          className="canvas-editor-stage"
          onContextMenu={onContextMenu}
          onDoubleClick={onDoubleClick}
        >
          {canvas ? (
            <>
              <div className="canvas-viewer-wrap">
                <CanvasViewer
                  ref={viewerRef}
                  canvas={canvas}
                  onNodeSelect={onNodeSelect}
                  onScheduleEventsChange={onScheduleEventsChange}
                  onTreeSize={onTreeSize}
                  style={{ width: '100%', height: '100%' }}
                />
              </div>
              <CanvasEditorOverlay
                canvas={canvas}
                viewerRef={viewerRef}
                selectedIds={selection.selectedIds}
                onSelect={selection.onSelect}
                onChange={selection.onChange}
                onBeforeChange={selection.onBeforeChange}
                interactive={selection.interactive}
                selectedEdgeId={selection.selectedEdgeId}
                onSelectEdge={selection.onSelectEdge}
                focusedGroupId={selection.focusedGroupId}
                activeEditingId={selection.activeEditingId}
                guidesEnabled={selection.guidesEnabled}
                onToggleBlockEdit={selection.onToggleBlockEdit}
                onFocusBlockEdit={selection.onFocusBlockEdit}
                onDeleteBlock={selection.onDeleteBlock}
                onResetBlockSize={selection.onResetBlockSize}
                onToggleRatioLock={selection.onToggleRatioLock}
              />
              <CanvasEditorTools
                canvas={canvas}
                tool={tools.tool}
                viewerRef={viewerRef}
                onBeforeChange={selection.onBeforeChange}
                onChange={selection.onChange}
                onApply={tools.onApply}
                onExitTool={tools.onExitTool}
                editRequest={tools.editRequest}
                onEditRequestHandled={tools.onEditRequestHandled}
                createRequest={tools.createRequest}
                onCreateRequestHandled={tools.onCreateRequestHandled}
                onEditMarkdown={tools.onEditMarkdown}
                onEditingChange={tools.onEditingChange}
                onRequestEdit={tools.onRequestEdit}
              />
              <CanvasMarkdownLayer
                canvas={canvas}
                viewerRef={viewerRef}
                editingId={markdown.editingId}
                focusId={markdown.focusId}
                focusNode={markdown.focusNode}
                onInput={markdown.onInput}
                onCommit={markdown.onCommit}
                onRequestClose={markdown.onRequestClose}
                onCloseFocus={markdown.onCloseFocus}
              />
              {stylePanelOpen ? (
                <CanvasStylePanel
                  canvas={canvas}
                  selectedIds={selection.selectedIds}
                  selectedEdgeId={selection.selectedEdgeId}
                  onBeforeChange={selection.onBeforeChange}
                  onApply={tools.onApply}
                  onRememberColor={onRememberColor}
                />
              ) : null}
              <CanvasDirectorLayer
                canvas={canvas}
                viewerRef={viewerRef}
                directorMode={director.mode}
                presentation={director.presentation}
                selectedFrameId={director.selectedFrameId}
                onSelectFrame={director.onSelectFrame}
                onBeforeChange={selection.onBeforeChange}
                frames={director.frames}
                onChangeFrames={director.onChangeFrames}
                onPlayFrame={director.onPlayFrame}
                frameControllerOpen={director.controllerOpen}
                onOpenController={director.onOpenController}
                onCloseController={director.onCloseController}
              />
              {palette.open ? (
                <CanvasToolPalette
                  tool={tools.tool}
                  onToolChange={tools.onChangeTool}
                  onInsertMarkdown={palette.onInsertMarkdown}
                  onInsertPele={palette.onInsertPele}
                  onInsertSchedule={palette.onInsertSchedule}
                  onInsertMedia={palette.onInsertMedia}
                  onInsertTree={palette.onInsertTree}
                />
              ) : null}
            </>
          ) : (
            <div className="sb-canvas-empty">
              <div>
                <h2>{t('editor:empty.title')}</h2>
                <p>
                  <Trans
                    i18nKey="editor:empty.body"
                    values={{ scope }}
                    components={{ code: <code /> }}
                  />
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}

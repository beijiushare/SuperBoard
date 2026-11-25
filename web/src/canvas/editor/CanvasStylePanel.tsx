import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  nodeSupportsBackground as supportsBackground,
  nodeSupportsSurface as supportsSurface,
  resolveNodeStyle,
  type CanvasDocument,
  type CanvasEdge,
  type CanvasNode,
} from '../model'
import { isRoundedRect } from './blocks'
import { collectDescendants } from './hierarchy'
import { DEFAULT_PREFERENCES } from './preferences'
import { ColorPicker } from './ColorPicker'
import { DrawingStyleSection } from './DrawingStyleSection'
import { Select } from '../../components/ui/select'
import { Switch } from '../../components/ui/switch'
import {
  BackgroundFields,
  BorderFields,
  CanvasFields,
  TextFields,
  TransformFields,
} from './StyleFieldGroups'
import { StyleNumberControl } from './StyleNumberControl'
import { updateUiState, useUiState } from './uiState'
import { useFloatingPanel } from './useFloatingPanel'
import { WindowDragHandle } from './WindowDragHandle'
import { useStylePanelActions } from './useStylePanelActions'

interface CanvasStylePanelProps {
  canvas: CanvasDocument
  selectedIds: string[]
  selectedEdgeId?: string | null
  onBeforeChange: (mergeKey?: string) => void
  onApply: (next: CanvasDocument, selection?: string[]) => void
  onRememberColor?: (color: string) => void
}

function kindOf(node: CanvasNode) {
  return node['x-superboard']?.kind
}

/** Blocks whose content can be inset from the surface. */
const CONTENT_PADDING_KINDS = new Set(['markdown', 'pele', 'schedule', 'media'])

function CropSlider({
  label,
  value,
  min = 0,
  max = 100,
  onCommit,
}: {
  label: string
  value: number
  min?: number
  max?: number
  onCommit: (value: number) => void
}) {
  const [local, setLocal] = useState(value)
  useEffect(() => setLocal(value), [value])
  return (
    <div className="sb-style-row">
      <span>{label}</span>
      <input
        className="sb-style-range"
        type="range"
        min={min}
        max={max}
        value={local}
        onChange={(event) => setLocal(Number(event.target.value))}
        onPointerUp={(event) => onCommit(Number(event.currentTarget.value))}
        onKeyUp={(event) => onCommit(Number(event.currentTarget.value))}
      />
      <em className="sb-style-value">{local}</em>
    </div>
  )
}

export function CanvasStylePanel({
  canvas,
  selectedIds,
  selectedEdgeId = null,
  onBeforeChange,
  onApply,
  onRememberColor,
}: CanvasStylePanelProps) {
  const { t } = useTranslation(['editor'])
  const { rootRef, position, handleProps } = useFloatingPanel({
    alignRight: true,
    centerVertically: true,
  })
  const preferences = DEFAULT_PREFERENCES
  const uiState = useUiState()
  const selected = new Set(selectedIds)
  const nodes = canvas.nodes.filter((node) => selected.has(node.id))
  const [panelTab, setPanelTab] = useState<'element' | 'group'>('element')
  const groups = nodes.filter((node) => kindOf(node) === 'group')
  const elementNodes = (() => {
    const explicit = nodes.filter((node) => kindOf(node) !== 'group')
    const fromGroups = groups
      .flatMap((group) => collectDescendants(group, canvas.nodes))
      .filter((node) => kindOf(node) !== 'group')
    return [...new Map([...explicit, ...fromGroups].map((node) => [node.id, node])).values()]
  })()
  const activeTab = groups.length
    ? elementNodes.length
      ? panelTab
      : 'group'
    : 'element'
  const targetNodes = activeTab === 'group' ? groups : elementNodes
  const edge = selectedEdgeId
    ? canvas.edges.find((item) => item.id === selectedEdgeId)
    : undefined
  const boardSettings = canvas['x-superboard']?.settings ?? {}
  const hasSelection = nodes.length > 0 || Boolean(edge)

  const texts = targetNodes.filter(
    (node) => node.type === 'text' && (!kindOf(node) || kindOf(node) === 'text'),
  )
  const mediaNodes = targetNodes.filter(
    (node) => node['x-superboard']?.kind === 'media' && node['x-superboard']?.media,
  )
  const peleNodes = targetNodes.filter(
    (node) => node['x-superboard']?.kind === 'pele',
  )
  const paddingNodes = targetNodes.filter((node) => {
    const kind = kindOf(node)
    return kind ? CONTENT_PADDING_KINDS.has(kind) : false
  })
  const {
    updateBoardSettings,
    updateGeometry,
    updateCommonStyle,
    updateGroupPadding,
    updateContentPadding,
    applyPeleNarrow,
    updateDrawing,
    styleText,
    updateEdge,
    setMediaCrop,
    align,
    distribute,
  } = useStylePanelActions({
    canvas,
    selectedIds,
    targetNodes,
    paddingNodes,
    peleNodes,
    mediaNodes,
    edge,
    onBeforeChange,
    onApply,
  })


  const firstNode = targetNodes[0]
  const firstKind = firstNode?.['x-superboard']?.kind
  const firstIsDrawing = firstKind === 'drawing'
  const firstResolved = resolveNodeStyle(firstNode?.['x-superboard']?.style)
  const showBackground = targetNodes.some(supportsBackground)
  const showBorder = targetNodes.some(supportsSurface)
  const firstIsRoundedRect = firstNode ? isRoundedRect(firstNode) : false
  const firstCornerRadius =
    firstResolved.cornerRadius ?? preferences.shapeCornerRadius
  const maxCornerRadius = firstNode
    ? Math.max(1, Math.floor(Math.min(firstNode.width, firstNode.height) / 2))
    : 100
  const hasExplicitBorder = firstResolved.borderColor !== undefined
  const hasExplicitBackground = firstResolved.background !== undefined
  const firstStyle = firstNode?.['x-superboard']?.style
  const hasBorderOpacity = firstStyle?.borderOpacity !== undefined
  const hasBackgroundOpacity = firstStyle?.backgroundOpacity !== undefined
  const firstBorderColor =
    firstResolved.borderColor ?? preferences.block.borderColor
  const firstBorderWidth =
    firstResolved.borderWidth ?? preferences.block.borderWidth
  const firstBorderOpacity = Math.round(
    (hasExplicitBorder || hasBorderOpacity
      ? firstResolved.borderOpacity
      : preferences.block.borderOpacity) * 100,
  )
  const firstBorderStyle = hasExplicitBorder
    ? firstResolved.borderStyle
    : preferences.block.borderStyle
  const firstBackgroundColor =
    firstResolved.background ?? preferences.block.backgroundColor
  const firstBackgroundOpacity = Math.round(
    (hasExplicitBackground || hasBackgroundOpacity
      ? firstResolved.backgroundOpacity
      : preferences.block.backgroundOpacity) * 100,
  )
  const firstText = texts[0]
  const firstMedia = mediaNodes[0]?.['x-superboard']?.media
  const firstStroke = firstNode?.['x-superboard']?.strokes?.[0]
  const drawingSize = firstStroke?.size ?? firstResolved.borderWidth ?? 4
  const drawingColor = firstStroke?.color ?? firstResolved.borderColor ?? '#1d1d1d'
  const drawingOpacity = Math.round(firstResolved.opacity * 100)
  const drawingThinning = firstStroke?.thinning ?? 0.5
  const drawingSmoothing = firstStroke?.smoothing ?? 0.5
  const drawingStreamline = firstStroke?.streamline ?? 0.5
  const drawingSimulatePressure = firstStroke?.simulatePressure ?? true
  const drawingStart = firstStroke?.start ?? 0
  const drawingEnd = firstStroke?.end ?? 0

  return (
    <div
      ref={rootRef}
      className="sb-style-panel"
      style={{ left: position.x, top: position.y }}
    >
      <div className="sb-style-panel-header">
        <div
          className="sb-style-panel-drag"
          role="button"
          tabIndex={-1}
          aria-label={t('editor:style.panelAria')}
          {...handleProps}
        >
          <WindowDragHandle />
        </div>
        <strong>{t('editor:style.panelTitle')}</strong>
      </div>
      <div className="sb-style-panel-content">
      <div className="sb-style-panel-body">
      {groups.length > 0 ? (
        <div className="sb-style-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'element'}
            className={activeTab === 'element' ? 'is-active' : undefined}
            onClick={() => setPanelTab('element')}
          >
            {t('editor:style.tabElements')}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'group'}
            className={activeTab === 'group' ? 'is-active' : undefined}
            onClick={() => setPanelTab('group')}
          >
            {t('editor:style.tabGroup')}
          </button>
        </div>
      ) : null}
      <div className="sb-style-panel-sections">
      {firstNode ? (
        firstIsDrawing ? (
          <DrawingStyleSection
            size={drawingSize}
            color={drawingColor}
            opacity={drawingOpacity}
            thinning={drawingThinning}
            smoothing={drawingSmoothing}
            streamline={drawingStreamline}
            simulatePressure={drawingSimulatePressure}
            start={drawingStart}
            end={drawingEnd}
            recentColors={uiState.recentColors}
            onChange={updateDrawing}
            onColorUsed={onRememberColor}
          />
        ) : (
        <>
          {activeTab === 'group' ? null : (
            <TransformFields
              rotation={firstNode['x-superboard']?.rotation ?? 0}
              width={firstNode.width}
              height={firstNode.height}
              onRotation={(rotation) => updateGeometry({ rotation })}
              onWidth={(width) => updateGeometry({ width })}
              onHeight={(height) => updateGeometry({ height })}
            />
          )}
          {activeTab === 'group' ? (
            <section>
              <StyleNumberControl
                label={t('editor:style.groupPadding')}
                value={firstStyle?.padding ?? 0}
                min={0}
                max={200}
                step={1}
                unit="px"
                onChange={updateGroupPadding}
              />
            </section>
          ) : null}
          {activeTab === 'group' ? null : paddingNodes.length > 0 ? (
            <section>
              <StyleNumberControl
                label={t('editor:style.contentPadding')}
                value={paddingNodes[0]?.['x-superboard']?.style?.padding ?? 0}
                min={0}
                max={96}
                step={1}
                unit="px"
                onChange={updateContentPadding}
              />
            </section>
          ) : null}
          {activeTab === 'group' ? null : peleNodes.length > 0 ? (
            <section>
              <h3>{t('editor:style.diagram')}</h3>
              <div className="sb-style-row">
                <span>{t('editor:style.peleNarrow')}</span>
                <Switch
                  checked={peleNodes[0]?.['x-superboard']?.narrow === true}
                  onChange={applyPeleNarrow}
                  ariaLabel={t('editor:style.peleNarrow')}
                  title={t('editor:style.peleNarrowHint')}
                />
              </div>
            </section>
          ) : null}
          {showBackground ? (
            <BackgroundFields
              color={firstBackgroundColor}
              opacity={firstBackgroundOpacity}
              recentColors={uiState.recentColors}
              onColor={(backgroundColor) =>
                updateCommonStyle({ backgroundColor })
              }
              onOpacity={(value) =>
                updateCommonStyle({ backgroundOpacity: value / 100 })
              }
              onColorUsed={onRememberColor}
            />
          ) : null}
          {showBorder ? (
            <BorderFields
              color={firstBorderColor}
              opacity={firstBorderOpacity}
              width={firstBorderWidth}
              style={firstBorderStyle}
              showStyle={!firstIsDrawing}
              recentColors={uiState.recentColors}
              onColor={(borderColor) => updateCommonStyle({ borderColor })}
              onOpacity={(value) =>
                updateCommonStyle({ borderOpacity: value / 100 })
              }
              onWidth={(borderWidth) => updateCommonStyle({ borderWidth })}
              onStyle={(borderStyle) => updateCommonStyle({ borderStyle })}
              onColorUsed={onRememberColor}
            />
          ) : null}
          {firstIsRoundedRect ? (
            <section>
              <h3>{t('editor:style.cornerRadius')}</h3>
              <StyleNumberControl
                label={t('editor:style.cornerRadius')}
                value={firstCornerRadius}
                min={0}
                max={maxCornerRadius}
                step={1}
                unit="px"
                slider
                onChange={(cornerRadius) => updateCommonStyle({ cornerRadius })}
              />
            </section>
          ) : null}
        </>
        )
      ) : null}
      {!hasSelection ? (
        <>
          <CanvasFields
            background={boardSettings.background ?? '#ffffff'}
            backgroundOpacity={Math.round(
              (boardSettings.backgroundOpacity ?? 1) * 100,
            )}
            grid={boardSettings.grid ?? 'lines'}
            guides={uiState.guides}
            recentColors={uiState.recentColors}
            onUpdate={updateBoardSettings}
            onToggleGuides={() =>
              updateUiState({ guides: !uiState.guides })
            }
            onColorUsed={onRememberColor}
          />
          <section>
            <h3>{t('editor:style.zoom')}</h3>
            <div className="sb-style-row">
              <span>{t('editor:style.min')}</span>
              <input
                className="sb-style-number"
                type="number"
                min={5}
                max={2000}
                step={5}
                value={Math.round((boardSettings.zoomMin ?? 0.05) * 100)}
                onChange={(event) =>
                  updateBoardSettings({
                    zoomMin: Math.max(0.05, Number(event.target.value) / 100),
                  })
                }
              />
              <em className="sb-style-value">%</em>
            </div>
            <div className="sb-style-row">
              <span>{t('editor:style.max')}</span>
              <input
                className="sb-style-number"
                type="number"
                min={5}
                max={2000}
                step={5}
                value={Math.round((boardSettings.zoomMax ?? 20) * 100)}
                onChange={(event) =>
                  updateBoardSettings({
                    zoomMax: Math.max(0.05, Number(event.target.value) / 100),
                  })
                }
              />
              <em className="sb-style-value">%</em>
            </div>
          </section>
          <section>
            <h3>{t('editor:style.newBlock')}</h3>
            <div className="sb-style-row">
              <span>{t('editor:style.width')}</span>
              <input
                className="sb-style-number"
                type="number"
                min={40}
                placeholder={t('editor:style.byType')}
                value={boardSettings.defaultBlockWidth ?? ''}
                onChange={(event) =>
                  updateBoardSettings({
                    defaultBlockWidth: event.target.value
                      ? Number(event.target.value)
                      : undefined,
                  })
                }
              />
            </div>
            <div className="sb-style-row">
              <span>{t('editor:style.height')}</span>
              <input
                className="sb-style-number"
                type="number"
                min={40}
                placeholder={t('editor:style.byType')}
                value={boardSettings.defaultBlockHeight ?? ''}
                onChange={(event) =>
                  updateBoardSettings({
                    defaultBlockHeight: event.target.value
                      ? Number(event.target.value)
                      : undefined,
                  })
                }
              />
            </div>
          </section>
        </>
      ) : null}
      {edge ? (
        <section>
          <h3>{t('editor:style.edge')}</h3>
          <ColorPicker
            label={t('editor:style.color')}
            value={edge.color ?? '#1d1d1d'}
            recentColors={uiState.recentColors}
            onChange={(color) => updateEdge({ color })}
            onColorUsed={onRememberColor}
          />
          <div className="sb-style-row">
            <span>{t('editor:style.toEnd')}</span>
            <Switch
              checked={edge.toEnd !== 'none'}
              onChange={(checked) => updateEdge({ toEnd: checked ? 'arrow' : 'none' })}
              ariaLabel={t('editor:style.toEnd')}
            />
          </div>
          <div className="sb-style-row">
            <span>{t('editor:style.fromEnd')}</span>
            <Switch
              checked={edge.fromEnd === 'arrow'}
              onChange={(checked) => updateEdge({ fromEnd: checked ? 'arrow' : 'none' })}
              ariaLabel={t('editor:style.fromEnd')}
            />
          </div>
          <div className="sb-style-row">
            <span>{t('editor:style.fromSide')}</span>
            <Select
              className="sb-select-compact"
              value={edge.fromSide ?? ''}
              onChange={(value) =>
                updateEdge({
                  fromSide: (value || undefined) as CanvasEdge['fromSide'],
                })
              }
              ariaLabel={t('editor:style.fromSide')}
              options={[
                { value: '', label: t('editor:style.auto') },
                { value: 'top', label: t('editor:style.sideTop') },
                { value: 'right', label: t('editor:style.sideRight') },
                { value: 'bottom', label: t('editor:style.sideBottom') },
                { value: 'left', label: t('editor:style.sideLeft') },
              ]}
            />
          </div>
          <div className="sb-style-row">
            <span>{t('editor:style.toSide')}</span>
            <Select
              className="sb-select-compact"
              value={edge.toSide ?? ''}
              onChange={(value) =>
                updateEdge({
                  toSide: (value || undefined) as CanvasEdge['toSide'],
                })
              }
              ariaLabel={t('editor:style.toSide')}
              options={[
                { value: '', label: t('editor:style.auto') },
                { value: 'top', label: t('editor:style.sideTop') },
                { value: 'right', label: t('editor:style.sideRight') },
                { value: 'bottom', label: t('editor:style.sideBottom') },
                { value: 'left', label: t('editor:style.sideLeft') },
              ]}
            />
          </div>
          <div className="sb-style-row">
            <span>{t('editor:style.label')}</span>
            <input
              key={`edge-label:${edge.id}:${edge.label ?? ''}`}
              className="sb-style-text-field"
              defaultValue={edge.label ?? ''}
              placeholder={t('editor:style.edgeLabelPlaceholder')}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.currentTarget.blur()
                } else if (event.key === 'Escape') {
                  event.currentTarget.value = edge.label ?? ''
                  event.currentTarget.blur()
                }
              }}
              onBlur={(event) => {
                const value = event.currentTarget.value.trim()
                if (value !== (edge.label ?? '')) {
                  updateEdge({ label: value || undefined })
                }
              }}
            />
          </div>
        </section>
      ) : null}

      {targetNodes.length >= 2 ? (
        <section>
          <h3>{t('editor:style.align')}</h3>
          <div className="sb-style-buttons is-row">
            <button type="button" onClick={() => align('left')}>
              {t('editor:style.alignLeft')}
            </button>
            <button type="button" onClick={() => align('right')}>
              {t('editor:style.alignRight')}
            </button>
            <button type="button" onClick={() => align('top')}>
              {t('editor:style.alignTop')}
            </button>
            <button type="button" onClick={() => align('bottom')}>
              {t('editor:style.alignBottom')}
            </button>
          </div>
          <div className="sb-style-buttons is-row">
            <button type="button" onClick={() => align('vcenter')}>
              {t('editor:style.alignVCenter')}
            </button>
            <button type="button" onClick={() => align('hcenter')}>
              {t('editor:style.alignHCenter')}
            </button>
          </div>
          <div className="sb-style-buttons is-row">
            <button type="button" onClick={() => distribute('h')}>
              {t('editor:style.distributeH')}
            </button>
            <button type="button" onClick={() => distribute('v')}>
              {t('editor:style.distributeV')}
            </button>
          </div>
        </section>
      ) : null}

      {texts.length > 0 ? (
        <TextFields
          node={firstText}
          recentColors={uiState.recentColors}
          onChange={(patch) => styleText(texts, patch)}
          onColorUsed={onRememberColor}
        />
      ) : null}



      {mediaNodes.length > 0 ? (
        <section>
          <h3>{t('editor:style.mediaCrop')}</h3>
          <div className="sb-style-buttons">
            {(
              [
                ['rect', t('editor:style.cropRect')],
                ['rounded', t('editor:style.cropRounded')],
                ['circle', t('editor:style.cropCircle')],
              ] as const
            ).map(([mode, label]) => (
              <button
                key={mode}
                type="button"
                className={firstMedia?.crop === mode ? 'is-active' : undefined}
                onClick={() => setMediaCrop({ crop: mode })}
              >
                {label}
              </button>
            ))}
            <button
              type="button"
              onClick={() =>
                setMediaCrop({
                  crop: 'rounded',
                  cropX: 0,
                  cropY: 0,
                  cropW: 100,
                  cropH: 100,
                  cropCorner: 8,
                })
              }
            >
              {t('editor:style.reset')}
            </button>
          </div>
          {firstMedia?.crop === 'circle' ? (
            <>
              <CropSlider
                label={t('editor:style.cropCx')}
                value={firstMedia.cropCx ?? 50}
                onCommit={(value) => setMediaCrop({ cropCx: value })}
              />
              <CropSlider
                label={t('editor:style.cropCy')}
                value={firstMedia.cropCy ?? 50}
                onCommit={(value) => setMediaCrop({ cropCy: value })}
              />
              <CropSlider
                label={t('editor:style.cropRadius')}
                value={firstMedia.cropRadius ?? 50}
                onCommit={(value) => setMediaCrop({ cropRadius: value })}
              />
            </>
          ) : (
            <>
              <CropSlider
                label={t('editor:style.cropX')}
                value={firstMedia?.cropX ?? 0}
                onCommit={(value) => setMediaCrop({ cropX: value })}
              />
              <CropSlider
                label={t('editor:style.cropY')}
                value={firstMedia?.cropY ?? 0}
                onCommit={(value) => setMediaCrop({ cropY: value })}
              />
              <CropSlider
                label={t('editor:style.width')}
                value={firstMedia?.cropW ?? 100}
                onCommit={(value) => setMediaCrop({ cropW: value })}
              />
              <CropSlider
                label={t('editor:style.height')}
                value={firstMedia?.cropH ?? 100}
                onCommit={(value) => setMediaCrop({ cropH: value })}
              />
            </>
          )}
          {firstMedia?.crop === 'rounded' ? (
            <CropSlider
              label={t('editor:style.cornerRadius')}
              value={firstMedia.cropCorner ?? 8}
              onCommit={(value) => setMediaCrop({ cropCorner: value })}
            />
          ) : null}
        </section>
      ) : null}
      </div>
      </div>
      </div>
    </div>
  )
}

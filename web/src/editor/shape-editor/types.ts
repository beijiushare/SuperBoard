import type { TLShapeId } from 'tldraw'
import { SB_MARKDOWN_TYPE, SB_PELE_TYPE } from '../../shared/shapes/types'

export type EditingShape = {
  id: TLShapeId
  type: typeof SB_MARKDOWN_TYPE | typeof SB_PELE_TYPE
  props: Record<string, unknown>
} & ({ mode: 'create'; position: { x: number; y: number } } | { mode: 'edit' })

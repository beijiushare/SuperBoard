import { StyleProp, T, createShapePropsMigrationSequence, type TLBaseShape } from 'tldraw'
import {
  SB_BLOCK_BORDER_STYLE_VALUES,
  SB_BLOCK_BORDER_WIDTH_VALUES,
  SB_BLOCK_COLOR_VALUES,
  type SbBlockStyleValues,
} from './blockStyles'

export const SB_MARKDOWN_TYPE = 'sb-markdown'
export const SB_PELE_TYPE = 'sb-pele'
export const SB_MEDIA_TYPE = 'sb-media'
export const SUPERBOARD_SHAPE_TYPES = [SB_MARKDOWN_TYPE, SB_PELE_TYPE] as const
export type SuperboardShapeType = (typeof SUPERBOARD_SHAPE_TYPES)[number]

export const SUPERBOARD_EDIT_EVENT = 'superboard:edit-shape'
export const SUPERBOARD_MEDIA_EVENT = 'superboard:edit-media'

export function isSuperboardShapeType(type: string): type is SuperboardShapeType {
  return (SUPERBOARD_SHAPE_TYPES as readonly string[]).includes(type)
}

export const sbBlockBackgroundColorStyle = StyleProp.defineEnum('superboard:blockBackgroundColor', {
  defaultValue: 'white',
  values: SB_BLOCK_COLOR_VALUES,
})

export const sbBlockBackgroundOpacityStyle = StyleProp.define('superboard:blockBackgroundOpacity', {
  defaultValue: 100,
  type: T.number,
})

export const sbBlockBorderColorStyle = StyleProp.defineEnum('superboard:blockBorderColor', {
  defaultValue: 'grey',
  values: SB_BLOCK_COLOR_VALUES,
})

export const sbBlockBorderOpacityStyle = StyleProp.define('superboard:blockBorderOpacity', {
  defaultValue: 35,
  type: T.number,
})

export const sbBlockBorderWidthStyle = StyleProp.defineEnum('superboard:blockBorderWidth', {
  defaultValue: 'thin',
  values: SB_BLOCK_BORDER_WIDTH_VALUES,
})

export const sbBlockBorderStyleStyle = StyleProp.defineEnum('superboard:blockBorderStyle', {
  defaultValue: 'solid',
  values: SB_BLOCK_BORDER_STYLE_VALUES,
})

export const sbBlockStyleProps = {
  backgroundColor: sbBlockBackgroundColorStyle,
  backgroundOpacity: sbBlockBackgroundOpacityStyle,
  borderColor: sbBlockBorderColorStyle,
  borderOpacity: sbBlockBorderOpacityStyle,
  borderWidth: sbBlockBorderWidthStyle,
  borderStyle: sbBlockBorderStyleStyle,
}

export const DEFAULT_SB_BLOCK_STYLE = {
  backgroundColor: 'white',
  backgroundOpacity: 100,
  borderColor: 'grey',
  borderOpacity: 35,
  borderWidth: 'thin',
  borderStyle: 'solid',
} satisfies SbBlockStyleValues

export const DEFAULT_SB_PELE_STYLE = {
  ...DEFAULT_SB_BLOCK_STYLE,
  backgroundColor: 'paper',
} satisfies SbBlockStyleValues

export interface SbMarkdownProps extends SbBlockStyleValues {
  w: number
  h: number
  baseH: number
  text: string
}

export interface SbPeleProps extends SbBlockStyleValues {
  w: number
  h: number
  code: string
  diagram: string
}

export type SbMediaKind = 'image' | 'video' | 'iframe'
export type SbMediaCrop = 'rect' | 'rounded' | 'circle'

export interface SbMediaProps {
  w: number
  h: number
  url: string
  kind: SbMediaKind
  crop: SbMediaCrop
  cropX: number
  cropY: number
  cropW: number
  cropH: number
  cropCx: number
  cropCy: number
  cropRadius: number
  cropCorner: number
}

declare module 'tldraw' {
  interface TLGlobalShapePropsMap {
    'sb-markdown': SbMarkdownProps
    'sb-pele': SbPeleProps
    'sb-media': SbMediaProps
  }
}

export type SbMarkdownShape = TLBaseShape<'sb-markdown', SbMarkdownProps>
export type SbPeleShape = TLBaseShape<'sb-pele', SbPeleProps>
export type SbMediaShape = TLBaseShape<'sb-media', SbMediaProps>
export type SuperboardShape = SbMarkdownShape | SbPeleShape

export const sbMarkdownProps = {
  ...sbBlockStyleProps,
  w: T.number,
  h: T.number,
  baseH: T.number,
  text: T.string,
}

export const sbPeleProps = {
  ...sbBlockStyleProps,
  w: T.number,
  h: T.number,
  code: T.string,
  diagram: T.string,
}

export const sbMediaProps = {
  w: T.number,
  h: T.number,
  url: T.string,
  kind: T.literalEnum('image', 'video', 'iframe'),
  crop: T.literalEnum('rect', 'rounded', 'circle'),
  cropX: T.number,
  cropY: T.number,
  cropW: T.number,
  cropH: T.number,
  cropCx: T.number,
  cropCy: T.number,
  cropRadius: T.number,
  cropCorner: T.number,
}

export const sbMediaMigrations = createShapePropsMigrationSequence({
  sequence: [
    {
      id: 'com.tldraw.shape.sb-media/1',
      up: (props) => {
        props.crop ??= 'rounded'
        return props
      },
      down: 'retired',
    },
    {
      id: 'com.tldraw.shape.sb-media/2',
      up: (props) => {
        props.cropX ??= 0
        props.cropY ??= 0
        props.cropW ??= 100
        props.cropH ??= 100
        props.cropCx ??= 50
        props.cropCy ??= 50
        props.cropRadius ??= 50
        props.cropCorner ??= 8
        return props
      },
      down: 'retired',
    },
  ],
})

function addBlockStyleDefaults(props: Record<string, unknown>, defaults: SbBlockStyleValues) {
  props.backgroundColor ??= defaults.backgroundColor
  props.backgroundOpacity ??= defaults.backgroundOpacity
  props.borderColor ??= defaults.borderColor
  props.borderOpacity ??= defaults.borderOpacity
  props.borderWidth ??= defaults.borderWidth
  props.borderStyle ??= defaults.borderStyle
  return props
}

export const sbMarkdownMigrations = createShapePropsMigrationSequence({
  sequence: [
    {
      id: 'com.tldraw.shape.sb-markdown/1',
      up: (props) => addBlockStyleDefaults(props, DEFAULT_SB_BLOCK_STYLE),
      down: 'retired',
    },
    {
      id: 'com.tldraw.shape.sb-markdown/2',
      up: (props) => {
        props.baseH ??= typeof props.h === 'number' ? props.h : 340
        return props
      },
      down: 'retired',
    },
  ],
})

export const sbPeleMigrations = createShapePropsMigrationSequence({
  sequence: [
    {
      id: 'com.tldraw.shape.sb-pele/1',
      up: (props) => addBlockStyleDefaults(props, DEFAULT_SB_PELE_STYLE),
      down: 'retired',
    },
  ],
})

export const sbShapeSchemas = {
  [SB_MARKDOWN_TYPE]: { props: sbMarkdownProps, migrations: sbMarkdownMigrations },
  [SB_PELE_TYPE]: { props: sbPeleProps, migrations: sbPeleMigrations },
  [SB_MEDIA_TYPE]: { props: sbMediaProps, migrations: sbMediaMigrations },
}

export const DEFAULT_MARKDOWN_TEXT = `# 新卡片

这里支持 **Markdown**、表格、代码块和 AsciiMath。

行内公式：$a^2 + b^2 = c^2$

$$
sum_(i=1)^n i = (n(n+1))/2
$$
`

export const DEFAULT_PELE_CODE = `flowchart TD
  A[Mermaid text] --> B{Flowchart?}
  B -- Yes --> C[Pele]
  B -- No --> D[Mermaid]
  C --> E([SVG])
  D --> E`

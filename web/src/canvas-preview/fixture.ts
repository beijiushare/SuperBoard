import type { CanvasDocument } from '../canvas/model'

export const previewCanvas: CanvasDocument = {
  nodes: [
    {
      id: 'title',
      type: 'text',
      x: 0,
      y: 0,
      width: 520,
      height: 220,
      text: '# JSON Canvas 预览\n\nMarkdown、公式、表格和代码块都应正常显示。\n\n行内公式：$a^2 + b^2 = c^2$',
      'x-superboard': { kind: 'markdown' },
    },
    {
      id: 'media',
      type: 'link',
      x: 600,
      y: 0,
      width: 360,
      height: 180,
      url: 'https://example.com',
      'x-superboard': { kind: 'media', media: { kind: 'image', url: 'https://example.com' } },
    },
    {
      id: 'shape',
      type: 'group',
      x: 0,
      y: 280,
      width: 320,
      height: 180,
      'x-superboard': { kind: 'shape', shape: 'ellipse' },
    },
    {
      id: 'drawing',
      type: 'group',
      x: 380,
      y: 300,
      width: 260,
      height: 160,
      'x-superboard': {
        kind: 'drawing',
        strokes: [
          {
            id: 'stroke-1',
            color: '#2f80ed',
            size: 8,
            simulatePressure: true,
            points: [
              [10, 120, 0.3],
              [40, 80, 0.5],
              [80, 40, 0.8],
              [120, 60, 0.6],
              [160, 20, 0.9],
              [200, 70, 0.5],
              [240, 40, 0.4],
            ],
          },
        ],
      },
    },
  ],
  edges: [
    {
      id: 'edge-1',
      fromNode: 'title',
      fromSide: 'right',
      toNode: 'media',
      toSide: 'left',
      toEnd: 'arrow',
      label: 'edge',
    },
  ],
  'x-superboard': {
    version: 1,
    meta: { title: 'Preview', slug: 'preview' },
  },
}

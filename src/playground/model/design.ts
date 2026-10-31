// The design specification the visitor edits. It is applied to an in-memory copy of the sanitized
// snapshot, and that copy is what the comparison engine reads as "the design".

export const SWATCHES = [
  { id: 'blue', label: 'Blue', hex: '#2563EB' },
  { id: 'purple', label: 'Purple', hex: '#7C3AED' },
  { id: 'green', label: 'Green', hex: '#047857' },
] as const

export const RADII = [8, 12, 20] as const

export interface Design {
  color: string
  radius: number
  illustration: boolean
}

export const BASELINE_DESIGN: Design = { color: '#2563EB', radius: 12, illustration: false }

/** Id of the optional illustration layer added to the in-memory design. It is not in the real snapshot. */
export const ILLUSTRATION_NODE_ID = 'sandbox:illustration'

const BUTTON_NODE_ID = '1:49'
const CORNER_FIELDS = ['cornerRadius', 'topLeftRadius', 'topRightRadius', 'bottomRightRadius', 'bottomLeftRadius']

export interface FigmaFill {
  type: string
  color?: { r: number; g: number; b: number; a?: number }
  [key: string]: unknown
}

export interface FigmaNode {
  id: string
  name?: string
  type: string
  fills?: FigmaFill[]
  children?: FigmaNode[]
  [key: string]: unknown
}

export interface Evidence {
  document: FigmaNode
  [key: string]: unknown
}

export function hexToRgb01(hex: string): { r: number; g: number; b: number } {
  const match = /^#([0-9a-f]{6})$/i.exec(hex)
  if (!match) throw new Error(`Expected a 6-digit hex colour, got ${hex}`)
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(match[1].slice(i, i + 2), 16) / 255)
  return { r, g, b }
}

export function findNode(root: FigmaNode, id: string): FigmaNode | undefined {
  if (root.id === id) return root
  for (const child of root.children ?? []) {
    const found = findNode(child, id)
    if (found) return found
  }
  return undefined
}

/** Applies the visitor's edits to a copy of the snapshot. The snapshot itself is never changed. */
export function buildEvidence(base: Evidence, design: Design): Evidence {
  const document = structuredClone(base.document)
  const button = findNode(document, BUTTON_NODE_ID)
  if (!button?.fills?.[0]) throw new Error('Snapshot is missing the button fill')
  button.fills[0].color = hexToRgb01(design.color)
  for (const field of CORNER_FIELDS) document[field] = design.radius
  if (design.illustration) {
    document.children = [
      { id: ILLUSTRATION_NODE_ID, name: 'Illustration', type: 'FRAME', visible: true, opacity: 1, children: [] },
      ...(document.children ?? []),
    ]
  }
  return { ...base, document }
}

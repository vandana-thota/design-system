import type { EngineMapping, MappingNode } from '../../../packages/figma-card-engine/src/index.mjs'

// The React implementation, as source text. The engine analyses this text and the page renders the same
// text, so what is checked is what is shown.

export const IMPLEMENTATION_FILES = {
  css: 'src/playground/implementation/Card.css',
  baseline: 'src/playground/implementation/Card.tsx',
  illustrated: 'src/playground/implementation/CardWithIllustration.tsx',
} as const

export interface Sources {
  css: string
  baselineJsx: string
  illustratedJsx: string
}

export type Structure = 'baseline' | 'illustrated'

export interface Implementation {
  css: string
  structure: Structure
}

export const initialImplementation = (sources: Sources): Implementation => ({ css: sources.css, structure: 'baseline' })

export const jsxFor = (impl: Implementation, sources: Sources): string =>
  impl.structure === 'illustrated' ? sources.illustratedJsx : sources.baselineJsx

export const jsxPathFor = (impl: Implementation): string =>
  impl.structure === 'illustrated' ? IMPLEMENTATION_FILES.illustrated : IMPLEMENTATION_FILES.baseline

/** Replaces one CSS custom property value. It must exist exactly once, so a patch can never silently miss. */
export function setDeclaration(css: string, name: string, value: string): string {
  const pattern = new RegExp(`(${name}\\s*:\\s*)[^;]+;`, 'g')
  const matches = css.match(pattern)
  if (matches?.length !== 1) throw new Error(`Expected exactly one ${name} declaration, found ${matches?.length ?? 0}`)
  return css.replace(pattern, `$1${value};`)
}

export const withRadius = (css: string, px: number): string => setDeclaration(css, '--atlas-radius', `${px}px`)
export const withButtonColor = (css: string, hex: string): string => setDeclaration(css, '--atlas-action-bg', hex.toUpperCase())

/** Maps Figma layers to the sandbox card's class names, including the optional illustration layer. */
export function buildMapping(engineMapping: EngineMapping, impl: Implementation, illustrationId: string): EngineMapping {
  const nodes: Record<string, MappingNode> = {}
  for (const [id, node] of Object.entries(engineMapping.nodes)) {
    nodes[id] = { ...node, selector: node.selector.replace('.card', '.atlas-card') }
  }
  nodes[illustrationId] = { selector: '.atlas-card__illustration', tag: 'div', figmaType: 'FRAME' }
  return { ...engineMapping, nodes, jsxFile: jsxPathFor(impl), cssFile: IMPLEMENTATION_FILES.css }
}

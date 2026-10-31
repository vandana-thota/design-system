// The design-system project, bundled into the page so the real token checker (DS001–DS007) can run in the
// browser. These are this repository's own public source files; there is no secret in them.
import baseSnapshot from '../../packages/figma-card-engine/snapshots/atlas-card.v1.json'
import cardCss from './implementation/Card.css?raw'
import cardTsx from './implementation/Card.tsx?raw'
import cardIllustratedTsx from './implementation/CardWithIllustration.tsx?raw'
import tokens from '../../tokens/tokens.json'
import tailwindCss from '../styles/tokens/tailwind.css?raw'
import typeCss from '../styles/tokens/type.css?raw'
import allowlist from '../../drift.allowlist.json'
import spec from '../../docs/tokens-spec.md?raw'
import type { Evidence } from './model/design.ts'
import type { DriftInputs } from './model/governance.ts'
import type { Sources } from './model/implementation.ts'

export const base = baseSnapshot as unknown as Evidence

export const sources: Sources = { css: cardCss, baselineJsx: cardTsx, illustratedJsx: cardIllustratedTsx }

// Same folders the command-line checker reads: src and .storybook.
const projectFiles = import.meta.glob(
  ['../**/*.{ts,tsx,css,mdx}', '../../.storybook/*.{ts,tsx}', '!../styles/tokens/**', '!../**/assets/**'],
  { eager: true, query: '?raw', import: 'default' },
) as Record<string, string>

// Glob keys are relative to this file (src/playground), such as '../App.tsx' or './Playground.tsx'.
// Turn them into repository paths ('src/App.tsx', 'src/playground/Playground.tsx', '.storybook/main.ts').
export function toRepoPath(key: string, from = 'src/playground'): string {
  const parts = from.split('/')
  for (const part of key.split('/')) {
    if (part === '..') parts.pop()
    else if (part !== '.') parts.push(part)
  }
  return parts.join('/')
}

/** The project's files as the checker expects them. (The checker itself skips src/playground, the demo.) */
export function repoInputs(): DriftInputs {
  const files = Object.entries(projectFiles).map(([key, text]) => ({ file: toRepoPath(key), text }))
  return {
    tokens,
    generated: { 'tailwind.css': tailwindCss, 'type.css': typeCss },
    files,
    allowlist,
    spec,
  }
}

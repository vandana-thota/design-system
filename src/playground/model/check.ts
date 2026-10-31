import { checks, compare, mapping as engineMapping } from '../../../packages/figma-card-engine/src/index.mjs'
import type { EngineReport } from '../../../packages/figma-card-engine/src/index.mjs'
import type { Evidence } from './design.ts'
import { ILLUSTRATION_NODE_ID } from './design.ts'
import { buildMapping, jsxFor } from './implementation.ts'
import type { Implementation, Sources } from './implementation.ts'

/**
 * Runs the real Figma-card comparison engine: the design (snapshot with the visitor's edits) against the
 * implementation (CSS and JSX source text). Nothing here is simulated; the report is the engine's own.
 */
export function runDriftCheck(evidence: Evidence, impl: Implementation, sources: Sources): EngineReport {
  return compare({
    evidence,
    css: impl.css,
    jsx: jsxFor(impl, sources),
    mode: 'in-browser sandbox (sanitized snapshot, not a live Figma read)',
    mapping: buildMapping(engineMapping, impl, ILLUSTRATION_NODE_ID),
    checks,
  })
}

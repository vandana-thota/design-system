import { checkInputs } from '../../../scripts/drift/core.mjs'
import type { DriftInputs, DriftResult } from '../../../scripts/drift/core.mjs'
import { rules } from '../../../scripts/drift/rules.mjs'

export type { DriftInputs, DriftResult }

export interface RuleSummary {
  id: string
  name: string
  severity: 'error' | 'warning'
  /** Findings that are not on the allowlist. */
  open: number
  /** Findings that are on the allowlist, each with a written reason. */
  allowed: number
}

/** Runs the real DS001–DS007 token-governance checker on in-memory project files. */
export function runGovernance(inputs: DriftInputs): DriftResult {
  return checkInputs(inputs, { rule: null, strict: false })
}

export function summarizeRules(result: DriftResult): RuleSummary[] {
  const summary = rules.map((rule) => {
    const mine = result.findings.filter((f) => f.rule === rule.id)
    return { ...rule, open: mine.filter((f) => !f.allowed).length, allowed: mine.filter((f) => f.allowed).length }
  })
  // Findings about the allowlist itself (for example an entry that matches nothing) are not one of the seven rules.
  const known = new Set(rules.map((rule) => rule.id))
  const other = result.findings.filter((f) => !known.has(f.rule))
  if (other.length) summary.push({ id: 'ALLOWLIST', name: 'allowlist', severity: 'warning', open: other.filter((f) => !f.allowed).length, allowed: other.filter((f) => f.allowed).length })
  return summary
}

/** Design tokens whose resolved light-theme value is exactly this colour. */
export function tokensForHex(result: DriftResult, hex: string): string[] {
  const wanted = hex.toLowerCase()
  return result.ctx.tokens
    .filter((t) => t.type === 'color' && t.layer !== 'primitive' && result.ctx.resolve(t).toLowerCase() === wanted)
    .map((t) => t.path)
}

/** Follows {references} from a token down to its final value, for example component -> semantic -> primitive. */
export function tokenChain(result: DriftResult, path: string): { path: string; value: string }[] {
  const chain: { path: string; value: string }[] = []
  let current = result.ctx.byPath.get(path)
  while (current && chain.length < 10) {
    const raw = typeof current.value === 'string' ? current.value : JSON.stringify(current.value)
    chain.push({ path: current.path, value: raw })
    const next = /^\{([\w.-]+)\}$/.exec(raw)?.[1]
    current = next ? result.ctx.byPath.get(next) : undefined
  }
  return chain
}

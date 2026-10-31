import type { DriftInputs, DriftResult } from './core.mjs'

export { checkInputs } from './core.mjs'
export function readInputs(root: string): DriftInputs
export function check(opts: { root: string; rule?: string | null; strict?: boolean }): DriftResult

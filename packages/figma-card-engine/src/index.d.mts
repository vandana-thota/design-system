export type Status = 'MATCH' | 'DRIFT' | 'NOT CHECKED'

export interface EngineRow {
  property: string
  status: Status
  expected: unknown
  actual: unknown
  figmaSource: string
  codeSources: string[]
  rawCss: string | null
  reason: string
}

export interface EngineReport {
  generatedAt: string
  mode: string
  figma: { url: string; provider: string | null; fetchedAt: string | null; version: string | null; error: string | null }
  scope: string
  summary: Record<Status, number>
  results: EngineRow[]
}

export interface MappingNode {
  selector: string
  tag: string
  figmaType: string
  textId?: string
  prop?: string
}

export interface EngineMapping {
  fileKey: string
  nodeId: string
  url: string
  component: string
  jsxFile: string
  cssFile: string
  nodes: Record<string, MappingNode>
}

export interface EngineCheck {
  label: string
  nodeId: string
  css: string
  kind: string
  figma: string
}

export function compare(options: {
  evidence?: unknown
  figmaError?: string
  css: string
  jsx: string
  mode?: string
  mapping?: EngineMapping
  checks?: EngineCheck[]
}): EngineReport
export function exitCode(report: EngineReport): number
export function markdown(report: EngineReport): string
export function validateEvidence(evidence: unknown, mapping?: EngineMapping): unknown
export function normalizeColor(value: unknown): number[]
export function normalizeLength(value: unknown): number
export function inspectCss(source: string, file: string): unknown
export function inspectJsx(source: string, mapping: EngineMapping): unknown
export const mapping: EngineMapping
export const checks: EngineCheck[]

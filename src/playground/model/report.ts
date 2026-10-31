import type { EngineMapping, EngineReport, EngineRow, Status } from '../../../packages/figma-card-engine/src/index.mjs'
import { findNode } from './design.ts'
import type { Evidence } from './design.ts'

export type { EngineReport, EngineRow, Status }

export type IssueKind = 'color' | 'radius' | 'padding' | 'buttonPadding' | 'gap' | 'direction' | 'structure' | 'rendered'

export interface StructureDiff {
  /** In the design, but the React card does not render it. */
  missingInCode: string[]
  /** Rendered by the React card, but not in the design. */
  extraInCode: string[]
}

/** Engine rows that belong together (for example the four corner radii), shown as one issue. */
export interface Issue {
  kind: IssueKind
  title: string
  status: Status
  rows: EngineRow[]
  expectedText: string
  actualText: string
  /** Hex colours, only for the colour issue. */
  swatches?: { expected: string; actual: string }
  /** One plain-language sentence about this issue, built from the engine's values. */
  explanation: string
  structure?: StructureDiff
}

const KIND_ORDER: IssueKind[] = ['color', 'radius', 'structure', 'padding', 'buttonPadding', 'gap', 'direction', 'rendered']
const TITLES: Record<IssueKind, string> = {
  color: 'Button background',
  radius: 'Card radius',
  structure: 'Component structure',
  padding: 'Card padding',
  buttonPadding: 'Button padding',
  gap: 'Content gap',
  direction: 'Content layout direction',
  rendered: 'Rendered appearance',
}

function kindOf(property: string): IssueKind {
  if (property === 'Button background') return 'color'
  if (property.startsWith('Card radius')) return 'radius'
  if (property.startsWith('Card padding')) return 'padding'
  if (property.startsWith('Button padding')) return 'buttonPadding'
  if (property === 'Content gap') return 'gap'
  if (property === 'Content layout direction') return 'direction'
  if (property === 'Component structure') return 'structure'
  return 'rendered'
}

export function toHex(rgba: unknown): string | null {
  if (!Array.isArray(rgba) || rgba.length < 3) return null
  return `#${rgba.slice(0, 3).map((n: number) => n.toString(16).padStart(2, '0')).join('').toUpperCase()}`
}

const sameValue = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

function aggregate(rows: EngineRow[], field: 'expected' | 'actual'): unknown {
  const first = rows[0]?.[field]
  return rows.every((row) => sameValue(row[field], first)) ? first : rows.map((row) => row[field])
}

const text = (value: unknown, kind: IssueKind): string => {
  if (value === null || value === undefined) return 'Unavailable'
  if (kind === 'color') return toHex(value) ?? JSON.stringify(value)
  if (kind === 'radius' || kind === 'padding' || kind === 'buttonPadding' || kind === 'gap') {
    return Array.isArray(value) ? value.map((n) => `${n}px`).join(' / ') : `${value}px`
  }
  return typeof value === 'string' ? value : JSON.stringify(value)
}

interface Tree {
  element: string
  children: (Tree | string)[]
}

const isTree = (node: unknown): node is Tree => typeof node === 'object' && node !== null && 'element' in node

function flatten(node: Tree, parent = ''): string[] {
  const here = `${parent} > ${node.element}`
  return [here, ...node.children.filter(isTree).flatMap((child) => flatten(child, here))]
}

/** Layer name for an element such as "div.atlas-card__illustration", taken from the design snapshot. */
export function layerNames(mapping: EngineMapping, evidence: Evidence): Record<string, string> {
  const names: Record<string, string> = {}
  for (const [id, node] of Object.entries(mapping.nodes)) {
    const layer = findNode(evidence.document, id)
    if (layer?.name) names[`${node.tag}${node.selector}`] = layer.name
  }
  return names
}

export function diffStructure(expected: unknown, actual: unknown): StructureDiff | null {
  if (!isTree(expected) || !isTree(actual)) return null
  const remaining = flatten(actual)
  const missingInCode: string[] = []
  for (const entry of flatten(expected)) {
    const at = remaining.indexOf(entry)
    if (at === -1) missingInCode.push(entry)
    else remaining.splice(at, 1)
  }
  return { missingInCode, extraInCode: remaining }
}

const lastElement = (entry: string) => entry.split(' > ').pop() ?? entry

function describeStructure(diff: StructureDiff, names: Record<string, string>): string {
  const label = (entry: string) => {
    const element = lastElement(entry)
    return names[element] ? `the “${names[element]}” layer (${element})` : element
  }
  const parts = [
    ...diff.missingInCode.map((entry) => `The design has ${label(entry)}, but the React card does not render it.`),
    ...diff.extraInCode.map((entry) => `The React card renders ${label(entry)}, which is not in the design.`),
  ]
  return parts.join(' ')
}

function statusOf(rows: EngineRow[]): Status {
  if (rows.some((row) => row.status === 'DRIFT')) return 'DRIFT'
  if (rows.some((row) => row.status === 'NOT CHECKED')) return 'NOT CHECKED'
  return 'MATCH'
}

/** Groups the engine's rows into issues for reading. The rows themselves are left exactly as the engine returned them. */
export function groupIssues(report: EngineReport, names: Record<string, string> = {}): Issue[] {
  const groups = new Map<IssueKind, EngineRow[]>()
  for (const row of report.results) {
    const kind = kindOf(row.property)
    groups.set(kind, [...(groups.get(kind) ?? []), row])
  }
  const issues: Issue[] = []
  for (const kind of KIND_ORDER) {
    const rows = groups.get(kind)
    if (!rows) continue
    const status = statusOf(rows)
    const expected = aggregate(rows, 'expected')
    const actual = aggregate(rows, 'actual')
    const issue: Issue = {
      kind, title: TITLES[kind], status, rows,
      expectedText: text(expected, kind), actualText: text(actual, kind),
      explanation: rows.find((row) => row.status === status)?.reason ?? '',
    }
    if (kind === 'color') {
      const e = toHex(expected)
      const a = toHex(actual)
      if (e && a) issue.swatches = { expected: e, actual: a }
    }
    if (kind === 'structure') {
      const structure = diffStructure(expected, actual)
      if (structure) {
        issue.structure = structure
        issue.expectedText = 'Design layers'
        issue.actualText = 'React elements'
        if (status === 'DRIFT') issue.explanation = describeStructure(structure, names)
      }
    }
    if (status === 'DRIFT' && kind !== 'structure') {
      issue.explanation = `The design expects ${issue.expectedText}, but the React implementation renders ${issue.actualText}.`
    }
    if (status === 'MATCH') issue.explanation = 'Design and implementation agree.'
    issues.push(issue)
  }
  return issues
}

export const statusRank: Record<Status, number> = { DRIFT: 0, 'NOT CHECKED': 1, MATCH: 2 }

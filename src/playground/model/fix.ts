import { IMPLEMENTATION_FILES, jsxFor, withButtonColor, withRadius } from './implementation.ts'
import type { Implementation, Sources } from './implementation.ts'
import { changedHunks, lineDiff } from './diff.ts'
import type { DiffLine } from './diff.ts'
import { statusRank, toHex } from './report.ts'
import type { Issue, IssueKind } from './report.ts'

export interface FixStep {
  issue: IssueKind
  description: string
  file: string
}

export interface FilePatch {
  file: string
  lines: DiffLine[]
}

export interface FixPlan {
  steps: FixStep[]
  /** Drifting issues this simulation has no patch for. They stay as the engine reported them. */
  unsupported: { issue: IssueKind; reason: string }[]
  /** The implementation with the patches applied, in memory only. */
  next: Implementation
  patches: FilePatch[]
}

const sameValue = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

// The two sandbox component files differ in their explanatory header comments. The patch that matters is the code.
const withoutHeaderComment = (text: string): string => text.split('\n').filter((line) => !line.startsWith('// ')).join('\n')

/**
 * Works out which implementation changes would remove each drift the engine found, and applies them to a
 * copy of the implementation text. Values come from the engine's "expected" side, not from the page state.
 * Nothing is written anywhere: the result is just new strings.
 */
export function planFix(issues: Issue[], impl: Implementation, sources: Sources): FixPlan {
  let css = impl.css
  let structure = impl.structure
  const steps: FixStep[] = []
  const unsupported: FixPlan['unsupported'] = []

  for (const issue of issues.filter((i) => i.status === 'DRIFT')) {
    const expected = issue.rows.map((row) => row.expected)
    const uniform = expected.every((value) => sameValue(value, expected[0]))
    if (issue.kind === 'color' && uniform && toHex(expected[0])) {
      const hex = toHex(expected[0]) as string
      css = withButtonColor(css, hex)
      steps.push({ issue: issue.kind, description: `Button adopts the design colour ${hex}`, file: IMPLEMENTATION_FILES.css })
    } else if (issue.kind === 'radius' && uniform && typeof expected[0] === 'number') {
      css = withRadius(css, expected[0])
      steps.push({ issue: issue.kind, description: `Card adopts the design radius ${expected[0]}px`, file: IMPLEMENTATION_FILES.css })
    } else if (issue.kind === 'structure' && issue.structure?.missingInCode.some((e) => e.endsWith('atlas-card__illustration'))) {
      structure = 'illustrated'
      steps.push({ issue: issue.kind, description: 'Card renders the illustration strip as its first child', file: IMPLEMENTATION_FILES.illustrated })
    } else if (issue.kind === 'structure' && issue.structure?.extraInCode.some((e) => e.endsWith('atlas-card__illustration'))) {
      structure = 'baseline'
      steps.push({ issue: issue.kind, description: 'Card stops rendering the illustration strip', file: IMPLEMENTATION_FILES.baseline })
    } else {
      unsupported.push({ issue: issue.kind, reason: 'This simulation has no automatic patch for this kind of difference.' })
    }
  }

  const next: Implementation = { css, structure }
  const patches: FilePatch[] = []
  if (css !== impl.css) patches.push({ file: IMPLEMENTATION_FILES.css, lines: changedHunks(lineDiff(impl.css, css)) })
  if (structure !== impl.structure) {
    patches.push({
      file: structure === 'illustrated' ? IMPLEMENTATION_FILES.illustrated : IMPLEMENTATION_FILES.baseline,
      lines: changedHunks(lineDiff(withoutHeaderComment(jsxFor(impl, sources)), withoutHeaderComment(jsxFor(next, sources)))),
    })
  }
  return { steps, unsupported, next, patches }
}

export type Outcome = 'resolved' | 'still drifting' | 'not checked' | 'unchanged'

export interface IssueOutcome {
  kind: IssueKind
  title: string
  before: Issue['status']
  after: Issue['status']
  outcome: Outcome
}

/** Compares the issues before and after the simulated fix. */
export function compareOutcomes(before: Issue[], after: Issue[]): IssueOutcome[] {
  return before.map((b) => {
    const a = after.find((issue) => issue.kind === b.kind)
    const status = a?.status ?? b.status
    const outcome: Outcome =
      status === 'NOT CHECKED' ? 'not checked'
      : b.status === 'DRIFT' && status === 'MATCH' ? 'resolved'
      : status === 'DRIFT' ? 'still drifting'
      : 'unchanged'
    return { kind: b.kind, title: b.title, before: b.status, after: status, outcome }
  }).sort((x, y) => statusRank[x.before] - statusRank[y.before])
}

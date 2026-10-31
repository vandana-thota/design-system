import { mapping as engineMapping } from '../../../packages/figma-card-engine/src/index.mjs'
import type { EngineReport } from '../../../packages/figma-card-engine/src/index.mjs'
import { BASELINE_DESIGN, ILLUSTRATION_NODE_ID, buildEvidence } from './design.ts'
import type { Design, Evidence } from './design.ts'
import { runDriftCheck } from './check.ts'
import { buildMapping, initialImplementation } from './implementation.ts'
import type { Implementation, Sources } from './implementation.ts'
import { compareOutcomes, planFix } from './fix.ts'
import type { FixPlan, IssueOutcome } from './fix.ts'
import { groupIssues, layerNames } from './report.ts'
import type { Issue } from './report.ts'

export interface CheckRun {
  /** The design that was checked, so the page can tell when it has been edited since. */
  design: Design
  report: EngineReport
  issues: Issue[]
}

export interface FixRun {
  plan: FixPlan
  report: EngineReport
  issues: Issue[]
  outcomes: IssueOutcome[]
}

/** Everything the visitor can change. It lives in browser memory only. */
export interface Session {
  design: Design
  implementation: Implementation
  check: CheckRun | null
  fix: FixRun | null
}

export type Action =
  | { type: 'edit'; patch: Partial<Design> }
  | { type: 'run' }
  | { type: 'simulate' }
  | { type: 'reset' }

export interface Environment {
  /** The sanitized, versioned design snapshot. Never modified. */
  base: Evidence
  sources: Sources
}

export const initialSession = (env: Environment): Session => ({
  design: BASELINE_DESIGN,
  implementation: initialImplementation(env.sources),
  check: null,
  fix: null,
})

function check(env: Environment, design: Design, implementation: Implementation) {
  const evidence = buildEvidence(env.base, design)
  const report = runDriftCheck(evidence, implementation, env.sources)
  const names = layerNames(buildMapping(engineMapping, implementation, ILLUSTRATION_NODE_ID), evidence)
  return { report, issues: groupIssues(report, names) }
}

export const isStale = (session: Session): boolean =>
  session.check !== null && JSON.stringify(session.check.design) !== JSON.stringify(session.design)

export const hasDrift = (session: Session): boolean => !!session.check && !isStale(session) && session.check.report.summary.DRIFT > 0

export function reduce(session: Session, action: Action, env: Environment): Session {
  switch (action.type) {
    case 'edit':
      // Editing the design never touches the implementation. Results from an earlier fix no longer apply.
      return { ...session, design: { ...session.design, ...action.patch }, fix: null }
    case 'run':
      return { ...session, check: { design: session.design, ...check(env, session.design, session.implementation) }, fix: null }
    case 'simulate': {
      if (!session.check || isStale(session)) return session
      const plan = planFix(session.check.issues, session.implementation, env.sources)
      const after = check(env, session.check.design, plan.next)
      return {
        ...session,
        implementation: plan.next,
        fix: { plan, ...after, outcomes: compareOutcomes(session.check.issues, after.issues) },
      }
    }
    case 'reset':
      return initialSession(env)
  }
}

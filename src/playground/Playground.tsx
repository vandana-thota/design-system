import { useEffect, useMemo, useReducer } from 'react'
import type { ReactNode } from 'react'
import { Button } from '../components/index.ts'
import { IMPLEMENTATION_FILES } from './model/implementation.ts'
import { planFix } from './model/fix.ts'
import { runGovernance, tokenChain, tokensForHex } from './model/governance.ts'
import { hasDrift, initialSession, isStale, reduce } from './model/session.ts'
import type { Action, Environment, Session } from './model/session.ts'
import type { IssueKind } from './model/report.ts'
import { base, repoInputs, sources } from './repo.ts'
import { Controls } from './ui/Controls.tsx'
import { DesignCard, ImplementationCard } from './ui/cards.tsx'
import { Counts, FixResults, IssueList, RawReport } from './ui/Results.tsx'
import { UnderTheHood } from './ui/UnderTheHood.tsx'
import { Workflow } from './ui/Workflow.tsx'

const env: Environment = { base, sources }
const reducer = (session: Session, action: Action) => reduce(session, action, env)

const panel = 'rounded-card border-(length:--border-width-default) border-default bg-surface p-inset-lg'
// Both stages share one minimum height (sized to the card with its illustration), so toggling the illustration moves nothing.
const stage = 'flex items-center justify-center rounded-control bg-canvas p-inset-lg'
const STAGE_MIN_HEIGHT = 352

function Panel({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className={`${panel} flex min-w-0 flex-col gap-stack-md`}>
      <h2 id={id} className="text-label-m text-secondary">{label}</h2>
      {children}
    </section>
  )
}

/** Tells a parent page (for example a portfolio case study) how tall this page is, so an iframe can fit it. */
function useReportHeight(enabled: boolean) {
  useEffect(() => {
    if (!enabled || window.parent === window) return
    const send = () => window.parent.postMessage({ type: 'drift-playground:height', height: document.documentElement.scrollHeight }, '*')
    const observer = new ResizeObserver(send)
    observer.observe(document.body)
    send()
    return () => observer.disconnect()
  }, [enabled])
}

export function Playground() {
  const embed = useMemo(() => new URLSearchParams(window.location.search).get('embed') === '1', [])
  const [session, dispatch] = useReducer(reducer, env, initialSession)
  const governance = useMemo(() => runGovernance(repoInputs()), [])
  useReportHeight(embed)

  const { check, fix, implementation } = session
  const stale = isStale(session)
  const modified = implementation.css !== sources.css || implementation.structure !== 'baseline'

  const plan = useMemo(() => (check ? planFix(check.issues, implementation, sources) : null), [check, implementation])
  const resolutions = useMemo(() => {
    const out: Partial<Record<IssueKind, string>> = {}
    for (const step of plan?.steps ?? []) out[step.issue] = `${step.description}. Edit ${step.file}.`
    return out
  }, [plan])

  const tokenHints = useMemo(() => {
    const colour = check?.issues.find((issue) => issue.kind === 'color' && issue.status === 'DRIFT')
    if (!colour?.swatches) return {}
    const hex = colour.swatches.expected
    const owners = tokensForHex(governance, hex)
    const chain = tokenChain(governance, 'component.button.primary.bg').map((step) => step.path).join(' → ')
    return {
      color: (
        <p className="mt-stack-sm text-body-m text-secondary">
          <span className="text-label-m text-primary">Token reference. </span>
          {owners.length
            ? `${hex} is the value of ${owners.join(', ')}.`
            : `${hex} is not a design-system token. The design-system primary button takes its colour from ${chain}, so a production fix would reference a token, not this hex value.`}
        </p>
      ),
    }
  }, [check, governance])

  const summaryText = check
    ? stale
      ? 'The design changed since the last check. Run the check again.'
      : `Drift check finished: ${check.report.summary.MATCH} match, ${check.report.summary.DRIFT} drift, ${check.report.summary['NOT CHECKED']} not checked.`
    : ''

  return (
    <main className={`mx-auto flex max-w-(--layout-desktop-max-width) flex-col gap-stack-xl px-inset-lg tablet:px-inset-xl ${embed ? 'py-inset-lg' : 'py-section-sm'}`}>
      <header>
        {!embed && (
          <>
            <p className="text-label-s tracking-[0.08em] text-secondary">ATLAS / DESIGN SYSTEM LAB</p>
            <h1 className="mt-stack-xs text-headline-m text-primary">Design-to-Code Drift Playground</h1>
          </>
        )}
        <p className={`${embed ? '' : 'mt-stack-xs '}text-body-l text-secondary`}>
          Edit the design, run a check, and explore how design changes affect the React implementation.
        </p>
      </header>

      <div className="flex flex-col gap-stack-md">
        <div className="grid gap-inline-lg tablet:grid-cols-2">
          <Panel id="design-label" label="Design specification">
            <div className={stage} style={{ minHeight: STAGE_MIN_HEIGHT }}><DesignCard base={base} design={session.design} /></div>
            <Controls design={session.design} onChange={(patch) => dispatch({ type: 'edit', patch })} />
          </Panel>

          <Panel id="implementation-label" label="React implementation">
            <div className={stage} style={{ minHeight: STAGE_MIN_HEIGHT }}><ImplementationCard implementation={implementation} /></div>
            <div className="flex flex-col gap-stack-xs">
              <h3 className="text-label-m text-primary">Component source</h3>
              <ul className="flex flex-col gap-stack-xs text-code text-secondary wrap-anywhere">
                <li className={implementation.structure === 'baseline' ? 'text-primary' : ''}>{IMPLEMENTATION_FILES.baseline}{implementation.structure === 'baseline' ? ' (rendered)' : ''}</li>
                <li className={implementation.structure === 'illustrated' ? 'text-primary' : ''}>{IMPLEMENTATION_FILES.illustrated}{implementation.structure === 'illustrated' ? ' (rendered)' : ''}</li>
                <li>{IMPLEMENTATION_FILES.css} (applied and analysed as the same text)</li>
              </ul>
              <p className="text-label-m text-primary" data-testid="source-status">
                {modified ? 'Simulated changes applied in memory (no files changed)' : 'Unchanged baseline'}
              </p>
              <p className="text-body-s text-secondary">
                A plain-CSS sandbox card, because the engine reads plain CSS and static JSX. It uses the design system’s tokens; the Tailwind Card in src/components/Card is not read by the engine.
              </p>
            </div>
          </Panel>
        </div>

        <Button fullWidth size="lg" onClick={() => dispatch({ type: 'run' })}>Run Drift Check</Button>
        <div className="flex flex-wrap items-center gap-inline-sm">
          {check && hasDrift(session) && !fix && (
            <Button variant="secondary" onClick={() => dispatch({ type: 'simulate' })}>Simulate fix</Button>
          )}
          <Button variant="ghost" onClick={() => dispatch({ type: 'reset' })}>Reset experiment</Button>
          <p className="text-body-s text-secondary">Runs in your browser. Your edits are never saved, sent, or written to any file.</p>
        </div>
      </div>

      <div role="status" className="sr-only">{summaryText}</div>

      {check && (
        <section aria-labelledby="report-heading" className="flex flex-col gap-stack-md">
          <div>
            <h2 id="report-heading" className="text-title-m text-primary">Drift report</h2>
            <p className="mt-stack-xs text-body-m text-secondary">
              Real comparison engine · design: sanitized snapshot with your edits · implementation: the files listed above · {check.report.mode}
            </p>
          </div>
          {stale && (
            <p className="rounded-control bg-status-warning-bg p-inset-sm text-body-m text-status-warning-text">
              The design has changed since this report was made, so it describes an earlier version. Run the check again.
            </p>
          )}
          <div className="flex flex-col gap-stack-xs">
            <Counts summary={check.report.summary} label="Engine check counts" />
            <p className="text-body-s text-secondary">
              These are the engine’s individual checks. Related checks, such as the four corner radii, are grouped into one issue below.
            </p>
          </div>
          <IssueList issues={check.issues} resolutions={resolutions} tokenHints={tokenHints} />
          <RawReport report={check.report} />
        </section>
      )}

      {fix && <FixResults fix={fix} />}

      <Workflow />
      <UnderTheHood governance={governance} />
    </main>
  )
}

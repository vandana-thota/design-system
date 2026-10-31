import type { ReactNode } from 'react'
import type { EngineReport } from '../model/report.ts'
import { statusRank } from '../model/report.ts'
import type { Issue, Status } from '../model/report.ts'
import type { FixRun } from '../model/session.ts'
import type { DiffLine } from '../model/diff.ts'
import { IMPLEMENTATION_FILES } from '../model/implementation.ts'

const badge: Record<Status, string> = {
  MATCH: 'bg-status-success-bg text-status-success-text',
  DRIFT: 'bg-status-danger-bg text-status-danger-text',
  'NOT CHECKED': 'bg-status-warning-bg text-status-warning-text',
}

export function StatusBadge({ status }: { status: Status }) {
  return <span className={`inline-flex h-icon-md items-center rounded-chip px-inset-xs text-label-s whitespace-nowrap ${badge[status]}`}>{status}</span>
}

export function Counts({ summary, label }: { summary: Record<Status, number>; label?: string }) {
  return (
    <dl aria-label={label ?? 'Check counts'} className="grid grid-cols-3 gap-inline-sm">
      {(['MATCH', 'DRIFT', 'NOT CHECKED'] as const).map((status) => (
        <div key={status} className="rounded-control border-(length:--border-width-default) border-default bg-surface px-inset-md py-inset-sm">
          <dt className="text-label-s text-secondary">{status}</dt>
          <dd className="tabular text-headline-s text-primary">{summary[status]}</dd>
        </div>
      ))}
    </dl>
  )
}

const mono = 'text-code text-secondary wrap-anywhere'

function Swatch({ hex }: { hex: string }) {
  return <span aria-hidden="true" className="inline-block size-icon-sm shrink-0 rounded-chip border-(length:--border-width-default) border-default" style={{ backgroundColor: hex }} />
}

function Value({ label, text, swatch }: { label: string; text: string; swatch?: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-label-s text-secondary">{label}</dt>
      <dd className="mt-stack-xs flex items-center gap-inline-xs text-body-m text-primary">
        {swatch && <Swatch hex={swatch} />}
        <span className="tabular break-words">{text}</span>
      </dd>
    </div>
  )
}

const bracket = (source: string) => /\[(.+)\]/.exec(source)?.[1] ?? source

function Json({ value }: { value: unknown }) {
  return <pre className="max-h-64 overflow-auto rounded-control bg-surface-secondary p-inset-sm text-code text-primary">{JSON.stringify(value, null, 2)}</pre>
}

export function IssueCard({ issue, resolution, tokenHint }: { issue: Issue; resolution?: string; tokenHint?: ReactNode }) {
  const isRendered = issue.kind === 'rendered'
  const codeSources = [...new Set(issue.rows.flatMap((row) => row.codeSources))]
  return (
    <li className="rounded-card border-(length:--border-width-default) border-default bg-surface p-inset-lg">
      <div className="flex items-center justify-between gap-inline-sm">
        <h4 className="text-title-s text-primary">{issue.title}</h4>
        <StatusBadge status={issue.status} />
      </div>
      {!isRendered && issue.kind !== 'structure' && (
        <dl className="mt-stack-sm grid grid-cols-2 gap-inline-md">
          <Value label="Design expects" text={issue.expectedText} swatch={issue.swatches?.expected} />
          <Value label="React renders" text={issue.actualText} swatch={issue.swatches?.actual} />
        </dl>
      )}
      <p className="mt-stack-sm text-body-m text-secondary">{issue.explanation}</p>
      <dl className="mt-stack-sm grid gap-stack-xs">
        <div>
          <dt className="text-label-s text-secondary">Design source</dt>
          <dd className={mono}>{[...new Set(issue.rows.map((row) => bracket(row.figmaSource)))].slice(0, 3).join(' · ')}</dd>
        </div>
        <div>
          <dt className="text-label-s text-secondary">Code source</dt>
          <dd className={mono}>{codeSources.slice(0, 2).join(' · ')}{codeSources.length > 2 ? ` · +${codeSources.length - 2} more` : ''}</dd>
        </div>
      </dl>
      {tokenHint}
      {issue.status === 'DRIFT' && (
        <div className="mt-stack-sm rounded-control bg-accent-subtle p-inset-sm text-body-m text-accent-subtle-text">
          <span className="text-label-m">Suggested resolution. </span>
          {resolution ?? 'No automatic patch exists for this kind of difference. Review it by hand.'}
        </div>
      )}
      <details className="mt-stack-sm">
        <summary className="cursor-pointer text-label-m text-link">Technical details ({issue.rows.length} engine {issue.rows.length === 1 ? 'check' : 'checks'})</summary>
        <div className="mt-stack-xs">
          <Json value={issue.rows} />
        </div>
      </details>
    </li>
  )
}

export function IssueList({ issues, resolutions, tokenHints }: { issues: Issue[]; resolutions: Partial<Record<Issue['kind'], string>>; tokenHints: Partial<Record<Issue['kind'], ReactNode>> }) {
  const open = issues.filter((i) => i.status !== 'MATCH').sort((a, b) => statusRank[a.status] - statusRank[b.status])
  const matching = issues.filter((i) => i.status === 'MATCH')
  return (
    <div className="flex flex-col gap-stack-sm">
      <ul className="flex flex-col gap-stack-sm">
        {open.map((issue) => <IssueCard key={issue.kind} issue={issue} resolution={resolutions[issue.kind]} tokenHint={tokenHints[issue.kind]} />)}
      </ul>
      {matching.length > 0 && (
        <details className="rounded-card border-(length:--border-width-default) border-default bg-surface p-inset-lg">
          <summary className="cursor-pointer text-label-m text-primary">
            <StatusBadge status="MATCH" /> <span className="ml-inline-xs">{matching.map((i) => i.title).join(', ')}</span>
          </summary>
          <ul className="mt-stack-sm flex flex-col gap-stack-xs text-body-m text-secondary">
            {matching.map((i) => (
              <li key={i.kind}><span className="text-label-m text-primary">{i.title}</span>: {i.expectedText} in the design and {i.actualText} in React</li>
            ))}
          </ul>
        </details>
      )}
    </div>
  )
}

export function RawReport({ report }: { report: EngineReport }) {
  return (
    <details>
      <summary className="cursor-pointer text-label-m text-link">Raw engine report (JSON)</summary>
      <div className="mt-stack-xs"><Json value={report} /></div>
    </details>
  )
}

const lineStyle: Record<DiffLine['type'], string> = {
  same: 'text-secondary',
  add: 'bg-status-success-bg text-status-success-text',
  remove: 'bg-status-danger-bg text-status-danger-text',
}
const sign: Record<DiffLine['type'], string> = { same: ' ', add: '+', remove: '−' }

export function PatchPlan({ fix }: { fix: FixRun }) {
  if (!fix.plan.patches.length) return null
  return (
    <div className="flex flex-col gap-stack-sm">
      <p className="text-body-m text-secondary">
        Illustrative patch plan, generated by diffing the sandbox source text in memory. It is not applied to your repository.
      </p>
      {fix.plan.patches.map((patch) => (
        <figure key={patch.file} className="overflow-hidden rounded-control border-(length:--border-width-default) border-default">
          <figcaption className="border-b-(length:--border-width-default) border-default bg-surface-secondary px-inset-sm py-inset-xs text-code text-primary">{patch.file}</figcaption>
          <pre className="overflow-x-auto bg-surface py-inset-xs text-code">
            {patch.lines.map((line, index) => (
              <div key={index} className={`px-inset-sm whitespace-pre ${lineStyle[line.type]}`}>{sign[line.type]} {line.text}</div>
            ))}
          </pre>
        </figure>
      ))}
    </div>
  )
}

export function FixResults({ fix }: { fix: FixRun }) {
  return (
    <section aria-labelledby="fix-heading" className="rounded-card border-(length:--border-width-default) border-default bg-surface-secondary p-inset-lg">
      <div className="flex flex-wrap items-center justify-between gap-inline-sm">
        <h3 id="fix-heading" className="text-title-m text-primary">Simulated fix</h3>
        <span className="rounded-chip bg-status-info-bg px-inset-xs text-label-s text-status-info-text">Simulation only. Nothing is written to files, tokens, Figma or Git.</span>
      </div>
      <div className="mt-stack-sm grid gap-stack-md tablet:grid-cols-2">
        <div className="flex flex-col gap-stack-sm">
          <h4 className="text-title-s text-primary">Applied in memory</h4>
          {fix.plan.steps.length ? (
            <ul className="list-disc pl-inset-lg text-body-m text-primary">
              {fix.plan.steps.map((step) => <li key={step.issue}>{step.description}</li>)}
            </ul>
          ) : <p className="text-body-m text-secondary">The engine found nothing this simulation could patch.</p>}
          {fix.plan.unsupported.length > 0 && (
            <p className="text-body-m text-secondary">No automatic patch for: {fix.plan.unsupported.map((u) => u.issue).join(', ')}. These stay as reported.</p>
          )}
          <h4 className="mt-stack-xs text-title-s text-primary">Engine rerun on the updated implementation</h4>
          <Counts summary={fix.report.summary} label="Counts after the simulated fix" />
          <ul className="flex flex-col gap-stack-xs text-body-m text-primary">
            {fix.outcomes.map((o) => (
              <li key={o.kind} className="flex items-center justify-between gap-inline-sm">
                <span>{o.title}</span>
                <span className="flex items-center gap-inline-xs">
                  <StatusBadge status={o.before} />
                  <span aria-hidden="true">→</span>
                  <span className="sr-only">became</span>
                  <StatusBadge status={o.after} />
                </span>
              </li>
            ))}
          </ul>
          <p className="text-body-m text-secondary">
            Still NOT CHECKED: rendered appearance, typography, interaction states and external CSS. This engine does not verify them, so the fix does not claim to.
          </p>
        </div>
        <PatchPlan fix={fix} />
      </div>
      <p className="mt-stack-sm text-code text-secondary">Files read, never changed: {IMPLEMENTATION_FILES.css}, {IMPLEMENTATION_FILES.baseline}, {IMPLEMENTATION_FILES.illustrated}</p>
    </section>
  )
}

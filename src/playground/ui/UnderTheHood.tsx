import { useMemo } from 'react'
import type { ReactNode } from 'react'
import { summarizeRules, tokenChain } from '../model/governance.ts'
import type { DriftResult } from '../model/governance.ts'
import evidenceJson from '../evidence/evidence.json'

interface TestName { ok: boolean; name: string }
interface Run {
  id: string
  label: string
  command: string
  exitCode: number | null
  output?: string
  tests?: { total: number; pass: number; fail: number; names: TestName[] }
}
interface Evidence { capturedAt: string; node: string; commit: string; branch: string; runs: Run[] }
const evidence = evidenceJson as unknown as Evidence

const STORYBOOK = 'https://vandana-thota.github.io/design-system/'
const STORIES = [
  { label: 'Button / Primary', id: 'components-button--primary' },
  { label: 'Button / Full width', id: 'components-button--full-width' },
  { label: 'Card / Default', id: 'components-card--default' },
  { label: 'Card / Theme check (dark)', id: 'components-card--theme-check-dark' },
]

const box = 'min-w-0 rounded-card border-(length:--border-width-default) border-default bg-surface p-inset-lg'
const code = 'text-code text-primary'

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className={box}>
      <h3 className="text-title-s text-primary">{title}</h3>
      <div className="mt-stack-sm flex flex-col gap-stack-sm text-body-m text-secondary">{children}</div>
    </section>
  )
}

const date = (iso: string) => new Date(iso).toISOString().slice(0, 10)

const FLOW = [
  ['Design specification', 'sanitized snapshot + your edits'],
  ['Mapping', 'design layers ↔ CSS selectors'],
  ['Comparison engine', 'packages/figma-card-engine'],
  ['Structured findings', 'MATCH / DRIFT / NOT CHECKED rows'],
  ['This UI', 'grouped issues, patch plan'],
]

const LIMITATIONS = [
  'The Figma comparison covers one component (the card) and the properties listed in the report: button background, corner radii, paddings, content gap and layout direction, plus the element structure.',
  'The design is a sanitized snapshot, not a live Figma read. Your edits change an in-memory copy. The private tool that reads Figma live is not part of this page.',
  'The engine reads plain CSS and static JSX. It cannot read the Tailwind classes used by the design system’s own Button and Card, so the sandbox card is written in plain CSS and uses design-system tokens for everything the engine does not compare.',
  'Rendered appearance, typography, interaction states and external CSS are not verified. The report keeps them as NOT CHECKED.',
  'Simulate fix changes copies of source text in memory. It is a demonstration of a patch, not an automated code change, and only three kinds of difference have a patch.',
  'The command output and test counts below are a captured run (dated), not a live run in your browser. The DS001–DS007 table above them is live.',
]

export function UnderTheHood({ governance }: { governance: DriftResult }) {
  const rules = useMemo(() => summarizeRules(governance), [governance])
  const chain = useMemo(() => tokenChain(governance, 'component.button.primary.bg'), [governance])
  const layers = ['primitive', 'semantic', 'component'].map((layer) => [layer, governance.ctx.tokens.filter((t) => t.layer === layer).length] as const)
  const cli = evidence.runs.find((r) => r.id === 'drift-cli')
  const suites = evidence.runs.filter((r) => r.tests)
  const finalValue = chain.length ? governance.ctx.resolve(governance.ctx.byPath.get(chain[0].path)!) : ''
  const captured = `Captured ${date(evidence.capturedAt)} at commit ${evidence.commit} on Node ${evidence.node}`

  return (
    <details className="rounded-card border-(length:--border-width-default) border-default bg-surface-secondary p-inset-lg">
      <summary className="cursor-pointer text-title-m text-primary">Under the hood</summary>
      <p className="mt-stack-xs text-body-m text-secondary">
        Everything here comes from this repository. Live means it ran in your browser just now. Captured means it is real output saved on the date shown.
      </p>
      <div className="mt-stack-md grid gap-stack-sm">
        <Block title="How a check flows">
          <ol className="flex flex-wrap items-stretch gap-inline-sm">
            {FLOW.map(([name, note], index) => (
              <li key={name} className="flex items-center gap-inline-sm">
                <div className="rounded-control border-(length:--border-width-default) border-default bg-surface px-inset-sm py-inset-xs">
                  <div className="text-label-m text-primary">{name}</div>
                  <div className="text-caption text-secondary">{note}</div>
                </div>
                {index < FLOW.length - 1 && <span aria-hidden="true" className="text-secondary">→</span>}
              </li>
            ))}
          </ol>
        </Block>

        <Block title="Token architecture: primitive → semantic → component">
          <p>
            Live from tokens/tokens.json: {layers.map(([layer, n]) => `${n} ${layer}`).join(', ')} tokens. Components use component and semantic tokens only, never primitives or hex values; rule DS004 enforces it.
          </p>
          <ol className="flex flex-wrap items-center gap-inline-xs">
            {chain.map((step, index) => (
              <li key={step.path} className="flex items-center gap-inline-xs">
                <code className={`rounded-chip bg-surface px-inset-xs ${code}`}>{step.path}</code>
                {index < chain.length - 1 && <span aria-hidden="true">→</span>}
              </li>
            ))}
            <li className="flex items-center gap-inline-xs"><span aria-hidden="true">→</span><code className={`rounded-chip bg-surface px-inset-xs ${code}`}>{finalValue}</code></li>
          </ol>
          <p>The real Button and Card read component tokens such as <code className={code}>--button-primary-bg</code> and <code className={code}>--card-bg</code>. The sandbox card uses the same tokens for everything the engine does not compare.</p>
        </Block>

        <Block title="DS001–DS007 token checker">
          <p>
            Live: the same checker as <code className={code}>npm run drift</code> ran in your browser on this repository’s files and found {governance.errors} errors, {governance.warnings} warnings and {governance.allowed} allowed exceptions (each allowed exception has a written reason).
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-body-m">
              <thead><tr className="text-label-s text-secondary"><th className="py-inset-xs pr-inset-md">Rule</th><th className="pr-inset-md">Name</th><th className="pr-inset-md">Severity</th><th className="tabular pr-inset-md">Open</th><th className="tabular">Allowed</th></tr></thead>
              <tbody>
                {rules.map((rule) => (
                  <tr key={rule.id} className="border-t-(length:--border-width-default) border-default text-primary">
                    <td className="py-inset-xs pr-inset-md text-code">{rule.id}</td><td className="pr-inset-md">{rule.name}</td><td className="pr-inset-md">{rule.severity}</td>
                    <td className="tabular pr-inset-md">{rule.open}</td><td className="tabular">{rule.allowed}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {cli?.output && (
            <details>
              <summary className="cursor-pointer text-label-m text-link">Sample real CLI output: <code>{cli.command}</code></summary>
              <p className="mt-stack-xs text-caption">{captured}. Exit code {cli.exitCode}.</p>
              <pre className="mt-stack-xs max-h-72 overflow-auto rounded-control bg-surface p-inset-sm text-code text-primary">{cli.output}</pre>
            </details>
          )}
        </Block>

        <Block title="In-memory checker adapter">
          <p>
            The checker was split in two. <code className={code}>scripts/drift/core.mjs</code> takes everything as plain data and uses no Node-only code, so it runs in a browser. <code className={code}>scripts/drift/index.mjs</code> reads the project from disk and calls it, so the command line behaves as before.
          </p>
          <pre className="overflow-x-auto rounded-control bg-surface p-inset-sm text-code text-primary">{`checkInputs(
  { tokens, generated: { 'tailwind.css', 'type.css' }, files: [{ file, text }], allowlist, spec },
  { rule, strict }
)`}</pre>
          <p>A test runs the real project through both paths and requires identical findings.</p>
        </Block>

        <Block title="Real test coverage">
          <p>{captured}. Run again with <code className={code}>npm run playground:evidence</code>.</p>
          <ul className="flex flex-col gap-stack-xs">
            {suites.map((run) => (
              <li key={run.id}>
                <details>
                  <summary className="cursor-pointer text-primary">
                    <span className="text-label-m">{run.label}</span>: <span className="tabular">{run.tests!.pass}/{run.tests!.total}</span> passed <span className="text-code text-secondary">({run.command})</span>
                  </summary>
                  <ul className="mt-stack-xs list-disc pl-inset-lg text-body-s">
                    {run.tests!.names.map((t) => <li key={t.name}>{t.ok ? '✔' : '✖'} {t.name}</li>)}
                  </ul>
                </details>
              </li>
            ))}
          </ul>
        </Block>

        <Block title="Limitations">
          <ul className="list-disc pl-inset-lg">
            {LIMITATIONS.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </Block>

        <Block title="Storybook">
          <p>The design-system components behind the tokens, in the deployed Storybook (opens in a new tab).</p>
          <ul className="flex flex-wrap gap-x-inline-lg gap-y-stack-xs">
            {STORIES.map((story) => (
              <li key={story.id}><a className="text-link underline" href={`${STORYBOOK}?path=/story/${story.id}`} target="_blank" rel="noreferrer">{story.label}</a></li>
            ))}
          </ul>
        </Block>
      </div>
    </details>
  )
}

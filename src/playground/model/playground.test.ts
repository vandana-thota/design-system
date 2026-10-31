// Tests for the drift playground logic. Run with: npm run playground:test
// They use the real engines, the real sanitized snapshot and the real sandbox source files. Nothing is mocked.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { readInputs } from '../../../scripts/drift/index.mjs'
import { buildEvidence, BASELINE_DESIGN } from './design.ts'
import type { Design, Evidence } from './design.ts'
import { initialImplementation, IMPLEMENTATION_FILES } from './implementation.ts'
import { runDriftCheck } from './check.ts'
import { groupIssues } from './report.ts'
import { hasDrift, initialSession, isStale, reduce } from './session.ts'
import type { Environment, Session } from './session.ts'
import { lineDiff } from './diff.ts'
import { runGovernance, summarizeRules, tokenChain, tokensForHex } from './governance.ts'

const ROOT = new URL('../../../', import.meta.url).pathname
const read = (file: string) => fs.readFileSync(ROOT + file, 'utf8')

const env: Environment = {
  base: JSON.parse(read('packages/figma-card-engine/snapshots/atlas-card.v1.json')) as Evidence,
  sources: {
    css: read(IMPLEMENTATION_FILES.css),
    baselineJsx: read(IMPLEMENTATION_FILES.baseline),
    illustratedJsx: read(IMPLEMENTATION_FILES.illustrated),
  },
}

const edit = (session: Session, patch: Partial<Design>) => reduce(session, { type: 'edit', patch }, env)
const run = (session: Session) => reduce(session, { type: 'run' }, env)
const rowsWith = (session: Session, status: string) => session.check!.report.results.filter((r) => r.status === status).map((r) => r.property)

test('baseline: the design and the implementation match, and rendered appearance stays NOT CHECKED', () => {
  const session = run(initialSession(env))
  assert.deepEqual(session.check!.report.summary, { MATCH: 16, DRIFT: 0, 'NOT CHECKED': 1 })
  assert.deepEqual(rowsWith(session, 'NOT CHECKED'), ['Rendered appearance / external CSS / typography'])
  assert.equal(hasDrift(session), false)
})

test('the baseline implementation is blue #2563EB with a 12px radius and no illustration', () => {
  const impl = initialImplementation(env.sources)
  assert.match(impl.css, /--atlas-action-bg:\s*#2563EB;/)
  assert.match(impl.css, /--atlas-radius:\s*12px;/)
  assert.equal(impl.structure, 'baseline')
  assert.doesNotMatch(env.sources.baselineJsx, /atlas-card__illustration/)
})

test('color drift: purple and green are reported with the expected and actual colour', () => {
  for (const [hex, name] of [['#7C3AED', 'purple'], ['#047857', 'green']]) {
    const session = run(edit(initialSession(env), { color: hex }))
    const issue = session.check!.issues.find((i) => i.kind === 'color')!
    assert.equal(issue.status, 'DRIFT', name)
    assert.deepEqual(issue.swatches, { expected: hex, actual: '#2563EB' }, name)
    assert.equal(session.check!.report.summary.DRIFT, 1, name)
  }
})

test('radius drift: 8px and 20px drift on all four corners, 12px matches', () => {
  for (const radius of [8, 20]) {
    const session = run(edit(initialSession(env), { radius }))
    const issue = session.check!.issues.find((i) => i.kind === 'radius')!
    assert.equal(issue.status, 'DRIFT')
    assert.equal(issue.rows.length, 4)
    assert.equal(issue.expectedText, `${radius}px`)
    assert.equal(issue.actualText, '12px')
    assert.equal(session.check!.report.summary.DRIFT, 4)
  }
  assert.equal(run(edit(initialSession(env), { radius: 12 })).check!.report.summary.DRIFT, 0)
})

test('illustration drift: the design layer has no matching React element, named in plain words', () => {
  const session = run(edit(initialSession(env), { illustration: true }))
  const issue = session.check!.issues.find((i) => i.kind === 'structure')!
  assert.equal(issue.status, 'DRIFT')
  assert.deepEqual(issue.structure!.extraInCode, [])
  assert.equal(issue.structure!.missingInCode.length, 1)
  assert.match(issue.explanation, /“Illustration” layer/)
  assert.match(issue.explanation, /does not render it/)
})

test('several edits at once give one issue each, and the engine rows are left untouched by grouping', () => {
  const session = run(edit(initialSession(env), { color: '#047857', radius: 20, illustration: true }))
  const drifting = session.check!.issues.filter((i) => i.status === 'DRIFT').map((i) => i.kind).sort()
  assert.deepEqual(drifting, ['color', 'radius', 'structure'])
  assert.equal(session.check!.report.summary.DRIFT, 6) // 1 colour + 4 corners + 1 structure
  assert.equal(session.check!.issues.flatMap((i) => i.rows).length, session.check!.report.results.length)
})

test('editing the design never changes the implementation, and old results are flagged stale', () => {
  const before = run(initialSession(env))
  const after = edit(before, { color: '#7C3AED', radius: 20, illustration: true })
  assert.deepEqual(after.implementation, before.implementation)
  assert.equal(isStale(after), true)
  assert.equal(isStale(before), false)
})

test('simulate fix: patches an in-memory copy, reruns the engine and resolves what it can', () => {
  const drifted = run(edit(initialSession(env), { color: '#7C3AED', radius: 20, illustration: true }))
  const fixed = reduce(drifted, { type: 'simulate' }, env)
  const fix = fixed.fix!
  assert.deepEqual(fix.plan.steps.map((s) => s.issue).sort(), ['color', 'radius', 'structure'])
  assert.match(fixed.implementation.css, /--atlas-action-bg:\s*#7C3AED;/)
  assert.match(fixed.implementation.css, /--atlas-radius:\s*20px;/)
  assert.equal(fixed.implementation.structure, 'illustrated')
  assert.deepEqual(fix.report.summary, { MATCH: 16, DRIFT: 0, 'NOT CHECKED': 1 })
  assert.deepEqual(fix.outcomes.filter((o) => o.outcome === 'resolved').map((o) => o.kind).sort(), ['color', 'radius', 'structure'])
  assert.deepEqual(fix.outcomes.filter((o) => o.outcome === 'not checked').map((o) => o.kind), ['rendered'])
  // The patch plan is a real diff of the real strings.
  const cssPatch = fix.plan.patches.find((p) => p.file === IMPLEMENTATION_FILES.css)!
  assert.ok(cssPatch.lines.some((l) => l.type === 'add' && l.text.includes('#7C3AED')))
  assert.ok(cssPatch.lines.some((l) => l.type === 'remove' && l.text.includes('#2563EB')))
  const jsxPatch = fix.plan.patches.find((p) => p.file === IMPLEMENTATION_FILES.illustrated)!
  assert.ok(jsxPatch.lines.some((l) => l.type === 'add' && l.text.includes('atlas-card__illustration')))
})

test('simulate fix can also remove an illustration the code has but the design does not', () => {
  const fixed = reduce(run(edit(initialSession(env), { illustration: true })), { type: 'simulate' }, env)
  const undone = reduce(run(edit(fixed, { illustration: false })), { type: 'simulate' }, env)
  assert.equal(undone.implementation.structure, 'baseline')
  assert.equal(undone.fix!.report.summary.DRIFT, 0)
})

test('simulate fix never writes to disk: the source files are byte-for-byte unchanged', () => {
  const before = [IMPLEMENTATION_FILES.css, IMPLEMENTATION_FILES.baseline, IMPLEMENTATION_FILES.illustrated, 'tokens/tokens.json', 'packages/figma-card-engine/snapshots/atlas-card.v1.json'].map(read)
  reduce(run(edit(initialSession(env), { color: '#047857', radius: 8, illustration: true })), { type: 'simulate' }, env)
  const after = [IMPLEMENTATION_FILES.css, IMPLEMENTATION_FILES.baseline, IMPLEMENTATION_FILES.illustrated, 'tokens/tokens.json', 'packages/figma-card-engine/snapshots/atlas-card.v1.json'].map(read)
  assert.deepEqual(after, before)
  assert.equal(env.base.document.children!.length, 1) // the snapshot object itself was not edited either
})

test('simulate fix does nothing when the results are stale or there is nothing to fix', () => {
  const session = run(initialSession(env))
  assert.equal(reduce(session, { type: 'simulate' }, env).fix?.plan.steps.length, 0)
  const stale = edit(session, { radius: 20 })
  assert.equal(reduce(stale, { type: 'simulate' }, env), stale)
})

test('reset returns to the blue, no-illustration, 12px baseline and clears findings and fixes', () => {
  const messy = reduce(run(edit(initialSession(env), { color: '#047857', radius: 20, illustration: true })), { type: 'simulate' }, env)
  const reset = reduce(messy, { type: 'reset' }, env)
  assert.deepEqual(reset.design, BASELINE_DESIGN)
  assert.deepEqual(reset.implementation, initialImplementation(env.sources))
  assert.equal(reset.check, null)
  assert.equal(reset.fix, null)
  assert.deepEqual(run(reset).check!.report.summary, { MATCH: 16, DRIFT: 0, 'NOT CHECKED': 1 })
})

test('grouping does not hide NOT CHECKED: an unreadable stylesheet is reported, never matched', () => {
  const evidence = buildEvidence(env.base, BASELINE_DESIGN)
  const broken = { ...initialImplementation(env.sources), css: env.sources.css + '\n@media (width < 600px) { .atlas-card { padding: 0; } }' }
  const report = runDriftCheck(evidence, broken, env.sources)
  assert.equal(report.summary.MATCH < 16, true)
  assert.ok(groupIssues(report).some((i) => i.status === 'NOT CHECKED' && i.kind !== 'rendered'))
})

test('line diff marks added and removed lines', () => {
  const lines = lineDiff('a\nb\nc', 'a\nx\nc')
  assert.deepEqual(lines.map((l) => l.type), ['same', 'remove', 'add', 'same'])
})

test('token governance runs on in-memory project files and agrees with the CLI-style disk run', () => {
  const inputs = readInputs(ROOT)
  const result = runGovernance(inputs)
  const summary = summarizeRules(result)
  assert.deepEqual(summary.slice(0, 7).map((s) => s.id), ['DS001', 'DS002', 'DS003', 'DS004', 'DS005', 'DS006', 'DS007'])
  assert.equal(summary.reduce((n, s) => n + s.open, 0), result.errors + result.warnings)
  assert.equal(summary.reduce((n, s) => n + s.allowed, 0), result.allowed)
  assert.equal(result.errors, 0)
})

test('the playground is demo scaffolding: it is not governed, so it cannot change the design system results', () => {
  const inputs = readInputs(ROOT)
  assert.equal(inputs.files.some((f) => f.file.startsWith('src/playground/')), false)
  assert.ok(inputs.files.some((f) => f.file === 'src/components/Button/Button.tsx')) // real components still are
  const withDemoChanges = { ...inputs, files: [...inputs.files, { file: IMPLEMENTATION_FILES.css, text: ':root { --button-ghost-text: red; }' }] }
  assert.deepEqual(runGovernance(withDemoChanges).findings, runGovernance(inputs).findings)
})

test('token lookup: the sandbox blue is not a design token, the brand cobalt is', () => {
  const result = runGovernance(readInputs(ROOT))
  assert.deepEqual(tokensForHex(result, '#2563EB'), [])
  assert.ok(tokensForHex(result, '#3559E8').includes('semantic.color.accent.default'))
  assert.deepEqual(tokenChain(result, 'component.button.primary.bg').map((s) => s.path), ['component.button.primary.bg', 'semantic.color.accent.default', 'primitive.color.cobalt.500'])
})

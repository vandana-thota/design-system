// Tests for the drift checker. Run with: npm run drift:test
// Each test builds a tiny throwaway project that is clean, plants one known problem, and checks that
// the matching rule (and only that rule, via the `rule` option) reports it.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { check } from './index.mjs'

const tok = (type, value, extra = {}) => ({ $type: type, $value: value, ...extra })
const TOKENS = {
  primitive: { color: { sand: { 0: tok('color', '#FFFFFF'), 900: tok('color', '#111111') } }, space: { 100: tok('dimension', '0.5rem') } },
  semantic: {
    color: { bg: { surface: tok('color', '{primitive.color.sand.0}', { $extensions: { mode: { dark: '{primitive.color.sand.900}' } } }) } },
    space: { 'inset-sm': tok('dimension', '{primitive.space.100}') },
  },
  component: { button: { bg: tok('color', '{semantic.color.bg.surface}'), padding: tok('dimension', '{semantic.space.inset-sm}') } },
}
const SPEC = `## 1. Primitive tokens
| Token | Hex |
|---|---|
| sand-0 | #FFFFFF |
| sand-900 | #111111 |

| Token | px |
|---|---|
| space-100 | 8 |

## 2. Semantic tokens
| Token | Light | Dark |
|---|---|---|
| color.bg.surface | sand-0 | sand-900 |

| Token | Value |
|---|---|
| inset-sm | space-100 |

## 3. Component tokens
- Button: \`button-bg\`, \`button-padding\`
`
const button = (classes = '') => `export const Button = () => <button className="bg-(--button-bg) p-(--button-padding) ${classes}" />\n`

const BASE = {
  'tokens/tokens.json': JSON.stringify(TOKENS),
  'docs/tokens-spec.md': SPEC,
  'src/styles/tokens/tailwind.css': '@theme inline {\n  --color-surface: var(--color-bg-surface);\n}\n',
  'src/components/Button/Button.tsx': button(),
  'src/components/Button/Button.stories.tsx': 'export default {}\n',
}

// Writes a throwaway project: the clean BASE plus any changed files.
function run(changes = {}, opts = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'drift-'))
  for (const [file, text] of Object.entries({ ...BASE, ...changes })) {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true })
    fs.writeFileSync(path.join(root, file), text)
  }
  return check({ rule: null, strict: false, all: false, ...opts, root })
}
const tokens = (edit) => {
  const t = structuredClone(TOKENS)
  edit(t)
  return { 'tokens/tokens.json': JSON.stringify(t) }
}
const messages = (r) => r.findings.filter((f) => !f.allowed).map((f) => f.message)

test('a clean project has no findings and exits 0', () => {
  const r = run()
  assert.deepEqual(messages(r), [])
  assert.equal(r.exitCode, 0)
})

// [name, rule, changed files, text the planted problem's message must contain]
const PLANTED = [
  ['DS001 dead token', 'DS001', tokens((t) => { t.primitive.space[999] = tok('dimension', '9rem') }), 'primitive.space.999 is never used'],
  ['DS002 duplicate primitive', 'DS002', tokens((t) => { t.primitive.space[200] = tok('dimension', '0.5rem') }), 'primitive.space.100 and primitive.space.200'],
  ['DS003 hex color', 'DS003', { 'src/components/Button/Button.tsx': button('bg-[#ff0000]') }, 'hex color "#ff0000"'],
  ['DS003 px value', 'DS003', { 'src/components/Button/Button.tsx': button('w-[calc(var(--button-padding)_+_4px)]') }, 'arbitrary Tailwind value'],
  ['DS003 !important', 'DS003', { 'src/components/Button/Button.tsx': button('!important') }, '!important'],
  ['DS004 primitive in component code', 'DS004', { 'src/components/Button/Button.tsx': button('bg-(--prim-color-sand-0)') }, 'primitive.color.sand.0'],
  ['DS004 primitive in tokens.json', 'DS004', tokens((t) => { t.component.button.bg.$value = '{primitive.color.sand.0}' }), 'points straight at the primitive'],
  ['DS005 unknown variable', 'DS005', { 'src/components/Button/Button.tsx': button('bg-(--button-nope)') }, '--button-nope'],
  ['DS005 broken alias', 'DS005', tokens((t) => { t.component.button.padding.$value = '{semantic.space.nope}' }), 'does not exist'],
  ['DS006 name only in the spec', 'DS006', { 'docs/tokens-spec.md': SPEC.replace('| sand-900 | #111111 |', '| sand-900 | #111111 |\n| sand-950 | #000000 |') }, 'sand-950 (primitive) is in the spec but not in tokens.json'],
  ['DS006 token only in tokens.json', 'DS006', tokens((t) => { t.primitive.space[300] = tok('dimension', '1.5rem') }), 'primitive.space.300 is in tokens.json but not in the spec'],
  ['DS007 component without story', 'DS007', { 'src/components/Card/Card.tsx': 'export const Card = () => null\n' }, 'Component Card has no story'],
  ['DS007 story without component', 'DS007', { 'src/components/Orphan/Orphan.stories.tsx': 'export default {}\n' }, 'have no component'],
]
for (const [name, rule, changes, expected] of PLANTED) {
  test(`${name}: ${rule} reports it`, () => {
    const found = messages(run(changes, { rule }))
    assert.ok(found.some((m) => m.includes(expected)), `expected "${expected}" in ${JSON.stringify(found)}`)
  })
}

test('DS003 allows bracket values made only of token variables', () => {
  const only = run({ 'src/components/Button/Button.tsx': button('p-[calc(var(--button-padding)_+_var(--button-bg))]') }, { rule: 'DS003' })
  assert.deepEqual(messages(only), [])
  // A bare number is a hardcoded value, so it is still reported.
  const number = run({ 'src/components/Button/Button.tsx': button('p-[calc(var(--button-padding)_*_2)]') }, { rule: 'DS003' })
  assert.equal(messages(number).length, 1)
})

test('classes count as a use only when exactly one token owns them', () => {
  // bg-surface belongs to color.bg.surface alone, so it counts as a use.
  const exact = run({ 'src/components/Button/Button.tsx': 'export const B = () => <b className="bg-surface" />\n' })
  assert.ok(exact.ctx.usedInCode(exact.ctx.byPath.get('semantic.color.bg.surface')))
  // shadow-glow is both a shadow color and a shadow size, so it counts as a use of neither.
  const amb = run({
    ...tokens((t) => {
      t.semantic.color.bg.glow = tok('color', '{primitive.color.sand.0}')
      t.semantic.elevation = { glow: tok('elevation', { surface: '{semantic.color.bg.surface}', shadow: 'none' }) }
    }),
    'src/styles/tokens/tailwind.css': '@theme inline {\n  --color-glow: var(--color-bg-glow);\n  --shadow-glow: var(--elevation-glow-shadow);\n}\n',
    'src/components/Button/Button.tsx': 'export const B = () => <b className="shadow-glow" />\n',
  })
  assert.deepEqual(amb.ctx.lookup.ambiguous.map((a) => a.key), ['shadow-glow'])
  assert.ok(!amb.ctx.usedInCode(amb.ctx.byPath.get('semantic.color.bg.glow')))
  assert.ok(!amb.ctx.usedInCode(amb.ctx.byPath.get('semantic.elevation.glow')))
})

test('allowlist: a reasoned entry allows a finding, a bad or stale entry is reported', () => {
  const planted = { 'src/components/Button/Button.tsx': button('bg-[#ff0000]') }
  const entry = { rule: 'DS003', match: '#ff0000', reason: 'test' }
  const allow = (...entries) => ({ ...planted, 'drift.allowlist.json': JSON.stringify({ entries }) })

  const ok = run(allow(entry, { rule: 'DS003', match: '#ff0000', reason: 'test' }), { rule: 'DS003' })
  assert.equal(ok.exitCode, 0)
  assert.equal(ok.allowed, 2)

  const noReason = run(allow({ ...entry, reason: ' ' }), { rule: 'DS003' })
  assert.equal(noReason.exitCode, 1)
  assert.ok(messages(noReason).some((m) => m.includes('needs a rule, a reason')))

  const stale = run(allow({ rule: 'DS003', match: 'never-happens', reason: 'test' }), { rule: 'DS003' })
  assert.ok(stale.findings.some((f) => f.rule === 'ALLOWLIST' && f.severity === 'warning'))
})

test('allowlist: a token ending in * covers a group, and warns when it covers nothing', () => {
  const dead = tokens((t) => { t.primitive.space[999] = tok('dimension', '9rem'); t.primitive.space[998] = tok('dimension', '9rem') })
  const allow = (token) => ({ ...dead, 'drift.allowlist.json': JSON.stringify({ entries: [{ rule: 'DS001', token, reason: 'test' }] }) })

  const group = run(allow('primitive.space.99*'), { rule: 'DS001' })
  assert.equal(group.allowed, 2)
  assert.equal(group.warnings, 0)

  const none = run(allow('primitive.nothing.*'), { rule: 'DS001' })
  assert.equal(none.allowed, 0)
  assert.ok(none.findings.some((f) => f.rule === 'ALLOWLIST' && f.severity === 'warning'))
})

test('exit codes: warnings pass, --strict fails on warnings, errors fail', () => {
  const warn = tokens((t) => { t.primitive.space[999] = tok('dimension', '9rem') })
  assert.equal(run(warn, { rule: 'DS001' }).exitCode, 0)
  assert.equal(run(warn, { rule: 'DS001', strict: true }).exitCode, 1)
  assert.equal(run({ 'src/components/Button/Button.tsx': button('bg-[#ff0000]') }, { rule: 'DS003' }).exitCode, 1)
})

test('an unknown rule is an error', () => {
  assert.throws(() => run({}, { rule: 'DS999' }), /Unknown rule/)
})

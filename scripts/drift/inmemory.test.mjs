// Tests for running the drift checker on in-memory input (no files). Run with: npm run drift:test
// The core must give the same answer as the file-based check, and must not need the file system.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { check, checkInputs, readInputs } from './index.mjs'

const ROOT = new URL('../../', import.meta.url).pathname
const here = (name) => fs.readFileSync(new URL(name, import.meta.url), 'utf8')

const tok = (type, value, extra = {}) => ({ $type: type, $value: value, ...extra })
const inputs = (changes = {}) => ({
  tokens: {
    primitive: { color: { sand: { 0: tok('color', '#FFFFFF'), 900: tok('color', '#111111') } } },
    semantic: { color: { bg: { surface: tok('color', '{primitive.color.sand.0}', { $extensions: { mode: { dark: '{primitive.color.sand.900}' } } }) } } },
    component: { button: { bg: tok('color', '{semantic.color.bg.surface}') } },
  },
  generated: { 'tailwind.css': '@theme inline {\n  --color-surface: var(--color-bg-surface);\n}\n', 'type.css': '' },
  files: [
    { file: 'src/components/Button/Button.tsx', text: 'export const Button = () => <button className="bg-(--button-bg)" />\n' },
    { file: 'src/components/Button/Button.stories.tsx', text: 'export default {}\n' },
  ],
  allowlist: null,
  spec: null,
  ...changes,
})
const live = (r) => r.findings.filter((f) => !f.allowed)

test('in-memory input gives exactly the same findings as reading the real project from disk', () => {
  const fromDisk = check({ root: ROOT, rule: null, strict: false })
  const fromMemory = checkInputs(readInputs(ROOT), { rule: null, strict: false })
  assert.deepEqual(fromMemory.findings, fromDisk.findings)
  assert.equal(fromMemory.exitCode, fromDisk.exitCode)
  assert.equal(fromMemory.errors, fromDisk.errors)
  assert.equal(fromMemory.warnings, fromDisk.warnings)
  assert.equal(fromMemory.allowed, fromDisk.allowed)
})

test('a planted hardcoded color is caught from memory alone (DS003)', () => {
  const dirty = inputs({ files: [{ file: 'src/components/Button/Button.tsx', text: 'export const Button = () => <button className="bg-[#ff0000]" />\n' }, { file: 'src/components/Button/Button.stories.tsx', text: 'export default {}\n' }] })
  const r = checkInputs(dirty, { rule: 'DS003' })
  // The rule reports the same text twice: once as a hex color, once as an arbitrary Tailwind value.
  assert.ok(r.errors >= 1)
  assert.equal(r.exitCode, 1)
  assert.ok(live(r).some((f) => /#ff0000/i.test(f.message)))
})

test('editing an in-memory token reference to a primitive is caught (DS004)', () => {
  const edited = inputs()
  edited.tokens.component.button.bg.$value = '{primitive.color.sand.0}'
  const r = checkInputs(edited, { rule: 'DS004' })
  assert.equal(r.errors, 1)
  assert.match(live(r)[0].message, /primitive/i)
})

test('the same input is not changed by the check, so a playground can re-run it', () => {
  const data = inputs()
  const before = JSON.stringify(data)
  checkInputs(data, {})
  checkInputs(data, {})
  assert.equal(JSON.stringify(data), before)
})

test('missing spec is reported as a finding, a missing generated tailwind.css is a hard error', () => {
  assert.match(live(checkInputs(inputs({ spec: null }), { rule: 'DS006' }))[0].message, /not found/)
  assert.throws(() => checkInputs(inputs({ generated: {} }), {}), /tailwind\.css is missing/)
})

test('in-memory allowlist works like the file one', () => {
  const dirty = inputs({ files: [{ file: 'src/components/Button/Button.tsx', text: 'export const Button = () => <button className="bg-[#ff0000]" />\n' }, { file: 'src/components/Button/Button.stories.tsx', text: 'export default {}\n' }] })
  const allowlist = { entries: [{ rule: 'DS003', file: 'src/components/Button/Button.tsx', reason: 'test' }] }
  const r = checkInputs({ ...dirty, allowlist }, { rule: 'DS003' })
  assert.equal(r.errors, 0)
  assert.ok(r.allowed >= 1)
})

test('the core and the rules import nothing from Node, so they can run in a browser', () => {
  for (const name of ['core.mjs', 'rules.mjs']) {
    const source = here(name)
    assert.doesNotMatch(source, /from\s+['"]node:/, `${name} must not import node: modules`)
    assert.doesNotMatch(source, /\b(fs|path|process)\./, `${name} must not use fs, path or process`)
  }
})

test('src/playground is demo scaffolding: files there are not governed and cannot make tokens look used', () => {
  const demo = { file: 'src/playground/Demo.tsx', text: 'export const Demo = () => <p className="bg-(--button-bg)" />\n' }
  const base = checkInputs(inputs(), { rule: 'DS001' })
  const withDemo = checkInputs(inputs({ files: [...inputs().files, demo] }), { rule: 'DS001' })
  assert.deepEqual(withDemo.findings, base.findings)
})

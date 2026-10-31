#!/usr/bin/env node
// Design system drift checker. Run with: npm run drift
// Flags: --rule DS003 (one rule)  --strict (warnings fail too)  --all (show every finding)
//        --root <dir> (check another project)  --json <file> (report path)  --debug (print scan stats)
// Exit codes: 0 no errors, 1 errors (or warnings with --strict), 2 the checker itself failed.
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { checkInputs, isSource } from './core.mjs'

export { checkInputs }

const unix = (p) => p.split(path.sep).join('/')

// ---- Read a project from disk into the plain data the core expects --------------------------

export function readInputs(root) {
  const text = (rel) => (fs.existsSync(path.join(root, rel)) ? fs.readFileSync(path.join(root, rel), 'utf8') : null)
  const json = (rel) => (text(rel) === null ? null : JSON.parse(text(rel)))
  const files = []
  for (const dir of ['src', '.storybook']) {
    if (!fs.existsSync(path.join(root, dir))) continue
    for (const rel of fs.readdirSync(path.join(root, dir), { recursive: true })) {
      const file = unix(path.join(dir, rel))
      if (!isSource(file) || !fs.statSync(path.join(root, file)).isFile()) continue
      files.push({ file, text: fs.readFileSync(path.join(root, file), 'utf8') })
    }
  }
  return {
    tokens: JSON.parse(fs.readFileSync(path.join(root, 'tokens/tokens.json'), 'utf8')),
    generated: { 'tailwind.css': text('src/styles/tokens/tailwind.css'), 'type.css': text('src/styles/tokens/type.css') },
    files,
    allowlist: json('drift.allowlist.json'),
    spec: text('docs/tokens-spec.md'),
  }
}

// The file-based check used by the command line and the tests.
export function check(opts) {
  return checkInputs(readInputs(opts.root), opts)
}

// ---- Terminal report ------------------------------------------------------------------------

function printReport({ findings, notes, errors, warnings, allowed }, opts) {
  const live = findings.filter((f) => !f.allowed)
  for (const id of new Set(live.map((f) => f.rule))) {
    const mine = live.filter((f) => f.rule === id)
    console.log(`\n${id} ${mine[0].name} (${mine[0].severity}): ${mine.length}`)
    const shown = mine.filter((f) => !f.quiet || opts.all)
    for (const f of shown) console.log(`  ${f.file}${f.line ? `:${f.line}` : ''}  ${f.message}`)
    if (shown.length < mine.length) console.log(`  ... and ${mine.length - shown.length} more (run with --all to see them)`)
  }
  for (const n of notes) console.log(`\nNote: ${n}`)
  const s = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`
  console.log(`\n${s(errors, 'error')}, ${s(warnings, 'warning')}, ${allowed} allowed${opts.strict ? ' (strict: warnings fail)' : ''}`)
  // In GitHub Actions, these lines turn into annotations on the pull request. Errors only, to keep it quiet.
  if (process.env.GITHUB_ACTIONS) {
    for (const f of live.filter((f) => f.severity === 'error')) console.log(`::${f.severity} file=${f.file}${f.line ? `,line=${f.line}` : ''},title=${f.rule}::${f.message}`)
  }
}

function printDebug({ ctx }) {
  const count = (l) => ctx.tokens.filter((t) => t.layer === l).length
  const kinds = ['component', 'story', 'other'].map((k) => `${k} ${ctx.files.filter((f) => f.kind === k).length}`)
  const { ambiguous, unmapped } = ctx.lookup
  console.log(`Tokens: primitive ${count('primitive')}, semantic ${count('semantic')}, component ${count('component')}`)
  console.log(`Source files: ${kinds.join(', ')}`)
  console.log(`Lookup: ${ctx.lookup.vars.size} variable names, ${ctx.lookup.classes.size} class names`)
  console.log(`CSS variables mentioned: ${ctx.usage.vars.size}; classes seen: ${ctx.usage.classes.size}`)
  console.log(`Tokens used directly in code: ${ctx.tokens.filter(ctx.usedInCode).length} of ${ctx.tokens.length}`)
  console.log(`Ambiguous (counted as a use of neither): ${ambiguous.length || 'none'}`)
  for (const a of ambiguous) console.log(`  ${a.key}${ctx.usage.vars.has(a.key) || ctx.usage.classes.has(a.key) ? ' (seen in code)' : ''} -> ${a.tokens.join(', ')}`)
  console.log(`Theme names with no token: ${unmapped.join(', ') || 'none'}`)
}

function parseArgs(argv) {
  const opts = { root: process.cwd(), rule: null, strict: false, all: false, debug: false, json: 'drift-report.json' }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--root') opts.root = path.resolve(argv[++i])
    else if (a === '--rule') opts.rule = argv[++i]
    else if (a === '--json') opts.json = argv[++i]
    else if (a === '--strict') opts.strict = true
    else if (a === '--all') opts.all = true
    else if (a === '--debug') opts.debug = true
    else throw new Error(`Unknown option ${a}`)
  }
  return opts
}

function main() {
  try {
    const opts = parseArgs(process.argv.slice(2))
    const result = check(opts)
    if (opts.debug) printDebug(result)
    printReport(result, opts)
    const { findings, notes, errors, warnings, allowed, exitCode } = result
    fs.writeFileSync(path.resolve(opts.root, opts.json), JSON.stringify({ errors, warnings, allowed, exitCode, notes, findings }, null, 2) + '\n')
    process.exit(exitCode)
  } catch (err) {
    console.error(`drift: ${err.message}`)
    process.exit(2)
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) main()

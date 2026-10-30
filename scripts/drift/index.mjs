#!/usr/bin/env node
// Design system drift checker. Run with: npm run drift
// Flags: --rule DS003 (one rule)  --strict (warnings fail too)  --all (show every finding)
//        --root <dir> (check another project)  --json <file> (report path)  --debug (print scan stats)
// Exit codes: 0 no errors, 1 errors (or warnings with --strict), 2 the checker itself failed.
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { rules } from './rules.mjs'

const unix = (p) => p.split(path.sep).join('/')

// ---- Tokens: read tokens/tokens.json into a flat list --------------------------------------

const refsIn = (v) => [...JSON.stringify(v).matchAll(/\{([\w.-]+)\}/g)].map((m) => m[1])
const kebabKey = (k) => k.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)
// Same naming as style-dictionary.config.mjs: primitives get a prim- prefix, the layer word is dropped.
const varOf = (parts) => (parts[0] === 'primitive' ? `--prim-${parts.slice(1).join('-')}` : `--${parts.slice(1).join('-')}`)

function makeToken(parts, node) {
  const composite = typeof node.$value === 'object' // type, transition, elevation: one CSS variable per field
  return {
    path: parts.join('.'), parts, layer: parts[0], group: parts[1], name: parts.slice(1).join('.'),
    type: node.$type, value: node.$value, dark: node.$extensions?.mode?.dark,
    refs: refsIn([node.$value, node.$extensions]), composite,
    vars: composite ? Object.keys(node.$value).map((k) => `${varOf(parts)}-${kebabKey(k)}`) : [varOf(parts)],
  }
}

function loadTokens(root) {
  const tokens = []
  const walk = (node, parts) => {
    for (const [k, v] of Object.entries(node)) {
      if (k.startsWith('$') || !v || typeof v !== 'object') continue
      if ('$value' in v) tokens.push(makeToken([...parts, k], v))
      else walk(v, [...parts, k])
    }
  }
  walk(JSON.parse(fs.readFileSync(path.join(root, 'tokens/tokens.json'), 'utf8')), [])
  return tokens
}

// ---- Exact lookup: CSS variable or class name -> the one token it means --------------------
// Built from the generated Tailwind theme (tailwind.css) and text-* utilities (type.css), so a
// class counts as a use only if the generated CSS really defines it. A name that could belong to
// two tokens is "ambiguous" and counts as a use of neither.

const PREFIXES = {
  color: ['bg', 'text', 'border', 'border-x', 'border-y', 'border-t', 'border-r', 'border-b', 'border-l', 'border-s', 'border-e', 'ring', 'ring-offset', 'outline', 'fill', 'stroke', 'divide', 'decoration', 'accent', 'caret', 'from', 'via', 'to', 'placeholder', 'shadow'],
  spacing: ['p', 'px', 'py', 'pt', 'pr', 'pb', 'pl', 'ps', 'pe', 'm', 'mx', 'my', 'mt', 'mr', 'mb', 'ml', 'ms', 'me', 'gap', 'gap-x', 'gap-y', 'space-x', 'space-y', 'size', 'w', 'h', 'min-w', 'min-h', 'max-w', 'max-h', 'inset', 'inset-x', 'inset-y', 'top', 'right', 'bottom', 'left', 'start', 'end', 'basis', 'translate-x', 'translate-y', 'scroll-m', 'scroll-p'],
  radius: ['rounded', 'rounded-t', 'rounded-r', 'rounded-b', 'rounded-l', 'rounded-s', 'rounded-e', 'rounded-tl', 'rounded-tr', 'rounded-br', 'rounded-bl', 'rounded-ss', 'rounded-se', 'rounded-es', 'rounded-ee'],
  shadow: ['shadow', 'inset-shadow'],
  font: ['font'],
}

function buildLookup(root, tokens) {
  const vars = new Map()
  const classes = new Map()
  const add = (map, key, tokenPath) => map.set(key, (map.get(key) ?? new Set()).add(tokenPath))
  for (const t of tokens) t.vars.forEach((v) => add(vars, v, t.path))

  const read = (f) => (fs.existsSync(path.join(root, 'src/styles/tokens', f)) ? fs.readFileSync(path.join(root, 'src/styles/tokens', f), 'utf8') : null)
  const tailwind = read('tailwind.css')
  if (tailwind === null) throw new Error('src/styles/tokens/tailwind.css is missing. Run npm run tokens first.')

  const unmapped = []
  for (const [, ns, rest, value] of tailwind.matchAll(/^\s*--(color|spacing|radius|shadow|font|breakpoint)-([\w-]+):\s*([^;]+);/gm)) {
    const name = `--${ns}-${rest}`
    // A theme variable either is a token's own variable, or points at one with var(--token).
    const target = vars.get(name) ?? vars.get(value.match(/^var\((--[\w-]+)\)$/)?.[1]) ?? (ns === 'breakpoint' ? vars.get(`--prim-breakpoint-${rest}`) : undefined)
    if (!target) { unmapped.push(name); continue }
    for (const p of [...target]) {
      add(vars, name, p)
      if (ns === 'breakpoint') ['', 'max-', 'min-'].forEach((v) => add(classes, `variant:${v}${rest}`, p))
      else PREFIXES[ns].forEach((pre) => add(classes, `${pre}-${rest}`, p))
    }
  }
  for (const [, role] of (read('type.css') ?? '').matchAll(/@utility text-([\w-]+)/g)) {
    if (tokens.some((t) => t.path === `semantic.type.${role}`)) add(classes, `text-${role}`, `semantic.type.${role}`)
    else unmapped.push(`text-${role}`)
  }
  const ambiguous = [...vars, ...classes].filter(([, s]) => s.size > 1).map(([key, s]) => ({ key, tokens: [...s] }))
  return { vars, classes, ambiguous, unmapped }
}

// ---- Source files: read them with comments blanked out (line numbers stay the same) -------

const blank = (s) => s.replace(/[^\n]/g, '')
const stripComments = (text, file) => {
  const noBlock = text.replace(/\/\*[\s\S]*?\*\//g, blank)
  return /\.tsx?$/.test(file) ? noBlock.replace(/(^|[^:"'`\\])\/\/.*$/gm, (_, before) => before) : noBlock
}

function loadFiles(root) {
  const files = []
  for (const dir of ['src', '.storybook']) {
    if (!fs.existsSync(path.join(root, dir))) continue
    for (const rel of fs.readdirSync(path.join(root, dir), { recursive: true })) {
      const file = unix(path.join(dir, rel))
      // Generated token CSS and images are not hand-written source.
      if (/(^|\/)(assets|styles\/tokens)(\/|$)/.test(file) || !/\.(tsx?|css|mdx)$/.test(file)) continue
      if (!fs.statSync(path.join(root, file)).isFile()) continue
      const story = /\.stories\.tsx?$/.test(file) || file.startsWith('src/stories/')
      files.push({
        file,
        kind: story ? 'story' : file.startsWith('src/components/') ? 'component' : 'other',
        text: stripComments(fs.readFileSync(path.join(root, file), 'utf8'), file),
      })
    }
  }
  return files
}

// ---- Usage: which CSS variables and class names the source mentions -------------------------

const varsIn = (line) => [...line.matchAll(/--[a-z0-9-]+/g)].map((m) => m[0])
// Class words in a line, as lookup keys: 'max-tablet:bg-surface/50' -> 'bg-surface', 'variant:max-tablet'.
const classesIn = (line) =>
  [...line.matchAll(/[\w:/.-]+/g)].flatMap(([word]) => {
    const parts = word.split(':')
    const last = parts.pop().replace(/^[!-]+/, '').replace(/!$/, '').replace(/\/(\d+|\[[^\]]*\]|\([^)]*\))$/, '')
    return [last, ...parts.map((v) => `variant:${v}`)]
  })

function scanUsage(files) {
  const vars = new Map() // '--button-gap' -> [{ file, line }]
  const classes = new Set()
  for (const { file, text } of files) {
    text.split('\n').forEach((line, i) => {
      for (const v of varsIn(line)) vars.set(v, [...(vars.get(v) ?? []), { file, line: i + 1 }])
      classesIn(line).forEach((c) => classes.add(c))
    })
  }
  return { vars, classes }
}

// ---- Allowlist: intentional exceptions, each with a reason ----------------------------------

function applyAllowlist(root, findings, ranIds) {
  const file = path.join(root, 'drift.allowlist.json')
  if (!fs.existsSync(file)) return findings
  const problem = (message, severity) => ({ rule: 'ALLOWLIST', name: 'allowlist', severity, file: 'drift.allowlist.json', message })
  const extra = []
  ;(JSON.parse(fs.readFileSync(file, 'utf8')).entries ?? []).forEach((e, i) => {
    const label = `Entry ${i + 1} (${e.rule ?? 'no rule'})`
    if (!e.rule || !String(e.reason ?? '').trim() || !(e.file || e.token || e.match)) {
      extra.push(problem(`${label} needs a rule, a reason, and at least one of file, token, match`, 'error'))
      return
    }
    // A token ending in * matches every token path that starts with the text before it: 'semantic.layout.*'.
    const tokenOk = (f) => !e.token || (e.token.endsWith('*') ? f.token?.startsWith(e.token.slice(0, -1)) : f.token === e.token)
    const hits = findings.filter((f) => f.rule === e.rule && (!e.file || f.file === e.file) && tokenOk(f) && (!e.match || f.message.includes(e.match)))
    hits.forEach((f) => Object.assign(f, { allowed: true, allowReason: e.reason }))
    // With --rule, entries for other rules would look unused, so only judge the rules that ran.
    if (!hits.length && ranIds.includes(e.rule)) extra.push(problem(`${label} matches nothing any more; remove it`, 'warning'))
  })
  return [...findings, ...extra]
}

// ---- The check itself (no printing, so tests can call it) -----------------------------------

export function check(opts) {
  const tokens = loadTokens(opts.root)
  const files = loadFiles(opts.root)
  const usage = scanUsage(files)
  const lookup = buildLookup(opts.root, tokens)
  const byPath = new Map(tokens.map((t) => [t.path, t]))
  const notes = []

  // A name counts as a use only when it belongs to exactly one token.
  const used = new Set()
  for (const [map, keys] of [[lookup.vars, usage.vars.keys()], [lookup.classes, usage.classes]]) {
    for (const k of keys) if (map.get(k)?.size === 1) used.add([...map.get(k)][0])
  }

  const ctx = {
    opts, tokens, files, usage, lookup, byPath, notes, varsIn, classesIn,
    usedInCode: (t) => used.has(t.path),
    // Fully resolved value, e.g. '{semantic.color.bg.surface}' -> '#FFFFFF'.
    resolve(t, dark = false, depth = 0) {
      const v = dark && t.dark !== undefined ? t.dark : t.value
      const sub = (s) => String(s).replace(/\{([\w.-]+)\}/g, (_, ref) => {
        const target = byPath.get(ref)
        return target && depth < 20 ? ctx.resolve(target, dark, depth + 1) : `{${ref}}`
      })
      return typeof v === 'object' ? JSON.stringify(Object.fromEntries(Object.entries(v).map(([k, x]) => [k, sub(x)]))) : sub(v)
    },
  }

  const selected = opts.rule ? rules.filter((r) => r.id === opts.rule) : rules
  if (opts.rule && !selected.length) throw new Error(`Unknown rule ${opts.rule}. Known: ${rules.map((r) => r.id).join(', ')}`)

  const raw = selected.flatMap((r) => r.run(ctx).map((f) => ({ rule: r.id, name: r.name, severity: r.severity, ...f })))
  const findings = applyAllowlist(opts.root, raw, selected.map((r) => r.id))
  const live = findings.filter((f) => !f.allowed)
  const errors = live.filter((f) => f.severity === 'error').length
  const warnings = live.filter((f) => f.severity === 'warning').length
  const exitCode = errors || (opts.strict && warnings) ? 1 : 0
  return { findings, notes, errors, warnings, allowed: findings.length - live.length, exitCode, ctx }
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

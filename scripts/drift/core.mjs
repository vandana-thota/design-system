// Design system drift checker, core. No file access, no Node-only imports: everything it needs
// arrives as plain data (see checkInputs), so it runs the same in Node, in tests and in a browser.
// The command-line tool in index.mjs reads the project from disk and calls this.
import { rules } from './rules.mjs'

// ---- Tokens: flatten the parsed tokens.json into a list --------------------------------------

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

function loadTokens(json) {
  const tokens = []
  const walk = (node, parts) => {
    for (const [k, v] of Object.entries(node)) {
      if (k.startsWith('$') || !v || typeof v !== 'object') continue
      if ('$value' in v) tokens.push(makeToken([...parts, k], v))
      else walk(v, [...parts, k])
    }
  }
  walk(json, [])
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

function buildLookup(generated, tokens) {
  const vars = new Map()
  const classes = new Map()
  const add = (map, key, tokenPath) => map.set(key, (map.get(key) ?? new Set()).add(tokenPath))
  for (const t of tokens) t.vars.forEach((v) => add(vars, v, t.path))

  const read = (f) => generated?.[f] ?? null
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

// Generated token CSS and images are not hand-written source.
export const isSource = (file) => !/(^|\/)(assets|styles\/tokens)(\/|$)/.test(file) && /\.(tsx?|css|mdx)$/.test(file)

function prepareFiles(raw) {
  return raw
    .filter(({ file }) => isSource(file))
    .map(({ file, text }) => {
      const story = /\.stories\.tsx?$/.test(file) || file.startsWith('src/stories/')
      return { file, kind: story ? 'story' : file.startsWith('src/components/') ? 'component' : 'other', text: stripComments(text, file) }
    })
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

function applyAllowlist(allowlist, findings, ranIds) {
  if (!allowlist) return findings
  const problem = (message, severity) => ({ rule: 'ALLOWLIST', name: 'allowlist', severity, file: 'drift.allowlist.json', message })
  const extra = []
  ;(allowlist.entries ?? []).forEach((e, i) => {
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

// ---- The check itself (no printing, no file access: everything arrives as data) -------------
//
// inputs = {
//   tokens:    the parsed tokens/tokens.json
//   generated: { 'tailwind.css': text, 'type.css': text }   (the generated CSS in src/styles/tokens/)
//   files:     [{ file: 'src/components/Button/Button.tsx', text }]   (paths use forward slashes)
//   allowlist: the parsed drift.allowlist.json, or null
//   spec:      the text of docs/tokens-spec.md, or null
// }
// opts = { rule, strict }

export function checkInputs(inputs, opts = {}) {
  const tokens = loadTokens(inputs.tokens)
  const files = prepareFiles(inputs.files)
  const usage = scanUsage(files)
  const lookup = buildLookup(inputs.generated, tokens)
  const byPath = new Map(tokens.map((t) => [t.path, t]))
  const notes = []

  // A name counts as a use only when it belongs to exactly one token.
  const used = new Set()
  for (const [map, keys] of [[lookup.vars, usage.vars.keys()], [lookup.classes, usage.classes]]) {
    for (const k of keys) if (map.get(k)?.size === 1) used.add([...map.get(k)][0])
  }

  const ctx = {
    opts, inputs, tokens, files, usage, lookup, byPath, notes, varsIn, classesIn,
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
  const findings = applyAllowlist(inputs.allowlist, raw, selected.map((r) => r.id))
  const live = findings.filter((f) => !f.allowed)
  const errors = live.filter((f) => f.severity === 'error').length
  const warnings = live.filter((f) => f.severity === 'warning').length
  const exitCode = errors || (opts.strict && warnings) ? 1 : 0
  return { findings, notes, errors, warnings, allowed: findings.length - live.length, exitCode, ctx }
}

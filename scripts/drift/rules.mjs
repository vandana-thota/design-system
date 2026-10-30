// The drift rules. Each rule is { id, name, severity, run(ctx) } and returns a list of
// { file, line?, token?, message, quiet? }. `quiet` findings are counted and saved to the JSON
// but hidden in the terminal unless you pass --all.
import fs from 'node:fs'
import path from 'node:path'

const TOKENS = 'tokens/tokens.json'
const SPEC = 'docs/tokens-spec.md'

const ofKind = (ctx, kind) => ctx.files.filter((f) => f.kind === kind && /\.tsx?$/.test(f.file))
const eachLine = (files, fn) => files.forEach((f) => f.text.split('\n').forEach((text, i) => fn(f.file, text, i + 1)))

// A bracket value is fine when it only combines token variables: it has a var(--...) and, once those
// are removed, no number left (so no px, rem or bare values). Example: p-[calc(var(--a)_+_var(--b))].
const onlyVars = (cls) => {
  const inner = cls.slice(cls.indexOf('-['))
  return /var\(--/.test(inner) && !/\d/.test(inner.replace(/var\(--[a-z0-9-]+\)/g, ''))
}

// Things a component must not contain: [pattern, label, optional "this match is fine" test].
// Arbitrary variants like [&>svg]:flex are not checked.
const HARDCODED = [
  [/#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})\b/g, 'hex color'],
  [/(?<![\w.-])\d*\.?\d+(?:px|rem)\b/g, 'px/rem value'],
  [/[\w:/.-]*-\[[^\]\n]*\]/g, 'arbitrary Tailwind value', onlyVars],
  [/!important/g, '!important'],
  [/(?<![\w-])text-(?:xs|sm|base|lg|[2-9]?xl)(?![\w-])|(?<![\w-])font-?[Ss]ize\b/g, 'raw font size'],
]

// Reads the token names out of the spec. Names live in table rows (first column of Token / Role tables),
// the layout grid, two prose lists in section 1 (type and z-index), and backticked names in section 3.
// The "## 1." / "## 2." / "## 3." headings tell us which layer a name belongs to.
const GRID = { Columns: 'columns', Gutter: 'gutter', Margin: 'margin', 'Max content width': 'max-width' }
const FONT = { Families: 'family', Weights: 'weight', Sizes: 'size', 'Line heights': 'line-height', Tracking: 'tracking', 'Paragraph spacing': 'paragraph-spacing' }

function parseSpec(text) {
  const names = []
  let layer = null
  let header = null
  const add = (name, line) => names.push({ layer, name: name.replace(/[`\s]/g, '').replace(/\./g, '-'), line })
  text.split('\n').forEach((raw, i) => {
    const line = i + 1
    const heading = raw.match(/^## (\d+)\./)
    if (heading) layer = [null, 'primitive', 'semantic', 'component'][heading[1]] ?? null
    if (!layer) return
    if (raw.startsWith('|')) {
      const cells = raw.split('|').slice(1, -1).map((c) => c.trim())
      if (!header) header = cells
      else if (!cells[0].startsWith('---')) {
        if (['Token', 'Role'].includes(header[0])) add(cells[0], line)
        if (header[0] === 'Mode') cells.forEach((c, n) => GRID[header[n]] && /^\d+$/.test(c) && add(`layout-${cells[0].toLowerCase()}-${GRID[header[n]]}`, line))
      }
      return
    }
    header = null
    const font = layer === 'primitive' && raw.match(/^- (Families|Weights|Sizes|Line heights|Tracking|Paragraph spacing)\b[^:]*:\s*(.*)$/)
    if (font) {
      const rest = font[2]
      const items = font[1] === 'Families' ? [...rest.matchAll(/`font-([a-z]+)`/g)].map((m) => m[1])
        : ['Weights', 'Tracking'].includes(font[1]) ? [...rest.matchAll(/([a-z]+) -?[\d.]+/g)].map((m) => m[1])
        : rest.split('.')[0].match(/\d+/g) ?? []
      items.forEach((x) => add(`font-${FONT[font[1]]}-${x}`, line))
    }
    if (layer === 'primitive' && /^base 0, /.test(raw)) [...raw.matchAll(/([a-z]+) \d+/g)].forEach((m) => add(`layer-${m[1]}`, line))
    if (layer === 'component' && /^\s*- .*:/.test(raw)) [...raw.matchAll(/`([a-z][a-z0-9-]*)`/g)].forEach((m) => add(m[1], line))
  })
  return names
}

export const rules = [
  {
    id: 'DS001', name: 'dead-token', severity: 'warning',
    run(ctx) {
      // A token is used if code mentions it, or a used token points at it.
      const used = new Set(ctx.tokens.filter(ctx.usedInCode).map((t) => t.path))
      const queue = [...used]
      while (queue.length) {
        for (const ref of ctx.byPath.get(queue.pop())?.refs ?? []) if (!used.has(ref)) { used.add(ref); queue.push(ref) }
      }
      const dead = ctx.tokens.filter((t) => !used.has(t.path))
      const deadPrims = dead.filter((t) => t.layer === 'primitive')
      ctx.notes.push(`DS001: ${deadPrims.length} of ${ctx.tokens.filter((t) => t.layer === 'primitive').length} primitive tokens are unused (first 10 shown, --all for the rest).`)
      return dead.map((t) => ({ file: TOKENS, token: t.path, message: `${t.path} is never used`, quiet: t.layer === 'primitive' && deadPrims.indexOf(t) >= 10 }))
    },
  },
  {
    id: 'DS002', name: 'duplicate-token', severity: 'warning',
    run(ctx) {
      // Same layer, same group (color is one group; others are grouped by their parent path), same value in both themes.
      const groups = new Map()
      for (const t of ctx.tokens.filter((t) => t.layer !== 'component')) {
        const key = [t.layer, t.group === 'color' ? 'color' : t.parts.slice(1, -1).join('.'), ctx.resolve(t), ctx.resolve(t, true)].join('|')
        groups.set(key, [...(groups.get(key) ?? []), t])
      }
      const dupes = [...groups.values()].filter((g) => g.length > 1)
      const sem = dupes.filter((g) => g[0].layer === 'semantic')
      if (sem.length) ctx.notes.push(`DS002: ${sem.reduce((n, g) => n + g.length, 0)} semantic tokens share a value with another semantic token (${sem.length} groups). Not listed, because alias names like inset-sm and stack-sm are often intentional.`)
      return dupes.filter((g) => g[0].layer === 'primitive').map((g) => ({ file: TOKENS, token: g[0].path, message: `${g.map((t) => t.path).join(' and ')} have the same value (${ctx.resolve(g[0])})` }))
    },
  },
  {
    id: 'DS003', name: 'hardcoded-value', severity: 'error',
    run(ctx) {
      const out = []
      eachLine(ofKind(ctx, 'component').filter((f) => f.file.endsWith('.tsx')), (file, text, line) => {
        for (const [re, label, fine] of HARDCODED) {
          for (const m of text.matchAll(re)) if (!fine?.(m[0])) out.push({ file, line, message: `${label} "${m[0]}" (use a token)` })
        }
      })
      return out
    },
  },
  {
    id: 'DS004', name: 'layer-violation', severity: 'error',
    run(ctx) {
      const out = []
      const primitiveIn = (set) => (set?.size === 1 ? ctx.byPath.get([...set][0]) : null)
      eachLine(ofKind(ctx, 'component'), (file, text, line) => {
        const hits = [
          ...ctx.varsIn(text).map((v) => [`variable ${v}`, ctx.lookup.vars.get(v)]),
          ...ctx.classesIn(text).map((c) => [c.startsWith('variant:') ? `breakpoint ${c.slice(8)}:` : `class ${c}`, ctx.lookup.classes.get(c)]),
        ]
        for (const [what, set] of new Map(hits)) {
          const t = primitiveIn(set)
          if (t?.layer === 'primitive') out.push({ file, line, token: t.path, message: `${what} is the primitive ${t.path}; use a semantic or component token` })
        }
      })
      for (const t of ctx.tokens.filter((t) => t.layer === 'component')) {
        for (const ref of t.refs.filter((r) => r.startsWith('primitive.'))) {
          out.push({ file: TOKENS, token: t.path, message: `${t.path} points straight at the primitive ${ref}; point it at a semantic token` })
        }
      }
      return out
    },
  },
  {
    id: 'DS005', name: 'broken-reference', severity: 'error',
    run(ctx) {
      const out = []
      for (const t of ctx.tokens) {
        for (const ref of t.refs.filter((r) => !ctx.byPath.has(r))) out.push({ file: TOKENS, token: t.path, message: `${t.path} points at {${ref}}, which does not exist` })
      }
      // CSS variables that components use. Variables a file declares itself, and Tailwind's own --tw-*, are fine.
      // Short class names are not checked here: Tailwind quietly drops a class it does not know.
      const declared = new Set(ctx.files.flatMap((f) => [...f.text.matchAll(/(--[a-z0-9-]+)\s*:/g)].map((m) => m[1])))
      eachLine(ofKind(ctx, 'component'), (file, text, line) => {
        for (const v of ctx.varsIn(text)) {
          if (!ctx.lookup.vars.has(v) && !declared.has(v) && !v.startsWith('--tw-')) out.push({ file, line, message: `${v} is not a token or theme variable` })
        }
      })
      return out
    },
  },
  {
    id: 'DS006', name: 'spec-drift', severity: 'error',
    run(ctx) {
      const file = path.join(ctx.opts.root, SPEC)
      if (!fs.existsSync(file)) return [{ file: SPEC, message: `${SPEC} not found` }]
      // The spec spells names several ways (sand-0, color.bg.surface, inset-xs), so a token matches under either spelling.
      const known = new Map()
      for (const t of ctx.tokens) {
        for (const s of [t.name.replace(/\./g, '-'), t.parts.slice(2).join('-')]) known.set(`${t.layer}:${s}`, t)
      }
      const matched = new Set()
      const out = []
      for (const s of parseSpec(fs.readFileSync(file, 'utf8'))) {
        const t = known.get(`${s.layer}:${s.name}`)
        if (t) matched.add(t.path)
        else out.push({ file: SPEC, line: s.line, message: `${s.name} (${s.layer}) is in the spec but not in tokens.json` })
      }
      for (const t of ctx.tokens.filter((t) => !matched.has(t.path))) out.push({ file: TOKENS, token: t.path, message: `${t.path} is in tokens.json but not in the spec` })
      return out
    },
  },
  {
    id: 'DS007', name: 'story-coverage', severity: 'error',
    run(ctx) {
      // A component is src/components/Name/Name.tsx; its stories are *.stories.tsx in the same folder.
      const folders = new Map()
      for (const f of ctx.files) {
        const m = f.file.match(/^src\/components\/([^/]+)\/([^/]+)$/)
        if (m) folders.set(m[1], [...(folders.get(m[1]) ?? []), m[2]])
      }
      const out = []
      for (const [name, names] of folders) {
        const hasComponent = names.includes(`${name}.tsx`)
        const hasStory = names.some((n) => /\.stories\.tsx?$/.test(n))
        if (hasComponent && !hasStory) out.push({ file: `src/components/${name}/${name}.tsx`, message: `Component ${name} has no story` })
        if (!hasComponent && hasStory) out.push({ file: `src/components/${name}/`, message: `Stories in ${name}/ have no component (${name}.tsx is missing)` })
      }
      return out
    },
  },
]

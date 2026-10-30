// Reads tokens/tokens.json (the same file Style Dictionary reads) so the Foundations pages never
// hardcode a value. Aliases like '{primitive.color.sand.50}' are resolved here, per theme / mode.
import tokens from '../../../tokens/tokens.json'

export type Theme = 'light' | 'dark'
export type TypeMode = 'mobile' | 'tablet' | 'desktop'

type Node = {
  $type?: string
  $description?: string
  $value?: unknown
  $extensions?: {
    mode?: { dark?: unknown }
    responsive?: Partial<Record<TypeMode, Record<string, string>>>
  }
  [key: string]: unknown
}

export type TokenEntry = {
  /** Dotted path without the layer, e.g. 'color.bg.surface' */
  name: string
  /** Full path including the layer, e.g. 'semantic.color.bg.surface' */
  path: string
  node: Node
}

const root = tokens as unknown as Record<string, Node>

const isToken = (n: unknown): n is Node => typeof n === 'object' && n !== null && '$value' in n

const getNode = (path: string): Node => {
  let cur: unknown = root
  for (const part of path.split('.')) cur = (cur as Record<string, unknown> | undefined)?.[part]
  if (!isToken(cur)) throw new Error(`Token not found: ${path}`)
  return cur
}

const ALIAS = /\{([^}]+)\}/g

/** Resolves a raw token value (string or object of strings) to plain values for one theme. */
const resolveValue = (value: unknown, theme: Theme): unknown => {
  if (typeof value === 'string') {
    const whole = value.match(/^\{([^}]+)\}$/)
    if (whole) return resolveToken(whole[1], theme)
    return value.replace(ALIAS, (_, ref: string) => String(resolveToken(ref, theme)))
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, resolveValue(v, theme)]))
  }
  return value
}

/** Resolved value of the token at `path` (full path), using its dark value when theme is dark. */
export const resolveToken = (path: string, theme: Theme = 'light'): unknown => {
  const node = getNode(path)
  const dark = node.$extensions?.mode?.dark
  return resolveValue(theme === 'dark' && dark !== undefined ? dark : node.$value, theme)
}

/** Resolved string value of a semantic token, e.g. semanticValue('color.bg.surface', 'dark') -> '#1E2029'. */
export const semanticValue = (name: string, theme: Theme = 'light'): string =>
  String(resolveToken(`semantic.${name}`, theme))

export const primitiveValue = (name: string, theme: Theme = 'light'): string =>
  String(resolveToken(`primitive.${name}`, theme))

/** The token's $description (what it is used for), or an empty string when it has none. */
export const describe = (path: string): string => getNode(path).$description ?? ''

/** Every token under a path prefix, in file order. listTokens('semantic.color.bg') */
export const listTokens = (prefix: string): TokenEntry[] => {
  const out: TokenEntry[] = []
  const walk = (node: unknown, parts: string[]) => {
    if (isToken(node)) {
      const path = parts.join('.')
      out.push({ path, name: parts.slice(1).join('.'), node })
      return
    }
    if (node && typeof node === 'object') {
      for (const [k, v] of Object.entries(node)) if (!k.startsWith('$')) walk(v, [...parts, k])
    }
  }
  let start: unknown = root
  for (const part of prefix.split('.')) start = (start as Record<string, unknown> | undefined)?.[part]
  walk(start, prefix.split('.'))
  return out
}

/** Same as listTokens, smallest to largest. The JSON lists some steps out of order (space-025 comes late). */
export const listTokensBySize = (prefix: string): TokenEntry[] =>
  listTokens(prefix).sort((a, b) => toPx(String(resolveToken(a.path))) - toPx(String(resolveToken(b.path))))

/** True when the token has its own dark value. */
export const hasDark = (entry: TokenEntry): boolean => entry.node.$extensions?.mode?.dark !== undefined

/** CSS variable for a token, matching style-dictionary.config.mjs (primitives get a prim- prefix). */
export const cssVar = (path: string): string => {
  const [layer, ...rest] = path.split('.')
  return layer === 'primitive' ? `--prim-${rest.join('-')}` : `--${rest.join('-')}`
}

export type TypeRole = {
  fontFamily: string
  fontWeight: number
  fontSize: string
  lineHeight: string
  letterSpacing: string
}

/** Type role resolved for one breakpoint mode. Tablet overrides mobile; desktop overrides tablet. */
export const typeRole = (role: string, mode: TypeMode): TypeRole => {
  const node = getNode(`semantic.type.${role}`)
  const responsive = node.$extensions?.responsive ?? {}
  const raw = {
    ...(node.$value as Record<string, string>),
    ...(mode !== 'mobile' ? responsive.tablet : {}),
    ...(mode === 'desktop' ? responsive.desktop : {}),
  }
  return resolveValue(raw, 'light') as TypeRole
}

export const typeRoleNames = (): string[] =>
  listTokens('semantic.type').map((t) => t.path.split('.')[2])

const REM_PX = 16

/** '0.75rem' -> 12. Values already in px or unitless pass through. */
export const toPx = (value: string): number => {
  if (value.endsWith('rem')) return parseFloat(value) * REM_PX
  return parseFloat(value)
}

/** '0.75rem' -> '12px (0.75rem)' for tables. */
export const pxLabel = (value: string): string =>
  value.endsWith('rem') ? `${toPx(value)}px (${value})` : value

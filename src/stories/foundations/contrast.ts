// WCAG 2.2 contrast math (1.4.3 / 1.4.11) on resolved token colors.
import { semanticValue, type Theme } from './tokenData'

const channel = (c: number): number => {
  const s = c / 255
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
}

const parseHex = (hex: string): [number, number, number] => {
  const h = hex.replace('#', '')
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number]
}

export const luminance = (hex: string): number => {
  const [r, g, b] = parseHex(hex)
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

export const contrastRatio = (a: string, b: string): number => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

export type ContrastPair = {
  /** Semantic token names (without the 'semantic.' layer) */
  fg: string
  bg: string
  /** 4.5 for text, 3 for focus indicators and other non-text UI */
  needs: 4.5 | 3
  /** Spec-documented exception: reported as known, not as a failure */
  exception?: string
}

// The pairs from the "Contrast" table in docs/tokens-spec.md, plus the documented control-border exception.
export const contrastPairs: ContrastPair[] = [
  { fg: 'color.text.primary', bg: 'color.bg.canvas', needs: 4.5 },
  { fg: 'color.text.secondary', bg: 'color.bg.surface-secondary', needs: 4.5 },
  { fg: 'color.text.secondary', bg: 'color.bg.surface-hover', needs: 4.5 },
  { fg: 'color.text.secondary', bg: 'color.bg.surface-selected', needs: 4.5 },
  { fg: 'color.text.link', bg: 'color.bg.surface', needs: 4.5 },
  { fg: 'color.text.on-accent', bg: 'color.accent.default', needs: 4.5 },
  { fg: 'color.text.on-accent', bg: 'color.accent.hover', needs: 4.5 },
  { fg: 'color.text.on-accent', bg: 'color.accent.pressed', needs: 4.5 },
  { fg: 'color.accent.subtle-text', bg: 'color.accent.subtle', needs: 4.5 },
  { fg: 'color.border.focus', bg: 'color.bg.canvas', needs: 3 },
  { fg: 'color.status.success.text', bg: 'color.status.success.bg', needs: 4.5 },
  { fg: 'color.status.warning.text', bg: 'color.status.warning.bg', needs: 4.5 },
  { fg: 'color.status.danger.text', bg: 'color.status.danger.bg', needs: 4.5 },
  { fg: 'color.text.on-danger', bg: 'color.status.danger.fill', needs: 4.5 },
  {
    fg: 'color.border.default',
    bg: 'color.bg.surface',
    needs: 3,
    exception: 'Documented exception: controls stay identifiable through a label, surface fill and focus ring.',
  },
]

export type ContrastResult = {
  pair: ContrastPair
  ratio: number
  status: 'pass' | 'fail' | 'exception'
}

export const checkPair = (pair: ContrastPair, theme: Theme): ContrastResult => {
  const ratio = contrastRatio(semanticValue(pair.fg, theme), semanticValue(pair.bg, theme))
  const passes = ratio >= pair.needs
  return { pair, ratio, status: passes ? 'pass' : pair.exception ? 'exception' : 'fail' }
}

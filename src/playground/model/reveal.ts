// Pure helpers for what happens after "Run Drift Check" finishes: a count summary under the button,
// then the report heading is brought into view. Kept free of React so it can be tested with node --test.

export interface Counts {
  DRIFT: number
  MATCH: number
  'NOT CHECKED': number
}

export interface CheckSummary {
  /** Visible line under the button, built from the real counts. */
  text: string
  /** True only when nothing drifted and at least one check actually matched. */
  success: boolean
  /** Longer sentence for screen readers. */
  announcement: string
}

export function summarizeCounts(counts: Counts): CheckSummary {
  const { DRIFT: drift, MATCH: match, 'NOT CHECKED': skipped } = counts
  const tally = `${drift} DRIFT · ${match} MATCH · ${skipped} NOT CHECKED`
  const spoken = `${drift} drift, ${match} match, ${skipped} not checked`
  const hint = 'The detailed report is below and keyboard focus has moved to its heading.'
  if (drift > 0) return { text: tally, success: false, announcement: `Drift check finished: ${spoken}. ${hint}` }
  if (match > 0) return { text: `No drift found · ${tally}`, success: true, announcement: `Drift check finished. No drift found: ${spoken}. ${hint}` }
  // Nothing was verified, so do not call it a pass.
  return { text: `Nothing could be verified · ${tally}`, success: false, announcement: `Drift check finished. Nothing could be verified: ${spoken}. ${hint}` }
}

/** Space left above the heading when it is scrolled into view. */
export const TOP_GAP = 24

export function scrollTop(headingTop: number, scrollY: number, gap = TOP_GAP) {
  return Math.max(0, Math.round(headingTop + scrollY - gap))
}

export interface RevealWindow {
  scrollX: number
  scrollY: number
  matchMedia?: (query: string) => { matches: boolean }
  scrollTo: (options: { top: number; left: number; behavior: 'auto' | 'smooth' }) => void
}

export interface RevealTarget {
  getBoundingClientRect: () => { top: number }
  focus: (options: { preventScroll: boolean }) => void
}

/**
 * Scrolls this window only (an element-level scroll call would also scroll a portfolio page that embeds
 * the playground in an iframe), then focuses the heading without letting the focus move scroll anything.
 */
export function revealHeading(heading: RevealTarget, win: RevealWindow) {
  const reduced = win.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
  win.scrollTo({ top: scrollTop(heading.getBoundingClientRect().top, win.scrollY), left: win.scrollX, behavior: reduced ? 'auto' : 'smooth' })
  heading.focus({ preventScroll: true })
}

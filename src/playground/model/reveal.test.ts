import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { revealHeading, scrollTop, summarizeCounts } from './reveal.ts'
import type { RevealTarget, RevealWindow } from './reveal.ts'

test('the summary uses the counts it is given, never fixed numbers', () => {
  assert.equal(summarizeCounts({ DRIFT: 6, MATCH: 10, 'NOT CHECKED': 1 }).text, '6 DRIFT · 10 MATCH · 1 NOT CHECKED')
  assert.equal(summarizeCounts({ DRIFT: 2, MATCH: 3, 'NOT CHECKED': 4 }).text, '2 DRIFT · 3 MATCH · 4 NOT CHECKED')
  assert.equal(summarizeCounts({ DRIFT: 6, MATCH: 10, 'NOT CHECKED': 1 }).success, false)
  assert.match(summarizeCounts({ DRIFT: 3, MATCH: 7, 'NOT CHECKED': 2 }).announcement, /3 drift, 7 match, 2 not checked/)
})

test('no drift gives a clear success message', () => {
  const s = summarizeCounts({ DRIFT: 0, MATCH: 12, 'NOT CHECKED': 1 })
  assert.equal(s.success, true)
  assert.equal(s.text, 'No drift found · 0 DRIFT · 12 MATCH · 1 NOT CHECKED')
})

test('zero verified checks is not reported as a pass', () => {
  const s = summarizeCounts({ DRIFT: 0, MATCH: 0, 'NOT CHECKED': 5 })
  assert.equal(s.success, false)
  assert.match(s.text, /^Nothing could be verified/)
})

test('scroll target leaves a gap above the heading and never goes negative', () => {
  assert.equal(scrollTop(500, 100), 576)
  assert.equal(scrollTop(5, 0), 0)
})

function fake(reduced: boolean) {
  const calls: unknown[][] = []
  const win: RevealWindow = { scrollX: 0, scrollY: 200, matchMedia: (q) => ({ matches: reduced && q.includes('reduce') }), scrollTo: (o) => calls.push(['scrollTo', o]) }
  const heading: RevealTarget = { getBoundingClientRect: () => ({ top: 400 }), focus: (o) => calls.push(['focus', o]) }
  return { calls, win, heading }
}

test('reveal scrolls smoothly, then focuses without scrolling', () => {
  const { calls, win, heading } = fake(false)
  revealHeading(heading, win)
  assert.deepEqual(calls, [['scrollTo', { top: 576, left: 0, behavior: 'smooth' }], ['focus', { preventScroll: true }]])
})

test('reveal respects prefers-reduced-motion', () => {
  const { calls, win, heading } = fake(true)
  revealHeading(heading, win)
  assert.equal((calls[0][1] as { behavior: string }).behavior, 'auto')
})

test('the page is wired for focus, announcement, and iframe safety', () => {
  const page = readFileSync(new URL('../Playground.tsx', import.meta.url), 'utf8')
  assert.match(page, /id="report-heading"[^>]*tabIndex=\{-1\}/)
  assert.match(page, /role="status"/)
  assert.match(page, /revealHeading\(/)
  const code = readFileSync(new URL('./reveal.ts', import.meta.url), 'utf8').replace(/\/\/.*|\/\*[\s\S]*?\*\//g, '')
  assert.equal(/scrollIntoView/.test(page + code), false)
})

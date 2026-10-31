#!/usr/bin/env node
// Captures real command output for the playground's "Under the hood" section.
// Run with: npm run playground:evidence
//
// It runs the project's own commands and saves what they print, with the date and commit, to
// src/playground/evidence/evidence.json. The page labels this as a captured run, not a live one.
// Absolute paths are replaced with <repo> so no local folder names end up in the public bundle.
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const scrub = (text) => text.replaceAll(root, '<repo>').replace(/\/Users\/[^\s/]+/g, '<home>')

const RUNS = [
  { id: 'drift-cli', label: 'Token governance checker (DS001–DS007)', script: 'drift' },
  { id: 'drift-tests', label: 'Token governance tests', script: 'drift:test' },
  { id: 'engine-tests', label: 'Figma-card comparison engine tests', script: 'engine:test' },
  { id: 'playground-tests', label: 'Playground logic tests', script: 'playground:test' },
]

function parseTests(output) {
  const count = (name) => Number(new RegExp(`^ℹ ${name} (\\d+)`, 'm').exec(output)?.[1] ?? 0)
  const names = [...output.matchAll(/^([✔✖]) (.+?)(?: \([\d.]+ms\))?$/gm)].map((m) => ({ ok: m[1] === '✔', name: m[2] }))
  return { total: count('tests'), pass: count('pass'), fail: count('fail'), names }
}

const git = (...args) => spawnSync('git', args, { cwd: root, encoding: 'utf8' }).stdout.trim()

const runs = RUNS.map(({ id, label, script }) => {
  const result = spawnSync('npm', ['run', '-s', script], { cwd: root, encoding: 'utf8', env: { ...process.env, GITHUB_ACTIONS: '', FORCE_COLOR: '0' } })
  const output = scrub(`${result.stdout}${result.stderr}`).trim()
  return { id, label, command: `npm run ${script}`, exitCode: result.status, ...(script === 'drift' ? { output } : { tests: parseTests(output) }) }
})

const evidence = {
  capturedAt: new Date().toISOString(),
  node: process.version,
  commit: git('rev-parse', '--short', 'HEAD'),
  branch: git('branch', '--show-current'),
  runs,
}
const out = path.join(root, 'src/playground/evidence/evidence.json')
fs.mkdirSync(path.dirname(out), { recursive: true })
fs.writeFileSync(out, JSON.stringify(evidence, null, 2) + '\n')
console.log(`Wrote ${path.relative(root, out)}`)
for (const run of runs) console.log(`  ${run.command}: exit ${run.exitCode}${run.tests ? `, ${run.tests.pass}/${run.tests.total} passed` : ''}`)

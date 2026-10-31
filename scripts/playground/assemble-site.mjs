#!/usr/bin/env node
// Assembles the GitHub Pages site: Storybook at the root, the playground at /playground/.
// Run after `npm run build-storybook` and `npm run playground:build`:  node scripts/playground/assemble-site.mjs
//
// The playground keeps its own assets/ folder inside /playground/, so it never mixes with Storybook's files.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const at = (...parts) => path.join(root, ...parts)

for (const dir of ['storybook-static', 'playground-dist/playground', 'playground-dist/assets']) {
  if (!fs.existsSync(at(dir))) throw new Error(`${dir} is missing. Build Storybook and the playground first.`)
}

fs.rmSync(at('_site'), { recursive: true, force: true })
fs.cpSync(at('storybook-static'), at('_site'), { recursive: true })
fs.cpSync(at('playground-dist/assets'), at('_site/playground/assets'), { recursive: true })

// The build points at ../assets/ (a sibling of the playground folder). Here the assets sit inside it.
const html = fs.readFileSync(at('playground-dist/playground/index.html'), 'utf8')
const fixed = html.replaceAll('../assets/', './assets/')
if (fixed.includes('../')) throw new Error('playground/index.html still has a parent-folder path after rewriting')
fs.writeFileSync(at('_site/playground/index.html'), fixed)

console.log('Assembled _site: Storybook at /, playground at /playground/')

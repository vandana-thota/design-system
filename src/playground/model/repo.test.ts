// Guards the browser's copy of the project: the files bundled into the page must give exactly the same
// token-governance result as the command line reading the real folder. Loads src/playground/repo.ts through
// Vite (the same file-glob code the browser bundle uses), without starting a server.
import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'vite'
import { checkInputs, readInputs } from '../../../scripts/drift/index.mjs'

const ROOT = new URL('../../../', import.meta.url).pathname

test('the files bundled into the page give the same governance result as the CLI', async () => {
  const server = await createServer({ root: ROOT, configFile: ROOT + 'vite.playground.config.ts', appType: 'custom', server: { middlewareMode: true }, logLevel: 'silent' })
  try {
    const repo = await server.ssrLoadModule('/src/playground/repo.ts')
    assert.deepEqual(
      ['./Playground.tsx', '../App.tsx', '../../.storybook/main.ts', '../components/Button/Button.tsx'].map((key) => repo.toRepoPath(key)),
      ['src/playground/Playground.tsx', 'src/App.tsx', '.storybook/main.ts', 'src/components/Button/Button.tsx'],
    )
    const browser = repo.repoInputs()
    const cli = readInputs(ROOT)
    const governed = (files: { file: string; text: string }[]) => files.filter((f) => !f.file.startsWith('src/playground/') && !/(^|\/)(assets|styles\/tokens)(\/|$)/.test(f.file)).map((f) => `${f.file}\n${f.text}`).sort()
    assert.deepEqual(governed(browser.files), governed(cli.files))
    assert.deepEqual(browser.tokens, cli.tokens)
    assert.deepEqual(browser.allowlist, cli.allowlist)
    assert.equal(browser.spec, cli.spec)
    assert.deepEqual(browser.generated, cli.generated)
    const a = checkInputs(browser, {})
    const b = checkInputs(cli, {})
    assert.deepEqual([a.errors, a.warnings, a.allowed], [b.errors, b.warnings, b.allowed])
    assert.deepEqual(a.findings, b.findings)
  } finally {
    await server.close()
  }
})

// Checks components.json against the variables Token Sync would create, without Figma.
// Run with: node figma-plugin/component-builder/dry-run.mjs
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const here = (file) => fileURLToPath(new URL(file, import.meta.url));
const load = (file) => {
  const sandbox = { module: { exports: {} } };
  vm.runInNewContext(readFileSync(here(file), 'utf8'), sandbox);
  return sandbox.module.exports;
};

const { mapTokens } = load('../token-sync/code.js');
const { checkSpec, combos } = load('./code.js');

const plan = mapTokens(JSON.parse(readFileSync(here('../../tokens/tokens.json'), 'utf8')));
const known = new Map(plan.entries.map((e) => [`${e.collection}|${e.name}`, e.type]));
const spec = JSON.parse(readFileSync(here('./components.json'), 'utf8'));
const result = checkSpec(spec, known);

for (const { component: c, rows, annotations, unused } of result.components) {
  console.log(`\n${c.name}: ${combos(c.properties, c.exclude).length} variants (${Object.entries(c.properties).map(([k, v]) => `${k} ${v.length}`).join(', ')})`);
  console.log('Part            Property     When                                  Variable                                  Status');
  for (const r of rows) {
    const when = r.when ? Object.entries(r.when).map(([k, v]) => `${k}=${v}`).join(', ') : 'all';
    console.log(`${r.part.padEnd(15)} ${r.property.padEnd(12)} ${when.padEnd(37)} ${(r.ref === null ? '(none)' : r.ref).padEnd(41)} ${r.status}`);
  }
  console.log(`\nAnnotations: ${annotations.total} (${annotations.proposed} marked Proposed, ${annotations.noSource} missing text or source)`);
  console.log(`Component tokens for ${c.id} not used in Figma: ${unused.length ? unused.join(', ') : 'none'}`);
  console.log(`Known gaps recorded in components.json: ${(c.knownGaps || []).length}`);
}

console.log(`\nDocumentation pages use ${result.docVariableCount} variables.`);
if (result.problems.length) {
  console.log(`\nPROBLEMS (${result.problems.length}):`);
  for (const p of result.problems) console.log(`  ${p}`);
  process.exit(1);
}
console.log('\nNo problems found.');

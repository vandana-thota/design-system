// Runs the token mapping without Figma and prints counts per collection.
// Run with: node figma-plugin/token-sync/dry-run.mjs
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const here = (file) => fileURLToPath(new URL(file, import.meta.url));

// code.js is plain script (Figma loads it that way), so run it in a small sandbox.
const sandbox = { module: { exports: {} } };
vm.runInNewContext(readFileSync(here('./code.js'), 'utf8'), sandbox);
const { mapTokens } = sandbox.module.exports;

const tokens = JSON.parse(readFileSync(here('../../tokens/tokens.json'), 'utf8'));
const plan = mapTokens(tokens);

const expected = { Primitives: 136, Semantic: 97, Component: 57 };
const typesOf = (name) => {
  const t = {};
  for (const e of plan.entries.filter((e) => e.collection === name)) t[e.type] = (t[e.type] || 0) + 1;
  return Object.entries(t).map(([k, v]) => `${k} ${v}`).join(', ');
};

console.log('Collection   Tokens read (expected)   Variables   Skipped   Types');
for (const name of Object.keys(expected)) {
  const read = plan.sourceCounts[name];
  const vars = plan.entries.filter((e) => e.collection === name).length;
  const skipped = plan.skipped.filter((s) => s.collection === name).length;
  const ok = read === expected[name] ? 'ok' : 'MISMATCH';
  console.log(`${name.padEnd(12)} ${String(read).padStart(3)} (${expected[name]}) ${ok.padEnd(8)}  ${String(vars).padStart(8)}   ${String(skipped).padStart(7)}   ${typesOf(name)}`);
}

const semantic = plan.entries.filter((e) => e.collection === 'Semantic');
const withDark = semantic.filter((e) => e.dark).length;
console.log(`\nSemantic: ${semantic.length} variables, ${withDark} with their own Dark value (the rest repeat the Light value).`);
console.log(`If Figma allows only one mode, "Semantic / Light" and "Semantic / Dark" each get ${semantic.length} variables.`);

console.log(`\nSkipped (${plan.skipped.length}):`);
for (const s of plan.skipped) console.log(`  [${s.collection}] ${s.token}: ${s.reason}`);

if (plan.notes.length) {
  console.log('\nNotes:');
  for (const n of plan.notes.slice(0, 5)) console.log(`  ${n}`);
  if (plan.notes.length > 5) console.log(`  ... and ${plan.notes.length - 5} more`);
}

console.log('\nSample names:');
for (const n of ['color/bg/surface', 'type/body-l/size/mobile', 'type/body-l/size/desktop', 'motion/hover/easing']) {
  const e = plan.entries.find((e) => e.name === n);
  console.log(`  ${n}: ${e ? `${e.type} ${JSON.stringify(e.value.alias ? 'alias ' + e.value.alias.ref : e.value.literal)}` : 'not found'}`);
}

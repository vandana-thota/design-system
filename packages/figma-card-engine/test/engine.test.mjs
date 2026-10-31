import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { compare, exitCode, markdown, inspectCss, normalizeColor, inspectJsx, validateEvidence, mapping } from '../src/index.mjs';

const css = await readFile(new URL('../fixtures/Card.css.txt',import.meta.url),'utf8');
const jsx = await readFile(new URL('../fixtures/Card.tsx.txt',import.meta.url),'utf8');
// Sanitized public snapshot; mutations below are isolated test inputs, never production values.
const evidence = JSON.parse(await readFile(new URL('../snapshots/atlas-card.v1.json',import.meta.url),'utf8'));
const run = (changes = {}) => compare({ css, jsx, evidence, mode: 'test', ...changes });
const row = (report, property) => report.results.find(r=>r.property===property);
const button = e => e.document.children[0].children.find(n=>n.id==='1:49');
const element = inspectJsx(jsx,mapping).elements.find(n=>n.classes.includes('card__action'));
const read = (source, prop='padding-top') => inspectCss(source,'test.css').read(element,prop);

test('sanitized snapshot matches 16 source checks; uninspected rendering stays NOT CHECKED', () => {
  const report=run();
  assert.deepEqual(report.summary,{MATCH:16,DRIFT:0,'NOT CHECKED':1});
  assert.equal(exitCode(report),0);
  assert.match(row(report,'Button background').codeSources.join(' '),/Card.css:75:3.*Card.css:11:3/);
  assert.match(markdown(report),/Expected Figma/);
});

test('changing a CSS variable detects button color drift without changing source files', () => {
  const report=run({css:css.replace('--sds-color-background-positive-default: #14ae5c','--sds-color-background-positive-default: #ff0000')});
  const r=row(report,'Button background');
  assert.equal(r.status,'DRIFT'); assert.deepEqual(r.actual,[255,0,0,1]); assert.deepEqual(r.expected,[20,174,92,1]); assert.equal(exitCode(report),1);
});

test('new Figma values, not mapping constants, drive expectations', () => {
  const changed=structuredClone(evidence);
  button(changed).fills[0].color={r:0,g:0,b:1};
  changed.document.topLeftRadius=20;
  changed.document.paddingTop=32;
  changed.document.children[0].itemSpacing=12;
  const report=run({evidence:changed});
  for (const name of ['Button background','Card radius top-left','Card padding top','Content gap']) assert.equal(row(report,name).status,'DRIFT');
});

test('normalizes equivalent hex and RGB colors', () => {
  assert.deepEqual(normalizeColor('#fff'),normalizeColor('rgb(255 255 255)'));
  assert.deepEqual(normalizeColor('#14ae5c'),normalizeColor('rgb(20, 174, 92)'));
  assert.deepEqual(normalizeColor('#0008'),[0,0,0,0.5333]);
  assert.equal(row(run({css:css.replace('#14ae5c','rgb(20, 174, 92)')}),'Button background').status,'MATCH');
});

test('resolves nested fallback and inherited aliases with definition source locations', () => {
  const r=read(':root { --base: 8px; } .card { --alias: var(--base); } .card__action { padding: var(--missing, var(--alias)); }');
  assert.equal(r.value,'8px'); assert.equal(r.sources.length,3);
});

test('ancestor variable aliases resolve before child variable overrides', () => {
  assert.equal(read('.card { --base: 8px; --alias: var(--base); } .card__action { --base: 20px; padding: var(--alias); }').value,'8px');
});

test('local override, declaration order, specificity and important are respected', () => {
  assert.equal(read('.card { --x: 8px; } .card__action { --x: 16px; padding: var(--x); padding-top: 20px; }').value,'20px');
  assert.equal(read('.card__action { padding: 8px !important; } button { padding-top: 9px; }').value,'8px');
  assert.equal(read('.card__action { padding: 8px; } button { padding-top: 9px; }').value,'8px');
  assert.equal(read('.card__action { padding-top: 9px; padding: 8px; }').value,'8px');
});

test('expands padding and radius shorthand including individual corner override', () => {
  const report=run({css:css+'\n.card { padding: 1px 2px 3px 4px; border-radius: 11px 12px 13px 14px; border-top-left-radius: 15px; }'});
  assert.deepEqual(['top','right','bottom','left'].map(s=>row(report,`Card padding ${s}`).actual),[1,2,3,4]);
  assert.deepEqual(['top-left','top-right','bottom-right','bottom-left'].map(s=>row(report,`Card radius ${s}`).actual),[15,12,13,14]);
});

test('missing/cyclic variables are never reported as matches', () => {
  for (const suffix of ['.card { --a: var(--b); --b: var(--a); padding: var(--a); }','.card { padding: var(--missing); }','.card { --a: var(--a, 24px); padding: var(--a); }']) {
    const report=run({css:css+suffix});
    assert.equal(row(report,'Card padding top').status,'NOT CHECKED'); assert.equal(exitCode(report),2);
  }
  assert.equal(read('.card__action { --a: var(--a); padding: var(--a, 8px); }').value,'8px');
});

test('unsupported units, calc and malformed shorthands cannot produce partial matches', () => {
  for (const value of ['calc(12px + 12px)','1.5rem','24px nonsense','var(--unknown)']) {
    const report=run({css:css+`.card { padding: ${value}; }`});
    assert.equal(row(report,'Card padding top').status,'NOT CHECKED');
  }
});

test('unsupported selectors, conditional CSS and CSS imports are conservative', () => {
  for (const extra of ['@media (width < 600px) { .card { padding: 0; } }','@import "other.css";','.preview .card { padding: 0; }','.card { & button { padding: 0; } }']) {
    const report=run({css:css+extra});
    assert.equal(row(report,'Card padding top').status,'NOT CHECKED');
  }
  assert.equal(row(run({css:css+'.card:hover { padding: 0; }'}),'Card padding top').status,'MATCH');
});

test('logical overrides, unknown layout and parse failures do not produce matches', () => {
  assert.equal(row(run({css:css+'.card { padding-inline: 0; }'}),'Card padding right').status,'NOT CHECKED');
  assert.equal(row(run({css:css+'.card__content { display: grid; }'}),'Content gap').status,'NOT CHECKED');
  assert.equal(row(run({css:css+' broken {'}),'Button background').status,'NOT CHECKED');
  assert.equal(row(run({jsx:'not valid <jsx'}),'Component structure').status,'NOT CHECKED');
});

test('removed, reordered, added and reparented JSX elements cause structure drift', () => {
  const description = '        <p className="card__description">{description}</p>';
  const title = '        <h2 className="card__title" id={titleId}>{title}</h2>';
  const variants=[jsx.replace(description,''),jsx.replace(title+'\n'+description,description+'\n'+title),jsx.replace(description,description+'<span />'),jsx.replace(description,'<section>'+description+'</section>')];
  for (const variant of variants) assert.equal(row(run({jsx:variant}),'Component structure').status,'DRIFT');
});

test('Figma additions/removals and text-wrapper changes cause structure drift', () => {
  for (const mutate of [e=>button(e).children.push({id:'test:new',type:'RECTANGLE'}),e=>e.document.children[0].children.reverse(),e=>{button(e).type='INSTANCE';},e=>{button(e).children=[];}]) {
    const changed=structuredClone(evidence); mutate(changed);
    assert.equal(row(run({evidence:changed}),'Component structure').status,'DRIFT');
  }
});

test('missing mapped selector is NOT CHECKED for style, DRIFT for static structure', () => {
  const report=run({jsx:jsx.replace('className="card__action"','className="different"').replace('{actionLabel}','View Details')});
  assert.equal(row(report,'Button background').status,'NOT CHECKED');
  assert.equal(row(report,'Component structure').status,'DRIFT');
});

test('dynamic children/classes, styles and spreads require runtime inspection', () => {
  for (const value of [jsx.replace('{actionLabel}','{active && <span />}'),jsx.replace('className="card__action"','className={classes}'),jsx.replace('<button','<button style={{padding: 0}}'),jsx.replace('<button','<button {...props}'),jsx.replace(".join(' ')",".join('')")]) {
    assert.equal(row(run({jsx:value}),'Component structure').status,'NOT CHECKED');
  }
});

test('missing or unsupported Figma properties preserve actual code but never MATCH', () => {
  const changed=structuredClone(evidence);
  delete changed.document.paddingTop;
  button(changed).fills=[{type:'GRADIENT_LINEAR'}];
  const report=run({evidence:changed});
  assert.equal(row(report,'Button background').status,'NOT CHECKED');
  assert.deepEqual(row(report,'Button background').actual,[20,174,92,1]);
  assert.equal(row(report,'Card padding top').status,'NOT CHECKED');
});

test('REST corner representation is supported, without substituting missing properties', () => {
  const changed=structuredClone(evidence);
  for(const p of ['cornerRadius','topLeftRadius','topRightRadius','bottomRightRadius','bottomLeftRadius']) delete changed.document[p];
  changed.document.rectangleCornerRadii=[16,16,16,16];
  assert.equal(row(run({evidence:changed}),'Card radius top-left').status,'MATCH');
  delete changed.document.rectangleCornerRadii;
  assert.equal(row(run({evidence:changed}),'Card radius top-left').status,'NOT CHECKED');
});

test('wrong identity, missing nodes and malformed evidence cannot claim a match', () => {
  for(const changed of [undefined,{...evidence,fileKey:'wrong'},{...evidence,nodeId:'other'},{...evidence,fetchedAt:undefined},{...evidence,document:null}]) {
    const report=run({evidence:changed});
    assert.equal(report.summary.MATCH,0); assert.equal(exitCode(report),2);
  }
});

test('public snapshot is sanitized: allowlisted fields only, no private identifiers', () => {
  const raw = JSON.stringify(evidence);
  assert.equal(evidence.sanitized, true);
  assert.equal(evidence.fileKey, 'sandbox-atlas-card');
  assert.doesNotMatch(raw, /figma\.com|VariableID|boundVariables|figd_|\/Users\//);
  assert.deepEqual(validateEvidence(evidence), evidence);
});

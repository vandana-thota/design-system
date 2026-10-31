import { mapping, checks } from './mapping.mjs';
import { inspectCss, normalizeColor, normalizeLength } from './css.mjs';
import { inspectJsx, codeShape, figmaShape } from './jsx.mjs';
import { validateEvidence } from './figma.mjs';

const attempt = fn => { try { return { value: fn() }; } catch (e) { return { error: e.message }; } };
const same = (a,b) => JSON.stringify(a) === JSON.stringify(b);
const link = id => `${mapping.url.split('?')[0]}?node-id=${id.replace(':','-')}`;

function indexNodes(root) {
  const nodes = new Map();
  function visit(n) {
    if (!n || typeof n.id !== 'string' || nodes.has(n.id)) throw new Error('Invalid or duplicate Figma node ID');
    nodes.set(n.id,n);
    for (const child of n.children ?? []) visit(child);
  }
  visit(root);
  return nodes;
}

function expectedValue(check, node) {
  if (!node) throw new Error(`Mapped node ${check.nodeId} unavailable in V1 subtree`);
  if (check.kind === 'color') {
    const fills = node.fills?.filter(f=>f.visible !== false);
    if (!fills || fills.length !== 1 || fills[0].type !== 'SOLID') throw new Error('Expected one visible solid fill; gradients/multiple fills are not inspected');
    const fill = fills[0];
    if ((fill.blendMode && fill.blendMode !== 'NORMAL') || node.opacity !== undefined && node.opacity !== 1) throw new Error('Blending/node opacity requires rendered inspection');
    return normalizeColor({ ...fill.color, a: (fill.opacity ?? 1) * (fill.color?.a ?? 1) });
  }
  if (check.kind === 'direction') {
    if (node.layoutMode === 'VERTICAL') return 'column';
    if (node.layoutMode === 'HORIZONTAL') return 'row';
    throw new Error('Figma auto-layout direction unavailable/unsupported');
  }
  if (check.figma === 'itemSpacing' && (node.layoutMode !== 'VERTICAL' || node.primaryAxisAlignItems === 'SPACE_BETWEEN')) throw new Error('Gap comparison requires vertical packed Figma auto layout');
  const value = check.cornerIndex === undefined ? node[check.figma] : node[check.figma] ?? node.rectangleCornerRadii?.[check.cornerIndex] ?? node.cornerRadius;
  if (typeof value !== 'number') throw new Error(`Figma ${check.figma} unavailable`);
  return normalizeLength(value);
}

export function compare({ evidence, figmaError, css, jsx, mode = 'live' }) {
  const validated = attempt(() => { if (figmaError) throw new Error(figmaError); return validateEvidence(evidence); });
  const indexed = validated.error ? validated : attempt(()=>indexNodes(evidence.document));
  const parsedJsx = attempt(()=>inspectJsx(jsx, mapping));
  const parsedCss = attempt(()=>inspectCss(css, mapping.cssFile));
  const results = checks.map(check => {
    const selector = mapping.nodes[check.nodeId].selector;
    const expected = indexed.error ? indexed : attempt(()=>expectedValue(check,indexed.value.get(check.nodeId)));
    let cssDetail;
    const actual = attempt(()=>{
      if (parsedJsx.error || parsedCss.error) throw new Error(parsedJsx.error ?? parsedCss.error);
      const elements = parsedJsx.value.elements.filter(n=>n.classes.includes(selector.slice(1)));
      if (elements.length !== 1) throw new Error(`Expected one ${selector} element; found ${elements.length}`);
      const element = elements[0];
      if (check.css === 'row-gap' || check.css === 'flex-direction') {
        const display = parsedCss.value.read(element,'display');
        if (!['flex','inline-flex'].includes(display.value)) throw new Error('Spacing/direction comparison requires flex display');
        if (check.css === 'row-gap' && parsedCss.value.read(element,'flex-direction').value !== 'column') throw new Error('Vertical gap comparison requires column direction');
      }
      cssDetail = parsedCss.value.read(element,check.css);
      return check.kind === 'color' ? normalizeColor(cssDetail.value) : check.kind === 'length' ? normalizeLength(cssDetail.value) : ['row','column','row-reverse','column-reverse'].includes(cssDetail.value) ? cssDetail.value : (()=>{throw new Error('Unsupported flex direction');})();
    });
    return {
      property: check.label,
      status: expected.error || actual.error ? 'NOT CHECKED' : same(expected.value,actual.value) ? 'MATCH' : 'DRIFT',
      expected: expected.value ?? null, actual: actual.value ?? null,
      figmaSource: `${link(check.nodeId)} [${check.nodeId}.${check.figma}]`,
      codeSources: cssDetail?.sources ?? [`${mapping.cssFile} [${selector} → ${check.css}; no resolved declaration]`],
      rawCss: cssDetail?.raw ?? null,
      reason: [expected.error && `Figma: ${expected.error}`, actual.error && `Code: ${actual.error}`].filter(Boolean).join('; ') || 'Compared inspected normalized values',
    };
  });
  const expected = validated.error ? validated : attempt(()=>figmaShape(evidence.document,mapping));
  const actual = parsedJsx.error ? parsedJsx : attempt(()=>codeShape(parsedJsx.value.root));
  results.push({
    property: 'Component structure',
    status: expected.error || actual.error ? 'NOT CHECKED' : same(expected.value,actual.value) ? 'MATCH' : 'DRIFT',
    expected: expected.value ?? null, actual: actual.value ?? null,
    figmaSource: `${link(mapping.nodeId)} [children; explicit text-wrapper mapping in drift/mapping.mjs]`,
    codeSources: parsedJsx.value?.elements.map(n=>n.source) ?? [mapping.jsxFile],
    reason: [expected.error,actual.error].filter(Boolean).join('; ') || 'Compared mapped tag/class hierarchy, child order and text slots (not text copy)',
  });
  results.push({ property: 'Rendered appearance / external CSS / typography', status: 'NOT CHECKED', expected: null, actual: null, figmaSource: mapping.url, codeSources: [mapping.cssFile,mapping.jsxFile], reason: 'V1 checks the default Card source only. No browser, external styles, supplied className, typography or interaction-state comparison.' });
  return {
    generatedAt: new Date().toISOString(), mode,
    figma: { url: mapping.url, provider: evidence?.provider ?? null, fetchedAt: evidence?.fetchedAt ?? null, version: evidence?.version ?? null, error: validated.error ?? null },
    scope: 'Default Card source contract; only mapped Version 1 subtree. Snapshot mode is recorded evidence, never a fresh Figma check.',
    summary: Object.fromEntries(['MATCH','DRIFT','NOT CHECKED'].map(s=>[s,results.filter(r=>r.status===s).length])), results,
  };
}

export function exitCode(report) {
  if (report.results.slice(0,-1).some(r=>r.status === 'NOT CHECKED')) return 2;
  return report.summary.DRIFT ? 1 : 0;
}

export function markdown(report) {
  const value = v => v === null ? 'Unavailable' : typeof v === 'object' ? JSON.stringify(v) : String(v);
  const cell = v => value(v).replaceAll('|','\\|').replaceAll('\n',' ');
  return `# Version 1 drift report\n\nMode: **${report.mode}**. Figma retrieval: ${report.figma.fetchedAt ?? 'unavailable'}. Report: ${report.generatedAt}.\n\n${report.scope}\n\n${Object.entries(report.summary).map(([s,n])=>`${s}: ${n}`).join(' · ')}\n\n| Property | Status | Expected Figma | Actual code | Figma source | Code source(s) | Notes |\n| --- | --- | --- | --- | --- | --- | --- |\n${report.results.map(r=>`| ${cell(r.property)} | ${r.status} | ${cell(r.expected)} | ${cell(r.actual)} | ${cell(r.figmaSource)} | ${cell(r.codeSources.join('; '))} | ${cell(r.reason)} |`).join('\n')}\n\nColors are [red, green, blue, alpha]; lengths are CSS pixels. Source lines include the winning declaration and resolved variable definitions.\n`;
}

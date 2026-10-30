// Component Builder: builds the documentation pages and components from components.json,
// using the variables that Token Sync created.
//
// Part 1 is plain JavaScript with no Figma calls, so dry-run.mjs can run it in Node.
// Part 2 (below it) talks to Figma and only runs when `figma` exists.

// ---------------------------------------------------------------------------------------------
// Part 1: reading components.json (no Figma calls)
// ---------------------------------------------------------------------------------------------

// A variable reference is "<Collection>/<variable name>", e.g. "Component/button/primary/bg".
// "Semantic" means "Semantic / Light" when Token Sync had to split Light and Dark.
const COLLECTION_KEYS = ['Primitives', 'Semantic', 'Component'];

// A type style reference ("Semantic/type/label-m") stands for these four variables.
const TYPE_PARTS = ['size/mobile', 'line-height/mobile', 'font-family', 'font-weight'];

// Property name in components.json -> what kind of variable it needs.
const PROP_KINDS = {
  height: 'float', width: 'float', paddingX: 'float', paddingY: 'float', padding: 'float',
  gap: 'float', radius: 'float', strokeWidth: 'float', size: 'float', offset: 'float',
  fill: 'color', stroke: 'color', color: 'color', typeStyle: 'type',
};
const KIND_TYPE = { float: 'FLOAT', color: 'COLOR' };

// Variables the documentation pages themselves use.
const DOC = {
  canvas: 'Semantic/color/bg/canvas',
  surface: 'Semantic/color/bg/surface',
  border: 'Semantic/color/border/default',
  text: 'Semantic/color/text/primary',
  textSecondary: 'Semantic/color/text/secondary',
  width: 'Semantic/layout/desktop/max-width',
  radius: 'Semantic/radius/card',
  borderWidth: 'Semantic/border-width/default',
  gapXs: 'Semantic/space/stack-xs',
  gapSm: 'Semantic/space/stack-sm',
  gapMd: 'Semantic/space/stack-md',
  gapLg: 'Semantic/space/stack-lg',
  insetMd: 'Semantic/space/inset-md',
  insetLg: 'Semantic/space/inset-lg',
  section: 'Semantic/space/section-md',
  sectionLg: 'Semantic/space/section-lg',
  inline: 'Semantic/space/inline-md',
};
const DOC_TYPES = {
  title: 'Semantic/type/display-l',
  h1: 'Semantic/type/headline-m',
  h2: 'Semantic/type/headline-s',
  h3: 'Semantic/type/title-m',
  h4: 'Semantic/type/title-s',
  body: 'Semantic/type/body-m',
  small: 'Semantic/type/body-s',
  caption: 'Semantic/type/caption',
  code: 'Semantic/type/code',
};

function splitRef(ref) {
  const i = ref.indexOf('/');
  return { collection: ref.slice(0, i), name: ref.slice(i + 1) };
}

// A property in components.json is a single reference, null (nothing), or a list of rules.
// Each rule is { when?, var }. The first rule whose `when` matches wins; no `when` always matches.
function rulesOf(value) {
  if (typeof value === 'string' || value === null) return [{ when: undefined, ref: value }];
  return value.map((r) => ({ when: r.when, ref: r.var }));
}

function matches(when, props) {
  return !when || Object.keys(when).every((k) => (Array.isArray(when[k]) ? when[k].includes(props[k]) : props[k] === when[k]));
}

// Returns { ref } (ref may be null for "nothing"), or undefined when no rule matches.
function pick(value, props) {
  for (const r of rulesOf(value)) if (matches(r.when, props)) return { ref: r.ref };
  return undefined;
}

// Every combination of the component's variant properties, in the order of components.json.
// `exclude` is a list of `when` objects: combinations that do not exist (e.g. a static card cannot be hovered).
function combos(properties, exclude) {
  let out = [{}];
  for (const key of Object.keys(properties)) {
    const next = [];
    for (const o of out) for (const v of properties[key]) next.push(Object.assign({}, o, { [key]: v }));
    out = next;
  }
  return (exclude || []).length ? out.filter((o) => !exclude.some((w) => matches(w, o))) : out;
}

function variantName(props) {
  return Object.keys(props).map((k) => `${k}=${props[k]}`).join(', ');
}

// All nodes of a component's build tree, including the focus ring as a pseudo node.
function walkBuild(node, fn) {
  fn(node);
  if (node.focusRing) fn(Object.assign({ type: 'focusRing' }, node.focusRing));
  for (const child of node.children || []) walkBuild(child, fn);
}

// Every variable reference a component binds, one row per rule.
function listBindings(component) {
  const rows = [];
  walkBuild(component.build, (node) => {
    for (const prop of Object.keys(PROP_KINDS)) {
      if (!(prop in node)) continue;
      for (const r of rulesOf(node[prop])) {
        rows.push({ part: node.name || node.type, property: prop, when: r.when, ref: r.ref, kind: PROP_KINDS[prop] });
      }
    }
  });
  return rows;
}

// Expands a binding row into the variable names it needs: [{ key, type }].
function neededVariables(row) {
  if (row.ref === null) return [];
  const { collection, name } = splitRef(row.ref);
  if (row.kind === 'type') {
    const types = { 'size/mobile': 'FLOAT', 'line-height/mobile': 'FLOAT', 'font-family': 'STRING', 'font-weight': 'FLOAT' };
    return TYPE_PARTS.map((p) => ({ collection, name: `${name}/${p}`, type: types[p] }));
  }
  return [{ collection, name, type: KIND_TYPE[row.kind] }];
}

// Everything the documentation pages need besides the components.
function docVariables() {
  const list = [];
  const color = [DOC.canvas, DOC.surface, DOC.border, DOC.text, DOC.textSecondary];
  for (const ref of Object.values(DOC)) {
    const { collection, name } = splitRef(ref);
    list.push({ collection, name, type: color.includes(ref) ? 'COLOR' : 'FLOAT' });
  }
  for (const ref of Object.values(DOC_TYPES)) {
    for (const v of neededVariables({ ref, kind: 'type' })) list.push(v);
  }
  return list;
}

// Checks components.json against the variables that exist. `known` maps "Collection|name" to a
// variable type ('COLOR', 'FLOAT', 'STRING'). Returns rows for printing and a list of problems.
function checkSpec(spec, known) {
  const problems = [];
  const components = [];

  for (const c of spec.components) {
    const rows = listBindings(c).map((row) => {
      let status = row.ref === null ? 'none' : 'ok';
      for (const need of neededVariables(row)) {
        const type = known.get(`${need.collection}|${need.name}`);
        if (type === undefined) { status = 'MISSING'; problems.push(`${c.name}: variable ${need.collection}/${need.name} does not exist`); }
        else if (type !== need.type) { status = 'WRONG TYPE'; problems.push(`${c.name}: ${need.collection}/${need.name} is ${type}, expected ${need.type}`); }
      }
      if (row.ref !== null && !COLLECTION_KEYS.includes(splitRef(row.ref).collection)) {
        status = 'MISSING';
        problems.push(`${c.name}: "${row.ref}" does not start with Primitives, Semantic or Component`);
      }
      return Object.assign({}, row, { status });
    });

    // Every property of every part that shows in a variant must resolve to something.
    const gaps = new Set();
    for (const props of combos(c.properties, c.exclude)) {
      walkBuild(c.build, (node) => {
        if (!matches(node.when, props)) return;
        for (const prop of Object.keys(PROP_KINDS)) {
          if (prop in node && pick(node[prop], props) === undefined) gaps.add(`${node.name || node.type}.${prop} has no rule for ${variantName(props)}`);
        }
      });
    }
    for (const g of gaps) problems.push(`${c.name}: ${g}`);

    // Annotations need text and a source. Proposed text is counted so it can be approved.
    const annotations = { total: 0, proposed: 0, noSource: 0 };
    const notes = c.annotations || {};
    for (const group of Object.keys(notes)) {
      for (const a of notes[group]) {
        annotations.total += 1;
        if (a.proposed) annotations.proposed += 1;
        if (!a.source || !a.text) { annotations.noSource += 1; problems.push(`${c.name}: annotation in "${group}" has no ${a.text ? 'source' : 'text'}`); }
      }
    }
    if (c.intro && (!c.intro.text || !c.intro.source)) problems.push(`${c.name}: intro needs text and source`);

    // Component tokens that exist for this component but are not bound anywhere.
    const used = new Set(rows.map((r) => r.ref).filter(Boolean));
    const unused = [];
    for (const key of known.keys()) {
      const [collection, name] = key.split('|');
      if (collection === 'Component' && name.startsWith(`${c.id}/`) && !used.has(`Component/${name}`)) unused.push(name);
    }
    components.push({ component: c, rows, annotations, unused });
  }

  const docNeeds = docVariables();
  for (const need of docNeeds) {
    const type = known.get(`${need.collection}|${need.name}`);
    if (type === undefined) problems.push(`Documentation pages: variable ${need.collection}/${need.name} does not exist`);
    else if (type !== need.type) problems.push(`Documentation pages: ${need.collection}/${need.name} is ${type}, expected ${need.type}`);
  }
  for (const f of spec.system.facts || []) if (!f.source) problems.push(`Cover fact "${f.label}" has no source`);
  if (!spec.system.descriptionSource) problems.push('Cover description has no source');

  return { components, problems, docVariableCount: docNeeds.length };
}

// "'Fraunces Variable', Georgia, serif" -> "Fraunces"
function firstFamily(stack) {
  const first = String(stack).split(',')[0].trim().replace(/^['"]|['"]$/g, '');
  return first.replace(/\s+Variable$/, '');
}

function toHex(c) {
  const h = (n) => Math.round(n * 255).toString(16).padStart(2, '0');
  return `#${h(c.r)}${h(c.g)}${h(c.b)}`.toUpperCase();
}

// ---------------------------------------------------------------------------------------------
// Part 2: build in Figma
// ---------------------------------------------------------------------------------------------

const ctx = {};

function resetContext() {
  ctx.vars = new Map();      // "Collection|name" -> Figma variable
  ctx.byId = new Map();      // variable id -> Figma variable
  ctx.fontStyles = new Map();// family -> Set of styles
  ctx.fontCache = new Map(); // "family|weight" -> font name actually used
  ctx.report = {
    pages: [], components: [], missingVariables: [], unbound: [], fontFallbacks: [],
    apiIssues: [], notes: [], errors: [],
  };
}

function note(list, text) { if (!list.includes(text)) list.push(text); }

function getVar(ref) {
  if (!ref) return undefined;
  const { collection, name } = splitRef(ref);
  const v = ctx.vars.get(`${collection}|${name}`);
  if (!v) note(ctx.report.missingVariables, ref);
  return v;
}

// Follows aliases down to a plain value (number, string or {r,g,b,a}).
function resolveValue(variable) {
  let v = variable;
  for (let i = 0; v && i < 10; i++) {
    const modeId = Object.keys(v.valuesByMode)[0];
    const value = v.valuesByMode[modeId];
    if (value && value.type === 'VARIABLE_ALIAS') { v = ctx.byId.get(value.id); continue; }
    return value;
  }
  return undefined;
}

function resolveRef(ref) {
  const v = getVar(ref);
  return v ? resolveValue(v) : undefined;
}

// An API call that failed: keep the exact error and say which fallback was used.
function apiIssue(call, error, fallback) {
  const message = error && error.message ? error.message : String(error);
  const key = `${call} | ${message} | ${fallback}`;
  const found = ctx.report.apiIssues.find((i) => i.key === key);
  if (found) found.count += 1;
  else ctx.report.apiIssues.push({ key, call, message, fallback, count: 1 });
}

// Sets a number from a variable. `plain(value)` is the fallback: the typed number from the variable.
function bindFloat(node, field, ref, plain) {
  const v = getVar(ref);
  if (!v) { note(ctx.report.unbound, `${node.name}.${field}: ${ref}`); return; }
  try {
    node.setBoundVariable(field, v);
  } catch (e) {
    apiIssue(`setBoundVariable('${field}')`, e, 'typed the number from the variable instead (not bound)');
    note(ctx.report.unbound, `${node.name}.${field}: ${ref}`);
    const n = resolveValue(v);
    if (typeof n === 'number') plain(n);
  }
}

const FOUR = {
  padding: ['paddingLeft', 'paddingRight', 'paddingTop', 'paddingBottom'],
  paddingX: ['paddingLeft', 'paddingRight'],
  paddingY: ['paddingTop', 'paddingBottom'],
  radius: ['topLeftRadius', 'topRightRadius', 'bottomLeftRadius', 'bottomRightRadius'],
};

function bindEach(node, prop, ref) {
  for (const field of FOUR[prop]) bindFloat(node, field, ref, (n) => { node[field] = n; });
}

// Fill or stroke bound to a COLOR variable. ref === null clears it.
function bindPaint(node, prop, ref) {
  if (ref === null || ref === undefined) { node[prop] = []; return; }
  const v = getVar(ref);
  if (!v) { node[prop] = []; note(ctx.report.unbound, `${node.name}.${prop}: ${ref}`); return; }
  try {
    const paint = figma.variables.setBoundVariableForPaint({ type: 'SOLID', color: { r: 0, g: 0, b: 0 } }, 'color', v);
    node[prop] = [paint];
  } catch (e) {
    apiIssue('setBoundVariableForPaint', e, 'used a plain color copied from the variable (not bound)');
    note(ctx.report.unbound, `${node.name}.${prop}: ${ref}`);
    const c = resolveValue(v);
    node[prop] = c ? [{ type: 'SOLID', color: { r: c.r, g: c.g, b: c.b }, opacity: c.a === undefined ? 1 : c.a }] : [];
  }
}

function setSize(node, w, h) { node.resize(w === undefined ? node.width : w, h === undefined ? node.height : h); }

// --- fonts -----------------------------------------------------------------------------------

// Weight of a Figma style name such as "SemiBold" or "9pt Soft Medium". Italic styles are never used.
const STYLE_WEIGHTS = [
  ['extralight', 200], ['ultralight', 200], ['extrabold', 800], ['semibold', 600], ['demibold', 600],
  ['thin', 100], ['light', 300], ['regular', 400], ['book', 400], ['roman', 400], ['medium', 500],
  ['bold', 700], ['black', 900], ['heavy', 900],
];

function styleWeight(style) {
  const s = style.toLowerCase().replace(/[\s-]/g, '');
  for (const [word, weight] of STYLE_WEIGHTS) if (s.includes(word)) return weight;
  return undefined;
}

// The real style of `styles` closest to `weight`. Ties go to the plainest (shortest) name.
function closestStyle(styles, weight) {
  let best;
  for (const style of styles) {
    if (/italic|oblique/i.test(style)) continue;
    const w = styleWeight(style);
    if (w === undefined) continue;
    const d = Math.abs(w - weight);
    if (!best || d < best.d || (d === best.d && style.length < best.style.length)) best = { style, d };
  }
  return best ? best.style : undefined;
}

async function fontFor(family, weight) {
  const key = `${family}|${weight}`;
  if (ctx.fontCache.has(key)) return ctx.fontCache.get(key);
  let chosen = null;
  for (const fam of [family, 'Inter']) {
    const styles = ctx.fontStyles.get(fam);
    const style = styles && closestStyle(styles, weight);
    if (!style) continue;
    try {
      await figma.loadFontAsync({ family: fam, style });
      chosen = { family: fam, style };
      break;
    } catch (e) {
      apiIssue('loadFontAsync', e, `tried the next font for ${family} ${weight}`);
    }
  }
  if (!chosen) {
    chosen = { family: 'Inter', style: 'Regular' };
    await figma.loadFontAsync(chosen);
  }
  // Report whenever the result is not an exact match, with the style names Figma actually has.
  const exact = chosen.family === family && styleWeight(chosen.style) === weight;
  if (!exact) {
    const have = ctx.fontStyles.get(family);
    const list = have ? Array.from(have).sort().join(', ') : 'none, the family is not installed';
    note(ctx.report.fontFallbacks, `${family} weight ${weight}: used ${chosen.family} ${chosen.style}. Styles Figma lists for ${family}: ${list}`);
  }
  ctx.fontCache.set(key, chosen);
  return chosen;
}

// --- building blocks -------------------------------------------------------------------------

// Auto layout frame for documentation. Spacing keys take variable references.
function docFrame(parent, o) {
  const f = figma.createFrame();
  f.name = o.name;
  parent.appendChild(f);
  f.layoutMode = o.dir || 'VERTICAL';
  f.primaryAxisSizingMode = 'AUTO';
  f.counterAxisSizingMode = 'AUTO';
  f.clipsContent = false;
  if (o.align) f.counterAxisAlignItems = o.align;
  if (o.wrap) f.layoutWrap = 'WRAP';
  f.fills = [];
  if (o.gap) bindFloat(f, 'itemSpacing', o.gap, (n) => { f.itemSpacing = n; });
  if (o.wrap && o.gap) bindFloat(f, 'counterAxisSpacing', o.gap, (n) => { f.counterAxisSpacing = n; });
  if (o.pad) bindEach(f, 'padding', o.pad);
  if (o.padX) bindEach(f, 'paddingX', o.padX);
  if (o.padY) bindEach(f, 'paddingY', o.padY);
  if (o.radius) bindEach(f, 'radius', o.radius);
  if (o.fill) bindPaint(f, 'fills', o.fill);
  if (o.stroke) {
    bindPaint(f, 'strokes', o.stroke);
    f.strokeAlign = 'INSIDE';
    bindFloat(f, 'strokeWeight', DOC.borderWidth, (n) => { f.strokeWeight = n; });
  }
  if (o.width) {
    f.layoutSizingHorizontal = 'FIXED';
    bindFloat(f, 'width', o.width, (n) => setSize(f, n));
  }
  if (o.fixedWidth) {
    f.layoutSizingHorizontal = 'FIXED';
    f.resize(o.fixedWidth, f.height);
  }
  if (o.fillWidth && parent.layoutMode && parent.layoutMode !== 'NONE') f.layoutSizingHorizontal = 'FILL';
  return f;
}

// Text bound to a type style. Font family and weight are looked up from the variables, but not bound:
// the family variable holds a CSS font stack, which is not a Figma font name.
async function docText(parent, str, o) {
  const style = o.style || DOC_TYPES.body;
  const family = firstFamily(resolveRef(`${style}/font-family`) || 'Inter');
  const weight = resolveRef(`${style}/font-weight`) || 400;
  const t = figma.createText();
  parent.appendChild(t);
  t.fontName = await fontFor(family, weight);
  t.characters = str;
  t.name = o.name || str.slice(0, 40);
  const size = resolveRef(`${style}/size/mobile`);
  const line = resolveRef(`${style}/line-height/mobile`);
  if (size) t.fontSize = size;
  if (line) t.lineHeight = { unit: 'PIXELS', value: line };
  bindFloat(t, 'fontSize', `${style}/size/mobile`, (n) => { t.fontSize = n; });
  bindFloat(t, 'lineHeight', `${style}/line-height/mobile`, (n) => { t.lineHeight = { unit: 'PIXELS', value: n }; });
  bindPaint(t, 'fills', o.color || DOC.text);
  if (o.fillWidth && parent.layoutMode && parent.layoutMode !== 'NONE') {
    t.textAutoResize = 'HEIGHT';
    t.layoutSizingHorizontal = 'FILL';
  } else if (o.width) {
    t.textAutoResize = 'HEIGHT';
    t.resize(o.width, t.height);
  }
  return t;
}

function clearByKey(parent, key) {
  for (const child of parent.children.slice()) if (child.getPluginData('cb:key') === key) child.remove();
}

function keyed(node, key) { node.setPluginData('cb:key', key); return node; }

async function getPage(id, title) {
  const pages = figma.root.children;
  for (const p of pages) await p.loadAsync(); // children and plugin data can only be read on a loaded page
  let page = pages.find((p) => p.getPluginData('cb:page') === id) || pages.find((p) => p.name === title);
  if (!page && id === 'cover') page = pages.find((p) => p.name === 'Page 1' && p.children.length === 0);
  if (!page) page = figma.createPage();
  page.name = title;
  page.setPluginData('cb:page', id);
  await page.loadAsync();
  await figma.setCurrentPageAsync(page);
  return page;
}

// A full-width page root: vertical, canvas colored, with a title.
async function pageRoot(page, key, title, subtitle) {
  clearByKey(page, key);
  const root = keyed(docFrame(page, { name: title, pad: DOC.sectionLg, gap: DOC.section, fill: DOC.canvas, width: DOC.width }), key);
  root.x = 0;
  root.y = 0;
  await docText(root, title, { style: DOC_TYPES.title, name: 'Page title' });
  if (subtitle) await docText(root, subtitle, { style: DOC_TYPES.body, color: DOC.textSecondary, fillWidth: true, name: 'Page subtitle' });
  return root;
}

async function sectionTitle(parent, title, caption) {
  const box = docFrame(parent, { name: `${title} heading`, gap: DOC.gapXs, fillWidth: true });
  await docText(box, title, { style: DOC_TYPES.h1, name: 'Section title' });
  if (caption) await docText(box, caption, { style: DOC_TYPES.small, color: DOC.textSecondary, fillWidth: true, name: 'Section caption' });
  return box;
}

// --- Cover -----------------------------------------------------------------------------------

async function buildCover(spec, componentNames) {
  const page = await getPage('cover', 'Cover');
  const root = await pageRoot(page, 'root', spec.system.name);
  await docText(root, spec.system.description, { style: DOC_TYPES.h3, fillWidth: true, name: 'Description' });
  const facts = docFrame(root, { name: 'Facts', gap: DOC.gapMd, fillWidth: true });
  for (const f of spec.system.facts || []) {
    const row = docFrame(facts, { name: f.label, dir: 'HORIZONTAL', gap: DOC.inline, fillWidth: true });
    await docText(row, f.label, { style: DOC_TYPES.h4, width: 160, name: 'Label' });
    await docText(row, f.text, { style: DOC_TYPES.body, fillWidth: true, name: 'Text' });
  }
  const list = docFrame(root, { name: 'Contents', gap: DOC.gapSm, fillWidth: true });
  await docText(list, 'In this file', { style: DOC_TYPES.h2 });
  await docText(list, 'Foundations: color, type, spacing, radius, motion', { style: DOC_TYPES.body });
  await docText(list, `Components: ${componentNames.join(', ')}`, { style: DOC_TYPES.body });
  await docText(list, 'Shown in the light theme.', { style: DOC_TYPES.small, color: DOC.textSecondary });
  ctx.report.pages.push('Cover');
}

// --- Foundations -----------------------------------------------------------------------------

function semanticVars(prefix) {
  const out = [];
  for (const [key, v] of ctx.vars) {
    const [collection, name] = key.split('|');
    if (collection === 'Semantic' && name.startsWith(prefix)) out.push({ name, variable: v });
  }
  return out;
}

function px(n) { return `${Math.round(n * 100) / 100}px`; }

async function colorSection(parent) {
  const sec = docFrame(parent, { name: 'Color', gap: DOC.gapLg, fillWidth: true });
  await sectionTitle(sec, 'Color', 'Semantic color variables, light theme. Each swatch is filled with its variable.');
  const groups = new Map();
  for (const item of semanticVars('color/')) {
    const group = item.name.split('/')[1];
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group).push(item);
  }
  for (const [group, items] of groups) {
    const box = docFrame(sec, { name: `Color / ${group}`, gap: DOC.gapSm, fillWidth: true });
    await docText(box, group, { style: DOC_TYPES.h3 });
    const wrap = docFrame(box, { name: 'Swatches', dir: 'HORIZONTAL', wrap: true, gap: DOC.gapMd, fillWidth: true });
    for (const item of items) {
      const card = docFrame(wrap, { name: item.name, gap: DOC.gapXs });
      const sw = figma.createRectangle();
      sw.name = 'Swatch';
      card.appendChild(sw);
      sw.resize(120, 56);
      bindEach(sw, 'radius', DOC.radius);
      bindPaint(sw, 'fills', `Semantic/${item.name}`);
      sw.strokes = [];
      bindPaint(sw, 'strokes', DOC.border);
      sw.strokeAlign = 'INSIDE';
      bindFloat(sw, 'strokeWeight', DOC.borderWidth, (n) => { sw.strokeWeight = n; });
      await docText(card, item.name.replace(/^color\//, ''), { style: DOC_TYPES.code, name: 'Variable name' });
      const value = resolveValue(item.variable);
      await docText(card, value && typeof value === 'object' ? toHex(value) : '', { style: DOC_TYPES.caption, color: DOC.textSecondary, name: 'Value' });
    }
  }
}

async function typeSection(parent) {
  const sec = docFrame(parent, { name: 'Type', gap: DOC.gapLg, fillWidth: true });
  await sectionTitle(sec, 'Type', 'Semantic type styles at the mobile size. Tablet and desktop sizes are in the type variables.');
  const names = [];
  for (const item of semanticVars('type/')) {
    const name = item.name.split('/').slice(0, 2).join('/');
    if (!names.includes(name)) names.push(name);
  }
  for (const name of names) {
    const style = `Semantic/${name}`;
    const family = firstFamily(resolveRef(`${style}/font-family`) || '');
    const weight = resolveRef(`${style}/font-weight`);
    const size = resolveRef(`${style}/size/mobile`);
    const line = resolveRef(`${style}/line-height/mobile`);
    const row = docFrame(sec, { name, dir: 'HORIZONTAL', gap: DOC.inline, fillWidth: true, align: 'MIN' });
    const meta = docFrame(row, { name: 'Meta', gap: DOC.gapXs, fixedWidth: 200 });
    await docText(meta, name.replace('type/', ''), { style: DOC_TYPES.code, name: 'Style name' });
    await docText(meta, `${family || '?'} ${weight || ''} · ${size || '?'}/${line || '?'}`, { style: DOC_TYPES.caption, color: DOC.textSecondary, name: 'Details' });
    await docText(row, 'Quiet tools for careful work', { style, fillWidth: true, name: 'Sample' });
  }
}

async function spacingSection(parent) {
  const sec = docFrame(parent, { name: 'Spacing', gap: DOC.gapLg, fillWidth: true });
  await sectionTitle(sec, 'Spacing', 'Semantic space variables. Each bar is as wide as its variable.');
  for (const item of semanticVars('space/')) {
    const row = docFrame(sec, { name: item.name, dir: 'HORIZONTAL', gap: DOC.inline, align: 'CENTER', fillWidth: true });
    const label = await docText(row, item.name.replace('space/', ''), { style: DOC_TYPES.code, name: 'Variable name' });
    label.textAutoResize = 'HEIGHT';
    label.resize(160, label.height);
    const bar = figma.createRectangle();
    bar.name = 'Bar';
    row.appendChild(bar);
    bar.resize(1, 16);
    bindFloat(bar, 'width', `Semantic/${item.name}`, (n) => bar.resize(n || 1, bar.height));
    bindPaint(bar, 'fills', 'Semantic/color/accent/default');
    const value = resolveValue(item.variable);
    await docText(row, typeof value === 'number' ? px(value) : '', { style: DOC_TYPES.caption, color: DOC.textSecondary, name: 'Value' });
  }
}

async function radiusSection(parent) {
  const sec = docFrame(parent, { name: 'Radius', gap: DOC.gapLg, fillWidth: true });
  await sectionTitle(sec, 'Radius', 'Semantic radius variables, bound to all four corners.');
  const wrap = docFrame(sec, { name: 'Radii', dir: 'HORIZONTAL', wrap: true, gap: DOC.gapLg, fillWidth: true });
  for (const item of semanticVars('radius/')) {
    const card = docFrame(wrap, { name: item.name, gap: DOC.gapXs });
    const box = figma.createRectangle();
    box.name = 'Shape';
    card.appendChild(box);
    box.resize(96, 64);
    bindEach(box, 'radius', `Semantic/${item.name}`);
    bindPaint(box, 'fills', DOC.surface);
    bindPaint(box, 'strokes', DOC.border);
    box.strokeAlign = 'INSIDE';
    bindFloat(box, 'strokeWeight', DOC.borderWidth, (n) => { box.strokeWeight = n; });
    await docText(card, item.name.replace('radius/', ''), { style: DOC_TYPES.code, name: 'Variable name' });
    const value = resolveValue(item.variable);
    await docText(card, typeof value === 'number' ? px(value) : '', { style: DOC_TYPES.caption, color: DOC.textSecondary, name: 'Value' });
  }
}

async function motionSection(parent) {
  const sec = docFrame(parent, { name: 'Motion', gap: DOC.gapLg, fillWidth: true });
  await sectionTitle(sec, 'Motion', 'Semantic motion variables. Durations are in milliseconds. Figma shows them as a table, not an animation.');
  const names = [];
  for (const item of semanticVars('motion/')) {
    const name = item.name.split('/')[1];
    if (!names.includes(name)) names.push(name);
  }
  for (const name of names) {
    const row = docFrame(sec, { name, dir: 'HORIZONTAL', gap: DOC.inline, fillWidth: true });
    const duration = resolveRef(`Semantic/motion/${name}/duration`);
    const easing = resolveRef(`Semantic/motion/${name}/easing`);
    const a = await docText(row, name, { style: DOC_TYPES.code, name: 'Name' });
    a.textAutoResize = 'HEIGHT';
    a.resize(160, a.height);
    const b = await docText(row, typeof duration === 'number' ? `${duration} ms` : '', { style: DOC_TYPES.body, name: 'Duration' });
    b.textAutoResize = 'HEIGHT';
    b.resize(120, b.height);
    await docText(row, easing ? String(easing) : '', { style: DOC_TYPES.code, color: DOC.textSecondary, fillWidth: true, name: 'Easing' });
  }
}

async function buildFoundations() {
  const page = await getPage('foundations', 'Foundations');
  const root = await pageRoot(page, 'root', 'Foundations', 'Everything on this page is read from the Figma variables created by Token Sync.');
  await colorSection(root);
  await typeSection(root);
  await spacingSection(root);
  await radiusSection(root);
  await motionSection(root);
  ctx.report.pages.push('Foundations');
}

// --- Components ------------------------------------------------------------------------------

function applyAutoLayout(f, s) {
  f.layoutMode = s.direction || 'HORIZONTAL';
  f.primaryAxisAlignItems = s.primary || 'MIN';
  f.counterAxisAlignItems = s.counter || 'MIN';
  f.clipsContent = false;
}

// Applies the frame properties of a build node to a frame, from scratch.
function applyFrame(f, s, props, isRoot) {
  applyAutoLayout(f, s);
  f.itemSpacing = 0;
  for (const field of [...FOUR.padding, ...FOUR.radius]) f[field] = 0;
  if (s.height) {
    const ref = pick(s.height, props).ref;
    f.resize(f.width, 40);
    f.layoutSizingVertical = 'FIXED';
    bindFloat(f, 'height', ref, (n) => setSize(f, undefined, n));
  } else {
    f.layoutSizingVertical = 'HUG';
  }
  f.layoutSizingHorizontal = 'HUG';
  if (s.fixedWidth) {
    f.layoutSizingHorizontal = 'FIXED';
    f.resize(s.fixedWidth, f.height);
  }
  if (s.padding) bindEach(f, 'padding', pick(s.padding, props).ref);
  if (s.paddingX) bindEach(f, 'paddingX', pick(s.paddingX, props).ref);
  if (s.paddingY) bindEach(f, 'paddingY', pick(s.paddingY, props).ref);
  if (s.gap) bindFloat(f, 'itemSpacing', pick(s.gap, props).ref, (n) => { f.itemSpacing = n; });
  if (s.radius) bindEach(f, 'radius', pick(s.radius, props).ref);
  bindPaint(f, 'fills', s.fill ? pick(s.fill, props).ref : null);
  const stroke = s.stroke ? pick(s.stroke, props).ref : null;
  bindPaint(f, 'strokes', stroke);
  if (stroke) {
    f.strokeAlign = 'INSIDE';
    bindFloat(f, 'strokeWeight', pick(s.strokeWidth, props).ref, (n) => { f.strokeWeight = n; });
  }
}

async function buildChild(parent, s, props) {
  if (!matches(s.when, props)) return;
  if (s.type === 'text') {
    const style = pick(s.typeStyle, props).ref;
    const t = await docText(parent, s.text, { style, color: pick(s.fill, props).ref, name: s.name, fillWidth: s.fillWidth });
    if (!s.fillWidth) t.textAutoResize = 'WIDTH_AND_HEIGHT';
  } else if (s.type === 'icon') {
    // A plain filled circle standing in for the icon glyph.
    const sizeRef = pick(s.size, props).ref;
    const dot = figma.createEllipse();
    dot.name = s.name || 'Icon';
    parent.appendChild(dot);
    const size = resolveRef(sizeRef) || 16;
    dot.resize(size, size);
    bindFloat(dot, 'width', sizeRef, (n) => setSize(dot, n, undefined));
    bindFloat(dot, 'height', sizeRef, (n) => setSize(dot, undefined, n));
    bindPaint(dot, 'fills', pick(s.color, props).ref);
    dot.strokes = [];
  } else if (s.type === 'spinner') {
    const sizeRef = pick(s.size, props).ref;
    const colorRef = pick(s.color, props).ref;
    const widthRef = pick(s.strokeWidth, props).ref;
    const frame = figma.createFrame();
    frame.name = s.name || 'Spinner';
    parent.appendChild(frame);
    frame.layoutMode = 'NONE';
    frame.fills = [];
    frame.clipsContent = false;
    const size = resolveRef(sizeRef) || 16;
    frame.resize(size, size);
    bindFloat(frame, 'width', sizeRef, (n) => setSize(frame, n, undefined));
    bindFloat(frame, 'height', sizeRef, (n) => setSize(frame, undefined, n));
    const track = figma.createEllipse();
    track.name = 'Track';
    frame.appendChild(track);
    track.resize(size, size);
    track.fills = [];
    bindPaint(track, 'strokes', colorRef);
    track.strokeAlign = 'INSIDE';
    bindFloat(track, 'strokeWeight', widthRef, (n) => { track.strokeWeight = n; });
    track.opacity = 0.3;
    const arc = figma.createEllipse();
    arc.name = 'Arc';
    frame.appendChild(arc);
    arc.resize(size, size);
    arc.fills = [];
    bindPaint(arc, 'strokes', colorRef);
    arc.strokeAlign = 'INSIDE';
    arc.strokeCap = 'ROUND';
    bindFloat(arc, 'strokeWeight', widthRef, (n) => { arc.strokeWeight = n; });
    try {
      arc.arcData = { startingAngle: -Math.PI / 2, endingAngle: 0, innerRadius: 0 };
    } catch (e) {
      apiIssue('ellipse.arcData', e, 'the spinner arc is drawn as a full ring');
    }
  } else if (s.type === 'frame') {
    const f = figma.createFrame();
    f.name = s.name || 'Frame';
    parent.appendChild(f);
    applyFrame(f, s, props, false);
    if (s.fillWidth) f.layoutSizingHorizontal = 'FILL';
    for (const c of s.children || []) await buildChild(f, c, props);
  }
}

function addFocusRing(root, ring, props) {
  if (!matches(ring.when, props)) return;
  const offset = resolveRef(ring.offset) || 0;
  const rect = figma.createRectangle();
  rect.name = ring.name || 'Focus ring';
  root.appendChild(rect);
  rect.layoutPositioning = 'ABSOLUTE';
  rect.fills = [];
  rect.resize(root.width + offset * 2, root.height + offset * 2);
  rect.x = -offset;
  rect.y = -offset;
  bindPaint(rect, 'strokes', ring.color);
  rect.strokeAlign = 'OUTSIDE';
  bindFloat(rect, 'strokeWeight', ring.width, (n) => { rect.strokeWeight = n; });
  if (ring.radius) bindEach(rect, 'radius', ring.radius);
}

async function buildVariant(component, spec, props) {
  for (const child of component.children.slice()) child.remove();
  applyFrame(component, spec.build, props, true);
  for (const c of spec.build.children || []) await buildChild(component, c, props);
  if (spec.build.focusRing) addFocusRing(component, spec.build.focusRing, props);
}

// Lays the variants out in a grid: one row per combination of every property except the last one,
// one column per value of the last property. Cell gaps are layout of the canvas, not component styling.
function arrangeVariants(set, spec) {
  const keys = Object.keys(spec.properties);
  const colKey = keys[keys.length - 1];
  const cols = spec.properties[colKey];
  const rowCombos = combos(Object.fromEntries(keys.slice(0, -1).map((k) => [k, spec.properties[k]])));
  const GAP = 24;
  const byName = new Map(set.children.map((c) => [c.name, c]));
  const colW = cols.map(() => 0);
  const rowH = rowCombos.map(() => 0);
  rowCombos.forEach((rc, r) => cols.forEach((cv, c) => {
    const node = byName.get(variantName(Object.assign({}, rc, { [colKey]: cv })));
    if (!node) return;
    colW[c] = Math.max(colW[c], node.width);
    rowH[r] = Math.max(rowH[r], node.height);
  }));
  let y = GAP;
  rowCombos.forEach((rc, r) => {
    let x = GAP;
    cols.forEach((cv, c) => {
      const node = byName.get(variantName(Object.assign({}, rc, { [colKey]: cv })));
      if (node) { node.x = x; node.y = y; }
      x += colW[c] + GAP;
    });
    y += rowH[r] + GAP;
  });
  set.resize(colW.reduce((a, b) => a + b, 0) + GAP * (cols.length + 1), rowH.reduce((a, b) => a + b, 0) + GAP * (rowCombos.length + 1));
}

// Finds this component's set anywhere on the page: by the id the plugin stored, or else by name.
// Extra copies (from earlier runs) are reported and left alone; the first one is the one updated.
function findExistingSet(page, spec) {
  const sets = page.findAll((n) => n.type === 'COMPONENT_SET');
  const tagged = sets.filter((n) => n.getPluginData('cb:id') === spec.id);
  const found = tagged.length ? tagged : sets.filter((n) => n.name === spec.name && !n.getPluginData('cb:id'));
  if (found.length > 1) note(ctx.report.notes, `${spec.name}: ${found.length} component sets with this name exist. The first one was updated; delete the others by hand.`);
  return found[0];
}

// Loose components left on the page by a run that stopped before the set was made.
function removeLeftovers(page, spec) {
  for (const n of page.children.slice()) {
    if (n.type === 'COMPONENT' && n.getPluginData('cb:variant') === spec.id) n.remove();
  }
}

async function buildComponentSet(specimen, spec, existing) {
  const result = { name: spec.name, created: 0, updated: 0, variants: 0 };
  let set = existing;
  if (set) {
    set.setPluginData('cb:id', spec.id);
    if (set.parent !== specimen) specimen.appendChild(set);
  }
  const all = combos(spec.properties, spec.exclude);
  const made = [];

  if (!set) {
    for (const props of all) {
      const c = figma.createComponent();
      c.name = variantName(props);
      c.setPluginData('cb:variant', spec.id);
      await buildVariant(c, spec, props);
      made.push(c);
      result.created += 1;
    }
    set = figma.combineAsVariants(made, specimen);
    set.name = spec.name;
    set.setPluginData('cb:id', spec.id);
    for (const c of set.children) c.setPluginData('cb:variant', '');
  } else {
    for (const props of all) {
      const name = variantName(props);
      let c = set.children.find((n) => n.name === name);
      if (c) {
        result.updated += 1;
      } else {
        c = figma.createComponent();
        c.name = name;
        try {
          set.appendChild(c);
        } catch (e) {
          apiIssue('componentSet.appendChild', e, 'the new variant was left outside the set');
        }
        result.created += 1;
      }
      await buildVariant(c, spec, props);
    }
    const names = new Set(all.map(variantName));
    const orphans = set.children.filter((n) => !names.has(n.name)).map((n) => n.name);
    if (orphans.length) note(ctx.report.notes, `${spec.name}: variants not in components.json were left alone: ${orphans.join('; ')}`);
  }
  result.variants = set.children.length;
  if (spec.intro) { try { set.description = spec.intro.text; } catch (e) { apiIssue('componentSet.description', e, 'description not set'); } }
  arrangeVariants(set, spec);
  return result;
}

function whenText(when) {
  return when ? Object.keys(when).map((k) => `${k}=${when[k]}`).join(', ') : 'all';
}

async function annotationList(parent, title, items) {
  const box = docFrame(parent, { name: title, gap: DOC.gapSm, fillWidth: true });
  await docText(box, title, { style: DOC_TYPES.h3 });
  for (const a of items) {
    const item = docFrame(box, { name: 'Note', gap: DOC.gapXs, fillWidth: true });
    const head = a.name ? `${a.name}: ${a.text}` : a.text;
    await docText(item, a.proposed ? `${head} [Proposed]` : head, { style: DOC_TYPES.body, fillWidth: true, name: 'Text' });
    await docText(item, `Source: ${a.source}`, { style: DOC_TYPES.caption, color: DOC.textSecondary, fillWidth: true, name: 'Source' });
  }
}

async function tokenMap(parent, spec) {
  const box = docFrame(parent, { name: 'Token map', gap: DOC.gapSm, fillWidth: true });
  await docText(box, 'Which variable each part uses', { style: DOC_TYPES.h3 });
  await docText(box, 'Generated from the same data that builds the component, so it always matches.', { style: DOC_TYPES.small, color: DOC.textSecondary, fillWidth: true });
  for (const r of listBindings(spec)) {
    const row = docFrame(box, { name: `${r.part}.${r.property}`, dir: 'HORIZONTAL', gap: DOC.inline, fillWidth: true });
    const a = await docText(row, `${r.part} · ${r.property}`, { style: DOC_TYPES.code, name: 'Part' });
    a.textAutoResize = 'HEIGHT';
    a.resize(220, a.height);
    const b = await docText(row, whenText(r.when), { style: DOC_TYPES.caption, color: DOC.textSecondary, name: 'When' });
    b.textAutoResize = 'HEIGHT';
    b.resize(260, b.height);
    await docText(row, r.ref === null ? 'none (empty)' : r.ref, { style: DOC_TYPES.code, fillWidth: true, name: 'Variable' });
  }
}

async function buildComponentsPage(spec, onlyComponentIds) {
  const page = await getPage('components', 'Components');
  let root = page.children.find((n) => n.getPluginData('cb:key') === 'root');
  if (root) {
    for (const child of root.children.slice()) {
      if (child.getPluginData('cb:key') === 'page-heading') child.remove();
    }
  } else {
    root = keyed(docFrame(page, { name: 'Components', pad: DOC.sectionLg, gap: DOC.section, fill: DOC.canvas, width: DOC.width }), 'root');
    root.x = 0;
    root.y = 0;
  }
  const heading = keyed(docFrame(root, { name: 'Heading', gap: DOC.gapXs, fillWidth: true }), 'page-heading');
  await docText(heading, 'Components', { style: DOC_TYPES.title, name: 'Page title' });
  await docText(heading, 'Shown in the light theme. Every fill, stroke, radius, padding and gap is bound to a variable.', { style: DOC_TYPES.body, color: DOC.textSecondary, fillWidth: true });
  root.insertChild(0, heading);

  for (const spec of onlyComponentIds) {
    let section = root.children.find((n) => n.getPluginData('cb:key') === `section:${spec.id}`);
    if (!section) {
      section = keyed(docFrame(root, { name: spec.name, gap: DOC.gapLg, fillWidth: true, pad: DOC.insetLg, fill: DOC.surface, stroke: DOC.border, radius: DOC.radius }), `section:${spec.id}`);
    }
    removeLeftovers(page, spec);
    const existing = findExistingSet(page, spec);
    for (const child of section.children.slice()) {
      if (child.getPluginData('cb:key') !== 'specimen' && child !== existing) child.remove();
    }
    const head = docFrame(section, { name: 'Header', gap: DOC.gapSm, fillWidth: true });
    await docText(head, spec.name, { style: DOC_TYPES.h1, name: 'Component name' });
    if (spec.intro) {
      await docText(head, spec.intro.text, { style: DOC_TYPES.body, fillWidth: true, name: 'Intro' });
      await docText(head, `Source: ${spec.intro.source}`, { style: DOC_TYPES.caption, color: DOC.textSecondary, fillWidth: true, name: 'Intro source' });
    }
    let specimen = section.children.find((n) => n.getPluginData('cb:key') === 'specimen');
    if (!specimen) {
      specimen = keyed(docFrame(section, { name: 'Specimen', fillWidth: true }), 'specimen');
    }
    section.insertChild(0, head);
    const built = await buildComponentSet(specimen, spec, existing);
    ctx.report.components.push(built);

    const notes = spec.annotations || {};
    const ann = docFrame(section, { name: 'Annotations', gap: DOC.gapLg, fillWidth: true });
    if (notes.whenToUse) await annotationList(ann, 'When to use', notes.whenToUse);
    if (notes.states) await annotationList(ann, 'States', notes.states);
    await tokenMap(ann, spec);
    if (notes.accessibility) await annotationList(ann, 'Accessibility', notes.accessibility);
  }
  ctx.report.pages.push('Components');
}

// --- run -------------------------------------------------------------------------------------

async function prepare() {
  resetContext();
  const collections = await figma.variables.getLocalVariableCollectionsAsync();
  const variables = await figma.variables.getLocalVariablesAsync();
  const names = new Map(collections.map((c) => [c.id, c.name]));
  const hasLight = collections.some((c) => c.name === 'Semantic / Light');
  const logical = (n) => (n === 'Semantic / Light' || (n === 'Semantic' && !hasLight) ? 'Semantic' : n);
  for (const v of variables) {
    ctx.byId.set(v.id, v);
    const key = logical(names.get(v.variableCollectionId));
    if (COLLECTION_KEYS.includes(key)) ctx.vars.set(`${key}|${v.name}`, v);
  }
  if (!ctx.vars.size) throw new Error('No variables found. Run Token Sync in this file first.');
  const fonts = await figma.listAvailableFontsAsync();
  for (const f of fonts) {
    if (!ctx.fontStyles.has(f.fontName.family)) ctx.fontStyles.set(f.fontName.family, new Set());
    ctx.fontStyles.get(f.fontName.family).add(f.fontName.style);
  }
  note(ctx.report.notes, hasLight
    ? 'Semantic is split into "Semantic / Light" and "Semantic / Dark". The pages use the Light variables only.'
    : 'Semantic has modes; the pages use its first mode (Light).');
}

async function build(spec) {
  await prepare();
  const known = new Map();
  for (const [key, v] of ctx.vars) known.set(key, v.resolvedType);
  const check = checkSpec(spec, known);
  ctx.report.problems = check.problems;

  const steps = [
    ['Cover', () => buildCover(spec, spec.components.map((c) => c.name))],
    ['Foundations', () => buildFoundations()],
    ['Components', () => buildComponentsPage(spec, spec.components)],
  ];
  for (const [name, run] of steps) {
    try {
      await run();
    } catch (e) {
      ctx.report.errors.push(`${name}: ${e && e.message ? e.message : String(e)}`);
    }
  }
  return {
    pages: ctx.report.pages,
    components: ctx.report.components,
    missingVariables: ctx.report.missingVariables,
    unbound: ctx.report.unbound,
    fontFallbacks: ctx.report.fontFallbacks,
    apiIssues: ctx.report.apiIssues.map(({ call, message, fallback, count }) => ({ call, message, fallback, count })),
    notes: ctx.report.notes,
    problems: check.problems,
    errors: ctx.report.errors,
  };
}

if (typeof figma !== 'undefined') {
  figma.showUI(__html__, { width: 460, height: 600 });
  figma.ui.onmessage = async (msg) => {
    if (msg.type !== 'build') return;
    try {
      const result = await build(JSON.parse(msg.spec));
      figma.ui.postMessage({ type: 'done', result });
      figma.notify('Component Builder finished');
    } catch (e) {
      figma.ui.postMessage({ type: 'failed', message: e && e.message ? e.message : String(e) });
    }
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { checkSpec, listBindings, combos, variantName, pick, matches, docVariables, firstFamily, build, resetContext, ctx };
}

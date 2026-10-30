// Token Sync: creates Figma variables from tokens/tokens.json.
//
// Part 1 (mapTokens) is plain JavaScript with no Figma calls, so dry-run.mjs can run it in Node.
// Part 2 (the bottom of the file) talks to Figma and only runs when `figma` exists.

// ---------------------------------------------------------------------------------------------
// Part 1: token JSON -> a flat list of planned variables
// ---------------------------------------------------------------------------------------------

const LAYERS = { primitive: 'Primitives', semantic: 'Semantic', component: 'Component' };
const LAYER_ORDER = ['Primitives', 'Semantic', 'Component'];
const PX_PER_REM = 16;

// Token $type -> Figma variable type. Anything missing here (shadow, ...) cannot be a variable.
const VAR_TYPE = {
  color: 'COLOR',
  dimension: 'FLOAT',
  number: 'FLOAT',
  fontWeight: 'FLOAT',
  duration: 'FLOAT',
  fontFamily: 'STRING',
  cubicBezier: 'STRING',
};

// Fields of the composite tokens: field name -> [variable name part, token type of the field].
const TYPOGRAPHY_FIELDS = {
  fontFamily: ['font-family', 'fontFamily'],
  fontWeight: ['font-weight', 'fontWeight'],
  fontSize: ['size', 'dimension'],
  lineHeight: ['line-height', 'dimension'],
  letterSpacing: ['letter-spacing', 'dimension'],
};
const TRANSITION_FIELDS = {
  duration: ['duration', 'duration'],
  easing: ['easing', 'cubicBezier'],
};
const ELEVATION_FIELDS = {
  surface: ['surface', 'color'],
  shadow: ['shadow', 'shadow'],
};

function collectLeaves(node, path, out) {
  if (node && typeof node === 'object' && '$value' in node) {
    out.push({ path, node });
    return;
  }
  for (const key of Object.keys(node)) {
    if (key[0] !== '$') collectLeaves(node[key], path.concat(key), out);
  }
}

function parseRef(value) {
  const m = typeof value === 'string' ? /^\{([^}]+)\}$/.exec(value.trim()) : null;
  return m ? m[1].split('.') : null;
}

function parseColor(value) {
  const s = String(value).trim();
  let m = /^#([0-9a-f]{3,8})$/i.exec(s);
  if (m) {
    let h = m[1];
    if (h.length === 3 || h.length === 4) h = h.split('').map((c) => c + c).join('');
    if (h.length !== 6 && h.length !== 8) throw new Error(`cannot read color "${s}"`);
    const n = (i) => parseInt(h.slice(i, i + 2), 16) / 255;
    return { r: n(0), g: n(2), b: n(4), a: h.length === 8 ? n(6) : 1 };
  }
  m = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:\s*[/,]\s*([\d.]+%?))?\s*\)$/i.exec(s);
  if (m) {
    const a = m[4] === undefined ? 1 : m[4].endsWith('%') ? parseFloat(m[4]) / 100 : parseFloat(m[4]);
    return { r: m[1] / 255, g: m[2] / 255, b: m[3] / 255, a };
  }
  throw new Error(`cannot read color "${s}"`);
}

// rem -> px at 16px per rem. `em` has no px equivalent without a font size, so it is kept as a
// plain multiplier and reported in the notes.
function parseDimension(value, notes, source) {
  const m = /^(-?\d*\.?\d+)\s*(rem|px|em)?$/.exec(String(value).trim());
  if (!m) throw new Error(`cannot read dimension "${value}"`);
  const n = parseFloat(m[1]);
  if (m[2] === 'rem') return n * PX_PER_REM;
  if (m[2] === 'em') {
    notes.add(`em values are stored as plain multipliers (e.g. -0.02em becomes -0.02): ${source}`);
  }
  return n;
}

function parseDuration(value) {
  const m = /^(-?\d*\.?\d+)\s*(ms|s)?$/.exec(String(value).trim());
  if (!m) throw new Error(`cannot read duration "${value}"`);
  return m[2] === 's' ? parseFloat(m[1]) * 1000 : parseFloat(m[1]);
}

function parseLiteral(tokenType, raw, notes, source) {
  switch (tokenType) {
    case 'color': return parseColor(raw);
    case 'dimension': return parseDimension(raw, notes, source);
    case 'duration': return parseDuration(raw);
    case 'number':
    case 'fontWeight': {
      const n = Number(raw);
      if (Number.isNaN(n)) throw new Error(`cannot read number "${raw}"`);
      return n;
    }
    case 'fontFamily':
    case 'cubicBezier': return String(raw);
    default: throw new Error(`no Figma variable type for "${tokenType}"`);
  }
}

function skipReason(tokenType) {
  return tokenType === 'shadow'
    ? 'shadows cannot be stored in a Figma variable (they need an effect style)'
    : `token type "${tokenType}" has no Figma variable type`;
}

// Input: the parsed tokens.json. Output: { entries, skipped, notes, sourceCounts }.
// Each entry is one variable: { collection, name, type, description, source, value, dark }.
// A value is { alias: { collection, name, ref } } or { literal }. `dark` is only set when the
// token has its own dark value (Semantic only).
function mapTokens(json) {
  const entries = [];
  const skipped = [];
  const notes = new Set();
  const sourceCounts = { Primitives: 0, Semantic: 0, Component: 0 };

  const leaves = [];
  collectLeaves(json, [], leaves);

  function toValue(tokenType, raw, source) {
    const refPath = parseRef(raw);
    if (refPath) {
      const collection = LAYERS[refPath[0]];
      if (!collection) throw new Error(`reference ${raw} points at an unknown layer`);
      return { alias: { collection, name: refPath.slice(1).join('/'), ref: raw } };
    }
    return { literal: parseLiteral(tokenType, raw, notes, source) };
  }

  function add(collection, nameParts, tokenType, raw, darkRaw, description, source) {
    try {
      if (!VAR_TYPE[tokenType]) throw new Error(skipReason(tokenType));
      const entry = {
        collection,
        name: nameParts.join('/'),
        type: VAR_TYPE[tokenType],
        description: description || '',
        source,
        value: toValue(tokenType, raw, source),
      };
      if (darkRaw !== undefined) {
        if (collection === 'Semantic') entry.dark = toValue(tokenType, darkRaw, source);
        else notes.add(`dark value ignored, only Semantic has Light and Dark: ${source}`);
      }
      entries.push(entry);
    } catch (e) {
      skipped.push({ collection, token: source, reason: e.message });
    }
  }

  for (const { path, node } of leaves) {
    const collection = LAYERS[path[0]];
    const dotted = path.join('.');
    if (!collection) {
      skipped.push({ collection: '(none)', token: dotted, reason: `unknown top-level group "${path[0]}"` });
      continue;
    }
    sourceCounts[collection] += 1;
    const base = path.slice(1);
    const type = node.$type;
    const desc = node.$description;
    const dark = node.$extensions && node.$extensions.mode ? node.$extensions.mode.dark : undefined;

    const fieldTable = { typography: TYPOGRAPHY_FIELDS, transition: TRANSITION_FIELDS, elevation: ELEVATION_FIELDS }[type];
    if (!fieldTable) {
      const extra = type === 'duration' ? 'milliseconds' : '';
      add(collection, base, type, node.$value, dark, desc || extra, dotted);
      continue;
    }

    // Composite token: one variable per field.
    const responsive = (node.$extensions && node.$extensions.responsive) || {};
    const breakpoints = ['mobile'].concat(Object.keys(responsive));
    const responsiveFields = new Set();
    for (const bp of Object.keys(responsive)) Object.keys(responsive[bp]).forEach((k) => responsiveFields.add(k));

    for (const [field, raw] of Object.entries(node.$value)) {
      const spec = fieldTable[field];
      if (!spec) {
        skipped.push({ collection, token: `${dotted}.${field}`, reason: `unknown ${type} field "${field}"` });
        continue;
      }
      const [part, fieldType] = spec;
      if (!responsiveFields.has(field)) {
        add(collection, base.concat(part), fieldType, raw, undefined, desc, `${dotted}.${field}`);
        continue;
      }
      // Responsive field: one variable per breakpoint, each inheriting the previous value.
      let current = raw;
      for (const bp of breakpoints) {
        if (bp !== 'mobile' && responsive[bp][field] !== undefined) current = responsive[bp][field];
        add(collection, base.concat(part, bp), fieldType, current, undefined, desc, `${dotted}.${field}@${bp}`);
      }
    }
  }

  // Drop entries that cannot work: duplicate names, a name that is also a folder of another
  // variable, aliases to something that is missing or has another type. Repeat, because dropping
  // one entry can break the entries that alias it.
  function drop(entry, reason) {
    skipped.push({ collection: entry.collection, token: entry.source, reason });
    entries.splice(entries.indexOf(entry), 1);
  }
  let changed = true;
  while (changed) {
    changed = false;
    const byKey = new Map();
    for (const e of entries.slice()) {
      const key = `${e.collection}|${e.name}`;
      if (byKey.has(key)) { drop(e, `variable name "${e.name}" is already used by ${byKey.get(key).source}`); changed = true; }
      else byKey.set(key, e);
    }
    for (const e of entries.slice()) {
      const parts = e.name.split('/');
      for (let i = 1; i < parts.length; i++) {
        const clash = byKey.get(`${e.collection}|${parts.slice(0, i).join('/')}`);
        if (clash && entries.includes(clash)) { drop(e, `name "${e.name}" sits inside variable "${clash.name}"`); changed = true; break; }
      }
    }
    for (const e of entries.slice()) {
      for (const v of [e.value, e.dark]) {
        if (!v || !v.alias) continue;
        const target = byKey.get(`${v.alias.collection}|${v.alias.name}`);
        if (!target || !entries.includes(target)) { drop(e, `references ${v.alias.ref}, which is not available as a variable`); changed = true; break; }
        if (target.type !== e.type) { drop(e, `references ${v.alias.ref}, which is ${target.type} but this is ${e.type}`); changed = true; break; }
      }
    }
  }

  entries.sort((a, b) => LAYER_ORDER.indexOf(a.collection) - LAYER_ORDER.indexOf(b.collection));
  return { entries, skipped, notes: Array.from(notes), sourceCounts };
}

// ---------------------------------------------------------------------------------------------
// Part 2: write the plan into Figma
// ---------------------------------------------------------------------------------------------

function sameValue(a, b) {
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    if (a.type === 'VARIABLE_ALIAS' || b.type === 'VARIABLE_ALIAS') return a.type === b.type && a.id === b.id;
    return ['r', 'g', 'b', 'a'].every((k) => Math.abs((a[k] === undefined ? 1 : a[k]) - (b[k] === undefined ? 1 : b[k])) < 1e-4);
  }
  return a === b;
}

async function syncTokens(json) {
  const plan = mapTokens(json);
  const collections = await figma.variables.getLocalVariableCollectionsAsync();
  const existing = await figma.variables.getLocalVariablesAsync();
  const findCollection = (name) => collections.find((c) => c.name === name);
  const errors = [];
  const notes = plan.notes.slice();

  // Collections. `cols[key]` holds the Figma collection and the mode ids to write for 'light'/'dark'.
  const cols = {};
  function useSingleMode(name, modeName) {
    let c = findCollection(name);
    if (!c) {
      c = figma.variables.createVariableCollection(name);
      c.renameMode(c.modes[0].modeId, modeName);
    }
    return { collection: c, light: c.modes[0].modeId };
  }
  cols.Primitives = useSingleMode('Primitives', 'Value');
  cols.Component = useSingleMode('Component', 'Value');

  // Semantic: try Light + Dark modes in one collection, otherwise two collections.
  let approach = 'modes';
  let fallbackReason = '';
  let sem = findCollection('Semantic');
  const semIsNew = !sem;
  try {
    if (!sem) sem = figma.variables.createVariableCollection('Semantic');
    let light = sem.modes.find((m) => m.name === 'Light') || sem.modes[0];
    if (light.name !== 'Light') sem.renameMode(light.modeId, 'Light');
    let dark = sem.modes.find((m) => m.name === 'Dark');
    const darkId = dark ? dark.modeId : sem.addMode('Dark');
    cols.Semantic = { collection: sem, light: light.modeId, dark: darkId };
  } catch (e) {
    approach = 'collections';
    fallbackReason = e && e.message ? e.message : String(e);
    if (semIsNew && sem) sem.remove();
    cols['Semantic / Light'] = useSingleMode('Semantic / Light', 'Light');
    cols['Semantic / Dark'] = useSingleMode('Semantic / Dark', 'Dark');
    cols['Semantic / Dark'].dark = cols['Semantic / Dark'].light;
    delete cols['Semantic / Dark'].light;
    notes.push('Components alias the Semantic / Light variables, so component colors do not switch to dark.');
  }

  const byId = new Map();
  for (const v of existing) byId.set(`${v.variableCollectionId}|${v.name}`, v);

  const stats = {};
  for (const key of Object.keys(cols)) stats[key] = { created: 0, updated: 0, unchanged: 0, skipped: 0, errors: 0 };
  for (const s of plan.skipped) {
    const logical = s.collection;
    for (const key of Object.keys(stats)) {
      if (key === logical || (logical === 'Semantic' && key.startsWith('Semantic / '))) stats[key].skipped += 1;
    }
  }

  const placementsFor = (entry) =>
    approach === 'collections' && entry.collection === 'Semantic'
      ? [{ key: 'Semantic / Light', mode: 'light' }, { key: 'Semantic / Dark', mode: 'dark' }]
      : [{ key: entry.collection, mode: null }];

  // Pass 1: find or create every variable, so aliases can point at variables defined later.
  const records = [];
  const lookup = new Map();
  for (const entry of plan.entries) {
    for (const p of placementsFor(entry)) {
      try {
        const col = cols[p.key].collection;
        let variable = byId.get(`${col.id}|${entry.name}`);
        let created = false;
        if (!variable) {
          variable = figma.variables.createVariable(entry.name, col, entry.type);
          created = true;
        } else if (variable.resolvedType !== entry.type) {
          throw new Error(`already exists as ${variable.resolvedType}, expected ${entry.type}`);
        }
        if (entry.description && variable.description !== entry.description) variable.description = entry.description;
        lookup.set(`${p.key}|${entry.name}`, variable);
        records.push({ entry, p, variable, created });
      } catch (e) {
        errors.push({ token: entry.source, message: e.message });
        stats[p.key].errors += 1;
      }
    }
  }

  // Pass 2: set the values. Anything that references another token becomes an alias.
  function resolve(value, p) {
    if (!value.alias) return value.literal;
    let key = value.alias.collection;
    if (approach === 'collections' && key === 'Semantic') key = p.mode === 'dark' ? 'Semantic / Dark' : 'Semantic / Light';
    const target = lookup.get(`${key}|${value.alias.name}`);
    if (!target) throw new Error(`cannot find variable for ${value.alias.ref}`);
    return figma.variables.createVariableAlias(target);
  }

  for (const { entry, p, variable, created } of records) {
    try {
      const col = cols[p.key];
      const writes = [];
      if (p.mode === 'dark') writes.push([col.dark, entry.dark || entry.value]);
      else if (p.mode === 'light') writes.push([col.light, entry.value]);
      else {
        writes.push([col.light, entry.value]);
        if (col.dark) writes.push([col.dark, entry.dark || entry.value]);
      }
      let changed = false;
      for (const [modeId, value] of writes) {
        const next = resolve(value, p);
        if (!sameValue(variable.valuesByMode[modeId], next)) {
          variable.setValueForMode(modeId, next);
          changed = true;
        }
      }
      if (created) stats[p.key].created += 1;
      else if (changed) stats[p.key].updated += 1;
      else stats[p.key].unchanged += 1;
    } catch (e) {
      errors.push({ token: entry.source, message: e.message });
      stats[p.key].errors += 1;
    }
  }

  return { approach, fallbackReason, stats, skipped: plan.skipped, errors, notes };
}

if (typeof figma !== 'undefined') {
  figma.showUI(__html__, { width: 420, height: 560 });
  figma.ui.onmessage = async (msg) => {
    if (msg.type !== 'sync') return;
    try {
      const result = await syncTokens(JSON.parse(msg.tokens));
      figma.ui.postMessage({ type: 'done', result });
      figma.notify('Token Sync finished');
    } catch (e) {
      figma.ui.postMessage({ type: 'failed', message: e && e.message ? e.message : String(e) });
    }
  };
}

if (typeof module !== 'undefined' && module.exports) module.exports = { mapTokens };

import postcss from 'postcss';

const state = /:(hover|active|focus|focus-visible|focus-within|visited|disabled)\b/;
const simple = /^(?:\*|:root|[a-z][\w-]*|\.[\w-]+)$/;
const where = d => `${d.source.input.file ?? 'CSS'}:${d.source.start.line}:${d.source.start.column}`;
const unknown = message => { throw new Error(message); };

// Only the documented flat default-state subset is accepted; no selector guesses.
export function inspectCss(source, file) {
  const root = postcss.parse(source, { from: file });
  const rules = [];
  root.walkAtRules(a => unknown(`Unsupported CSS @${a.name}; runtime/cascade inspection needed`));
  root.walkRules(rule => {
    if (rule.parent.type !== 'root') unknown('Nested CSS requires runtime inspection');
    const selectors = rule.selectors.filter(s => !state.test(s));
    if (selectors.some(s => !simple.test(s))) unknown(`Unsupported selector: ${rule.selector}`);
    rules.push({ selectors, declarations: rule.nodes.filter(n => n.type === 'decl') });
  });
  const cache = new Map();
  function declarations(element, onlyRoot = false) {
    const entries = [];
    let order = 0;
    for (const rule of rules) {
      const matches = rule.selectors.filter(s => onlyRoot ? s === ':root' : s === '*' || s === element.tag || (s.startsWith('.') && element.classes.includes(s.slice(1))));
      if (!matches.length) continue;
      const specificity = Math.max(...matches.map(s => s.startsWith('.') || s === ':root' ? 10 : s === '*' ? 0 : 1));
      for (const d of rule.declarations) entries.push({ d, specificity, order: order++ });
    }
    return entries.sort((a,b) => Number(!!a.d.important)-Number(!!b.d.important) || a.specificity-b.specificity || a.order-b.order).map(x => x.d);
  }
  function variables(element) {
    if (cache.has(element)) return cache.get(element);
    const inherited = element?.parent ? variables(element.parent) : element ? variables(null) : new Map();
    const local = new Map();
    for (const d of declarations(element, element === null)) if (d.prop.startsWith('--')) local.set(d.prop, d);
    // CSS cycles invalidate the variables in the cycle, including fallback edges.
    const cyclic = new Set();
    function scan(name, path = []) {
      if (path.includes(name)) { path.slice(path.indexOf(name)).forEach(n=>cyclic.add(n)); return; }
      const d = local.get(name);
      if (!d) return;
      for (const match of d.value.matchAll(/var\(\s*(--[\w-]+)/g)) scan(match[1], [...path,name]);
    }
    for (const name of local.keys()) scan(name);
    const resolved = new Map(inherited);
    function get(name, trail = []) {
      if (cyclic.has(name)) return { error: `Cyclic variable ${name}`, sources: [] };
      if (!local.has(name)) return inherited.get(name) ?? { error: `Missing variable ${name}`, sources: [] };
      if (trail.includes(name)) return { error: `Cyclic variable ${[...trail,name].join(' → ')}`, sources: [] };
      const d = local.get(name);
      const value = resolveVars(d.value, key => get(key, [...trail,name]));
      return { ...value, sources: [where(d), ...value.sources] };
    }
    for (const name of local.keys()) resolved.set(name, get(name));
    cache.set(element, resolved);
    return resolved;
  }
  function read(element, property) {
    if (!element) unknown('Mapped JSX element missing or ambiguous');
    const vars = variables(element);
    let winner;
    const relevant = d => d.prop === property || d.prop === 'all' ||
      property.startsWith('padding-') && (d.prop === 'padding' || /^padding-(inline|block)/.test(d.prop)) ||
      property.startsWith('border-') && property.endsWith('-radius') && (d.prop === 'border-radius' || /border-(start|end)-/.test(d.prop)) ||
      property === 'background-color' && d.prop === 'background' ||
      property === 'row-gap' && d.prop === 'gap';
    for (const d of declarations(element)) if (relevant(d)) winner = d;
    if (!winner) unknown(`No inspectable declaration for ${property}`);
    if (winner.prop === 'all' || /^(padding-(inline|block)|border-(start|end)-)/.test(winner.prop)) unknown(`Unsupported override ${winner.prop}`);
    const resolved = resolveVars(winner.value, key => vars.get(key) ?? { error: `Missing variable ${key}`, sources: [] });
    if (resolved.error) unknown(resolved.error);
    let value = resolved.value.trim();
    if (winner.prop === 'padding' || winner.prop === 'border-radius') {
      const parts = value.split(/\s+/);
      if (parts.length < 1 || parts.length > 4 || value.includes('/')) unknown(`Unsupported shorthand ${value}`);
      parts.forEach(normalizeLength);
      const expanded = [parts[0], parts[1] ?? parts[0], parts[2] ?? parts[0], parts[3] ?? parts[1] ?? parts[0]];
      const keys = winner.prop === 'padding' ? ['padding-top','padding-right','padding-bottom','padding-left'] : ['border-top-left-radius','border-top-right-radius','border-bottom-right-radius','border-bottom-left-radius'];
      value = expanded[keys.indexOf(property)];
    }
    if (winner.prop === 'gap') {
      const parts = value.split(/\s+/);
      if (parts.length > 2) unknown(`Unsupported gap ${value}`);
      parts.forEach(normalizeLength);
      value = parts[0];
    }
    return { value, raw: winner.value, sources: [...new Set([where(winner), ...resolved.sources])] };
  }
  return { read };
}

export function resolveVars(input, lookup) {
  let value = input;
  const sources = [];
  for (let count=0; value.includes('var('); count++) {
    if (count > 100) return { error: 'Variable expansion limit', sources };
    const start = value.indexOf('var(');
    let depth = 1, end = start + 4, comma = -1;
    for (; end < value.length && depth; end++) {
      if (value[end] === '(') depth++;
      if (value[end] === ')') depth--;
      if (value[end] === ',' && depth === 1 && comma < 0) comma = end;
    }
    if (depth) return { error: 'Unclosed var()', sources };
    const key = value.slice(start+4, comma < 0 ? end-1 : comma).trim();
    if (!/^--[\w-]+$/.test(key)) return { error: `Invalid variable name ${key}`, sources };
    let replacement = lookup(key);
    if (replacement.error && comma >= 0) replacement = resolveVars(value.slice(comma+1,end-1).trim(), lookup);
    if (replacement.error) return { ...replacement, sources: [...sources,...replacement.sources] };
    sources.push(...replacement.sources);
    value = value.slice(0,start) + replacement.value + value.slice(end);
  }
  return { value, sources };
}

export function normalizeLength(value) {
  if (typeof value === 'number') { if (Number.isFinite(value) && value >= 0) return value; }
  else if (/^(?:\d+(?:\.\d+)?|\.\d+)px$/.test(value) || value === '0') return parseFloat(value);
  throw new Error(`Unsupported/non-pixel length: ${value ?? 'unavailable'}`);
}

export function normalizeColor(value) {
  let channels;
  if (typeof value === 'string') {
    const v = value.toLowerCase().trim();
    const hex = v.match(/^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/)?.[1];
    if (hex) {
      const full = hex.length < 5 ? [...hex].map(x=>x+x).join('') : hex;
      channels = [0,2,4].map(i=>parseInt(full.slice(i,i+2),16));
      channels.push(full.length === 8 ? parseInt(full.slice(6),16)/255 : 1);
    } else {
      const rgb = v.match(/^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:\s*[,/]\s*([\d.]+))?\s*\)$/);
      if (rgb) channels = [+rgb[1],+rgb[2],+rgb[3],rgb[4] === undefined ? 1 : +rgb[4]];
    }
  } else if (value && ['r','g','b'].every(k=>Number.isFinite(value[k]) && value[k]>=0 && value[k]<=1)) {
    channels = [value.r*255,value.g*255,value.b*255,value.a ?? 1];
  }
  if (!channels || channels.some((n,i)=>!Number.isFinite(n) || n < 0 || n > (i===3 ? 1 : 255))) throw new Error('Unsupported or missing solid color');
  return [...channels.slice(0,3).map(Math.round), Number(channels[3].toFixed(4))];
}

import { parse } from '@babel/parser';

export function inspectJsx(source, mapping) {
  const ast = parse(source, { sourceType: 'module', plugins: ['typescript', 'jsx'] });
  const functions = ast.program.body.map(n => n.declaration ?? n).filter(n => n.type === 'FunctionDeclaration' && n.id?.name === mapping.component);
  if (functions.length !== 1) throw new Error('Expected one named Card function declaration');
  const fn = functions[0];
  const returns = fn.body.body.filter(n => n.type === 'ReturnStatement');
  if (returns.length !== 1 || fn.body.body.some(n => !['VariableDeclaration', 'ReturnStatement', 'ExpressionStatement'].includes(n.type))) throw new Error('Conditional/multiple returns are not supported');
  const elements = [];
  function visit(node, parent = null) {
    if (node?.type !== 'JSXElement' || node.openingElement.name.type !== 'JSXIdentifier') throw new Error('Dynamic JSX/fragment is not supported');
    const open = node.openingElement;
    const tag = open.name.name;
    if (!/^[a-z]/.test(tag)) throw new Error('Nested custom components are not inspected');
    if (open.attributes.some(a => a.type === 'JSXSpreadAttribute' || ['style','hidden'].includes(a.name?.name))) throw new Error('Inline styles, hidden attributes, or spread props require runtime inspection');
    const attr = open.attributes.find(a => a.name?.name === 'className');
    let classes = [];
    if (attr?.value?.type === 'StringLiteral') classes = attr.value.value.split(/\s+/);
    else if (attr) {
      // Explicitly support the existing default-instance className builder only.
      const expr = attr.value?.expression;
      const filter = expr?.callee?.object;
      const array = filter?.callee?.object;
      const isDefaultBuilder = expr?.type === 'CallExpression' && expr.callee?.property?.name === 'join' && expr.arguments.length === 1 && expr.arguments[0].value === ' ' &&
        filter?.type === 'CallExpression' && filter.callee?.property?.name === 'filter' && filter.arguments.length === 1 && filter.arguments[0].name === 'Boolean' &&
        array?.type === 'ArrayExpression' && array.elements.length === 2 && array.elements[0]?.value === 'card' && array.elements[1]?.name === 'className';
      if (parent === null && isDefaultBuilder) classes = ['card'];
      else throw new Error('Dynamic className cannot be resolved for the default instance');
    }
    const result = { tag, classes, parent, children: [], textProps: [], source: `${mapping.jsxFile}:${open.loc.start.line}:${open.loc.start.column + 1}` };
    elements.push(result);
    for (const child of node.children) {
      if (child.type === 'JSXText') { if (child.value.trim()) result.textProps.push('#literal'); }
      else if (child.type === 'JSXExpressionContainer') {
        if (child.expression.type === 'JSXEmptyExpression') continue;
        if (child.expression.type !== 'Identifier') throw new Error('Conditional/dynamic JSX child requires runtime inspection');
        const definition = Object.values(mapping.nodes).find(m => classes.includes(m.selector.slice(1)));
        if (child.expression.name !== definition?.prop) throw new Error('Unmapped child expression requires runtime inspection');
        result.textProps.push('#text');
      } else result.children.push(visit(child, result));
    }
    return result;
  }
  const root = visit(returns[0].argument);
  return { root, elements };
}

export function codeShape(node) {
  return { element: `${node.tag}${node.classes.map(c => `.${c}`).join('')}`, children: [...node.children.map(codeShape), ...node.textProps] };
}

export function figmaShape(node, mapping) {
  if (!node || typeof node.id !== 'string' || typeof node.type !== 'string') throw new Error('Incomplete Figma hierarchy');
  const m = mapping.nodes[node.id];
  if (!m) return { element: `UNMAPPED Figma ${node.type} ${node.id}`, children: (node.children ?? []).map(n => figmaShape(n, mapping)) };
  if (node.type !== m.figmaType) return { element: `TYPE CHANGED ${node.id}: ${node.type}`, children: [] };
  if (node.visible === false) return { element: `HIDDEN ${node.id}`, children: [] };
  if (!Array.isArray(node.children)) throw new Error(`Children unavailable for ${node.id}`);
  let children;
  if (m.textId) {
    children = node.children.map(n => n.id === m.textId && n.type === 'TEXT' && n.visible !== false ? '#text' : figmaShape(n, mapping));
  } else children = node.children.map(n => figmaShape(n, mapping));
  return { element: `${m.tag}${m.selector}`, children };
}

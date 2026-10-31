// Identity/translation only. Expected visual values always come from the snapshot.
// Public copy: the real Figma file key and link are replaced by sandbox placeholders.
export const mapping = {
  fileKey: 'sandbox-atlas-card',
  nodeId: '1:99',
  url: 'snapshot://atlas-card-v1',
  component: 'Card',
  jsxFile: 'Card.tsx',
  cssFile: 'Card.css',
  nodes: {
    '1:99': { selector: '.card', tag: 'article', figmaType: 'COMPONENT' },
    '1:63': { selector: '.card__content', tag: 'div', figmaType: 'FRAME' },
    '1:38': { selector: '.card__eyebrow', tag: 'p', figmaType: 'FRAME', textId: '1:6', prop: 'eyebrow' },
    '1:39': { selector: '.card__title', tag: 'h2', figmaType: 'FRAME', textId: '1:13', prop: 'title' },
    '1:40': { selector: '.card__description', tag: 'p', figmaType: 'FRAME', textId: '1:37', prop: 'description' },
    '1:49': { selector: '.card__action', tag: 'button', figmaType: 'FRAME', textId: '1:48', prop: 'actionLabel' },
  },
};

const sides = ['top', 'right', 'bottom', 'left'];
const corners = ['top-left', 'top-right', 'bottom-right', 'bottom-left'];
export const checks = [
  { label: 'Button background', nodeId: '1:49', css: 'background-color', kind: 'color', figma: 'fills' },
  ...corners.map((corner, index) => ({ label: `Card radius ${corner}`, nodeId: '1:99', css: `border-${corner}-radius`, kind: 'length', figma: ['topLeftRadius','topRightRadius','bottomRightRadius','bottomLeftRadius'][index], cornerIndex: index })),
  ...['1:99', '1:49'].flatMap(nodeId => sides.map(side => ({ label: `${nodeId === '1:99' ? 'Card' : 'Button'} padding ${side}`, nodeId, css: `padding-${side}`, kind: 'length', figma: `padding${side[0].toUpperCase()}${side.slice(1)}` }))),
  { label: 'Content gap', nodeId: '1:63', css: 'row-gap', kind: 'length', figma: 'itemSpacing' },
  { label: 'Content layout direction', nodeId: '1:63', css: 'flex-direction', kind: 'direction', figma: 'layoutMode' },
];

// Turns a raw Figma capture into the public sandbox snapshot.
//
// Usage: node scripts/sanitize-snapshot.mjs <raw-capture.json> [out.json]
//
// It is an allowlist: only the fields listed below are copied, so anything else in the
// raw file (file key, links, variable IDs, text copy, layer names, plugin data) is
// dropped by default. The raw capture itself stays outside this repository.
import { readFileSync, writeFileSync } from 'node:fs';
import { mapping } from '../src/mapping.mjs';

const SNAPSHOT_VERSION = 1;
const NODE_FIELDS = [
  'id', 'type', 'visible', 'opacity',
  'layoutMode', 'primaryAxisAlignItems', 'counterAxisAlignItems', 'itemSpacing',
  'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
  'cornerRadius', 'topLeftRadius', 'topRightRadius', 'bottomRightRadius', 'bottomLeftRadius',
];
const FILL_FIELDS = ['type', 'visible', 'opacity', 'blendMode'];
const COLOR_FIELDS = ['r', 'g', 'b', 'a'];
// Generic layer names replace the real ones (real text nodes are named after their copy).
const NAMES = {
  '1:99': 'Card', '1:63': 'Content', '1:38': 'Eyebrow', '1:39': 'Title',
  '1:40': 'Description', '1:49': 'Action', '1:6': 'Eyebrow text', '1:13': 'Title text',
  '1:37': 'Description text', '1:48': 'Action label',
};

const pick = (source, fields) => Object.fromEntries(fields.filter(f => source[f] !== undefined).map(f => [f, source[f]]));

function cleanFill(fill) {
  const out = pick(fill, FILL_FIELDS);
  if (fill.color) out.color = pick(fill.color, COLOR_FIELDS);
  return out;
}

function cleanNode(node) {
  const name = NAMES[node.id];
  if (!name) throw new Error(`Node ${node.id} has no sandbox name. Add it to NAMES only if it is part of the public example.`);
  const out = { ...pick(node, NODE_FIELDS.slice(0, 2)), name, ...pick(node, NODE_FIELDS.slice(2)) };
  if (Array.isArray(node.fills)) out.fills = node.fills.map(cleanFill);
  if (Array.isArray(node.children)) out.children = node.children.map(cleanNode);
  return out;
}

export function sanitize(raw) {
  if (raw?.schemaVersion !== 1 || raw.document?.id !== mapping.nodeId) throw new Error('Raw capture does not match the mapped Card component');
  return {
    schemaVersion: 1,
    snapshotVersion: SNAPSHOT_VERSION,
    provider: raw.provider,
    sanitized: true,
    note: 'Sanitized example of one Figma component for the public playground. Contains layout, spacing, radius and fill values only. Not a live Figma read.',
    fileKey: mapping.fileKey,
    nodeId: raw.nodeId,
    fetchedAt: raw.fetchedAt,
    document: cleanNode(raw.document),
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [input, output = new URL('../snapshots/atlas-card.v1.json', import.meta.url).pathname] = process.argv.slice(2);
  if (!input) { console.error('Usage: node scripts/sanitize-snapshot.mjs <raw-capture.json> [out.json]'); process.exit(2); }
  writeFileSync(output, JSON.stringify(sanitize(JSON.parse(readFileSync(input, 'utf8'))), null, 2) + '\n');
  console.log(`Wrote ${output}`);
}

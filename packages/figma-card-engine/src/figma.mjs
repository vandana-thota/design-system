import { mapping as defaultMapping } from './mapping.mjs';

export function validateEvidence(evidence, mapping = defaultMapping) {
  if (evidence?.schemaVersion !== 1 || !['figma-mcp','figma-rest'].includes(evidence.provider)) throw new Error('Unrecognized Figma evidence format/provider');
  if (evidence.fileKey !== mapping.fileKey || evidence.nodeId !== mapping.nodeId || evidence.document?.id !== mapping.nodeId) throw new Error('Evidence does not identify the mapped Version 1 component');
  if (!Number.isFinite(Date.parse(evidence.fetchedAt))) throw new Error('Evidence is missing a valid retrieval timestamp');
  if (evidence.document.type !== 'COMPONENT') throw new Error('Mapped Version 1 root is no longer a component');
  return evidence;
}

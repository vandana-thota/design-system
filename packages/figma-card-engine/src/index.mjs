// Public entry point. Pure functions only: no network, no file system, no credentials.
export { compare, exitCode, markdown } from './check.mjs';
export { inspectCss, normalizeColor, normalizeLength } from './css.mjs';
export { inspectJsx } from './jsx.mjs';
export { validateEvidence } from './figma.mjs';
export { mapping, checks } from './mapping.mjs';

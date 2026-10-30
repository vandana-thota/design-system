# Design system rules

## Project
- Stack: React + TypeScript, Vite, Tailwind CSS v4, Storybook 10.6.
- Don't add dependencies or change the project setup without asking.
- Visual direction lives in docs/design-direction.md. Read it only when doing visual work.

## Tokens
- Spec: docs/tokens-spec.md. Use only these token names. Propose any new token before adding it.
- Source of truth: tokens/tokens.json (W3C DTCG format). Style Dictionary generates the CSS. Never edit generated CSS by hand.
- Components use semantic or component tokens only. Never primitives, hex values, or hardcoded spacing, radii, font sizes, shadows or durations.
- Light and dark switch with data-theme on the root element.

## Components
- Typed props, accessible by default: visible focus, keyboard support, correct ARIA.
- Every component gets Storybook stories for each variant and state, in light and dark.
- No italics anywhere.

## How to work with me
- I'm learning to code. After each change, explain what you did in 2–3 plain sentences.
- Keep changes small and focused on what I asked.
- Ask before deleting or renaming files.
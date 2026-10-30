# Design system

A token-driven design system in React, TypeScript and Tailwind CSS v4, with three components (Button, Input, Card), light and dark themes, and a Storybook that documents all of it. Every color, size, space and motion value comes from one JSON file, so changing a token changes every component that uses it. It is built to WCAG 2.2 AA, with one documented exception (control borders). The live Storybook is at https://vandana-thota.github.io/design-system/.

## What's in it

**Tokens.** `tokens/tokens.json` holds 290 tokens in the W3C Design Tokens format, in three layers:
- 136 primitives: raw colors, spacing, sizes, radii, fonts, motion, shadows, layers and breakpoints.
- 97 semantic tokens: roles such as `color.bg.surface`, `color.text.primary`, `space.inset-md` and `type.body-l`. All 30 semantic colors have a light and a dark value.
- 57 component tokens: 25 for Button, 18 for Input and 14 for Card. They reference semantic tokens only.

Components never use primitives, hex values or hard-coded spacing, radii, font sizes or durations. The full list with values and the contrast checks is in [`docs/tokens-spec.md`](docs/tokens-spec.md).

**Themes.** Light ("Warm Editorial") and dark ("Dark Precision") switch with a `data-theme` attribute on the root element. The visual direction is in [`docs/design-direction.md`](docs/design-direction.md). Type uses Fraunces for display, IBM Plex Sans for the interface and IBM Plex Mono for code.

**Components.**
- Button: primary, secondary, ghost and danger variants; three sizes; loading and disabled states; optional leading and trailing icons.
- Input: label, helper text, required, error, success, loading, disabled and read-only states.
- Card: a plain container, a link or a button. Selected, hover, pressed and disabled states. An interactive card is one control and cannot contain other links or buttons.

**Accessibility.**
- Built to WCAG 2.2 AA, with one documented exception (control borders, below).
- A visible 2px focus ring on keyboard focus for every interactive element, in both themes.
- Keyboard support and correct ARIA on all three components.
- Text contrast pairs are checked and listed in the spec.
- Disabled states use dedicated colors, not opacity.
- Interactive targets are at least 24px, and the small button gets a 44px hit area on mobile.
- Respects `prefers-reduced-motion`; the loading spinner stops spinning.

**Tests.** The Storybook project has 49 stories: 44 component stories (Button 16, Input 14, Card 14) and 5 Foundations pages (Colors, Typography, Spacing, Radius and Elevation, Motion). All 49 run as tests with the Storybook Vitest addon in Chromium, and the accessibility check is set to fail the run on errors for every component story. Some stories also have interaction tests: clicking, typing, Tab focus, Enter and Space, disabled and loading behavior, and ARIA attributes.

## How the pieces connect

1. `tokens/tokens.json` is the single source of truth. Nobody edits the generated CSS by hand.
2. Style Dictionary (`style-dictionary.config.mjs`) reads the JSON and writes five CSS files to `src/styles/tokens/`: primitives, semantic (with the dark overrides), type, component tokens, and Tailwind theme mappings.
3. Tailwind CSS v4 reads the generated theme, so the token names become class names such as `bg-surface`, `text-primary`, `p-inset-md` and `text-body-l`.
4. The components in `src/components/` use those classes and the component token variables.
5. Storybook renders the components and the Foundations pages, with a toolbar toggle for light and dark.
6. A GitHub Actions workflow (`.github/workflows/deploy-storybook.yml`) builds the tokens and Storybook on every push to `main` and publishes `storybook-static` to GitHub Pages.

## Known exception: control borders

Inputs, secondary buttons and interactive cards use `color.border.default`, which has a contrast ratio of about 1.4:1 against surfaces. WCAG 1.4.11 asks for 3:1 for the borders of controls, so this falls below it.

I chose this on purpose. A 3:1 border looks heavy against the soft, editorial look of the system. To keep the controls easy to identify, each one has other cues: a visible text label, a surface fill that differs from the page canvas, and a 2px focus ring that is checked at 3:1 or better. Someone applying the standard strictly may disagree with this choice. The exception is written into the spec and into the component docs in Storybook, so it is a recorded decision.

## Run it locally

```bash
npm install
npm run storybook               # Storybook at http://localhost:6006 (builds tokens first)
npm run tokens                  # regenerate the CSS from tokens/tokens.json
npm run build-storybook         # static build in storybook-static/
npx vitest run --project storybook   # run the 49 story tests
npm run lint
npm run build                   # type check and Vite build
```

The first test run needs the Playwright browser: `npx playwright install chromium`.

## Folder map

```
tokens/
  tokens.json                 Source of truth for all tokens (W3C format)
style-dictionary.config.mjs   Turns the JSON into CSS
src/
  styles/tokens/              Generated CSS (do not edit)
  components/
    Button/  Input/  Card/    Component, stories and index for each
    index.ts
  stories/foundations/        Colors, Typography, Spacing, Radius and Elevation, Motion
  index.css                   Imports fonts, Tailwind and the generated tokens
docs/
  tokens-spec.md              Token names, values and contrast checks
  design-direction.md         Visual direction
.storybook/                   Storybook config and theme toggle
.github/workflows/            Storybook deploy to GitHub Pages
CLAUDE.md                     Working rules for AI-assisted changes
```

## Roadmap

These are planned and not built yet:
- A token drift checker that compares the JSON with Figma variables.
- A Figma plugin that reads the same JSON.
- Evals.
- More components beyond Button, Input and Card.

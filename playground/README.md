# Design-to-Code Drift Playground

An interactive page where a visitor edits a design (button colour, corner radius, an optional illustration), runs the real comparison engines in the browser, and sees what drifted. It is static: no server, no API, no credentials.

## Run it locally

```sh
npm run playground          # dev server  -> http://localhost:5174/playground/
npm run playground:build    # production build -> playground-dist/
npm run playground:preview  # serve the build  -> http://localhost:4174/playground/
```

## Tests

```sh
npm run playground:test     # playground logic + browser/CLI parity (Node, no browser needed)
npm run drift:test          # token checker, including the in-memory path
npm run engine:test         # Figma-card comparison engine
npm run playground:evidence # re-capture the real output shown in "Under the hood"
```

## What is real, what is simulated

| Part | Status |
| --- | --- |
| Figma-card comparison (`packages/figma-card-engine`) | Real engine, runs in the browser |
| Design input | A sanitized snapshot plus the visitor's edits, in memory. Not a live Figma read |
| DS001–DS007 token checker (`scripts/drift/core.mjs`) | Real checker, runs in the browser on this repo's files |
| Simulate fix | Patches copies of source text in memory and reruns the engine. Writes nothing |
| "Under the hood" CLI output and test counts | Captured real runs, dated. Not live |
| Rendered appearance, typography, interaction states | NOT CHECKED by the engine, and reported that way |

## Security model

- The public build contains no Figma file key, token, `.env` value or Figma API URL (checked by scanning the built bundle).
- Visitors can only change state held in their own browser tab. Nothing is saved, sent or written.
- The only network requests are for the page's own files.

## Page options (query string)

| Option | Effect |
| --- | --- |
| `?embed=1` | Compact mode for iframes: hides the overline and title, tighter padding, reports its height to the parent page |
| `?theme=dark` / `?theme=light` | Sets the theme (default light) |

## Two URLs to offer

- Full page: `<host>/playground/` (for example `https://vandana-thota.github.io/design-system-playground/playground/`, once deployed)
- Embedded: the same URL with `?embed=1`

## Embed in a case study

```html
<iframe
  id="drift-playground"
  src="https://YOUR-HOST/playground/?embed=1"
  title="Design-to-Code Drift Playground"
  loading="lazy"
  style="width:100%;height:900px;border:0"
></iframe>
<script>
  // Optional: fit the iframe to the playground's height. Only accepts messages from the playground's own origin.
  window.addEventListener('message', (event) => {
    if (event.origin !== 'https://YOUR-HOST') return
    if (event.data?.type !== 'drift-playground:height') return
    document.getElementById('drift-playground').style.height = event.data.height + 'px'
  })
</script>
```

Replace `YOUR-HOST` with the real origin after deployment. Add `&theme=dark` if the portfolio is dark.

## Hosting on GitHub Pages

The build uses relative paths (`base: './'`), so it works from any sub-path. The existing Storybook deploy publishes to the site root of the `design-system` repository, so deploy the playground separately rather than into the same artifact. Options, from simplest:

1. A second repository (or a `gh-pages` branch) that receives the contents of `playground-dist/`.
2. A combined Pages artifact (`storybook-static/` plus `playground-dist/playground/`) built by one workflow. This changes the existing deploy workflow, so it needs your approval first.

Nothing has been deployed or published.

# Token spec

The single source of truth for every design decision in this system.
Components use semantic and component tokens only. Primitives exist to be referenced, never used directly.

Standards this spec follows:
- WCAG 2.2 AA: 4.5:1 for text, 3:1 for large text, control borders, focus indicators and icons (1.4.3, 1.4.11), 24px minimum target size (2.5.8), text that survives 1.5 line height (1.4.12)
- W3C Design Tokens Community Group format for naming and the JSON source file
- Spacing scale modeled on Atlassian's 8px-base numeric scale; type roles modeled on Material 3's display / headline / title / body / label structure

Every color pair listed under "Contrast" has been checked. New tokens get proposed first, checked, then added.

Documented exception: inputs, checkboxes and other controls use `color.border.default` (1.4:1 against surfaces) by design choice, below the 3:1 that WCAG 1.4.11 asks for. Controls must stay identifiable through other cues: a visible label, the surface fill against the canvas, and a 2px focus ring. The contrast checker reports this as a known exception, not a failure.

---

## 0. Source file, naming and rules

Source of truth: `tokens/tokens.json` in the W3C Design Tokens format (DTCG), with light and dark values for semantic colors and mobile, tablet and desktop values for type roles. Style Dictionary converts it into the CSS that Tailwind reads. Generated CSS is never edited by hand; change the JSON and rebuild. The drift checker and the Figma plugin read the same JSON.

- Token path (design and JSON): `category.role.variant.state`, for example `color.bg.surface-hover`, `space.200`, `type.body-l`
- CSS variable: kebab case of the path, for example `--color-bg-surface-hover`
- Tailwind classes should read cleanly: `bg-surface-hover`, `text-primary`, `border-default`, `p-inset-md`, `rounded-card`, `text-body-l`. Implementation chooses the Tailwind v4 namespace mapping that produces these names.
- Figma variable names mirror token paths with slashes: `color/bg/surface-hover`, `type/body-l`. The drift checker matches them by path.
- Units: sizes in rem in code (16px = 1rem) so text respects browser font settings. This spec lists px for readability.
- No italics anywhere.

---

## 1. Primitive tokens

### 1.1 Color

Warm neutrals (light theme)
| Token | Hex |
|---|---|
| sand-0 | #FFFFFF |
| sand-50 | #F6F3ED |
| sand-75 | #F1EDE6 |
| sand-100 | #EEEAE3 |
| sand-400 | #9C998F |

Cool neutrals (light theme)
| Token | Hex |
|---|---|
| slate-200 | #D9DCE4 |
| graphite-600 | #65656B |
| charcoal-900 | #1B1C20 |

Ink (dark theme)
| Token | Hex |
|---|---|
| ink-50 | #FAFAFC |
| ink-300 | #A3A4B0 |
| ink-500 | #6B6E7A |
| ink-700 | #343741 |
| ink-800 | #292B35 |
| ink-850 | #252731 |
| ink-900 | #1E2029 |
| ink-950 | #101116 |

Cobalt (brand)
| Token | Hex |
|---|---|
| cobalt-50 | #EAEEFD |
| cobalt-75 | #E6EBFC |
| cobalt-200 | #AEBBFF |
| cobalt-250 | #9DACFF |
| cobalt-300 | #8295FF |
| cobalt-400 | #6E83F5 |
| cobalt-500 | #3559E8 |
| cobalt-600 | #2747CC |
| cobalt-700 | #1F38A6 |
| cobalt-900 | #1E2448 |
| cobalt-950 | #262B45 |

Status
| Token | Hex |
|---|---|
| green-50 | #E4F3EA |
| green-300 | #6CCF98 |
| green-700 | #1A7148 |
| green-950 | #132A1E |
| amber-50 | #FBF0D9 |
| amber-300 | #F0BE55 |
| amber-700 | #8A5300 |
| amber-950 | #2B2214 |
| red-50 | #FCEAE8 |
| red-300 | #FF8C82 |
| red-350 | #FF7A70 |
| red-400 | #F2665C |
| red-600 | #C2302A |
| red-700 | #B42318 |
| red-800 | #912018 |
| red-950 | #331917 |

### 1.2 Spacing (4px grid, 8px base unit)

Name = value relative to the 8px base (100 = 8px).

| Token | px |
|---|---|
| space-0 | 0 |
| space-025 | 2 |
| space-050 | 4 |
| space-075 | 6 |
| space-100 | 8 |
| space-150 | 12 |
| space-200 | 16 |
| space-250 | 20 |
| space-300 | 24 |
| space-400 | 32 |
| space-500 | 40 |
| space-600 | 48 |
| space-800 | 64 |
| space-1000 | 80 |
| space-1200 | 96 |
| space-1600 | 128 |

### 1.3 Sizing

| Token | px | Use |
|---|---|---|
| size-icon-sm | 16 | Inline icons |
| size-icon-md | 20 | Default icons |
| size-icon-lg | 24 | Standalone icons |
| size-control-sm | 32 | Dense tables, toolbars |
| size-control-md | 40 | Default buttons and inputs |
| size-control-lg | 48 | Primary mobile actions |
| size-target-min | 24 | WCAG 2.2 minimum target |
| size-target-touch | 44 | Minimum touch target on mobile |

### 1.4 Radius

| Token | px |
|---|---|
| radius-0 | 0 |
| radius-025 | 2 |
| radius-050 | 4 |
| radius-075 | 6 |
| radius-100 | 8 |
| radius-150 | 12 |
| radius-200 | 16 |
| radius-full | 9999 |

### 1.5 Border width

| Token | px |
|---|---|
| border-width-0 | 0 |
| border-width-1 | 1 |
| border-width-2 | 2 |

### 1.6 Typography

- Families: `font-display` Fraunces (load with the opsz axis), `font-sans` IBM Plex Sans, `font-mono` IBM Plex Mono
- Weights: regular 400, medium 500, semibold 600
- Sizes (px): 12, 13, 14, 16, 18, 20, 22, 24, 28, 32, 40, 44, 56
- Line heights (px): 16, 20, 24, 28, 32, 36, 40, 48, 52, 64
- Tracking: tight -0.02em, snug -0.01em, normal 0
- Paragraph spacing (px): 8, 12, 16. Prose components only.
- Numeric: `tabular` (font-variant-numeric: tabular-nums)

### 1.7 Motion

| Token | Value |
|---|---|
| duration-0 | 0ms |
| duration-120 | 120ms |
| duration-200 | 200ms |
| duration-320 | 320ms |
| duration-800 | 800ms |
| ease-standard | cubic-bezier(0.2, 0, 0, 1) |
| ease-enter | cubic-bezier(0, 0, 0, 1) |
| ease-exit | cubic-bezier(0.3, 0, 1, 1) |
| ease-linear | cubic-bezier(0, 0, 1, 1) |

### 1.8 Shadow

Used only for floating layers (menus, popovers, dialogs, toasts). Cards use borders.
| Token | Light | Dark |
|---|---|---|
| shadow-sm | 0 1px 2px rgb(27 28 32 / 0.06) | 0 1px 2px rgb(0 0 0 / 0.4) |
| shadow-md | 0 4px 12px rgb(27 28 32 / 0.08), 0 1px 3px rgb(27 28 32 / 0.06) | 0 4px 12px rgb(0 0 0 / 0.5), 0 1px 3px rgb(0 0 0 / 0.4) |
| shadow-lg | 0 12px 32px rgb(27 28 32 / 0.12), 0 2px 6px rgb(27 28 32 / 0.06) | 0 12px 32px rgb(0 0 0 / 0.6), 0 2px 6px rgb(0 0 0 / 0.4) |

In dark mode, elevation is shown mainly by lighter surfaces; shadows are secondary.

### 1.9 Layer (z-index)

base 0, raised 10, dropdown 100, sticky 200, overlay 300, modal 400, toast 500, tooltip 600

### 1.10 Breakpoints

| Token | Code min-width | Figma frame |
|---|---|---|
| breakpoint-mobile | 0 | 375 |
| breakpoint-tablet | 744 | 744 |
| breakpoint-desktop | 1024 | 1440 |
| breakpoint-wide | 1440 | 1920 |

`wide` changes layout only (grid width, margins). Type has three modes: mobile, tablet, desktop.

---

## 2. Semantic tokens

### 2.1 Color

Switches with `data-theme="light"` or `data-theme="dark"` on the root element. Light is the default.

| Token | Light | Dark | Use |
|---|---|---|---|
| color.bg.canvas | sand-50 | ink-950 | Page background |
| color.bg.surface | sand-0 | ink-900 | Cards, inputs, panels |
| color.bg.surface-secondary | sand-100 | ink-800 | Wells, table headers, code blocks |
| color.bg.surface-hover | sand-75 | ink-850 | Hovered rows and ghost buttons |
| color.bg.surface-selected | cobalt-75 | cobalt-950 | Selected rows, active nav item |
| color.bg.overlay | rgb(16 17 22 / 0.48) | rgb(0 0 0 / 0.64) | Scrim behind dialogs |
| color.text.primary | charcoal-900 | ink-50 | Body text, headings |
| color.text.secondary | graphite-600 | ink-300 | Supporting text, labels |
| color.text.disabled | sand-400 | ink-500 | Disabled text (exempt from contrast) |
| color.text.link | cobalt-500 | cobalt-300 | Links |
| color.text.on-accent | sand-0 | ink-950 | Text on accent fills |
| color.text.on-danger | sand-0 | ink-950 | Text on danger fills |
| color.border.default | slate-200 | ink-700 | Cards, dividers, inputs, checkboxes, radios, selects |
| color.border.focus | cobalt-500 | cobalt-300 | Focus ring |
| color.accent.default | cobalt-500 | cobalt-300 | Primary buttons, active states |
| color.accent.hover | cobalt-600 | cobalt-250 | Primary hover |
| color.accent.pressed | cobalt-700 | cobalt-400 | Primary pressed |
| color.accent.subtle | cobalt-50 | cobalt-900 | Tinted accent backgrounds |
| color.accent.subtle-text | cobalt-600 | cobalt-200 | Text on accent.subtle |
| color.status.success.bg | green-50 | green-950 | Success banners, badges |
| color.status.success.text | green-700 | green-300 | |
| color.status.warning.bg | amber-50 | amber-950 | |
| color.status.warning.text | amber-700 | amber-300 | |
| color.status.danger.bg | red-50 | red-950 | |
| color.status.danger.text | red-700 | red-300 | Error messages |
| color.status.danger.fill | red-600 | red-350 | Destructive buttons |
| color.status.danger.fill-pressed | red-800 | red-400 | Destructive button pressed |
| color.status.danger.border | red-700 | red-300 | Input error border |
| color.status.info.bg | cobalt-50 | cobalt-900 | |
| color.status.info.text | cobalt-600 | cobalt-200 | |

Disabled controls use `text.disabled` and `bg.surface-secondary`, never opacity. Opacity changes contrast unpredictably across surfaces.

Contrast (checked)
| Pair | Light | Dark | Needs |
|---|---|---|---|
| text.primary on bg.canvas | 15.4 | 18.1 | 4.5 |
| text.secondary on bg.surface-secondary | 4.8 | 5.7 | 4.5 |
| text.secondary on bg.surface-hover | 5.0 | 6.0 | 4.5 |
| text.secondary on bg.surface-selected | 4.9 | 5.6 | 4.5 |
| text.link on bg.surface | 5.6 | 5.9 | 4.5 |
| text.on-accent on accent.default | 5.6 | 6.9 | 4.5 |
| text.on-accent on accent.hover | 7.3 | 8.8 | 4.5 |
| text.on-accent on accent.pressed | 9.7 | 5.6 | 4.5 |
| accent.subtle-text on accent.subtle | 6.3 | 8.1 | 4.5 |
| border.focus on bg.canvas | 5.1 | 6.9 | 3.0 |
| status.success.text on .bg | 5.2 | 8.0 | 4.5 |
| status.warning.text on .bg | 5.6 | 9.1 | 4.5 |
| status.danger.text on .bg | 5.7 | 7.2 | 4.5 |
| text.on-danger on status.danger.fill | 5.6 | 7.4 | 4.5 |
| text.primary on bg.surface-secondary (card pressed) | 14.2 | 13.5 | 4.5 |
| text.on-danger on status.danger.border (danger button hover) | 6.6 | 8.4 | 4.5 |
| text.on-danger on status.danger.fill-pressed | 8.7 | 6.1 | 4.5 |

### 2.2 Focus

| Token | Value |
|---|---|
| focus.ring.color | color.border.focus |
| focus.ring.width | border-width-2 |
| focus.ring.offset | space-025 |

Focus shows on keyboard focus only (`:focus-visible`), on every interactive element, in both themes.

### 2.3 Spacing roles

Components use roles. Page layouts may use the scale directly.

| Token | Value | Use |
|---|---|---|
| inset-xs | space-050 (4) | Badges, tight chips |
| inset-sm | space-100 (8) | Small buttons, table cells |
| inset-md | space-150 (12) | Buttons, inputs |
| inset-lg | space-200 (16) | Cards, menus |
| inset-xl | space-300 (24) | Dialogs, large cards |
| stack-xs | space-050 (4) | Label to input |
| stack-sm | space-100 (8) | Related items |
| stack-md | space-200 (16) | Form fields |
| stack-lg | space-300 (24) | Groups within a section |
| stack-xl | space-500 (40) | Between groups |
| inline-xs | space-050 (4) | Icon to label |
| inline-sm | space-100 (8) | Button groups, chips |
| inline-md | space-150 (12) | Toolbar items |
| inline-lg | space-200 (16) | Nav items |
| section-sm | space-600 (48) | Mobile sections |
| section-md | space-1000 (80) | Tablet sections |
| section-lg | space-1200 (96) | Desktop sections |

### 2.4 Layout grid

| Mode | Columns | Gutter | Margin | Max content width |
|---|---|---|---|---|
| Mobile | 4 | 16 | 16 | none |
| Tablet | 8 | 24 | 32 | none |
| Desktop | 12 | 24 | 48 | 1200 |
| Wide | 12 | 32 | auto (centered) | 1280 |

### 2.5 Radius roles

| Token | Value | Use |
|---|---|---|
| radius-chip | radius-050 (4) | Badges, tags, checkboxes |
| radius-control | radius-075 (6) | Buttons, inputs, selects |
| radius-card | radius-150 (12) | Cards, panels |
| radius-dialog | radius-200 (16) | Dialogs, sheets |
| radius-pill | radius-full | Pills, avatars, toggles |

Nested elements use a smaller radius than their container (inner radius = outer radius minus padding, minimum 4).

### 2.6 Border width roles

| Token | Value |
|---|---|
| border-width-default | border-width-1 |
| border-width-emphasis | border-width-2 |
| border-width-focus | border-width-2 |

### 2.7 Type roles

Size / line height in px for mobile, tablet (from 744) and desktop (from 1024). Each role is one class that updates at each breakpoint, so components never need breakpoint-specific type classes.

| Role | Family, weight | Mobile | Tablet | Desktop | Tracking | Use |
|---|---|---|---|---|---|---|
| display-xl | Fraunces 500 | 32/40 | 44/52 | 56/64 | tight | Hero headline |
| display-l | Fraunces 500 | 28/36 | 32/40 | 40/48 | tight | Section intros, large stats |
| headline-m | Fraunces 500 | 22/28 | 24/32 | 28/36 | snug | Page titles |
| headline-s | Fraunces 500 | 20/28 | 20/28 | 24/32 | snug | Section titles |
| title-m | Plex Sans 600 | 16/24 | 18/24 | 18/24 | normal | Card and dialog titles |
| title-s | Plex Sans 600 | 14/20 | 16/24 | 16/24 | normal | Small card titles, table group headers |
| body-xl | Plex Sans 400 | 16/24 | 18/28 | 18/28 | normal | Lead paragraphs |
| body-l | Plex Sans 400 | 16/24 | 16/24 | 16/24 | normal | Default body, input text |
| body-m | Plex Sans 400 | 14/20 | 14/20 | 14/20 | normal | Dense UI, table cells |
| body-s | Plex Sans 400 | 12/16 | 12/16 | 12/16 | normal | Helper text |
| label-m | Plex Sans 500 | 14/20 | 14/20 | 14/20 | normal | Buttons, form labels, tabs |
| label-s | Plex Sans 500 | 12/16 | 12/16 | 12/16 | normal | Small buttons, badges |
| caption | Plex Sans 400 | 12/16 | 12/16 | 12/16 | normal | Captions, timestamps |
| code | Plex Mono 400 | 13/20 | 13/20 | 13/20 | normal | Code, token names |

Rules
- Fraunces only for display and headline roles. Never in buttons, forms, tables or dense UI.
- Input text uses body-l so mobile text stays at 16px (smaller text makes iPhone Safari zoom in).
- Any role showing money or metrics adds the tabular numeric setting so columns of digits align.
- Links are any role plus `color.text.link` and an underline. There are no separate link type roles.
- A heavier variant (for example body-m at 600) is allowed for emphasis inside text, using the same size and line height.

### 2.8 Motion roles

| Token | Duration | Easing | Use |
|---|---|---|---|
| motion-hover | duration-120 | ease-standard | Hover and press feedback |
| motion-enter | duration-200 | ease-enter | Menus, toasts, popovers appearing |
| motion-exit | duration-120 | ease-exit | Elements leaving |
| motion-emphasis | duration-320 | ease-standard | Dialogs, drawers, layout changes |
| motion-spinner | duration-800 | ease-linear | Loading spinner rotation. Under reduced motion the spinner is a static ring. |

Animate opacity and transform only. When `prefers-reduced-motion: reduce` is set, all durations become duration-0 and movement is replaced with a fade or no animation.

### 2.9 Elevation roles

| Token | Surface | Shadow | Use |
|---|---|---|---|
| elevation-flat | bg.surface | none | Cards, panels (use border.default) |
| elevation-raised | bg.surface | shadow-sm | Sticky headers |
| elevation-overlay | bg.surface | shadow-md | Menus, popovers, toasts |
| elevation-modal | bg.surface | shadow-lg | Dialogs |

### 2.10 Icon size roles

| Token | Value | Use |
|---|---|---|
| size-icon-sm | size-icon-sm (16) | Inline icons, spinner in small buttons |
| size-icon-md | size-icon-md (20) | Default icons, spinner in medium and large buttons |
| size-icon-lg | size-icon-lg (24) | Standalone icons |

Exposed as Tailwind classes `size-icon-sm`, `size-icon-md`, `size-icon-lg` (also `w-` and `h-`).

---

## 3. Component tokens

Pattern: `component-part-property-state`. Component tokens reference semantic tokens only.

Starting set:
- Button: `button-height-sm` (size-control-sm), `button-height-md` (size-control-md), `button-height-lg` (size-control-lg), `button-padding-x` (inset-lg), `button-radius` (radius-control), `button-primary-bg` (accent.default), `button-primary-bg-hover` (accent.hover), `button-primary-bg-pressed` (accent.pressed), `button-primary-text` (text.on-accent), `button-secondary-border` (border.default), `button-danger-bg` (status.danger.fill)
  - Added with the Button build: `button-padding-x-sm` (inset-sm), `button-gap` (inline-xs), `button-disabled-bg` (bg.surface-secondary), `button-disabled-text` (text.disabled), `button-secondary-bg` (bg.surface), `button-secondary-bg-hover` (bg.surface-hover), `button-secondary-text` (text.primary), `button-ghost-bg-hover` (bg.surface-hover), `button-ghost-bg-pressed` (bg.surface-secondary), `button-ghost-text` (text.primary), `button-danger-bg-hover` (status.danger.border), `button-danger-bg-pressed` (status.danger.fill-pressed), `button-danger-text` (text.on-danger), `button-target-touch` (size-target-touch, invisible mobile hit area for the small button)
- Input: `input-height` (size-control-md), `input-padding-x` (inset-md), `input-radius` (radius-control), `input-bg` (bg.surface), `input-border` (border.default), `input-border-focus` (border.focus), `input-border-error` (status.danger.border), `input-text` (text.primary), `input-placeholder` (text.secondary)
  - Added with the Input build: `input-bg-disabled` (bg.surface-secondary), `input-text-disabled` (text.disabled), `input-label-text` (text.secondary), `input-helper-text` (text.secondary), `input-error-text` (status.danger.text), `input-success-text` (status.success.text), `input-gap` (stack-xs, label to input), `input-border-width` (border-width-default), `input-border-width-emphasis` (border-width-emphasis, on focus and error; horizontal padding is reduced by the difference so text does not shift)
- Card: `card-bg` (bg.surface), `card-border` (border.default), `card-radius` (radius-card), `card-padding` (inset-lg)
  - Added with the Card build: `card-bg-hover` (bg.surface-hover), `card-bg-selected` (bg.surface-selected), `card-bg-disabled` (bg.surface-secondary), `card-border-selected` (accent.default), `card-padding-lg` (inset-xl), `card-gap` (stack-sm), `card-title-text` (text.primary), `card-body-text` (text.secondary), `card-bg-pressed` (bg.surface-secondary), `card-text-disabled` (text.disabled)

New component tokens are added as each component is built, following the same pattern.

Interactive targets are at least size-target-min (24px) everywhere and size-target-touch (44px) on mobile, using padding or an invisible hit area when the visual element is smaller.

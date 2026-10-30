Final Visual Design Brief

Design direction: Warm Editorial Minimalism + Dark Precision
Personality: Premium, intelligent, modern, trustworthy, approachable and technically refined.

1. Typography

Primary display font: Fraunces

Used for hero headlines, editorial headings, large statistics and feature highlights.

Use weights 400, 500 and 600.

Avoid using Fraunces for buttons, forms, tables and dense interface elements.

Primary interface font: IBM Plex Sans

Used for navigation, buttons, forms, tables, body text, labels, component documentation and dashboards.

Use weights 400, 500 and 600.

Use tabular numbers for financial data and numerical metrics.

Maintain excellent readability in both themes.

Technical font: IBM Plex Mono

Used for code snippets, design-token names, technical metadata and developer documentation.

All three are available through Google Fonts.

2. Light Theme: Warm Editorial

Token

Color

Hex

Canvas

Warm ivory

#F6F3ED

Surface

Clean white

#FFFFFF

Secondary surface

Warm pale gray

#EEEAE3

Primary text

Rich charcoal

#1B1C20

Secondary text

Muted graphite

#65656B

Border

Soft cool gray

#D9DCE4

Primary accent

Electric cobalt

#3559E8

Accent foreground

White

#FFFFFF

Visual treatment: Warm ivory backgrounds, fine borders, restrained shadows, large expressive serif headlines and precise sans-serif interface typography. Use cobalt blue selectively for primary actions, links, focus states and selected navigation items.

3. Dark Theme: Dark Precision

Token

Color

Hex

Canvas

Deep near-black

#101116

Surface

Elevated charcoal

#1E2029

Secondary surface

Dark graphite

#292B35

Primary text

Soft white

#FAFAFC

Secondary text

Muted lavender-gray

#A3A4B0

Border

Subtle graphite

#343741

Primary accent

Soft electric periwinkle

#8295FF

Accent foreground

Near-black

#101116

Visual treatment: Deep charcoal surfaces with subtle tonal separation. Use periwinkle-blue accents instead of the stronger light-theme cobalt. Prioritize quiet contrast, precise borders, legible typography and restrained visual effects.

4. Layout and Composition

Editorial asymmetric compositions with structured alignment.

Twelve-column responsive grid for larger layouts.

Eight-pixel spacing foundation with four-pixel increments for tighter UI.

Generous whitespace around editorial headings.

Compact information density inside dashboards and tables.

Subtle 1px borders rather than heavy shadows.

Cards with approximately 8–12px corner radii.

Buttons and inputs with approximately 6–8px radii.

Bento-style layouts for product showcases and feature introductions.

Avoid generic gradient-heavy SaaS interfaces and decorative glassmorphism.

5. Component Styling

Buttons: Solid cobalt in light mode, soft periwinkle in dark mode. Secondary buttons use subtle borders and transparent or surface-colored backgrounds.

Inputs: Clean surfaces, fine borders and visible blue focus indicators. Support error, success, disabled and loading states.

Cards: Minimal elevation, consistent radii and disciplined internal spacing.

Data tables: IBM Plex Sans with tabular numerals, compact row spacing and restrained dividers.

AI components: Streaming responses, source verification, confidence and uncertainty messages, clarification chips, progress indicators, actionable approvals and recoverable errors.

Motion: Subtle opacity, transform and state transitions using semantic motion tokens. Respect reduced-motion preferences.

6. Technical Implementation

Use the existing React, TypeScript, Vite, Tailwind CSS v4 and Storybook 10.6 project.

Create three token layers:

Primitive tokens: Raw colors, spacing, font families, radii and motion values.

Semantic tokens: Canvas, surface, foreground, muted, border, accent, focus and status roles for each theme.

Component tokens: Component-specific values that reference semantic tokens.

Components must not directly reference raw hex values.

Include accessible focus states, keyboard behavior, light/dark theme switching and automated accessibility checks.

7. Final Design Principle

Build an interface that feels like a thoughtfully designed editorial publication combined with the engineering precision of a modern productivity application.

Fraunces creates personality. IBM Plex Sans provides clarity. Cobalt creates recognition. Warm ivory and deep charcoal give the system its distinctive visual identity.

The final result must look custom-designed, cohesive, accessible and polished in both themes.

## Additions
- No italics anywhere. Fraunces is always upright.
- Exact token names and values live in docs/tokens-spec.md. If this file and the spec disagree, the spec wins.
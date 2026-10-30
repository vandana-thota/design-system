import type { Meta, StoryObj } from '@storybook/react-vite'
import { Badge, Cell, DocTable, Page, PageHeader, Section, ThemePanel, TokenName } from './components'
import { checkPair, contrastPairs, type ContrastResult } from './contrast'
import { cssVar, listTokens, primitiveValue, semanticValue, type Theme } from './tokenData'

const meta = {
  title: 'Foundations/Colors',
  parameters: { layout: 'fullscreen' },
} satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

const themes: Theme[] = ['light', 'dark']

const groups = [
  { key: 'bg', title: 'Background', intro: 'Page, surface and overlay fills.' },
  { key: 'text', title: 'Text', intro: 'Shown on the surface they are meant to sit on.' },
  { key: 'border', title: 'Border', intro: 'Dividers, control borders and the focus ring.' },
  { key: 'accent', title: 'Accent', intro: 'Brand color for primary actions and active states.' },
  { key: 'status', title: 'Status', intro: 'Success, warning, danger and info.' },
]

// What a token is previewed against, so white text is never shown on a white card.
const backdropFor = (name: string): string => {
  if (name === 'color.text.on-accent') return 'color.accent.default'
  if (name === 'color.text.on-danger') return 'color.status.danger.fill'
  if (name === 'color.accent.subtle-text') return 'color.accent.subtle'
  const status = name.match(/^color\.status\.(\w+)\.text$/)
  if (status) return `color.status.${status[1]}.bg`
  return 'color.bg.surface'
}

type Kind = 'fill' | 'text' | 'border'
const kindOf = (name: string): Kind => {
  const parts = name.split('.')
  const last = parts[parts.length - 1]
  if (parts[1] === 'text' || last === 'text' || last === 'subtle-text') return 'text'
  if (parts[1] === 'border' || last === 'border') return 'border'
  return 'fill'
}

const borderStyle = (color: string) => ({
  borderWidth: 'var(--border-width-emphasis)',
  borderStyle: 'solid',
  borderColor: color,
})

function Preview({ name, theme }: { name: string; theme: Theme }) {
  const value = semanticValue(name, theme)
  const kind = kindOf(name)
  const backdrop = semanticValue(kind === 'fill' ? 'color.bg.canvas' : backdropFor(name), theme)
  return (
    <div aria-hidden="true" style={{ background: backdrop }} className="rounded-chip border border-default p-inset-xs">
      {kind === 'fill' ? (
        <div style={{ background: value }} className="rounded-chip min-w-section-md py-inset-lg" />
      ) : kind === 'text' ? (
        <span style={{ color: value }} className="text-title-m px-inset-lg block min-w-section-md">Aa</span>
      ) : (
        <div style={borderStyle(value)} className="rounded-chip min-w-section-md py-inset-lg" />
      )}
    </div>
  )
}

function ColorGroup({ groupKey, title, intro }: { groupKey: string; title: string; intro: string }) {
  const entries = listTokens('semantic.color').filter((t) => t.name.split('.')[1] === groupKey)
  return (
    <Section title={title} intro={intro}>
      <DocTable label={`${title} color tokens`} columns={['Token', 'CSS variable', 'Light', 'Dark']}>
        {entries.map((entry) => (
          <tr key={entry.path}>
            <Cell>
              <TokenName>{entry.name}</TokenName>
            </Cell>
            <Cell mono>{cssVar(entry.path)}</Cell>
            {themes.map((theme) => (
              <Cell key={theme}>
                <div className="flex items-center gap-inline-md">
                  <Preview name={entry.name} theme={theme} />
                  <span className="text-code">{semanticValue(entry.name, theme)}</span>
                </div>
              </Cell>
            ))}
          </tr>
        ))}
      </DocTable>
    </Section>
  )
}

const tone = { pass: 'success', fail: 'danger', exception: 'warning' } as const
const label = { pass: 'Pass', fail: 'Fail', exception: 'Exception' } as const

function ContrastSample({ result, theme }: { result: ContrastResult; theme: Theme }) {
  const { fg, bg } = result.pair
  const fgValue = semanticValue(fg, theme)
  const bgValue = semanticValue(bg, theme)
  return fg.startsWith('color.border') ? (
    <div aria-hidden="true" style={{ background: bgValue }} className="rounded-chip p-inset-xs">
      <div style={borderStyle(fgValue)} className="rounded-chip min-w-section-sm py-inset-sm" />
    </div>
  ) : (
    <span aria-hidden="true" style={{ color: fgValue, background: bgValue }} className="text-title-s rounded-chip px-inset-md py-inset-xs inline-block">
      Aa
    </span>
  )
}

function ContrastTable() {
  const rows = contrastPairs.map((pair) => ({ light: checkPair(pair, 'light'), dark: checkPair(pair, 'dark') }))
  return (
    <DocTable label="Contrast ratios" columns={['Foreground', 'Background', 'Needs', 'Light', 'Dark']}>
      {rows.map(({ light, dark }) => (
        <tr key={`${light.pair.fg}-${light.pair.bg}`}>
          <Cell>
            <TokenName>{light.pair.fg}</TokenName>
          </Cell>
          <Cell>
            <TokenName>{light.pair.bg}</TokenName>
          </Cell>
          <Cell>{light.pair.needs}:1</Cell>
          {[
            { theme: 'light' as const, result: light },
            { theme: 'dark' as const, result: dark },
          ].map(({ theme, result }) => (
            <Cell key={theme}>
              <div className="flex items-center gap-inline-md">
                <ContrastSample result={result} theme={theme} />
                <span className="tabular">{result.ratio.toFixed(1)}:1</span>
                <Badge tone={tone[result.status]}>{label[result.status]}</Badge>
              </div>
            </Cell>
          ))}
        </tr>
      ))}
    </DocTable>
  )
}

function Scrim() {
  return (
    <div className="grid gap-stack-lg tablet:grid-cols-2">
      {themes.map((theme) => (
        <ThemePanel key={theme} theme={theme}>
          <div className="grid rounded-card overflow-hidden bg-surface-secondary">
            <div className="[grid-area:1/1] p-inset-lg py-section-sm flex flex-col gap-stack-xs">
              <p className="text-title-m">Page content</p>
              <p className="text-body-m text-secondary">The scrim sits between this and the dialog.</p>
            </div>
            <div aria-hidden="true" className="[grid-area:1/1] bg-overlay" />
            <div
              style={{ boxShadow: primitiveValue('shadow.lg', theme) }}
              className="[grid-area:1/1] place-self-center bg-surface border border-default rounded-dialog p-inset-lg"
            >
              <p className="text-title-s">Dialog</p>
            </div>
          </div>
        </ThemePanel>
      ))}
    </div>
  )
}

export const Overview: Story = {
  render: () => (
    <Page>
      <PageHeader
        title="Colors"
        intro="Semantic color tokens in light and dark. Components use these, never the primitives behind them. Every value on this page is read from tokens/tokens.json."
      />
      {groups.map((g) => (
        <ColorGroup key={g.key} groupKey={g.key} title={g.title} intro={g.intro} />
      ))}
      <Section title="Overlay scrim" intro="color.bg.overlay sits behind dialogs. It is darker in dark mode so the dialog still lifts off the page.">
        <Scrim />
      </Section>
      <Section
        title="Contrast"
        intro="Ratios are computed from the resolved token values. Text needs 4.5:1; focus indicators and other non-text parts need 3:1 (WCAG 2.2 AA)."
      >
        <ContrastTable />
        {contrastPairs
          .filter((pair) => pair.exception)
          .map((pair) => (
            <p key={pair.fg} className="text-body-m text-secondary max-w-prose">
              Exception: {pair.fg} is {checkPair(pair, 'light').ratio.toFixed(1)}:1 against {pair.bg} by design. {pair.exception}
            </p>
          ))}
      </Section>
    </Page>
  ),
}

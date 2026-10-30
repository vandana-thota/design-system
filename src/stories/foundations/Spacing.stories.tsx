import type { Meta, StoryObj } from '@storybook/react-vite'
import { Cell, DocTable, Page, PageHeader, Section, TokenName } from './components'
import { describe, listTokens, listTokensBySize, primitiveValue, pxLabel, resolveToken } from './tokenData'

const meta = {
  title: 'Foundations/Spacing',
  parameters: { layout: 'fullscreen' },
} satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

// 'primitive.space.050' written as an alias in the JSON -> 'space.050'
const refName = (value: unknown) => String(value).replace(/[{}]/g, '').replace(/^primitive\./, '')

const Bar = ({ width }: { width: string }) => (
  <div aria-hidden="true" style={{ width }} className="h-inset-md bg-accent-default rounded-chip" />
)

const roleGroups = [
  { prefix: 'inset', title: 'Inset', intro: 'Padding inside a component.' },
  { prefix: 'stack', title: 'Stack', intro: 'Vertical gaps between items.' },
  { prefix: 'inline', title: 'Inline', intro: 'Horizontal gaps between items.' },
  { prefix: 'section', title: 'Section', intro: 'Vertical space between page sections, per breakpoint.' },
]

const layoutModes = ['mobile', 'tablet', 'desktop', 'wide']

const layoutRow = (mode: string) => {
  const values = Object.fromEntries(
    listTokens(`semantic.layout.${mode}`).map((t) => [t.path.split('.').pop() as string, String(resolveToken(t.path))]),
  )
  const show = (key: string, fallback: string) => (values[key] ? pxLabel(values[key]) : fallback)
  const breakpoint = mode === 'mobile' ? '0' : primitiveValue(`breakpoint.${mode}`)
  return {
    mode,
    columns: values.columns,
    gutter: show('gutter', '-'),
    margin: show('margin', 'auto (centered)'),
    maxWidth: show('max-width', 'none'),
    breakpoint,
  }
}

export const Overview: Story = {
  render: () => (
    <Page>
      <PageHeader
        title="Spacing"
        intro="A 4px grid with an 8px base unit. The scale is named by its value relative to the base (100 is 8px). Components use the roles below; page layouts may use the scale directly. Values are read from tokens/tokens.json."
      />
      <Section title="Scale" intro="Primitive spacing. Referenced by the roles, never used directly in components.">
        <DocTable label="Spacing scale" columns={['Token', 'Value', 'Preview']}>
          {listTokensBySize('primitive.space').map((t) => {
            const value = String(resolveToken(t.path))
            return (
              <tr key={t.path}>
                <Cell>
                  <TokenName>{t.name}</TokenName>
                </Cell>
                <Cell>{pxLabel(value)}</Cell>
                <Cell>
                  <Bar width={value} />
                </Cell>
              </tr>
            )
          })}
        </DocTable>
      </Section>

      {roleGroups.map(({ prefix, title, intro }) => (
        <Section key={prefix} title={`${title} roles`} intro={intro}>
          <DocTable label={`${title} spacing roles`} columns={['Role', 'Scale token', 'Value', 'Preview']}>
            {listTokens('semantic.space')
              .filter((t) => t.name.split('.')[1].startsWith(`${prefix}-`))
              .map((t) => {
                const value = String(resolveToken(t.path))
                return (
                  <tr key={t.path}>
                    <Cell>
                      <TokenName>{t.name}</TokenName>
                    </Cell>
                    <Cell mono>{refName(t.node.$value)}</Cell>
                    <Cell>{pxLabel(value)}</Cell>
                    <Cell>
                      <Bar width={value} />
                    </Cell>
                  </tr>
                )
              })}
          </DocTable>
        </Section>
      ))}

      <Section title="Sizing" intro="Icons, controls and touch targets. Interactive targets are at least the minimum size everywhere and the touch size on mobile.">
        <DocTable label="Sizing tokens" columns={['Token', 'Value', 'Use', 'Preview']}>
          {listTokens('primitive.size').map((t) => {
            const value = String(resolveToken(t.path))
            return (
              <tr key={t.path}>
                <Cell>
                  <TokenName>{t.name}</TokenName>
                </Cell>
                <Cell>{pxLabel(value)}</Cell>
                <Cell>{describe(t.path)}</Cell>
                <Cell>
                  <div aria-hidden="true" style={{ width: value, height: value }} className="bg-accent-subtle border border-default rounded-chip" />
                </Cell>
              </tr>
            )
          })}
        </DocTable>
      </Section>

      <Section title="Layout grid" intro="Columns, gutters and margins per mode. Wide changes layout only; type stays on the desktop mode.">
        <DocTable label="Layout grid" columns={['Mode', 'Min width', 'Columns', 'Gutter', 'Margin', 'Max content width']}>
          {layoutModes.map(layoutRow).map((r) => (
            <tr key={r.mode}>
              <Cell>
                <TokenName>{`layout.${r.mode}`}</TokenName>
              </Cell>
              <Cell>{r.breakpoint}</Cell>
              <Cell>{r.columns}</Cell>
              <Cell>{r.gutter}</Cell>
              <Cell>{r.margin}</Cell>
              <Cell>{r.maxWidth}</Cell>
            </tr>
          ))}
        </DocTable>
      </Section>
    </Page>
  ),
}

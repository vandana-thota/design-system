import type { Meta, StoryObj } from '@storybook/react-vite'
import { Cell, DocTable, Page, PageHeader, Section, ThemePanel, TokenName } from './components'
import { listTokens, listTokensBySize, pxLabel, resolveToken, type Theme } from './tokenData'

const meta = {
  title: 'Foundations/Radius and Elevation',
  parameters: { layout: 'fullscreen' },
} satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

const themes: Theme[] = ['light', 'dark']

const refName = (value: unknown) => String(value).replace(/[{}]/g, '').replace(/^primitive\./, '')

const radiusUses: Record<string, string> = {
  chip: 'Badges, tags, checkboxes',
  control: 'Buttons, inputs, selects',
  card: 'Cards, panels',
  dialog: 'Dialogs, sheets',
  pill: 'Pills, avatars, toggles',
}

const elevationUses: Record<string, string> = {
  flat: 'Cards, panels (use a border instead of a shadow)',
  raised: 'Sticky headers',
  overlay: 'Menus, popovers, toasts',
  modal: 'Dialogs',
}

function RadiusBox({ radius }: { radius: string }) {
  return (
    <div
      aria-hidden="true"
      style={{ borderRadius: radius }}
      className="bg-accent-subtle border border-default min-w-section-md py-inset-xl"
    />
  )
}

type ElevationValue = { shadow: string }

function ElevationCard({ name, theme }: { name: string; theme: Theme }) {
  const { shadow } = resolveToken(`semantic.elevation.${name}`, theme) as ElevationValue
  const flat = shadow === 'none'
  return (
    <article
      style={{ boxShadow: shadow }}
      className={`bg-surface rounded-card p-inset-lg flex flex-col gap-stack-xs ${flat ? 'border border-default' : ''}`}
    >
      <TokenName>{`elevation.${name}`}</TokenName>
      <p className="text-body-m text-secondary">{elevationUses[name]}</p>
      <p className="text-code text-secondary break-words">{flat ? 'no shadow' : shadow}</p>
    </article>
  )
}

export const Overview: Story = {
  render: () => (
    <Page>
      <PageHeader
        title="Radius and Elevation"
        intro="Corner radii and shadows. Cards use borders, not shadows; shadow is only for floating layers such as menus, popovers, dialogs and toasts. Values are read from tokens/tokens.json."
      />

      <Section title="Radius scale" intro="Primitive radii. Referenced by the roles, never used directly in components.">
        <div className="grid gap-stack-md grid-cols-2 tablet:grid-cols-4 desktop:grid-cols-8">
          {listTokensBySize('primitive.radius').map((t) => {
            const value = String(resolveToken(t.path))
            return (
              <div key={t.path} className="flex flex-col gap-stack-xs items-start">
                <RadiusBox radius={value} />
                <TokenName>{t.name}</TokenName>
                <span className="text-body-s text-secondary">{pxLabel(value)}</span>
              </div>
            )
          })}
        </div>
      </Section>

      <Section
        title="Radius roles"
        intro="Nested elements use a smaller radius than their container: inner radius is outer radius minus padding, with a minimum of 4px."
      >
        <DocTable label="Radius roles" columns={['Role', 'Scale token', 'Value', 'Use', 'Preview']}>
          {listTokens('semantic.radius').map((t) => {
            const value = String(resolveToken(t.path))
            return (
              <tr key={t.path}>
                <Cell>
                  <TokenName>{t.name}</TokenName>
                </Cell>
                <Cell mono>{refName(t.node.$value)}</Cell>
                <Cell>{pxLabel(value)}</Cell>
                <Cell>{radiusUses[t.path.split('.')[2]]}</Cell>
                <Cell>
                  <RadiusBox radius={value} />
                </Cell>
              </tr>
            )
          })}
        </DocTable>
      </Section>

      <Section title="Border width" intro="Default for dividers and cards, emphasis and focus for the focus ring and selected states.">
        <DocTable label="Border width" columns={['Token', 'Value', 'Preview']}>
          {[...listTokens('primitive.border-width'), ...listTokens('semantic.border-width')].map((t) => {
            const value = String(resolveToken(t.path))
            return (
              <tr key={t.path}>
                <Cell>
                  <TokenName>{t.name}</TokenName>
                </Cell>
                <Cell>{pxLabel(value)}</Cell>
                <Cell>
                  <div aria-hidden="true" style={{ borderTopWidth: value, borderTopStyle: 'solid' }} className="border-primary w-section-md" />
                </Cell>
              </tr>
            )
          })}
        </DocTable>
      </Section>

      <Section
        title="Elevation"
        intro="In dark mode, elevation is shown mainly by lighter surfaces; the shadows are secondary. Both themes are shown so you can compare them whatever the toolbar says."
      >
        <div className="grid gap-stack-lg tablet:grid-cols-2">
          {themes.map((theme) => (
            <ThemePanel key={theme} theme={theme}>
              <div className="flex flex-col gap-stack-lg">
                {listTokens('semantic.elevation').map((t) => (
                  <ElevationCard key={t.path} name={t.path.split('.')[2]} theme={theme} />
                ))}
              </div>
            </ThemePanel>
          ))}
        </div>
      </Section>
    </Page>
  ),
}

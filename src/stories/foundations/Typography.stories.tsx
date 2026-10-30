import type { Meta, StoryObj } from '@storybook/react-vite'
import { Page, PageHeader, Section, TokenName } from './components'
import { describe, toPx, typeRole, typeRoleNames, type TypeMode } from './tokenData'

const meta = {
  title: 'Foundations/Typography',
  parameters: { layout: 'fullscreen' },
} satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

const modes: { key: TypeMode; label: string }[] = [
  { key: 'mobile', label: 'Mobile' },
  { key: 'tablet', label: 'Tablet' },
  { key: 'desktop', label: 'Desktop' },
]

const sampleFor = (role: string) => (role === 'code' ? 'color.bg.surface' : 'Warm editorial, precise interface')

const familyName = (family: string) => family.split(',')[0].replaceAll("'", '').replace(' Variable', '')

function RoleCard({ role }: { role: string }) {
  const base = typeRole(role, 'mobile')
  return (
    <article className="bg-surface border border-default rounded-card p-inset-lg flex flex-col gap-stack-md">
      <header className="flex flex-col gap-stack-xs">
        <div className="flex flex-wrap items-center gap-inline-md">
          <TokenName>{`type.${role}`}</TokenName>
          <span className="text-code text-secondary">{`text-${role}`}</span>
        </div>
        <p className="text-body-m text-secondary">
          {familyName(base.fontFamily)} {base.fontWeight}, tracking {base.letterSpacing}. {describe(`semantic.type.${role}`)}.
        </p>
      </header>
      {modes.map(({ key, label }) => {
        const r = typeRole(role, key)
        return (
          <div key={key} className="flex flex-col gap-stack-xs tablet:flex-row tablet:gap-inline-lg border-t border-default pt-inset-md">
            <p className="shrink-0 tablet:w-section-lg text-body-s text-secondary">
              <span className="block text-label-m text-primary">{label}</span>
              <span className="tabular">
                {toPx(r.fontSize)} / {toPx(r.lineHeight)}
              </span>
            </p>
            <p
              style={{
                fontFamily: r.fontFamily,
                fontWeight: r.fontWeight,
                fontSize: r.fontSize,
                lineHeight: r.lineHeight,
                letterSpacing: r.letterSpacing,
              }}
              className="min-w-0 break-words"
            >
              {sampleFor(role)}
            </p>
          </div>
        )
      })}
    </article>
  )
}

const digits = ['1,111.11', '8,888.88', '12,345.00', '0.99']

export const Overview: Story = {
  render: () => (
    <Page>
      <PageHeader
        title="Typography"
        intro="Fourteen type roles. Each role is one class that changes size and line height at the tablet and desktop breakpoints, so components never need breakpoint-specific type classes. Sizes below are font size / line height in px, read from tokens/tokens.json."
      />
      <Section
        title="Roles"
        intro="Mobile, tablet and desktop are shown one under the other so you can compare them in a single window. In real use the browser width picks the mode."
      >
        <div className="flex flex-col gap-stack-lg">
          {typeRoleNames().map((role) => (
            <RoleCard key={role} role={role} />
          ))}
        </div>
      </Section>
      <Section title="Numbers" intro="Any role showing money or metrics adds the tabular utility, so columns of digits line up.">
        <div className="grid gap-stack-lg tablet:grid-cols-2">
          {[false, true].map((tabular) => (
            <div key={String(tabular)} className="bg-surface border border-default rounded-card p-inset-lg flex flex-col gap-stack-sm">
              <TokenName>{tabular ? 'tabular' : 'default digits'}</TokenName>
              <ul className={`text-body-l flex flex-col items-end w-section-lg ${tabular ? 'tabular' : ''}`}>
                {digits.map((d) => (
                  <li key={d}>{d}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Section>
      <Section title="Rules">
        <ul className="text-body-l text-secondary max-w-prose flex flex-col gap-stack-sm list-disc pl-inset-xl">
          <li>Fraunces is for display and headline roles only. Never in buttons, forms, tables or dense UI.</li>
          <li>Input text uses body-l so mobile text stays at 16px and iPhone Safari does not zoom in.</li>
          <li>Links are any role plus color.text.link and an underline. There are no separate link roles.</li>
          <li>A heavier weight is allowed for emphasis inside text, using the same size and line height.</li>
          <li>No italics anywhere.</li>
        </ul>
      </Section>
    </Page>
  ),
}

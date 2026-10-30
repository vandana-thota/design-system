import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { Cell, DocTable, Page, PageHeader, Section, TokenName } from './components'
import { listTokens, resolveToken } from './tokenData'

const meta = {
  title: 'Foundations/Motion',
  parameters: { layout: 'fullscreen' },
} satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

const uses: Record<string, string> = {
  hover: 'Hover and press feedback',
  enter: 'Menus, toasts, popovers appearing',
  exit: 'Elements leaving',
  emphasis: 'Dialogs, drawers, layout changes',
}

type Transition = { duration: string; easing: string }

const refName = (value: unknown) => String(value).replace(/[{}]/g, '').replace(/^primitive\./, '')

const ms = (value: string) => parseFloat(value)

/** 'cubic-bezier(0.2, 0, 0, 1)' -> [0.2, 0, 0, 1] */
const bezier = (value: string): [number, number, number, number] =>
  (value.match(/-?\d*\.?\d+/g) ?? []).map(Number).slice(0, 4) as [number, number, number, number]

function Curve({ easing }: { easing: string }) {
  const [x1, y1, x2, y2] = bezier(easing)
  return (
    <svg viewBox="0 0 1 1" aria-hidden="true" className="w-section-sm h-section-sm overflow-visible">
      <path
        d={`M0,1 C${x1},${1 - y1} ${x2},${1 - y2} 1,0`}
        fill="none"
        vectorEffect="non-scaling-stroke"
        style={{ strokeWidth: 'var(--border-width-emphasis)' }}
        className="stroke-accent-default"
      />
    </svg>
  )
}

/** Moves and fades a block using the role's own duration and easing variables. */
function Demo({ role }: { role: string }) {
  const [on, setOn] = useState(false)
  return (
    <div className="flex items-center gap-inline-lg">
      <button
        type="button"
        onClick={() => setOn((v) => !v)}
        aria-label={`Play ${role} motion`}
        className="bg-accent-default text-on-accent hover:bg-accent-hover rounded-control px-inset-lg py-inset-sm text-label-m cursor-pointer"
      >
        Play
      </button>
      <div aria-hidden="true" className="pr-section-md">
        <div
          style={{
            transitionProperty: 'opacity, transform, translate',
            transitionDuration: `var(--motion-${role}-duration)`,
            transitionTimingFunction: `var(--motion-${role}-easing)`,
          }}
          className={`size-section-sm bg-accent-subtle border border-default rounded-card ${on ? 'translate-x-section-md opacity-100' : 'translate-x-0 opacity-40'}`}
        />
      </div>
    </div>
  )
}

export const Overview: Story = {
  render: () => {
    const durations = listTokens('primitive.motion.duration')
    const longest = Math.max(...durations.map((t) => ms(String(resolveToken(t.path)))))
    return (
      <Page>
        <PageHeader
          title="Motion"
          intro="Short, quiet transitions. Motion confirms an action; it never decorates. Animate opacity and transform only. Values are read from tokens/tokens.json."
        />

        <Section title="Duration">
          <DocTable label="Durations" columns={['Token', 'Value', 'Length']}>
            {durations.map((t) => {
              const value = String(resolveToken(t.path))
              return (
                <tr key={t.path}>
                  <Cell>
                    <TokenName>{t.name}</TokenName>
                  </Cell>
                  <Cell>{value}</Cell>
                  <Cell>
                    <div aria-hidden="true" style={{ width: `${(ms(value) / longest) * 100}%` }} className="h-inset-md bg-accent-default rounded-chip" />
                  </Cell>
                </tr>
              )
            })}
          </DocTable>
        </Section>

        <Section title="Easing" intro="The curve is progress (up) over time (right).">
          <DocTable label="Easing curves" columns={['Token', 'Value', 'Curve']}>
            {listTokens('primitive.motion.ease').map((t) => {
              const value = String(resolveToken(t.path))
              return (
                <tr key={t.path}>
                  <Cell>
                    <TokenName>{t.name}</TokenName>
                  </Cell>
                  <Cell mono>{value}</Cell>
                  <Cell>
                    <Curve easing={value} />
                  </Cell>
                </tr>
              )
            })}
          </DocTable>
        </Section>

        <Section
          title="Motion roles"
          intro="Press Play to run a role. The demo reads the same CSS variables a component would, so it follows reduced-motion settings too."
        >
          <DocTable label="Motion roles" columns={['Role', 'Duration', 'Easing', 'Use', 'Demo']}>
            {listTokens('semantic.motion').map((t) => {
              const role = t.path.split('.')[2]
              const raw = t.node.$value as Transition
              return (
                <tr key={t.path}>
                  <Cell>
                    <TokenName>{`motion-${role}`}</TokenName>
                  </Cell>
                  <Cell mono>
                    {refName(raw.duration)} ({String((resolveToken(t.path) as Transition).duration)})
                  </Cell>
                  <Cell mono>{refName(raw.easing)}</Cell>
                  <Cell>{uses[role]}</Cell>
                  <Cell>
                    <Demo role={role} />
                  </Cell>
                </tr>
              )
            })}
          </DocTable>
        </Section>

        <Section title="Reduced motion">
          <p className="text-body-l text-secondary max-w-prose">
            When prefers-reduced-motion is set to reduce, every duration becomes 0ms and movement is replaced with a fade or no animation. Turn the setting
            on in your operating system and press Play again to see it.
          </p>
        </Section>
      </Page>
    )
  },
}

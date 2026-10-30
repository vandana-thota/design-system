import type { Meta, StoryObj } from '@storybook/react-vite'

const meta = { title: 'Foundations/Tokens' } satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

// Full class names written out so Tailwind can find them.
const roles = [
  'text-display-xl', 'text-display-l', 'text-headline-m', 'text-headline-s', 'text-title-m', 'text-title-s',
  'text-body-xl', 'text-body-l', 'text-body-m', 'text-body-s', 'text-label-m', 'text-label-s', 'text-caption', 'text-code',
] as const

export const Check: Story = {
  render: () => (
    <div className="bg-canvas text-primary p-inset-xl flex flex-col gap-stack-lg">
      <div className="bg-surface border border-default rounded-card p-inset-lg flex flex-col gap-stack-sm">
        <h2 className="text-headline-m">Warm editorial, precise interface</h2>
        <p className="text-body-l text-secondary">Body text in IBM Plex Sans. <span className="tabular">1,234.56</span></p>
        <code className="text-code">color.bg.surface</code>
        <button className="bg-accent-default text-on-accent rounded-control px-inset-lg h-10 text-label-m self-start">Primary</button>
      </div>
      <div className="grid grid-cols-2 gap-stack-sm">
        {['bg-canvas', 'bg-surface', 'bg-surface-secondary', 'bg-surface-hover', 'bg-surface-selected', 'bg-accent-default', 'bg-status-danger-fill'].map((c) => (
          <div key={c} className={`${c} border border-default rounded-chip p-inset-sm text-code text-primary`}>{c}</div>
        ))}
      </div>
      {roles.map((r) => (
        <div key={r} className={r}>{r} — The quick brown fox</div>
      ))}
    </div>
  ),
}

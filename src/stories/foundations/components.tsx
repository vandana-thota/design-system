// Small building blocks shared by the Foundations pages. Styled with semantic tokens only.
import { useState, type ReactNode } from 'react'
import type { Theme } from './tokenData'

const COPIED_MS = 1500

export function PageHeader({ title, intro }: { title: string; intro: ReactNode }) {
  return (
    <header className="flex flex-col gap-stack-sm">
      <h1 className="text-display-l">{title}</h1>
      <p className="text-body-xl text-secondary max-w-prose">{intro}</p>
    </header>
  )
}

export function Section({ title, intro, children }: { title: string; intro?: ReactNode; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-stack-md">
      <div className="flex flex-col gap-stack-xs">
        <h2 className="text-headline-m">{title}</h2>
        {intro ? <p className="text-body-l text-secondary max-w-prose">{intro}</p> : null}
      </div>
      {children}
    </section>
  )
}

export function Page({ children }: { children: ReactNode }) {
  return <div className="bg-canvas text-primary p-inset-xl flex flex-col gap-stack-xl min-h-screen">{children}</div>
}

/** A token name that copies itself on click. Falls back silently if the clipboard is blocked. */
export function TokenName({ children, copy }: { children: string; copy?: string }) {
  const [copied, setCopied] = useState(false)
  const onClick = async () => {
    try {
      await navigator.clipboard.writeText(copy ?? children)
      setCopied(true)
      setTimeout(() => setCopied(false), COPIED_MS)
    } catch {
      // Clipboard blocked (for example inside an iframe without permission): nothing to do.
    }
  }
  return (
    <>
      <button
        type="button"
        onClick={onClick}
        title="Copy token name"
        className="text-code text-primary bg-surface-secondary rounded-chip px-inset-xs py-inset-xs text-left cursor-pointer hover:bg-surface-hover"
      >
        {children}
      </button>
      <span role="status" className="sr-only">
        {copied ? 'Copied' : ''}
      </span>
    </>
  )
}

/** Scrollable table region. The wrapper is focusable so keyboard users can scroll it. */
export function DocTable({ label, columns, children }: { label: string; columns: string[]; children: ReactNode }) {
  return (
    <div
      role="region"
      aria-label={label}
      tabIndex={0}
      className="overflow-x-auto bg-surface border border-default rounded-card"
    >
      <table className="w-full text-left text-body-m border-collapse">
        <caption className="sr-only">{label}</caption>
        <thead className="bg-surface-secondary">
          <tr>
            {columns.map((c) => (
              <th key={c} scope="col" className="text-title-s p-inset-sm whitespace-nowrap">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  )
}

export const Cell = ({ children, mono }: { children: ReactNode; mono?: boolean }) => (
  <td className={`p-inset-sm border-t border-default align-middle ${mono ? 'text-code' : ''}`}>{children}</td>
)

type Tone = 'success' | 'warning' | 'danger'
const tones: Record<Tone, string> = {
  success: 'bg-status-success-bg text-status-success-text',
  warning: 'bg-status-warning-bg text-status-warning-text',
  danger: 'bg-status-danger-bg text-status-danger-text',
}

/** Status pill. The label always carries the meaning, color only reinforces it. */
export const Badge = ({ tone, children }: { tone: Tone; children: ReactNode }) => (
  <span className={`${tones[tone]} text-label-s rounded-chip px-inset-sm py-inset-xs inline-block`}>{children}</span>
)

/** Forces a theme for everything inside, whatever the toolbar says (data-theme is read per element). */
export function ThemePanel({ theme, children }: { theme: Theme; children: ReactNode }) {
  return (
    <div data-theme={theme} className="bg-canvas text-primary border border-default rounded-card p-inset-lg flex flex-col gap-stack-md">
      <h3 className="text-title-m">{theme === 'light' ? 'Light' : 'Dark'}</h3>
      {children}
    </div>
  )
}

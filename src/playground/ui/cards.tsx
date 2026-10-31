import { useMemo } from 'react'
import type { CSSProperties } from 'react'
import { buildEvidence, findNode } from '../model/design.ts'
import type { Design, Evidence } from '../model/design.ts'
import { toHex } from '../model/report.ts'
import type { Implementation } from '../model/implementation.ts'
import { Card as BaselineCard } from '../implementation/Card.tsx'
import { Card as IllustratedCard } from '../implementation/CardWithIllustration.tsx'
import illustrationUrl from '../assets/insight-glass.svg'

const CARD_COPY = {
  eyebrow: 'AI WORKSPACE',
  title: 'Intelligent Insights',
  description: 'Turn complex data into clear, actionable decisions.',
  actionLabel: 'View details',
}

const toRgb255 = (c: { r: number; g: number; b: number }) => [c.r, c.g, c.b].map((n) => Math.round(n * 255))

/**
 * The design specification, drawn from the same edited snapshot the comparison engine reads as "the design".
 * Numbers (padding, gap, radius, colour) come from that snapshot, not from separate page state.
 */
export function DesignCard({ base, design }: { base: Evidence; design: Design }) {
  const spec = useMemo(() => {
    const evidence = buildEvidence(base, design)
    const card = evidence.document
    const button = findNode(card, '1:49')
    const fill = button?.fills?.[0]?.color
    return {
      radius: card.cornerRadius as number,
      padding: card.paddingTop as number,
      gap: card.itemSpacing as number,
      buttonPaddingY: button?.paddingTop as number,
      buttonPaddingX: button?.paddingLeft as number,
      buttonColor: (fill && toHex(toRgb255(fill))) ?? design.color,
      illustration: !!findNode(card, 'sandbox:illustration'),
    }
  }, [base, design])

  return (
    <article
      aria-label="Design specification preview"
      className="flex w-full flex-col overflow-clip border-(length:--border-width-default) border-default bg-surface"
      style={{ maxWidth: 360, borderRadius: spec.radius, padding: spec.padding, gap: spec.gap }}
    >
      {spec.illustration && (
        <div
          aria-hidden="true"
          className="h-24 rounded-control bg-cover bg-center"
          style={{ backgroundImage: `url("${illustrationUrl}")` }}
        />
      )}
      <div className="flex flex-col items-start" style={{ gap: spec.gap }}>
        <p className="text-label-s tracking-[0.04em] text-secondary">{CARD_COPY.eyebrow}</p>
        <h3 className="text-title-m text-primary">{CARD_COPY.title}</h3>
        <p className="text-body-m text-secondary">{CARD_COPY.description}</p>
        <span
          className="inline-flex items-center justify-center rounded-control text-label-m whitespace-nowrap"
          style={{ backgroundColor: spec.buttonColor, color: '#FFFFFF', padding: `${spec.buttonPaddingY}px ${spec.buttonPaddingX}px` }}
        >
          {CARD_COPY.actionLabel}
        </span>
      </div>
    </article>
  )
}

/**
 * The React implementation. It renders the sandbox Card component next to the very CSS text the engine
 * analyses, so what you see is what is checked.
 */
export function ImplementationCard({ implementation }: { implementation: Implementation }) {
  const Card = implementation.structure === 'illustrated' ? IllustratedCard : BaselineCard
  return (
    <div style={{ '--card-illustration': `url("${illustrationUrl}")`, width: '100%' } as CSSProperties}>
      <style>{implementation.css}</style>
      <Card {...CARD_COPY} onAction={() => {}} />
    </div>
  )
}

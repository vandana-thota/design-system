import { useId, type MouseEventHandler } from 'react';

// Sandbox implementation (with illustration): the same card plus an illustration strip as its first child.
// This is the version "Simulate fix" switches to. It is kept as its own file because the drift engine
// reads static JSX only (no conditional rendering), so each structure needs its own readable source.
export interface CardProps {
  eyebrow: string;
  title: string;
  description: string;
  actionLabel: string;
  onAction: MouseEventHandler<HTMLButtonElement>;
}

export function Card({ eyebrow, title, description, actionLabel, onAction }: CardProps) {
  const titleId = useId();

  return (
    <article className="atlas-card" aria-labelledby={titleId}>
      <div className="atlas-card__illustration" aria-hidden="true" />
      <div className="atlas-card__content">
        <p className="atlas-card__eyebrow">{eyebrow}</p>
        <h2 className="atlas-card__title" id={titleId}>{title}</h2>
        <p className="atlas-card__description">{description}</p>
        <button className="atlas-card__action" type="button" onClick={onAction}>
          {actionLabel}
        </button>
      </div>
    </article>
  );
}

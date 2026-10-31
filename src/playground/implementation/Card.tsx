import { useId, type MouseEventHandler } from 'react';

// Sandbox implementation (baseline): no illustration. Styled by Card.css, which the playground applies
// next to this component. The drift engine reads this file's text, so it keeps to a simple shape:
// one function, one return, static class names.
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

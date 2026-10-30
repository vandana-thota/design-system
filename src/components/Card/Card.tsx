import { createContext, useContext, useEffect, useRef } from 'react'
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, HTMLAttributes, ReactNode } from 'react'

export type CardPadding = 'md' | 'lg'

type CardCommon = {
  padding?: CardPadding
  className?: string
  children: ReactNode
}

type StaticCardProps = CardCommon &
  Omit<HTMLAttributes<HTMLElement>, 'children' | 'className'> & {
    /** Element to render. A static card has no role of its own. */
    as?: 'div' | 'article' | 'section'
    href?: undefined
    onClick?: undefined
  }

type LinkCardProps = CardCommon &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'children' | 'className'> & {
    href: string
    /** Marks the card as the current page (aria-current). */
    selected?: boolean
  }

type ButtonCardProps = CardCommon &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'className'> & {
    onClick: NonNullable<ButtonHTMLAttributes<HTMLButtonElement>['onClick']>
    href?: undefined
    /** Marks the card as chosen (aria-pressed). */
    selected?: boolean
  }

/**
 * Static: a plain container. With `href` it becomes one link, with `onClick` one button.
 * An interactive card is a single control, so nothing inside it may be interactive.
 */
export type CardProps = StaticCardProps | LinkCardProps | ButtonCardProps

// Slots inside an interactive card must be phrasing content (spans), because <a> and <button>
// cannot contain divs or headings.
const InteractiveContext = createContext(false)

// Padding shrinks by the border growth (selected) so the content does not move. Written out in full
// because Tailwind only generates classes it can read literally.
const padding: Record<CardPadding, { rest: string; selected: string }> = {
  md: {
    rest: 'p-(--card-padding)',
    selected: 'p-[calc(var(--card-padding)_-_(var(--border-width-emphasis)_-_var(--border-width-default)))]',
  },
  lg: {
    rest: 'p-(--card-padding-lg)',
    selected: 'p-[calc(var(--card-padding-lg)_-_(var(--border-width-emphasis)_-_var(--border-width-default)))]',
  },
}

const base =
  'flex flex-col gap-(--card-gap) rounded-(--card-radius) bg-(--card-bg) text-left ' +
  'transition-colors duration-(--motion-hover-duration) ease-(--motion-hover-easing)'

const restingBorder = 'border-(length:--border-width-default) border-(--card-border)'
const selectedBorder = 'border-(length:--border-width-emphasis) border-(--card-border-selected) bg-(--card-bg-selected)'

const INTERACTIVE = 'a[href], button, input, select, textarea, summary, [tabindex], [role="button"], [role="link"]'

export function Card(props: CardProps) {
  const { padding: size = 'md', className = '', children } = props
  const ref = useRef<HTMLElement>(null)
  const interactive = props.href !== undefined || props.onClick !== undefined

  // Development check: an interactive card must not contain other interactive elements.
  useEffect(() => {
    if (!interactive || !import.meta.env.DEV) return
    if (ref.current?.querySelector(INTERACTIVE)) {
      console.error('Card: an interactive card must not contain links, buttons or other interactive elements.')
    }
  }, [interactive, children])

  if (props.href !== undefined) {
    const { href, selected = false, padding: _p, className: _c, children: _ch, ...rest } = props
    return (
      <InteractiveContext.Provider value>
        <a
          {...rest}
          ref={ref as React.Ref<HTMLAnchorElement>}
          href={href}
          aria-current={selected ? 'true' : undefined}
          className={`${base} ${selected ? selectedBorder : `${restingBorder} hover:bg-(--card-bg-hover) active:bg-(--card-bg-pressed)`} ${selected ? padding[size].selected : padding[size].rest} cursor-pointer ${className}`}
        >
          {children}
        </a>
      </InteractiveContext.Provider>
    )
  }

  if (props.onClick !== undefined) {
    const { onClick, selected = false, disabled = false, type = 'button', padding: _p, className: _c, children: _ch, ...rest } = props
    const look = disabled
      ? `${restingBorder} bg-(--card-bg-disabled) cursor-not-allowed [&_*]:text-(--card-text-disabled)!`
      : `${selected ? selectedBorder : `${restingBorder} hover:bg-(--card-bg-hover) active:bg-(--card-bg-pressed)`} cursor-pointer`
    return (
      <InteractiveContext.Provider value>
        <button
          {...rest}
          ref={ref as React.Ref<HTMLButtonElement>}
          type={type}
          disabled={disabled}
          onClick={onClick}
          aria-pressed={selected}
          className={`${base} ${look} ${selected && !disabled ? padding[size].selected : padding[size].rest} ${className}`}
        >
          {children}
        </button>
      </InteractiveContext.Provider>
    )
  }

  const { as: Tag = 'div', padding: _p, className: _c, children: _ch, ...rest } = props
  return (
    <Tag {...rest} ref={ref as React.Ref<never>} className={`${base} ${restingBorder} ${padding[size].rest} ${className}`}>
      {children}
    </Tag>
  )
}

type SlotProps = { children: ReactNode; className?: string }

function Slot({ children, className }: SlotProps) {
  return useContext(InteractiveContext) ? (
    <span className={`block ${className}`}>{children}</span>
  ) : (
    <div className={className}>{children}</div>
  )
}

function Header({ children, className = '' }: SlotProps) {
  return <Slot className={className}>{children}</Slot>
}

function Body({ children, className = '' }: SlotProps) {
  return <Slot className={`text-body-m text-(--card-body-text) ${className}`}>{children}</Slot>
}

/** Text only inside an interactive card (no buttons or links). */
function Footer({ children, className = '' }: SlotProps) {
  return <Slot className={`text-body-s text-(--card-body-text) ${className}`}>{children}</Slot>
}

function Title({ children, className = '', as: Heading = 'h3' }: SlotProps & { as?: 'h2' | 'h3' | 'h4' }) {
  const interactive = useContext(InteractiveContext)
  const classes = `block text-title-m text-(--card-title-text) ${className}`
  return interactive ? <span className={classes}>{children}</span> : <Heading className={classes}>{children}</Heading>
}

Card.Header = Header
Card.Title = Title
Card.Body = Body
Card.Footer = Footer

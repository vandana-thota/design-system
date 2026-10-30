import type { ButtonHTMLAttributes, ReactNode } from 'react'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
export type ButtonSize = 'sm' | 'md' | 'lg'

type ButtonBaseProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & {
  /** Visual style. Primary is for the one main action on a screen. */
  variant?: ButtonVariant
  size?: ButtonSize
  /** Shows a spinner and ignores clicks. The button stays focusable and keeps its width. */
  loading?: boolean
  fullWidth?: boolean
  leadingIcon?: ReactNode
  trailingIcon?: ReactNode
}

/** A button needs either visible text or an aria-label (icon-only buttons). */
export type ButtonProps = ButtonBaseProps &
  (
    | { children: ReactNode }
    | { children?: undefined; 'aria-label': string }
  )

const base =
  'relative inline-flex items-center justify-center gap-(--button-gap) rounded-(--button-radius) ' +
  'border-(length:--border-width-default) border-transparent cursor-pointer select-none whitespace-nowrap ' +
  'transition-colors duration-(--motion-hover-duration) ease-(--motion-hover-easing) ' +
  // On mobile the small button gets an invisible, taller hit area (44px target rule).
  'max-tablet:after:absolute max-tablet:after:inset-x-0 max-tablet:after:top-1/2 ' +
  'max-tablet:after:h-(--button-target-touch) max-tablet:after:-translate-y-1/2 max-tablet:after:content-[""]'

const sizes: Record<ButtonSize, string> = {
  sm: 'h-(--button-height-sm) px-(--button-padding-x-sm) text-label-s',
  md: 'h-(--button-height-md) px-(--button-padding-x) text-label-m',
  lg: 'h-(--button-height-lg) px-(--button-padding-x) text-label-m',
}

// Resting look of each variant.
const resting: Record<ButtonVariant, string> = {
  primary: 'bg-(--button-primary-bg) text-(--button-primary-text)',
  secondary: 'bg-(--button-secondary-bg) text-(--button-secondary-text) border-(--button-secondary-border)',
  ghost: 'bg-transparent text-(--button-ghost-text)',
  danger: 'bg-(--button-danger-bg) text-(--button-danger-text)',
}

// Hover and pressed feedback, only applied while the button is usable.
const feedback: Record<ButtonVariant, string> = {
  primary: 'hover:bg-(--button-primary-bg-hover) active:bg-(--button-primary-bg-pressed)',
  secondary: 'hover:bg-(--button-secondary-bg-hover) active:bg-(--button-ghost-bg-pressed)',
  ghost: 'hover:bg-(--button-ghost-bg-hover) active:bg-(--button-ghost-bg-pressed)',
  danger: 'hover:bg-(--button-danger-bg-hover) active:bg-(--button-danger-bg-pressed)',
}

const disabledLook: Record<ButtonVariant, string> = {
  primary: 'bg-(--button-disabled-bg) text-(--button-disabled-text) cursor-not-allowed',
  secondary: 'bg-(--button-disabled-bg) text-(--button-disabled-text) cursor-not-allowed',
  ghost: 'bg-transparent text-(--button-disabled-text) cursor-not-allowed',
  danger: 'bg-(--button-disabled-bg) text-(--button-disabled-text) cursor-not-allowed',
}

/** A ring with a gap. Static under reduced motion; the label stays visible either way. */
function Spinner({ size }: { size: ButtonSize }) {
  return (
    <svg
      viewBox="0 0 16 16"
      aria-hidden="true"
      className={`${size === 'sm' ? 'size-icon-sm' : 'size-icon-md'} shrink-0 animate-[spin_var(--motion-spinner-duration)_var(--motion-spinner-easing)_infinite] motion-reduce:animate-none`}
    >
      <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="2" strokeOpacity="0.3" />
      <path d="M8 2a6 6 0 0 1 6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  fullWidth = false,
  leadingIcon,
  trailingIcon,
  type = 'button',
  className = '',
  onClick,
  children,
  ...rest
}: ButtonProps) {
  const usable = !disabled && !loading
  const look = disabled ? disabledLook[variant] : `${resting[variant]} ${loading ? 'cursor-progress' : feedback[variant]}`

  return (
    <button
      {...rest}
      type={type}
      disabled={disabled}
      aria-disabled={loading || undefined}
      aria-busy={loading || undefined}
      onClick={usable ? onClick : undefined}
      className={`${base} ${sizes[size]} ${look} ${fullWidth ? 'w-full' : ''} ${className}`}
    >
      {loading ? <Spinner size={size} /> : leadingIcon && <span aria-hidden="true" className="inline-flex shrink-0">{leadingIcon}</span>}
      {children}
      {trailingIcon && <span aria-hidden="true" className="inline-flex shrink-0">{trailingIcon}</span>}
    </button>
  )
}

import { useId } from 'react'
import type { InputHTMLAttributes } from 'react'

export type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> & {
  /** Always visible. Inputs are never labelled by placeholder alone. */
  label: string
  helperText?: string
  /** Error message. Turns the field into its error state. */
  error?: string
  /** Success message, shown with a check icon. */
  success?: string
  /** Shows a spinner inside the field and sets aria-busy. */
  loading?: boolean
}

// The border grows from default to emphasis width on focus and error. Padding shrinks by the same
// difference (calc of the two border tokens) so the text does not move. Classes are written out in
// full because Tailwind only generates classes it can read literally.
const field =
  'block w-full h-(--input-height) rounded-(--input-radius) bg-(--input-bg) text-(--input-text) text-body-l ' +
  'border-(length:--input-border-width) border-(--input-border) px-(--input-padding-x) ' +
  'placeholder:text-(--input-placeholder) transition-colors duration-(--motion-hover-duration) ease-(--motion-hover-easing) ' +
  'focus-visible:border-(length:--input-border-width-emphasis) focus-visible:border-(--input-border-focus) ' +
  'focus-visible:px-[calc(var(--input-padding-x)_-_(var(--input-border-width-emphasis)_-_var(--input-border-width)))] ' +
  'aria-invalid:border-(length:--input-border-width-emphasis) aria-invalid:border-(--input-border-error) ' +
  'aria-invalid:px-[calc(var(--input-padding-x)_-_(var(--input-border-width-emphasis)_-_var(--input-border-width)))] ' +
  'disabled:cursor-not-allowed disabled:bg-(--input-bg-disabled) disabled:text-(--input-text-disabled) ' +
  'disabled:placeholder:text-(--input-text-disabled)'

function Spinner() {
  return (
    <svg
      viewBox="0 0 16 16"
      aria-hidden="true"
      className="size-icon-md shrink-0 animate-[spin_var(--motion-spinner-duration)_var(--motion-spinner-easing)_infinite] motion-reduce:animate-none"
    >
      <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="2" strokeOpacity="0.3" />
      <path d="M8 2a6 6 0 0 1 6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

const ErrorIcon = () => (
  <svg viewBox="0 0 16 16" aria-hidden="true" className="size-icon-sm shrink-0" fill="currentColor">
    <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1Zm-.75 3.5h1.5v4.5h-1.5V4.5Zm.75 7.5a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z" />
  </svg>
)

const SuccessIcon = () => (
  <svg viewBox="0 0 16 16" aria-hidden="true" className="size-icon-sm shrink-0" fill="currentColor">
    <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1Zm3.2 5.2-3.7 4a.75.75 0 0 1-1.07.03L4.8 9.7l1.04-1.08.9.86 3.17-3.4 1.29 1.12Z" />
  </svg>
)

export function Input({
  label,
  helperText,
  error,
  success,
  loading = false,
  required = false,
  disabled = false,
  id,
  className = '',
  'aria-describedby': describedBy,
  ...rest
}: InputProps) {
  const autoId = useId()
  const inputId = id ?? autoId
  const helperId = `${inputId}-helper`
  const messageId = `${inputId}-message`

  const message = error ?? success
  const describedIds = [helperText && helperId, message && messageId, describedBy].filter(Boolean).join(' ')

  return (
    <div className="flex flex-col gap-(--input-gap)">
      <label htmlFor={inputId} className="text-label-m text-(--input-label-text)">
        {label}
        {required && <span> (required)</span>}
      </label>
      <div className="relative">
        <input
          {...rest}
          id={inputId}
          required={required}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-busy={loading || undefined}
          aria-describedby={describedIds || undefined}
          className={`${field} ${loading ? 'pe-[calc(var(--input-padding-x)_+_var(--spacing-icon-md)_+_var(--input-padding-x))]' : ''} ${className}`}
        />
        {loading && (
          <span className="pointer-events-none absolute inset-y-0 end-(--input-padding-x) flex items-center text-(--input-label-text)">
            <Spinner />
          </span>
        )}
      </div>
      {helperText && (
        <p id={helperId} className="text-body-s text-(--input-helper-text)">
          {helperText}
        </p>
      )}
      {error && (
        <p id={messageId} role="alert" className="flex items-center gap-inline-xs text-body-s text-(--input-error-text)">
          <ErrorIcon />
          {error}
        </p>
      )}
      {!error && success && (
        <p id={messageId} role="status" className="flex items-center gap-inline-xs text-body-s text-(--input-success-text)">
          <SuccessIcon />
          {success}
        </p>
      )}
    </div>
  )
}

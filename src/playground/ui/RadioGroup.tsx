import { useId, useRef } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'

export interface RadioOption<T extends string | number> {
  value: T
  /** Accessible name, read by screen readers. */
  label: string
  content: ReactNode
}

interface RadioGroupProps<T extends string | number> {
  legend: string
  value: T
  options: readonly RadioOption<T>[]
  onChange: (value: T) => void
  /** Classes for the row of options. */
  className?: string
  optionClassName: (selected: boolean) => string
}

/** A single-choice group with arrow-key navigation, as the ARIA radio pattern asks. */
export function RadioGroup<T extends string | number>({ legend, value, options, onChange, className = '', optionClassName }: RadioGroupProps<T>) {
  const labelId = useId()
  const refs = useRef<(HTMLButtonElement | null)[]>([])

  function onKeyDown(event: KeyboardEvent, index: number) {
    const step = ['ArrowRight', 'ArrowDown'].includes(event.key) ? 1 : ['ArrowLeft', 'ArrowUp'].includes(event.key) ? -1 : 0
    if (!step) return
    event.preventDefault()
    const next = (index + step + options.length) % options.length
    onChange(options[next].value)
    refs.current[next]?.focus()
  }

  return (
    <div>
      <span id={labelId} className="mb-stack-xs block text-label-m text-primary">{legend}</span>
      <div role="radiogroup" aria-labelledby={labelId} className={className}>
        {options.map((option, index) => {
          const selected = option.value === value
          return (
            <button
              key={option.value}
              ref={(node) => { refs.current[index] = node }}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={option.label}
              tabIndex={selected ? 0 : -1}
              onClick={() => onChange(option.value)}
              onKeyDown={(event) => onKeyDown(event, index)}
              className={optionClassName(selected)}
            >
              {option.content}
            </button>
          )
        })}
      </div>
    </div>
  )
}

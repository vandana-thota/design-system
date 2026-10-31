import { RADII, SWATCHES } from '../model/design.ts'
import type { Design } from '../model/design.ts'
import { RadioGroup } from './RadioGroup.tsx'

interface ControlsProps {
  design: Design
  onChange: (patch: Partial<Design>) => void
}

const swatchOptions = SWATCHES.map((s) => ({
  value: s.hex,
  label: `${s.label} ${s.hex}${s.hex === '#2563EB' ? ' (baseline)' : ''}`,
  content: <span className="block size-icon-lg rounded-pill" style={{ backgroundColor: s.hex }} />,
}))

const radiusOptions = RADII.map((r) => ({ value: r, label: `${r} pixels`, content: `${r}px` }))

/** The three design controls. Changing them only changes the design specification preview. */
export function Controls({ design, onChange }: ControlsProps) {
  const chosen = SWATCHES.find((s) => s.hex === design.color)
  return (
    <div className="flex flex-col gap-stack-md">
      <div>
        <RadioGroup
          legend="Change button color"
          value={design.color}
          options={swatchOptions}
          onChange={(color) => onChange({ color })}
          className="flex items-center gap-inline-sm"
          optionClassName={(selected) =>
            `grid size-control-sm cursor-pointer place-items-center rounded-pill border-(length:--border-width-emphasis) bg-transparent ${selected ? 'border-primary' : 'border-transparent hover:border-default'}`
          }
        />
        <p className="mt-stack-xs text-code text-secondary">{chosen?.hex}{chosen?.hex === '#2563EB' ? ' (baseline)' : ''}</p>
      </div>

      <label className="flex w-fit cursor-pointer items-center gap-inline-sm text-label-m text-primary">
        <input
          type="checkbox"
          checked={design.illustration}
          onChange={(event) => onChange({ illustration: event.target.checked })}
          className="size-icon-sm cursor-pointer accent-(--color-accent-default)"
        />
        Add card illustration
      </label>

      <RadioGroup
        legend="Card radius"
        value={design.radius}
        options={radiusOptions}
        onChange={(radius) => onChange({ radius })}
        className="inline-flex divide-x divide-default overflow-hidden rounded-control border-(length:--border-width-default) border-default"
        optionClassName={(selected) =>
          `h-control-sm cursor-pointer px-inset-md text-label-m ${selected ? 'bg-accent-subtle text-accent-subtle-text' : 'bg-surface text-primary hover:bg-surface-hover'}`
        }
      />
    </div>
  )
}

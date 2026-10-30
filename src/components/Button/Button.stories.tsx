import type { ReactNode } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { Button, type ButtonSize, type ButtonVariant } from './Button'

const variants: ButtonVariant[] = ['primary', 'secondary', 'ghost', 'danger']
const sizes: ButtonSize[] = ['sm', 'md', 'lg']

const meta = {
  title: 'Components/Button',
  component: Button,
  args: { children: 'Save changes', onClick: fn() },
  argTypes: {
    variant: { control: 'inline-radio', options: variants },
    size: { control: 'inline-radio', options: sizes },
  },
  parameters: {
    layout: 'centered',
    a11y: { test: 'error' },
    docs: {
      description: {
        component:
          'Secondary buttons use `color.border.default` (1.4:1) by design. They stay identifiable through their visible label, the surface fill against the canvas, and the 2px focus ring. See the border exception in docs/tokens-spec.md.',
      },
    },
  },
} satisfies Meta<typeof Button>
export default meta
type Story = StoryObj<typeof meta>

// Storybook cannot hold :hover or :active, so these stories apply the same tokens with `!` (important).
const hovered: Record<ButtonVariant, string> = {
  primary: 'bg-(--button-primary-bg-hover)!',
  secondary: 'bg-(--button-secondary-bg-hover)!',
  ghost: 'bg-(--button-ghost-bg-hover)!',
  danger: 'bg-(--button-danger-bg-hover)!',
}
const pressed: Record<ButtonVariant, string> = {
  primary: 'bg-(--button-primary-bg-pressed)!',
  secondary: 'bg-(--button-ghost-bg-pressed)!',
  ghost: 'bg-(--button-ghost-bg-pressed)!',
  danger: 'bg-(--button-danger-bg-pressed)!',
}

const Row = ({ children }: { children: ReactNode }) => (
  <div className="flex flex-wrap items-center gap-inline-sm">{children}</div>
)

const Star = () => (
  <svg viewBox="0 0 16 16" width="1em" height="1em" fill="currentColor">
    <path d="M8 1l2 4.5 5 .5-3.7 3.3 1.1 4.9L8 11.7 3.6 14.2l1.1-4.9L1 6l5-.5z" />
  </svg>
)

export const Default: Story = {}

export const Primary: Story = { args: { variant: 'primary' } }
export const Secondary: Story = { args: { variant: 'secondary' } }
export const Ghost: Story = { args: { variant: 'ghost' } }
export const Danger: Story = { args: { variant: 'danger', children: 'Delete project' } }

export const Hover: Story = {
  render: (args) => (
    <Row>{variants.map((v) => <Button key={v} {...args} variant={v} className={hovered[v]}>{v}</Button>)}</Row>
  ),
}

export const Pressed: Story = {
  render: (args) => (
    <Row>{variants.map((v) => <Button key={v} {...args} variant={v} className={pressed[v]}>{v}</Button>)}</Row>
  ),
}

export const FocusVisible: Story = {
  render: (args) => (
    <Row>{variants.map((v) => <Button key={v} {...args} variant={v}>{v}</Button>)}</Row>
  ),
  play: async ({ canvasElement }) => {
    // Tab moves focus the way a keyboard user would, so the focus ring shows on the first button.
    await userEvent.tab()
    await expect(within(canvasElement).getAllByRole('button')[0]).toHaveFocus()
  },
}

export const Disabled: Story = {
  render: (args) => (
    <Row>{variants.map((v) => <Button key={v} {...args} variant={v} disabled>{v}</Button>)}</Row>
  ),
  play: async ({ canvasElement, args }) => {
    const first = within(canvasElement).getAllByRole('button')[0]
    await expect(first).toBeDisabled()
    await userEvent.click(first)
    await expect(args.onClick).not.toHaveBeenCalled()
  },
}

export const Loading: Story = {
  render: (args) => (
    <Row>{variants.map((v) => <Button key={v} {...args} variant={v} loading>{v}</Button>)}</Row>
  ),
  play: async ({ canvasElement, args }) => {
    const first = within(canvasElement).getAllByRole('button')[0]
    await expect(first).toHaveAttribute('aria-busy', 'true')
    await userEvent.click(first)
    await expect(args.onClick).not.toHaveBeenCalled()
  },
}

export const Sizes: Story = {
  render: (args) => (
    <Row>{sizes.map((s) => <Button key={s} {...args} size={s}>Size {s}</Button>)}</Row>
  ),
}

export const WithIcons: Story = {
  render: (args) => (
    <Row>
      <Button {...args} leadingIcon={<Star />}>Favorite</Button>
      <Button {...args} variant="secondary" trailingIcon={<Star />}>Favorite</Button>
      <Button variant="ghost" aria-label="Favorite" leadingIcon={<Star />} />
    </Row>
  ),
}

export const FullWidth: Story = {
  args: { fullWidth: true },
  parameters: { layout: 'padded' },
}

export const Interaction: Story = {
  args: { children: 'Click me' },
  play: async ({ canvasElement, args }) => {
    const button = within(canvasElement).getByRole('button', { name: 'Click me' })
    await userEvent.click(button)
    await expect(args.onClick).toHaveBeenCalledTimes(1)
    button.focus()
    await userEvent.keyboard('{Enter}')
    await userEvent.keyboard(' ')
    await expect(args.onClick).toHaveBeenCalledTimes(3)
  },
}

/** Every variant and state. The two stories below force light and dark. */
const Everything = () => (
  <div className="flex flex-col gap-stack-md bg-canvas p-inset-lg">
    {variants.map((v) => (
      <Row key={v}>
        <Button variant={v}>{v}</Button>
        <Button variant={v} className={hovered[v]}>Hover</Button>
        <Button variant={v} className={pressed[v]}>Pressed</Button>
        <Button variant={v} disabled>Disabled</Button>
        <Button variant={v} loading>Loading</Button>
      </Row>
    ))}
  </div>
)

export const ThemeCheckLight: Story = {
  render: () => <Everything />,
  globals: { theme: 'light' },
  parameters: { layout: 'fullscreen' },
}

export const ThemeCheckDark: Story = {
  render: () => <Everything />,
  globals: { theme: 'dark' },
  parameters: { layout: 'fullscreen' },
}

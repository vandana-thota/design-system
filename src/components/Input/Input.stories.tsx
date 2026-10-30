import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, within } from 'storybook/test'
import { Input } from './Input'

const meta = {
  title: 'Components/Input',
  component: Input,
  args: { label: 'Email address', placeholder: 'name@example.com', type: 'email' },
  decorators: [(Story) => <div className="w-80"><Story /></div>],
  parameters: {
    layout: 'centered',
    a11y: { test: 'error' },
    docs: {
      description: {
        component:
          'The border uses `color.border.default` (1.4:1) by design. The field stays identifiable through its visible label, the surface fill against the canvas, and the 2px focus ring. See the border exception in docs/tokens-spec.md. Hover has no visual change because there is no darker border token, so there is no Hover story.',
      },
    },
  },
} satisfies Meta<typeof Input>
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Placeholder: Story = {}

export const Filled: Story = { args: { defaultValue: 'maya@example.com' } }

export const WithHelperText: Story = { args: { helperText: 'We only use this to send receipts.' } }

export const Required: Story = { args: { required: true } }

export const FocusVisible: Story = {
  play: async ({ canvasElement }) => {
    // Tab moves focus the way a keyboard user would.
    await userEvent.tab()
    await expect(within(canvasElement).getByLabelText('Email address')).toHaveFocus()
  },
}

export const Disabled: Story = {
  args: { disabled: true, defaultValue: 'maya@example.com' },
  play: async ({ canvasElement }) => {
    const input = within(canvasElement).getByLabelText('Email address')
    await expect(input).toBeDisabled()
    await userEvent.type(input, 'x')
    await expect(input).toHaveValue('maya@example.com')
  },
}

export const ReadOnly: Story = { args: { readOnly: true, defaultValue: 'maya@example.com' } }

export const ErrorState: Story = {
  name: 'Error',
  args: { defaultValue: 'maya@', error: 'Enter a full email address, like name@example.com.', helperText: 'We only use this to send receipts.' },
  play: async ({ canvasElement }) => {
    const input = within(canvasElement).getByLabelText('Email address')
    await expect(input).toHaveAttribute('aria-invalid', 'true')
    const ids = (input.getAttribute('aria-describedby') ?? '').split(' ')
    await expect(ids).toHaveLength(2)
    await expect(canvasElement.querySelector(`#${ids[1]}`)).toHaveTextContent('Enter a full email address')
  },
}

export const Success: Story = { args: { defaultValue: 'maya@example.com', success: 'Email address is available.' } }

export const Loading: Story = {
  args: { defaultValue: 'maya@example.com', loading: true, helperText: 'Checking availability.' },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByLabelText('Email address')).toHaveAttribute('aria-busy', 'true')
  },
}

export const Interaction: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByText('Email address'))
    const input = canvas.getByLabelText('Email address')
    await expect(input).toHaveFocus()
    await userEvent.type(input, 'maya@example.com')
    await expect(input).toHaveValue('maya@example.com')
  },
}

const Everything = () => (
  <div className="flex w-80 flex-col gap-stack-md bg-canvas p-inset-lg">
    <Input label="Default" placeholder="Placeholder" />
    <Input label="Filled" defaultValue="maya@example.com" helperText="Helper text" />
    <Input label="Disabled" disabled defaultValue="maya@example.com" />
    <Input label="Read only" readOnly defaultValue="maya@example.com" />
    <Input label="Error" defaultValue="maya@" error="Enter a full email address." />
    <Input label="Success" defaultValue="maya@example.com" success="Email address is available." />
    <Input label="Loading" defaultValue="maya@example.com" loading />
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

import type { ReactNode } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { Card as CardComponent } from './Card'

// Card's props are a union (static, link, button), which Storybook cannot type as one set of args.
// The stories use one flat set of args; Card itself stays strictly typed.
type CardArgs = {
  as?: 'div' | 'article' | 'section'
  padding?: 'md' | 'lg'
  selected?: boolean
  disabled?: boolean
  href?: string
  onClick?: () => void
  className?: string
  children?: ReactNode
}
const Card = CardComponent as typeof CardComponent & ((props: CardArgs) => ReactNode)

const meta = {
  title: 'Components/Card',
  component: CardComponent as unknown as (props: CardArgs) => ReactNode,
  decorators: [(Story) => <div className="w-96"><Story /></div>],
  parameters: {
    layout: 'centered',
    a11y: { test: 'error' },
    docs: {
      description: {
        component:
          'Cards use `color.border.default` (1.4:1) by design; an interactive card stays identifiable through its text, the surface fill against the canvas, and the 2px focus ring. See the border exception in docs/tokens-spec.md. An interactive card is one link or one button, so it must never contain other interactive elements. Put actions in a static card instead.',
      },
    },
  },
} satisfies Meta<CardArgs>
export default meta
type Story = StoryObj<typeof meta>

const Content = ({ footer = 'Updated 2 days ago' }: { footer?: ReactNode }) => (
  <>
    <Card.Header><Card.Title>Quarterly report</Card.Title></Card.Header>
    <Card.Body>Revenue, retention and the three biggest changes since last quarter.</Card.Body>
    <Card.Footer>{footer}</Card.Footer>
  </>
)

// Storybook cannot hold :hover, so this story applies the same token with `!` (important).
const hoverLook = 'bg-(--card-bg-hover)!'
const pressedLook = 'bg-(--card-bg-pressed)!'

export const Default: Story = { args: { children: <Content /> } }

export const AsArticle: Story = { args: { as: 'article', children: <Content /> } }

export const LargePadding: Story = { args: { padding: 'lg', children: <Content /> } }

export const Hover: Story = {
  args: { onClick: fn(), className: hoverLook, children: <Content /> },
}

export const Pressed: Story = {
  args: { onClick: fn(), className: pressedLook, children: <Content /> },
}

export const FocusVisible: Story = {
  args: { onClick: fn(), children: <Content /> },
  play: async ({ canvasElement }) => {
    await userEvent.tab()
    await expect(within(canvasElement).getByRole('button')).toHaveFocus()
  },
}

export const Selected: Story = {
  args: { onClick: fn(), selected: true, children: <Content /> },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('button')).toHaveAttribute('aria-pressed', 'true')
  },
}

export const SelectedLink: Story = {
  args: { href: '#report', selected: true, children: <Content /> },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('link')).toHaveAttribute('aria-current', 'true')
  },
}

export const Disabled: Story = {
  args: { onClick: fn(), disabled: true, children: <Content /> },
  play: async ({ canvasElement, args }) => {
    const card = within(canvasElement).getByRole('button')
    await expect(card).toBeDisabled()
    await userEvent.click(card)
    await expect(args.onClick).not.toHaveBeenCalled()
  },
}

export const WithHeaderAndFooter: Story = {
  args: {
    children: (
      <>
        <Card.Header><Card.Title>Invite your team</Card.Title></Card.Header>
        <Card.Body>People you invite can view and comment. You can change their role later.</Card.Body>
        <Card.Footer className="flex gap-inline-sm">
          <button type="button" className="text-label-m text-link underline">Copy link</button>
          <button type="button" className="text-label-m text-link underline">Send invites</button>
        </Card.Footer>
      </>
    ),
  },
}

export const Interactive: Story = {
  args: { onClick: fn(), children: <Content /> },
  play: async ({ canvasElement, args }) => {
    const card = within(canvasElement).getByRole('button')
    // One control, nothing interactive inside it.
    await expect(card.querySelectorAll('a, button, input, select, textarea, [tabindex]')).toHaveLength(0)
    await userEvent.click(card)
    await expect(args.onClick).toHaveBeenCalledTimes(1)
    card.focus()
    await userEvent.keyboard('{Enter}')
    await userEvent.keyboard(' ')
    await expect(args.onClick).toHaveBeenCalledTimes(3)
  },
}

export const InteractiveLink: Story = {
  args: { href: '#report', children: <Content /> },
  play: async ({ canvasElement }) => {
    const card = within(canvasElement).getByRole('link')
    await expect(card.querySelectorAll('a, button, input, select, textarea, [tabindex]')).toHaveLength(0)
  },
}

const Everything = () => (
  <div className="flex w-96 flex-col gap-stack-md bg-canvas p-inset-lg">
    <Card><Content /></Card>
    <Card onClick={() => {}}><Content /></Card>
    <Card onClick={() => {}} className={hoverLook}><Content /></Card>
    <Card onClick={() => {}} className={pressedLook}><Content /></Card>
    <Card onClick={() => {}} selected><Content /></Card>
    <Card onClick={() => {}} disabled><Content /></Card>
    <Card href="#report" selected><Content /></Card>
  </div>
)

export const ThemeCheckLight: Story = {
  args: { children: null },
  render: () => <Everything />,
  globals: { theme: 'light' },
  parameters: { layout: 'fullscreen' },
}

export const ThemeCheckDark: Story = {
  args: { children: null },
  render: () => <Everything />,
  globals: { theme: 'dark' },
  parameters: { layout: 'fullscreen' },
}

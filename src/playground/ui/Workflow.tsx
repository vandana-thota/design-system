type Stage = 'Implemented' | 'Partly implemented' | 'Illustrated'

const STAGES: { title: string; stage: Stage; body: string }[] = [
  {
    title: 'Design updated',
    stage: 'Implemented',
    body: 'In this sandbox, your edits are applied to an in-memory copy of a sanitized design snapshot. The real Figma file is never read or changed here. A separate private tool reads Figma live.',
  },
  {
    title: 'Drift check executed',
    stage: 'Implemented',
    body: 'The real comparison engine runs in your browser on the edited snapshot and the card’s source text. It returns structured MATCH, DRIFT or NOT CHECKED results.',
  },
  {
    title: 'Component and token mapping inspected',
    stage: 'Implemented',
    body: 'Each report row names the design layer and the code location it was compared with. The token checker (DS001–DS007) and a token lookup show where a value should come from.',
  },
  {
    title: 'Suggested implementation change',
    stage: 'Partly implemented',
    body: 'Patches exist for button colour, card radius and the illustration layer, and they are applied to copies of the source text. Other kinds of difference get no patch, and the page says so.',
  },
  {
    title: 'Tests and Storybook review',
    stage: 'Illustrated',
    body: 'The repository has tests and Storybook stories, but this page does not run them against a simulated fix. In a real workflow, this is where a changed component is reviewed.',
  },
  {
    title: 'Pull request review',
    stage: 'Partly implemented',
    body: 'A GitHub Action runs the token checker on pull requests. The Figma comparison is not wired into CI, and this page never opens a pull request.',
  },
]

const tone: Record<Stage, string> = {
  Implemented: 'bg-status-success-bg text-status-success-text',
  'Partly implemented': 'bg-status-warning-bg text-status-warning-text',
  Illustrated: 'bg-surface-secondary text-secondary',
}

export function Workflow() {
  return (
    <section aria-labelledby="workflow-heading">
      <h2 id="workflow-heading" className="text-title-m text-primary">Engineering workflow</h2>
      <p className="mt-stack-xs text-body-m text-secondary">Where this playground sits in a design-to-code workflow, and which stages are real.</p>
      <ol className="mt-stack-md grid gap-stack-sm tablet:grid-cols-2 desktop:grid-cols-3">
        {STAGES.map((stage, index) => (
          <li key={stage.title} className="flex flex-col gap-stack-xs rounded-card border-(length:--border-width-default) border-default bg-surface p-inset-lg">
            <div className="flex items-start justify-between gap-inline-sm">
              <span className="tabular text-code text-secondary">{String(index + 1).padStart(2, '0')}</span>
              <span className={`rounded-chip px-inset-xs text-label-s whitespace-nowrap ${tone[stage.stage]}`}>{stage.stage}</span>
            </div>
            <h3 className="text-title-s text-primary">{stage.title}</h3>
            <p className="text-body-m text-secondary">{stage.body}</p>
          </li>
        ))}
      </ol>
    </section>
  )
}

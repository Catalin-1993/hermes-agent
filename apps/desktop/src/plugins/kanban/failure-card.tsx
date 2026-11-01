/**
 * A failed task explained as a short card: what happened, why it probably did, the few numbers worth seeing,
 * what to do next, and the original text folded away under "Technical details".
 */

import { Codicon } from '@hermes/plugin-sdk'

import type { Failure } from './failure-model'

const LABEL = 'text-[0.625rem] font-semibold tracking-[0.08em] text-(--ui-text-tertiary) uppercase'

/** The original text, folded: it is long, technical and mostly for whoever fixes it. */
export function RawOutput({ summary = 'Technical details', text }: { summary?: string; text: string }) {
  return (
    <details className="group rounded-md border border-(--ui-stroke-tertiary) bg-(--ui-bg-quinary)">
      <summary className="flex cursor-pointer list-none items-center gap-1.5 px-2.5 py-1.5 text-[0.6875rem] text-(--ui-text-tertiary) hover:text-foreground">
        <Codicon className="transition-transform group-open:rotate-90" name="chevron-right" size="0.7rem" />
        {summary}
      </summary>
      <pre className="max-h-56 overflow-auto px-2.5 pb-2 font-mono text-[0.65rem] leading-snug whitespace-pre-wrap text-(--ui-text-tertiary)">
        {text}
      </pre>
    </details>
  )
}

export function FailureCard({ failure }: { failure: Failure }) {
  return (
    <div className="flex flex-col gap-3" data-failure={failure.cause}>
      <div className="flex flex-col gap-1">
        <span className={LABEL}>What happened</span>
        <p className="text-[0.875rem] font-medium text-foreground">{failure.headline}</p>
        <p className="text-[0.75rem] leading-relaxed text-(--ui-text-secondary)">{failure.why}</p>
      </div>
      {failure.facts.length > 0 && (
        <dl className="flex flex-wrap gap-1.5">
          {failure.facts.map(fact => (
            <div
              className="flex items-baseline gap-1.5 rounded-md bg-(--ui-bg-tertiary) px-2 py-1 text-[0.6875rem]"
              key={fact.label}
            >
              <dt className="text-(--ui-text-tertiary)">{fact.label}</dt>
              <dd className="font-medium text-foreground tabular-nums">{fact.value}</dd>
            </div>
          ))}
        </dl>
      )}
      <div className="flex flex-col gap-1">
        <span className={LABEL}>What to do</span>
        <ol className="flex flex-col gap-1">
          {failure.steps.map((step, index) => (
            <li className="flex gap-2 text-[0.75rem] leading-relaxed text-(--ui-text-secondary)" key={step}>
              <span className="grid size-4 shrink-0 place-items-center rounded-full bg-(--ui-bg-tertiary) text-[0.625rem] font-semibold text-foreground">
                {index + 1}
              </span>
              {step}
            </li>
          ))}
        </ol>
      </div>
      <RawOutput text={failure.raw} />
    </div>
  )
}

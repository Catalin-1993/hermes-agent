import { useAuiState } from '@assistant-ui/react'
import { useStore } from '@nanostores/react'
import { useState } from 'react'

import { requestComposerSubmit } from '@/app/chat/composer/focus'
import { useSessionView } from '@/app/chat/session-view'
import { HermesCard, HermesCardHeader } from '@/components/ui/hermes-card'
import { answeredAfter } from '@/lib/chat-messages/parts'
import { MessageQuestion } from '@/lib/icons'
import { cn } from '@/lib/utils'

const settled = new Set<string>()

export function AskDirective({ attrs, streaming }: { attrs: Record<string, string>; streaming: boolean }) {
  const view = useSessionView()
  const storedId = useStore(view.$storedId)
  const runtimeId = useStore(view.$runtimeId)
  const messageId = useAuiState(state => state.message.id)
  const question = (attrs.question ?? '').trim()
  const identity = JSON.stringify([storedId ?? runtimeId, messageId, question])
  const target = view.kind === 'tile' ? `tile:${storedId}` : 'main'

  const options = (attrs.options ?? '')
    .split('|')
    .map(option => option.trim())
    .filter(Boolean)
    .slice(0, 6)

  const wantsInput = attrs.input === 'true' || attrs.input === 'yes'
  const [picked, setPicked] = useState<null | string>(() => (settled.has(identity) ? '' : null))

  const answeredInComposer = answeredAfter(useStore(view.$messages), messageId)

  const closed = picked !== null || answeredInComposer

  if (!question || (options.length === 0 && !wantsInput)) {
    return null
  }

  const submit = (value: string) => {
    if (closed || streaming || !value.trim()) {
      return
    }

    if (requestComposerSubmit(value.trim(), { target })) {
      settled.add(identity)
      setPicked(value.trim())
    }
  }

  return (
    <HermesCard className="my-3 max-w-xl" data-onboarding-card>
      <HermesCardHeader icon={<MessageQuestion className="size-4" />} title={question} />
      {options.length > 0 && (
        <div className="flex min-w-0 max-w-full flex-wrap gap-2 px-4 pt-3.5 pb-4">
          {options.map(option => (
            <button
              className={cn(
                'max-w-full shrink-0 rounded-full border px-3.5 py-1.5 text-left text-[0.8125rem] whitespace-normal wrap-anywhere transition-[background-color,border-color,color] duration-150',
                picked === option
                  ? 'border-(--ui-accent) bg-(--ui-accent) text-white'
                  : closed
                    ? 'border-(--card-well-stroke) text-(--ui-text-tertiary) opacity-60'
                    : 'border-(--card-well-stroke) bg-(--card-well) text-(--ui-text-secondary) hover:border-[color-mix(in_srgb,var(--ui-accent)_45%,transparent)] hover:bg-[color-mix(in_srgb,var(--ui-accent)_6%,transparent)] hover:text-(--ui-text-primary)'
              )}
              disabled={closed || streaming}
              key={option}
              onClick={() => submit(option)}
              type="button"
            >
              {option}
            </button>
          ))}
        </div>
      )}
      {options.length === 0 && <div className="pb-4" />}
    </HermesCard>
  )
}

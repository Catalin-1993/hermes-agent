import { REASONING_EFFORTS } from '@hermes/shared'
import { useState } from 'react'

import { Slider } from '@/components/ui/slider'
import { useI18n } from '@/i18n'
import { currentModelCapabilities } from '@/lib/model-options'
import { isThinkingEnabled, reasoningEffortClamp, resolveReasoningEffort } from '@/lib/reasoning-effort'

import { type ModelMenuHostProps, useModelMenuController } from './use-model-menu-controller'

/**
 * The thinking level of the ACTIVE model as one slider, at the head of the
 * composer's model menu. Same controller as the model menu, so a level set
 * here and one set in a catalog row's submenu are one code path — session
 * write, preset, optimistic store, rollback. Renders nothing for a model with
 * no reasoning control.
 */
export function ReasoningMenuPanel(props: ModelMenuHostProps) {
  const { t } = useI18n()
  const copy = t.shell.modelOptions
  const { controller, defaultEffort, modelOptions } = useModelMenuController(props)
  const { effort, effortWire, model, provider } = controller.current
  const caps = currentModelCapabilities(modelOptions.data, provider, model)
  // While a thumb is held the slider shows the drag; the level is written once, on release.
  const [dragIndex, setDragIndex] = useState<null | number>(null)

  if (!model || caps?.reasoning === false) {
    return null
  }

  const stops: readonly string[] =
    caps?.can_disable_reasoning === false ? REASONING_EFFORTS : ['none', ...REASONING_EFFORTS]

  const current = isThinkingEnabled(effort, defaultEffort) ? resolveReasoningEffort(effort, defaultEffort) : 'none'
  const index = dragIndex ?? Math.max(0, stops.indexOf(current))
  const value = stops[index] ?? current

  const levelLabel = (level: string) =>
    level === 'none' ? copy.off : copy[level as (typeof REASONING_EFFORTS)[number]]

  const clamp = dragIndex === null ? reasoningEffortClamp(value, effortWire) : null

  const commit = () => {
    if (dragIndex !== null && stops[dragIndex] !== current) {
      controller.setOptions({ effort: stops[dragIndex] }, { isActive: true, model, provider })
    }

    setDragIndex(null)
  }

  return (
    // Arrow keys move the thumb, never the menu's roving focus.
    <div
      className="border-b border-(--ui-stroke-tertiary) px-3 pt-2.5 pb-3"
      data-slot="model-menu-thinking"
      onKeyDown={event => event.stopPropagation()}
    >
      <div className="mb-2 flex items-baseline justify-between gap-3 text-xs">
        <span className="font-medium text-foreground">{copy.thinking}</span>
        <span
          className="truncate text-(--ui-text-tertiary)"
          title={clamp ? copy.sendsOnRoute(copy[clamp.wire]) : undefined}
        >
          {clamp ? `${levelLabel(value)} → ${copy[clamp.wire]}` : levelLabel(value)}
        </span>
      </div>
      <Slider
        aria-label={copy.thinking}
        aria-valuetext={levelLabel(value)}
        className="block w-full"
        max={stops.length - 1}
        min={0}
        onBlur={commit}
        onChange={event => setDragIndex(Number(event.currentTarget.value))}
        onKeyUp={commit}
        onPointerUp={commit}
        step={1}
        value={index}
      />
      <div aria-hidden className="mt-1.5 flex justify-between px-1.5">
        {stops.map((stop, i) => (
          <span
            className={
              i <= index
                ? 'size-1 rounded-full bg-(--ui-text-tertiary)'
                : 'size-1 rounded-full bg-(--ui-stroke-secondary)'
            }
            key={stop}
          />
        ))}
      </div>
    </div>
  )
}

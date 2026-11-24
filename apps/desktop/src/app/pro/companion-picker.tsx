/**
 * Brain (Pro Mode): choose who stands at the top of the Pro panel — the built-in Brain companion, the profile's
 * photo, or one of the project's pets. A pet picked here becomes the project's pet (the same `pet.select` the
 * Pets page uses), so the floating pet follows; Brain and the photo only change this panel.
 */

import { useStore } from '@nanostores/react'
import { useEffect, useMemo } from 'react'

import { useGatewayRequest } from '@/app/gateway/hooks/use-gateway-request'
import { BrainPet } from '@/components/pet/brain-pet'
import { PetThumb } from '@/components/pet/pet-thumb'
import { Codicon } from '@/components/ui/codicon'
import { useI18n } from '@/i18n'
import { triggerHaptic } from '@/lib/haptics'
import { Loader2 } from '@/lib/icons'
import { cn } from '@/lib/utils'
import {
  $petBusy,
  $petGallery,
  $petGalleryStatus,
  adoptPet,
  loadPetGallery,
  loadPetThumb,
  rankedGalleryPets
} from '@/store/pet-gallery'
import { type ProAvatar, setProAvatar } from '@/store/pro-avatar'

const ROW =
  'flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-(--chrome-action-hover)'

function Choice({
  active,
  hint,
  label,
  onPick,
  visual
}: {
  active: boolean
  hint: string
  label: string
  onPick: () => void
  visual: React.ReactNode
}) {
  return (
    <button aria-pressed={active} className={ROW} onClick={onPick} type="button">
      <span className="grid size-9 shrink-0 place-items-center">{visual}</span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-[0.8125rem] text-foreground">{label}</span>
        <span className="truncate text-[0.6875rem] text-(--ui-text-tertiary)">{hint}</span>
      </span>
      {active && <Codicon className="shrink-0 text-(--ui-accent)" name="check" size="0.875rem" />}
    </button>
  )
}

export function CompanionPicker({
  current,
  onDone,
  photo
}: {
  current: 'brain' | 'pet' | 'photo'
  onDone: () => void
  photo: React.ReactNode
}) {
  const { t } = useI18n()
  const copy = t.pro.companion
  const { requestGateway } = useGatewayRequest()
  const gallery = useStore($petGallery)
  const status = useStore($petGalleryStatus)
  const busy = useStore($petBusy)

  useEffect(() => {
    void loadPetGallery(requestGateway)
  }, [requestGateway])

  const pets = useMemo(() => rankedGalleryPets(gallery).slice(0, 24), [gallery])
  const activePet = current === 'pet' && gallery?.enabled ? gallery.active : ''

  const pick = (choice: ProAvatar) => {
    setProAvatar(choice)
    triggerHaptic('crisp')
    onDone()
  }

  const adopt = (slug: string) => {
    void adoptPet(requestGateway, slug, copy.petFailed).then(ok => {
      if (ok) {
        pick('pet')
      }
    })
  }

  return (
    <div className="flex flex-col gap-0.5" data-slot="pro-companion-picker">
      <p className="px-2 pt-1 pb-1.5 text-[0.6875rem] font-medium tracking-wide text-(--ui-text-tertiary) uppercase">
        {copy.title}
      </p>
      <Choice
        active={current === 'brain'}
        hint={copy.brainHint}
        label={copy.brain}
        onPick={() => pick('brain')}
        visual={<BrainPet size={32} />}
      />
      <Choice
        active={current === 'photo'}
        hint={copy.photoHint}
        label={copy.photo}
        onPick={() => pick('photo')}
        visual={photo}
      />

      <p className="px-2 pt-2.5 pb-1.5 text-[0.6875rem] font-medium tracking-wide text-(--ui-text-tertiary) uppercase">
        {copy.pets}
      </p>
      {status === 'loading' && !gallery ? (
        <p className="flex items-center gap-2 px-2 py-2 text-xs text-(--ui-text-tertiary)">
          <Loader2 className="size-3.5 animate-spin" />
          {copy.loading}
        </p>
      ) : pets.length === 0 ? (
        <p className="px-2 py-2 text-xs text-(--ui-text-tertiary)">{copy.noPets}</p>
      ) : (
        <div className="grid max-h-56 grid-cols-4 gap-1 overflow-y-auto px-1 pb-1">
          {pets.map(pet => (
            <button
              aria-label={pet.displayName}
              aria-pressed={pet.slug === activePet}
              className={cn(
                'relative flex min-w-0 flex-col items-center gap-1 rounded-lg p-1.5 transition-colors hover:bg-(--chrome-action-hover)',
                pet.slug === activePet && 'bg-(--chrome-action-hover) ring-1 ring-(--ui-accent)'
              )}
              disabled={Boolean(busy)}
              key={pet.slug}
              onClick={() => adopt(pet.slug)}
              type="button"
            >
              <PetThumb
                alt={pet.displayName}
                load={(slug, url) => loadPetThumb(requestGateway, slug, url)}
                size={34}
                slug={pet.slug}
                url={pet.spritesheetUrl}
              />
              <span className="w-full truncate text-center text-[0.625rem] text-(--ui-text-secondary)">
                {pet.displayName}
              </span>
              {busy === pet.slug && (
                <Loader2 className="absolute top-1 right-1 size-3 animate-spin text-(--ui-text-tertiary)" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

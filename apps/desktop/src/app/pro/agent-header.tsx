/**
 * Brain (Pro Mode): the top of the Pro panel — who you are working with, small and centred, so the tabs and their
 * content keep the room. Its face is what the person picked by clicking it (companion-picker.tsx): the built-in Brain
 * companion, one of the project's pets, or the profile's photo. The pick lives only here: the app's pet (Settings →
 * Appearance → Pet) is not touched. A pet that is also the app's active pet moves with the agent; any other shows its
 * picture. What the agent is doing lives in the Activity tab, and Stop in the composer.
 */

import { useStore } from '@nanostores/react'
import { useEffect, useState } from 'react'

import { useGatewayRequest } from '@/app/gateway/hooks/use-gateway-request'
import { BrainPet } from '@/components/pet/brain-pet'
import { PetSprite } from '@/components/pet/pet-sprite'
import { Codicon } from '@/components/ui/codicon'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useI18n } from '@/i18n'
import { cn } from '@/lib/utils'
import { $petActive, $petInfo } from '@/store/pet'
import { loadPetThumb } from '@/store/pet-gallery'
import { $proAvatar, $proPet, type ProPet, resolveProAvatar } from '@/store/pro-avatar'
import { $activeGatewayProfile, $profiles, normalizeProfileKey, profileLabel } from '@/store/profile'
import { $profileAvatars } from '@/store/profile-avatars'

import { CompanionPicker } from './companion-picker'

const RING =
  'relative grid size-14 place-items-center overflow-hidden rounded-full bg-[radial-gradient(circle_at_50%_40%,color-mix(in_oklab,var(--ui-accent)_14%,var(--ui-bg-quaternary,var(--chrome-action-hover))),var(--ui-bg-quaternary,var(--chrome-action-hover))_70%)] ring-1 ring-(--ui-stroke-tertiary)'

function useAgent() {
  const profileKey = normalizeProfileKey(useStore($activeGatewayProfile))
  const profile = useStore($profiles).find(row => normalizeProfileKey(row.name) === profileKey)
  const photo = useStore($profileAvatars)[profileKey]
  const name = profile && !profile.is_default ? profileLabel(profile) : 'Brain'

  return { name, photo }
}

function useFace(photo?: string) {
  return resolveProAvatar(useStore($proAvatar), Boolean(useStore($proPet)), Boolean(photo))
}

/** The panel's own pet: animated when it is also the app's active pet, else its picture (the gallery's idle frame). */
function PanelPet({ pet }: { pet: ProPet }) {
  const info = useStore($petInfo)
  const animated = useStore($petActive) && info.slug === pet.slug
  const { requestGateway } = useGatewayRequest()
  const [picture, setPicture] = useState<null | string>(null)

  useEffect(() => {
    if (animated) {
      return
    }

    let alive = true
    void loadPetThumb(requestGateway, pet.slug, pet.url).then(uri => alive && setPicture(uri))

    return () => {
      alive = false
    }
  }, [animated, pet.slug, pet.url, requestGateway])

  if (animated) {
    return <PetSprite info={info} zoom={0.66} />
  }

  return picture ? (
    <img alt="" className="size-[86%] object-contain [image-rendering:pixelated]" src={picture} />
  ) : (
    <Codicon className="text-(--ui-text-tertiary)" name="loading" size="1rem" />
  )
}

function PhotoFace({ className, name, photo }: { className: string; name: string; photo?: string }) {
  if (photo) {
    return <img alt="" className={cn(className, 'object-cover')} src={photo} />
  }

  return (
    <span aria-hidden className={cn(className, 'font-semibold text-foreground')}>
      {name.slice(0, 1).toUpperCase()}
    </span>
  )
}

function Face({ face, name, photo }: { face: 'brain' | 'pet' | 'photo'; name: string; photo?: string }) {
  const pet = useStore($proPet)

  if (face === 'pet' && pet) {
    return (
      <span className={RING} data-slot="pro-pet">
        <PanelPet pet={pet} />
      </span>
    )
  }

  if (face === 'brain') {
    return (
      <span className="grid size-14 place-items-center" data-slot="pro-brain-pet">
        <BrainPet size={54} />
      </span>
    )
  }

  return <PhotoFace className={cn(RING, 'text-xl')} name={name} photo={photo} />
}

export function AgentHeader() {
  const { t } = useI18n()
  const copy = t.pro.agent
  const { name, photo } = useAgent()
  const face = useFace(photo)
  const [picking, setPicking] = useState(false)

  return (
    <header className="flex flex-col items-center px-3 pt-1 text-center" data-slot="pro-agent">
      <Popover onOpenChange={setPicking} open={picking}>
        <PopoverTrigger asChild>
          <button
            aria-label={copy.choose}
            className="group flex max-w-full flex-col items-center gap-0.5 rounded-2xl px-1 pb-0.5 outline-none focus-visible:ring-2 focus-visible:ring-(--ui-accent)"
            type="button"
          >
            <span className="transition-transform duration-300 ease-out group-hover:scale-[1.04]">
              <Face face={face} name={name} photo={photo} />
            </span>
            <span className="relative max-w-full px-4">
              <h2 className="truncate text-[0.8125rem] font-semibold text-foreground">{name}</h2>
              <Codicon
                className="absolute top-1/2 right-0 -translate-y-1/2 text-(--ui-text-tertiary) opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
                name="chevron-down"
                size="0.75rem"
              />
            </span>
          </button>
        </PopoverTrigger>
        <PopoverContent align="center" className="w-72 p-1.5" side="bottom" sideOffset={4}>
          <CompanionPicker
            current={face}
            onDone={() => setPicking(false)}
            photo={
              <PhotoFace
                className="grid size-8 place-items-center overflow-hidden rounded-full bg-(--ui-bg-quaternary,var(--chrome-action-hover)) text-sm"
                name={name}
                photo={photo}
              />
            }
          />
        </PopoverContent>
      </Popover>
    </header>
  )
}

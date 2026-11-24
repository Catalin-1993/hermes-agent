/**
 * Brain (Pro Mode): the top of the Pro panel — who you are working with, centred. Its face is what the person
 * picked by clicking it (companion-picker.tsx): the built-in Brain companion, the project's pet, or the profile's
 * photo — each reacts to the agent. Then its name, what it is doing in a few words, and Stop while it works.
 */

import { useStore } from '@nanostores/react'
import { useState } from 'react'

import { BrainPet } from '@/components/pet/brain-pet'
import { PetSprite } from '@/components/pet/pet-sprite'
import { Button } from '@/components/ui/button'
import { Codicon } from '@/components/ui/codicon'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useI18n } from '@/i18n'
import { cn } from '@/lib/utils'
import { requestGatewayForActiveRoute } from '@/store/active-route-request'
import { $petActive, $petInfo } from '@/store/pet'
import { $proAvatar, resolveProAvatar } from '@/store/pro-avatar'
import { $activeGatewayProfile, $profiles, normalizeProfileKey, profileLabel } from '@/store/profile'
import { $profileAvatars } from '@/store/profile-avatars'
import { $activeSessionId, $busy } from '@/store/session'

import { useRecentActions } from './activity-model'
import { CompanionPicker } from './companion-picker'
import { Dot } from './pro-ui'

const RING =
  'relative grid size-20 place-items-center overflow-hidden rounded-full bg-[radial-gradient(circle_at_50%_40%,color-mix(in_oklab,var(--ui-accent)_14%,var(--ui-bg-quaternary,var(--chrome-action-hover))),var(--ui-bg-quaternary,var(--chrome-action-hover))_70%)] ring-1 ring-(--ui-stroke-tertiary)'

function useAgent() {
  const profileKey = normalizeProfileKey(useStore($activeGatewayProfile))
  const profile = useStore($profiles).find(row => normalizeProfileKey(row.name) === profileKey)
  const photo = useStore($profileAvatars)[profileKey]
  const name = profile && !profile.is_default ? profileLabel(profile) : 'Brain'

  return { name, photo }
}

function useFace(photo?: string) {
  const petOn = useStore($petActive)

  return resolveProAvatar(useStore($proAvatar), petOn, Boolean(photo))
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
  const pet = useStore($petInfo)

  if (face === 'pet') {
    return (
      <span className={RING} data-slot="pro-pet">
        <PetSprite info={pet} zoom={0.92} />
      </span>
    )
  }

  if (face === 'brain') {
    return (
      <span className={RING} data-slot="pro-brain-pet">
        <BrainPet size={56} />
      </span>
    )
  }

  return <PhotoFace className={cn(RING, 'text-2xl')} name={name} photo={photo} />
}

export function AgentHeader() {
  const { t } = useI18n()
  const copy = t.pro.agent
  const { name, photo } = useAgent()
  const face = useFace(photo)
  const [picking, setPicking] = useState(false)
  const busy = useStore($busy)
  const sessionId = useStore($activeSessionId)
  const doing = useRecentActions(1)[0]

  const stop = () => {
    if (sessionId) {
      void requestGatewayForActiveRoute($activeGatewayProfile.get(), 'session.interrupt', { session_id: sessionId })
    }
  }

  return (
    <header className="flex flex-col items-center gap-1.5 px-3 pt-3 pb-1 text-center" data-slot="pro-agent">
      <Popover onOpenChange={setPicking} open={picking}>
        <PopoverTrigger asChild>
          <button
            aria-label={copy.choose}
            className="group flex max-w-full flex-col items-center gap-1.5 rounded-2xl p-1 outline-none focus-visible:ring-2 focus-visible:ring-(--ui-accent)"
            type="button"
          >
            <span className="transition-transform duration-300 ease-out group-hover:scale-[1.04]">
              <Face face={face} name={name} photo={photo} />
            </span>
            <span className="relative mt-0.5 max-w-full px-4">
              <h2 className="truncate text-base font-semibold text-foreground">{name}</h2>
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
      <p className="flex max-w-full items-center gap-1.5 text-xs text-(--ui-text-secondary)">
        <Dot className={busy ? 'animate-pulse' : undefined} tone={busy ? 'now' : 'next'} />
        <span className="truncate">{busy ? (doing && !doing.done ? doing.label : copy.working) : copy.waiting}</span>
      </p>
      {busy && (
        <Button className="mt-1 h-7 rounded-full px-3" onClick={stop} size="sm" variant="secondary">
          <span className="size-2 rounded-[2px] bg-(--ui-red,#f85149)" />
          {copy.stop}
        </Button>
      )}
    </header>
  )
}

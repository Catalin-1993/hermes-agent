/**
 * Brain (Pro Mode): the top of the Pro panel — who you are working with, centred. The project's pet when it is on
 * (it already runs, waits, jumps and droops with the agent), else the agent's photo, else its initial; then its
 * name, what it is doing in a few words, and Stop while it works.
 */

import { useStore } from '@nanostores/react'

import { PetSprite } from '@/components/pet/pet-sprite'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/i18n'
import { cn } from '@/lib/utils'
import { requestGatewayForActiveRoute } from '@/store/active-route-request'
import { $petActive, $petInfo } from '@/store/pet'
import { $activeGatewayProfile, $profiles, normalizeProfileKey, profileLabel } from '@/store/profile'
import { $profileAvatars } from '@/store/profile-avatars'
import { $activeSessionId, $busy } from '@/store/session'

import { useRecentActions } from './activity-model'
import { Dot } from './pro-ui'

const RING =
  'relative grid size-24 place-items-center overflow-hidden rounded-full bg-[radial-gradient(circle_at_50%_40%,color-mix(in_oklab,var(--ui-accent)_14%,var(--ui-bg-quaternary,var(--chrome-action-hover))),var(--ui-bg-quaternary,var(--chrome-action-hover))_70%)] ring-1 ring-(--ui-stroke-tertiary)'

function useAgent() {
  const profileKey = normalizeProfileKey(useStore($activeGatewayProfile))
  const profile = useStore($profiles).find(row => normalizeProfileKey(row.name) === profileKey)
  const photo = useStore($profileAvatars)[profileKey]
  const name = profile && !profile.is_default ? profileLabel(profile) : 'Brain'

  return { name, photo }
}

function Face({ name, photo }: { name: string; photo?: string }) {
  const petOn = useStore($petActive)
  const pet = useStore($petInfo)

  if (petOn) {
    return (
      <span className={RING} data-slot="pro-pet">
        <PetSprite info={pet} zoom={1.1} />
      </span>
    )
  }

  if (photo) {
    return <img alt="" className={cn(RING, 'object-cover')} src={photo} />
  }

  return (
    <span aria-hidden className={cn(RING, 'text-3xl font-semibold text-foreground')}>
      {name.slice(0, 1).toUpperCase()}
    </span>
  )
}

export function AgentHeader() {
  const { t } = useI18n()
  const copy = t.pro.agent
  const { name, photo } = useAgent()
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
      <Face name={name} photo={photo} />
      <h2 className="mt-1 max-w-full truncate text-base font-semibold text-foreground">{name}</h2>
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

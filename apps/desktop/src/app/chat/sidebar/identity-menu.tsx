/**
 * Brain: Identity in the profile menu — how the agent can be reached as a person, in one submenu.
 *
 * - Connected: rows that plugins, connectors and tools contribute on `PROFILE_IDENTITY_AREA` (a phone number, an
 *   email address, a postal address, a wallet, a social account). Only identity kinds are listed, so a tool that
 *   has nothing to do with identity never shows up here.
 * - Social profiles: links the person pastes (Instagram, WhatsApp, Facebook, X, LinkedIn, …), recognised by their
 *   address and kept per profile on this device (store/identity-links.ts). A click opens the profile in the browser.
 */

import { useStore } from '@nanostores/react'
import { type KeyboardEvent, useId, useState } from 'react'

import { Codicon } from '@/components/ui/codicon'
import {
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger
} from '@/components/ui/dropdown-menu'
import {
  isProfileIdentityContribution,
  PROFILE_IDENTITY_AREA,
  PROFILE_IDENTITY_ICONS,
  type ProfileIdentityContribution
} from '@/contrib/profile-identity'
import { useContributions } from '@/contrib/react/use-contributions'
import { useI18n } from '@/i18n'
import { openExternalLink } from '@/lib/external-link'
import { parseSocialLink } from '@/lib/social-links'
import { $identityLinks, addIdentityLink, removeIdentityLink } from '@/store/identity-links'
import { $activeGatewayProfile, normalizeProfileKey } from '@/store/profile'

const ROW = 'gap-2.5 py-1.5'
const SECTION = 'px-2 pt-2 pb-1 text-[0.6875rem] font-medium text-(--ui-text-tertiary)'

function ConnectedRows() {
  const { t } = useI18n()
  const copy = t.profiles.identity

  const rows = useContributions(PROFILE_IDENTITY_AREA)
    .map(contribution => ({ data: contribution.data, key: `${contribution.source ?? 'core'}:${contribution.id}` }))
    .filter((row): row is { data: ProfileIdentityContribution; key: string } => isProfileIdentityContribution(row.data))

  if (rows.length === 0) {
    return <p className="px-2 pb-1.5 text-xs leading-snug text-(--ui-text-tertiary)">{copy.noneConnected}</p>
  }

  return rows.map(({ data, key }) => {
    const body = (
      <>
        <Codicon aria-hidden="true" name={data.icon ?? PROFILE_IDENTITY_ICONS[data.kind]} size="0.875rem" />
        <span className="min-w-0 flex-1 truncate">{data.label}</span>
        {data.detail && <span className="truncate text-xs text-(--ui-text-tertiary)">{data.detail}</span>}
      </>
    )

    // A row with nothing to open reads as information, not as a greyed-out action.
    return data.run ? (
      <DropdownMenuItem className={ROW} key={key} onSelect={data.run}>
        {body}
      </DropdownMenuItem>
    ) : (
      <div className={`flex items-center px-2 text-xs ${ROW}`} key={key}>
        {body}
      </div>
    )
  })
}

function SocialRows({ profile }: { profile: string }) {
  const { t } = useI18n()
  const copy = t.profiles.identity
  const links = useStore($identityLinks)[profile] ?? []

  return links.map(url => {
    const link = parseSocialLink(url)

    if (!link) {
      return null
    }

    return (
      <DropdownMenuItem
        className={`${ROW} group/link`}
        key={url}
        onSelect={() => openExternalLink(link.url)}
        title={link.url}
      >
        <Codicon aria-hidden="true" name={link.platform.icon} size="0.875rem" />
        <span className="shrink-0">{link.platform.name}</span>
        <span className="min-w-0 flex-1 truncate text-xs text-(--ui-text-tertiary)">{link.handle}</span>
        <button
          aria-label={copy.remove(link.platform.name)}
          className="grid size-5 shrink-0 place-items-center rounded text-(--ui-text-tertiary) opacity-0 transition-opacity group-hover/link:opacity-100 group-focus/link:opacity-100 hover:text-foreground"
          onClick={event => {
            event.preventDefault()
            event.stopPropagation()
            removeIdentityLink(profile, url)
          }}
          onPointerDown={event => event.stopPropagation()}
          type="button"
        >
          <Codicon aria-hidden="true" name="close" size="0.75rem" />
        </button>
      </DropdownMenuItem>
    )
  })
}

function AddLinkField({ profile }: { profile: string }) {
  const { t } = useI18n()
  const copy = t.profiles.identity
  const id = useId()
  const [value, setValue] = useState('')
  const [refused, setRefused] = useState(false)
  const preview = value.trim() ? parseSocialLink(value) : null

  const add = () => {
    if (addIdentityLink(profile, value)) {
      setValue('')
      setRefused(false)
    } else {
      setRefused(true)
    }
  }

  // The menu reads keys for its own navigation and type-ahead; while typing a link, they belong to the field.
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    event.stopPropagation()

    if (event.key === 'Enter') {
      event.preventDefault()
      add()
    }
  }

  return (
    <div className="grid gap-1 px-1.5 pt-1 pb-1.5">
      <label className="sr-only" htmlFor={id}>
        {copy.addLink}
      </label>
      <div className="flex items-center gap-1 rounded-md bg-(--chrome-action-hover) px-2 py-1">
        <Codicon aria-hidden="true" className="text-(--ui-text-tertiary)" name="link" size="0.8125rem" />
        <input
          aria-invalid={refused || undefined}
          className="min-w-0 flex-1 bg-transparent py-0.5 text-xs outline-none placeholder:text-(--ui-text-tertiary)"
          id={id}
          onChange={event => {
            setValue(event.target.value)
            setRefused(false)
          }}
          onKeyDown={onKeyDown}
          placeholder={copy.addLinkPlaceholder}
          spellCheck={false}
          value={value}
        />
        <button
          className="rounded px-1.5 py-0.5 text-xs font-medium text-(--ui-text-secondary) hover:text-foreground disabled:opacity-40"
          disabled={!preview}
          onClick={add}
          type="button"
        >
          {copy.add}
        </button>
      </div>
      {(preview || refused) && (
        <p className="px-1 text-[0.6875rem] text-(--ui-text-tertiary)">
          {refused || !preview ? copy.notALink : copy.recognised(preview.platform.name, preview.handle)}
        </p>
      )}
    </div>
  )
}

/** The profile menu's Identity row and its submenu. */
export function IdentityMenu() {
  const { t } = useI18n()
  const copy = t.profiles.identity
  const profile = normalizeProfileKey(useStore($activeGatewayProfile))

  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger>
        <Codicon aria-hidden="true" name="person" size="0.875rem" />
        <span className="truncate">{copy.title}</span>
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent className="w-72 p-1" data-slot="identity-menu">
        <DropdownMenuLabel className={SECTION}>{copy.connected}</DropdownMenuLabel>
        <ConnectedRows />
        <DropdownMenuLabel className={SECTION}>{copy.socialProfiles}</DropdownMenuLabel>
        <SocialRows profile={profile} />
        <AddLinkField profile={profile} />
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  )
}

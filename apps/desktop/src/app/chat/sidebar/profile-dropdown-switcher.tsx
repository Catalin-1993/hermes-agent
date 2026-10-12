import { useStore } from '@nanostores/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router'

import { Button } from '@/components/ui/button'
import { Codicon } from '@/components/ui/codicon'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { ProfileAvatar } from '@/components/ui/profile-avatar'
import { ProfileGlyph } from '@/components/ui/profile-glyph'
import { Tip } from '@/components/ui/tooltip'
import { useI18n } from '@/i18n'
import { triggerHaptic } from '@/lib/haptics'
import { Loader2 } from '@/lib/icons'
import { resolveProfileColor } from '@/lib/profile-color'
import { capitalize } from '@/lib/text'
import {
  $activeConnectionId,
  $connectionsRegistry,
  $hasMultipleConnections,
  selectConnection
} from '@/store/connections'
import { $fleetRoster } from '@/store/fleet-roster'
import { notifyError } from '@/store/notifications'
import {
  $activeGatewayProfile,
  $profileColors,
  $profileCreateRequest,
  $profileOrder,
  $profiles,
  $showAllProfiles,
  ALL_PROFILES,
  normalizeProfileKey,
  prewarmProfilePick,
  profileLabel,
  refreshActiveProfile,
  selectProfile,
  setShowAllProfiles,
  sortByProfileOrder
} from '@/store/profile'
import { $profileAvatars, avatarFromFile, clearProfileAvatar, setProfileAvatar } from '@/store/profile-avatars'
import { runImportProfileFlow } from '@/store/profile-share'

import { CreateProfileDialog } from '../../profiles/create-profile-dialog'
import { RenameProfileDialog } from '../../profiles/rename-profile-dialog'
import { CAPABILITIES_ROUTE, PROFILES_ROUTE, SETTINGS_ROUTE } from '../../routes'

import { FleetGatewayMenuGroup } from './fleet-gateway-menu-group'
import { buildRestGroups, type FleetAgent, fleetRouteKey } from './fleet-rail'
import { useLocalDeviceSwitch } from './local-device-switch'
import { useFleetRoster } from './use-fleet-roster'
import { useProfilePrewarm } from './use-profile-prewarm'

/**
 * The account row's profile picker: the active profile as a person — photo or initial, name — and,
 * on click, one menu for everything about who you are here: this gateway's profiles, every other
 * gateway's agents in fleet mode, new / import / manage, a photo for the active profile, the
 * gateways page and Settings. The colored rail (drag-order, hold-to-recolor) stays an opt-in strip
 * above it.
 */
export function ProfileSwitcher() {
  const { t } = useI18n()
  const p = t.profiles
  const navigate = useNavigate()
  const profiles = useStore($profiles)
  const order = useStore($profileOrder)
  const colors = useStore($profileColors)
  const gatewayProfile = useStore($activeGatewayProfile)
  const showAll = useStore($showAllProfiles)
  const avatars = useStore($profileAvatars)
  const photoInputRef = useRef<HTMLInputElement>(null)
  const multipleConnections = useStore($hasMultipleConnections)
  const registry = useStore($connectionsRegistry)
  const activeConnectionId = useStore($activeConnectionId)
  const roster = useStore($fleetRoster)
  const [createOpen, setCreateOpen] = useState(false)
  const [naming, setNaming] = useState(false)
  const [editing, setEditing] = useState(false)
  // Where the Edit button was: the panel opens at it, as the other sidebar menus open at theirs.
  const [editAnchor, setEditAnchor] = useState<DOMRect | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [pendingRoute, setPendingRoute] = useState<null | string>(null)
  const { dialog: localDeviceDialog, request: requestLocalDevice } = useLocalDeviceSwitch()

  useFleetRoster(multipleConnections)

  // The `profile.create` hotkey bumps this request atom; the rail answers it
  // while mounted, so with the rail hidden this picker owns the dialog instead.
  const createRequest = useStore($profileCreateRequest)
  const lastCreateRef = useRef(createRequest)

  // eslint-disable-next-line no-restricted-syntax -- legitimate non-atom ref write (see eslint rule comment)
  useEffect(() => {
    if (createRequest === lastCreateRef.current) {
      return
    }

    lastCreateRef.current = createRequest
    setCreateOpen(true)
  }, [createRequest])

  const connections = registry?.connections

  const restGroups = useMemo(
    () =>
      multipleConnections ? buildRestGroups({ activeConnectionId, connections: connections ?? [], order, roster }) : [],
    [activeConnectionId, connections, multipleConnections, order, roster]
  )

  const activeKey = normalizeProfileKey(gatewayProfile)
  const defaultProfile = profiles.find(profile => profile.is_default)

  const named = sortByProfileOrder(
    profiles.filter(profile => !profile.is_default),
    order
  )

  const ordered = defaultProfile ? [defaultProfile, ...named] : named
  const active = showAll ? undefined : profiles.find(profile => normalizeProfileKey(profile.name) === activeKey)
  const value = showAll ? ALL_PROFILES : (active?.name ?? '')

  const choose = (name: string) => {
    triggerHaptic('selection')

    if (name === ALL_PROFILES) {
      setShowAllProfiles(true)
    } else {
      selectProfile(name)
    }
  }

  const commitRestSwitch = (agent: FleetAgent) => {
    const key = fleetRouteKey(agent.connectionId, agent.profile)
    triggerHaptic('selection')
    setPendingRoute(key)

    void selectConnection(agent.connectionId, { profile: agent.profile })
      .catch((error: unknown) => notifyError(error, p.switchConnectionFailed(agent.connectionLabel)))
      .finally(() => setPendingRoute(current => (current === key ? null : current)))
  }

  const switchToRest = (agent: FleetAgent) => {
    if (agent.connectionKind !== 'local') {
      commitRestSwitch(agent)

      return
    }

    const key = fleetRouteKey(agent.connectionId, agent.profile)
    setPendingRoute(key)

    void requestLocalDevice({
      connectionId: agent.connectionId,
      label: agent.connectionLabel,
      profile: agent.profile,
      replaceCenter: agent.profile === 'default'
    }).then(accepted => {
      setPendingRoute(current => (current === key ? null : current))

      if (accepted) {
        commitRestSwitch(agent)
      }
    })
  }

  const triggerLabel = showAll
    ? p.allProfiles
    : active
      ? active.is_default && !active.display_name?.trim()
        ? capitalize(profileLabel(active))
        : profileLabel(active)
      : p.title

  const photo = active && !showAll ? (avatars[active.name] ?? null) : null

  const choosePhoto = async (file: File | undefined) => {
    const image = file && active ? await avatarFromFile(file) : null

    if (image && active) {
      setProfileAvatar(active.name, image)
    }
  }

  // A named profile's rename moves its directory: the photo follows it, and it stays the one in use.
  const renamed = async (name: string) => {
    if (active && !active.is_default && name !== active.name) {
      if (photo) {
        setProfileAvatar(name, photo)
        clearProfileAvatar(active.name)
      }

      selectProfile(name)
    }

    await refreshActiveProfile()
  }

  return (
    <div
      aria-busy={pendingRoute !== null}
      aria-label={p.title}
      className="relative min-w-0 flex-1"
      data-slot="profile-switcher"
      role="group"
    >
      <DropdownMenu onOpenChange={setMenuOpen} open={menuOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            aria-label={`${p.title}: ${triggerLabel}`}
            className="h-10 w-full min-w-0 justify-start gap-2.5 overflow-hidden rounded-lg px-1.5 text-foreground data-[state=open]:bg-(--ui-control-active-background)"
            type="button"
            variant="ghost"
          >
            {pendingRoute !== null ? (
              <span className="grid size-7 shrink-0 place-items-center">
                <Loader2 aria-hidden="true" className="size-4 animate-spin" />
              </span>
            ) : showAll || !active ? (
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-(--ui-control-hover-background) text-(--ui-text-tertiary)">
                <Codicon aria-hidden="true" name="layers" size="0.875rem" />
              </span>
            ) : (
              <ProfileAvatar
                aria-hidden="true"
                color={active.is_default ? null : resolveProfileColor(active.name, colors)}
                image={photo}
                label={triggerLabel}
              />
            )}
            <span className="display-italic min-w-0 flex-1 truncate text-left text-[1.25rem] leading-none tracking-tight">
              {triggerLabel}
            </span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-56 max-w-72" collisionPadding={8} side="top" sideOffset={6}>
          <DropdownMenuRadioGroup onValueChange={choose} value={value}>
            {ordered.map(profile => (
              <ProfileItem
                color={resolveProfileColor(profile.name, colors)}
                isDefault={profile.is_default}
                key={profile.name}
                label={profileLabel(profile)}
                name={profile.name}
                onEdit={
                  active?.name === profile.name && !showAll
                    ? (anchor: DOMRect) => {
                        setEditAnchor(editMenuAnchor(anchor))
                        setMenuOpen(false)
                        // After the menu has handed focus back, or the popover reads that as a click outside.
                        window.setTimeout(() => setEditing(true), 120)
                      }
                    : undefined
                }
              />
            ))}
            {/* Nothing to widen to with one profile: the ALL view only exists
                once a second profile does (the rail hides its toggle then too). */}
            {profiles.length > 1 && (
              <DropdownMenuRadioItem className="min-w-0" value={ALL_PROFILES}>
                <span className="flex min-w-0 items-center gap-1.5">
                  <Codicon aria-hidden="true" className="text-(--ui-text-tertiary)" name="layers" size="0.875rem" />
                  <span className="truncate">{p.allProfiles}</span>
                </span>
              </DropdownMenuRadioItem>
            )}
          </DropdownMenuRadioGroup>
          {restGroups.map(group => (
            <FleetGatewayMenuGroup
              group={group}
              key={group.connectionId}
              onSelect={switchToRest}
              slot="profile-switcher-gateway"
            />
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => navigate(PROFILES_ROUTE)}>
            <Codicon aria-hidden="true" name="sparkle" size="0.875rem" />
            <span className="truncate">{p.personalization}</span>
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => navigate(CAPABILITIES_ROUTE)}>
            <Codicon aria-hidden="true" name="symbol-misc" size="0.875rem" />
            <span className="truncate">{t.sidebar.nav.capabilities}</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {/* Profile and gateway actions: one row of icons along the menu's foot, named on hover. */}
          <div className="flex items-center gap-0.5" data-slot="profile-switcher-actions">
            {[
              { icon: 'add', label: p.newProfile, run: () => setCreateOpen(true) },
              { icon: 'cloud-download', label: p.importProfile, run: () => void runImportProfileFlow() },
              { icon: 'organization', label: p.manageProfiles, run: () => navigate(PROFILES_ROUTE) },
              ...(multipleConnections
                ? []
                : [{ icon: 'plug', label: p.connectGateway, run: () => navigate(`${SETTINGS_ROUTE}?tab=gateway`) }])
            ].map(action => (
              // The app's own tip (opens in a fifth of a second), not the slow native `title`.
              <Tip key={action.icon} label={action.label.replace(/…$/, '')} side="top">
                <DropdownMenuItem
                  aria-label={action.label}
                  className="size-8 shrink-0 justify-center p-0"
                  onSelect={action.run}
                >
                  <Codicon aria-hidden="true" name={action.icon} size="0.9375rem" />
                </DropdownMenuItem>
              </Tip>
            ))}
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      <input
        accept="image/*"
        aria-hidden="true"
        className="hidden"
        onChange={event => {
          void choosePhoto(event.target.files?.[0])
          event.target.value = ''
        }}
        ref={photoInputRef}
        tabIndex={-1}
        type="file"
      />

      {active && (
        <DropdownMenu onOpenChange={setEditing} open={editing}>
          <DropdownMenuTrigger asChild>
            <span
              aria-hidden="true"
              className="pointer-events-none fixed"
              style={{
                height: editAnchor?.height,
                left: editAnchor?.left,
                top: editAnchor?.top,
                width: editAnchor?.width
              }}
            />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-48" collisionPadding={8} side="top" sideOffset={6}>
            <DropdownMenuItem onSelect={() => setNaming(true)}>
              <Codicon aria-hidden="true" name="edit" size="0.875rem" />
              <span className="truncate">{p.changeName}</span>
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => photoInputRef.current?.click()}>
              <Codicon aria-hidden="true" name="device-camera" size="0.875rem" />
              <span className="truncate">{p.changePhoto}</span>
            </DropdownMenuItem>
            {photo && (
              <DropdownMenuItem onSelect={() => clearProfileAvatar(active.name)}>
                <Codicon aria-hidden="true" name="trash" size="0.875rem" />
                <span className="truncate">{p.removePhoto}</span>
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {active && (
        <RenameProfileDialog
          currentName={active.name}
          isDefault={active.is_default}
          onClose={() => setNaming(false)}
          onRenamed={renamed}
          open={naming}
        />
      )}

      <CreateProfileDialog
        onClose={() => setCreateOpen(false)}
        onCreated={async name => {
          await refreshActiveProfile()
          selectProfile(name)
        }}
        open={createOpen}
        profiles={profiles}
      />
      {localDeviceDialog}
    </div>
  )
}

/** Where the editing panel opens: level with the Edit menu of the navigation above (More › Edit), so the
 *  sidebar's small menus share one left edge; without that menu, at the button itself. */
function editMenuAnchor(button: DOMRect): DOMRect {
  const nav = document.querySelector('[data-slot="sidebar-nav-edit"]')?.getBoundingClientRect()

  return new DOMRect(nav?.left ?? button.left, button.top, 1, button.height)
}

function ProfileItem({
  color,
  isDefault,
  label,
  name,
  onEdit
}: {
  color: null | string
  isDefault: boolean
  label: string
  name: string
  /** Given for the profile in use: a small Edit button on its row, handing over where it is. */
  onEdit?: (anchor: DOMRect) => void
}) {
  const { t } = useI18n()

  const { cancelPrewarm, notePointerMove, startPrewarm } = useProfilePrewarm(name, prewarmProfilePick)

  return (
    <DropdownMenuRadioItem
      className="min-w-0"
      onPointerEnter={startPrewarm}
      onPointerLeave={cancelPrewarm}
      onPointerMove={notePointerMove}
      value={name}
    >
      <span className="flex min-w-0 flex-1 items-center gap-1.5">
        <ProfileGlyph aria-hidden="true" color={color} isDefault={isDefault} name={name} />
        <span className="truncate">{label}</span>
      </span>
      {onEdit && (
        <button
          aria-label={t.profiles.editProfile}
          className="ml-auto grid size-6 shrink-0 cursor-pointer place-items-center rounded-md text-(--ui-text-tertiary) transition-colors hover:bg-(--ui-control-hover-background) hover:text-(--ui-text-primary)"
          onClick={event => {
            event.preventDefault()
            event.stopPropagation()
            onEdit(event.currentTarget.getBoundingClientRect())
          }}
          onKeyDown={event => event.stopPropagation()}
          onPointerDown={event => event.stopPropagation()}
          onPointerUp={event => event.stopPropagation()}
          type="button"
        >
          <Codicon aria-hidden="true" name="edit" size="0.8125rem" />
        </button>
      )}
    </DropdownMenuRadioItem>
  )
}

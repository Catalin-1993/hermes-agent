/** Contributed sidebar rows (`sidebar.nav`): turning a plugin's data into a nav row, and the chevron and
 *  sub-list a row may carry (Brain's Projects list). */

import { useStore } from '@nanostores/react'

import { Codicon } from '@/components/ui/codicon'
import type { Contribution } from '@/contrib/types'
import { useI18n } from '@/i18n'
import { $sidebarNavOpen, setSidebarNavOpen } from '@/store/sidebar-nav'

import type { SidebarNavContribution } from '../../routes'
import type { SidebarNavItem } from '../../types'

/** Rows from `sidebar.nav` contributions. They fold under More unless the plugin asks for the main list. */
export function contributedNavItems(contributions: readonly Contribution[]): SidebarNavItem[] {
  return contributions.flatMap(c => {
    const data = c.data as Partial<SidebarNavContribution> | undefined

    if (!data?.path?.startsWith('/') || !data.label) {
      return []
    }

    const codicon = data.codicon || 'plug'

    return [
      {
        id: c.id,
        label: data.label,
        icon: (props: { className?: string }) => <Codicon name={codicon} {...props} />,
        route: data.path,
        tier: data.tier,
        sub: data.sub,
        group: data.primary ? undefined : ('more' as const)
      }
    ]
  })
}

/** The chevron at the end of a row that has a sub-list. */
export function NavSubToggle({ id, label }: { id: string; label: string }) {
  const { t } = useI18n()
  const open = Boolean(useStore($sidebarNavOpen)[id])

  return (
    <button
      aria-expanded={open}
      aria-label={`${open ? t.common.collapse : t.common.expand} ${label}`}
      className="absolute top-1 right-1 grid size-5 place-items-center rounded text-(--ui-text-tertiary) hover:bg-(--ui-control-hover-background) hover:text-foreground"
      data-slot="sidebar-nav-expand"
      onClick={() => setSidebarNavOpen(id, !open)}
      type="button"
    >
      <Codicon name={open ? 'chevron-down' : 'chevron-right'} size="0.8rem" />
    </button>
  )
}

/** The sub-list under a row, while the row is open. */
export function NavSubList({ id, sub }: { id: string; sub: () => React.ReactNode }) {
  return useStore($sidebarNavOpen)[id] ? <div className="flex flex-col gap-px pt-0.5 pb-1 pl-5">{sub()}</div> : null
}

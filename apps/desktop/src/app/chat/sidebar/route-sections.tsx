/**
 * Page-owned sidebar sections (`sidebar.routeSection`) and the Sessions section's header state.
 *
 * A plugin can put its own section at the top of the Sessions sidebar, on every page or on one route (Kanban lists its
 * projects there); while one is mounted, the sidebar keeps the session list flat — no folder Projects grouping.
 */

import { useLocation } from 'react-router'

import { ContribBoundary, ContribRender } from '@/contrib/react/boundary'
import { useContributions } from '@/contrib/react/use-contributions'

import { SIDEBAR_ROUTE_SECTION_AREA, type SidebarRouteSectionContribution } from '../../routes'

/** The `sidebar.routeSection` contributions for the route the app is on (those without a path are on every page). */
export function useRouteSections() {
  const { pathname } = useLocation()

  return useContributions(SIDEBAR_ROUTE_SECTION_AREA).filter(item => {
    const path = (item.data as SidebarRouteSectionContribution | undefined)?.path

    return path === undefined || path === pathname
  })
}

/** Mounts each section behind its own blast wall, as every contribution mount does. */
export function RouteSections({ items }: { items: ReturnType<typeof useRouteSections> }) {
  return (
    <>
      {items.map(item =>
        item.render ? (
          <ContribBoundary id={item.id} key={item.id} variant="chip">
            <ContribRender render={item.render} />
          </ContribBoundary>
        ) : null
      )}
    </>
  )
}

interface SectionHeaderInput {
  enteredProject?: { label: string; sessionCount?: number } | null
  grouping: boolean
  hasOverview: boolean
  hasProjectRows: boolean
  inProject: boolean
  labels: { projects: string; sessions: string }
  loading: boolean
}

/**
 * The Sessions section's header. It names what the section shows: grouped mode reads "Projects" only while there
 * IS a project switcher to show — a real project row, or a tree still resolving (the loading state keeps the label
 * from flapping to "Sessions" and back). The synthetic Home bucket alone is the flat session list wearing a project
 * costume, so with no real projects it keeps "Sessions" (#62537). `skeleton` mirrors the section's skeleton gate
 * (loading + nothing to show yet): while it is up there is no point also spinning the header count.
 */
export function sessionsSectionHeader(input: SectionHeaderInput): { label: string; skeleton: boolean } {
  const { enteredProject, grouping, hasOverview, hasProjectRows, inProject, labels, loading } = input
  const entered = inProject && enteredProject ? enteredProject : null

  const label = entered ? entered.label : grouping && (hasProjectRows || loading) ? labels.projects : labels.sessions

  const skeleton = grouping && loading && !hasOverview && !(inProject && (enteredProject?.sessionCount ?? 0) > 0)

  return { label, skeleton }
}

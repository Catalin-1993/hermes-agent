/**
 * Brain's workspace layer on the Kanban plugin: the Dashboard and Projects pages, their sidebar rows (in the
 * order Dashboard · New Session · Scheduled Jobs · Portfolio · Library · Projects), the Projects sub-list, and the
 * settings page that shows or hides each. The Kanban page, API and data are not touched; this only adds doors.
 */

import {
  host,
  PALETTE_AREA,
  type PaletteContribution,
  type PluginContext,
  type RouteContribution,
  ROUTES_AREA,
  SIDEBAR_NAV_AREA,
  SIDEBAR_NAV_PREFS_AREA,
  type SidebarNavContribution,
  type SidebarNavPrefsContribution
} from '@hermes/plugin-sdk'

import { BRAIN } from './brain-copy'
import { BrainDashboard } from './brain-dashboard'
import {
  $brainModules,
  $projectSlug,
  type BrainModules,
  DASHBOARD_ROUTE,
  NAV_ORDER,
  PROJECTS_ROUTE
} from './brain-data'
import { ProjectsNav } from './brain-nav'
import { BrainProjects } from './brain-projects'
import { BrainSettings } from './brain-settings'

const MODULES_KEY = 'brain.modules'
const PROJECT_KEY = 'brain.project'

export function registerBrain(ctx: PluginContext) {
  $brainModules.set({ ...$brainModules.get(), ...ctx.storage.get<Partial<BrainModules>>(MODULES_KEY, {}) })
  $projectSlug.set(ctx.storage.get(PROJECT_KEY, ''))
  ctx.onDispose($brainModules.listen(modules => ctx.storage.set(MODULES_KEY, modules)))
  ctx.onDispose($projectSlug.listen(slug => ctx.storage.set(PROJECT_KEY, slug)))

  ctx.registerMany([
    {
      id: 'dashboard-page',
      area: ROUTES_AREA,
      data: { path: DASHBOARD_ROUTE } satisfies RouteContribution,
      render: () => <BrainDashboard />
    },
    {
      id: 'projects-page',
      area: ROUTES_AREA,
      data: { path: PROJECTS_ROUTE } satisfies RouteContribution,
      render: () => <BrainProjects />
    },
    {
      id: 'dashboard-open',
      area: PALETTE_AREA,
      data: {
        id: 'brain.dashboard',
        label: BRAIN.dashboard.open,
        keywords: ['dashboard', 'projects', 'agents', 'overview'],
        run: () => host.navigate(DASHBOARD_ROUTE)
      } satisfies PaletteContribution
    },
    {
      id: 'projects-open',
      area: PALETTE_AREA,
      data: {
        id: 'brain.projects',
        label: BRAIN.projects.open,
        keywords: ['projects', 'project', 'new project'],
        run: () => host.navigate(PROJECTS_ROUTE)
      } satisfies PaletteContribution
    }
  ])

  ctx.registerSettingsPage({
    icon: 'layout-sidebar-left',
    id: 'workspace',
    render: () => <BrainSettings />,
    title: BRAIN.settings.title
  })

  // The rows follow the toggles; turning a page off only drops its row (the page and its data stay).
  let disposeRows = () => {}

  const registerRows = (modules: BrainModules) => {
    disposeRows()

    disposeRows = ctx.registerMany([
      ...(modules.dashboard
        ? [
            {
              id: 'dashboard',
              area: SIDEBAR_NAV_AREA,
              order: 10,
              data: {
                codicon: 'dashboard',
                label: BRAIN.dashboard.nav,
                path: DASHBOARD_ROUTE,
                primary: true
              } satisfies SidebarNavContribution
            }
          ]
        : []),
      ...(modules.projects
        ? [
            {
              id: 'projects',
              area: SIDEBAR_NAV_AREA,
              order: 60,
              data: {
                codicon: 'project',
                label: BRAIN.projects.nav,
                path: PROJECTS_ROUTE,
                primary: true,
                sub: () => <ProjectsNav />
              } satisfies SidebarNavContribution
            }
          ]
        : []),
      {
        id: 'nav-order',
        area: SIDEBAR_NAV_PREFS_AREA,
        data: { order: NAV_ORDER } satisfies SidebarNavPrefsContribution
      }
    ])
  }

  registerRows($brainModules.get())
  ctx.onDispose($brainModules.listen(registerRows))
  ctx.onDispose(() => disposeRows())
}

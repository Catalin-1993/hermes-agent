/** Registers the project page as a workspace page at `/project` (the project's id rides in `?id=`). */

import { lazy, Suspense } from 'react'

import { registry } from '@/contrib/registry'

import { type RouteContribution, ROUTES_AREA } from '../routes'

import { PROJECT_ROUTE } from './route'

const ProjectPage = lazy(async () => ({ default: (await import('./project-page')).ProjectPage }))

registry.register({
  area: ROUTES_AREA,
  data: { path: PROJECT_ROUTE } satisfies RouteContribution,
  id: 'project-page',
  render: () => (
    <Suspense fallback={null}>
      <ProjectPage />
    </Suspense>
  ),
  title: 'Project'
})

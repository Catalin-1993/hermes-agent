import { useMemo } from 'react'

import type { ProjectInfo, SessionInfo } from '@/hermes'

import { sessionsOutsideProjects } from './project-filter'
import { sessionBucketId, type SidebarProjectTree } from './projects'

/** The Sessions list without the chats the sidebar already lists under a project. */
export function useSessionsOutsideProjects(
  sessions: SessionInfo[],
  shownProjects: SidebarProjectTree[] | undefined,
  projects: ProjectInfo[],
  owners: ReadonlyMap<string, string>
): SessionInfo[] {
  return useMemo(
    () => sessionsOutsideProjects(sessions, shownProjects, session => sessionBucketId(session, projects, owners)),
    [sessions, shownProjects, projects, owners]
  )
}

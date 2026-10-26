/** The sidebar's Projects list: each project, and `+ New Project`. Shown under the Projects row while it is open. */

import { Codicon, useValue } from '@hermes/plugin-sdk'
import { host } from '@hermes/plugin-sdk'

import { BRAIN } from './brain-copy'
import { $newProjectRequest, $projectSlug, openProject, PROJECTS_ROUTE, useProjectList } from './brain-data'
import { projectName } from './brain-model'

const ROW =
  'flex h-6 w-full cursor-pointer items-center gap-2 rounded-md px-2 text-left text-[0.75rem] text-(--ui-text-tertiary) transition-colors hover:bg-(--ui-control-hover-background) hover:text-foreground'

export function ProjectsNav() {
  const boards = useProjectList()
  const open = useValue($projectSlug)

  return (
    <>
      {boards.map(board => (
        <button
          className={`${ROW} ${open === board.slug ? 'text-foreground' : ''}`}
          key={board.slug}
          onClick={() => openProject(board.slug)}
          type="button"
        >
          <Codicon name="folder" size="0.8rem" />
          <span className="min-w-0 truncate">{projectName(board)}</span>
        </button>
      ))}
      <button
        className={ROW}
        data-brain-new-project=""
        onClick={() => {
          $projectSlug.set('')
          $newProjectRequest.set(true)
          host.navigate(PROJECTS_ROUTE)
        }}
        type="button"
      >
        <Codicon name="add" size="0.8rem" />
        {BRAIN.projects.newProject}
      </button>
    </>
  )
}

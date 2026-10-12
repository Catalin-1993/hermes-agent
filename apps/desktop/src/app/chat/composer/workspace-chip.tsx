import { useStore } from '@nanostores/react'

import type { SidebarProjectTree } from '@/app/chat/sidebar/projects/workspace-groups'
import { Button } from '@/components/ui/button'
import { Codicon } from '@/components/ui/codicon'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  dropdownMenuSectionLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Tip } from '@/components/ui/tooltip'
import { useI18n } from '@/i18n'
import { displayPath, pathLeaf } from '@/lib/display-path'
import { useStoreSelector } from '@/lib/use-session-slice'
import { copyFilePath, revealFile, shouldOfferLocalReveal } from '@/store/file-actions'
import { revealFileInTree } from '@/store/layout'
import {
  $projectTree,
  enterProject,
  followEnteredProjectCwd,
  goToProject,
  openFolderAsProject,
  projectIdForCwd,
  projectNameForCwd,
  projectRootCwd
} from '@/store/projects'
import { $connection, $selectedStoredSessionId, $sessions, sessionMatchesStoredId } from '@/store/session'
import { $sessionTiles, isSessionRemote } from '@/store/session-states'

const MAX_CHOICES = 12

/**
 * Whether this computer's file manager can show the chat's folder: only when the session's backend
 * is this computer. A row tagged with another Connections gateway runs there, and a session whose
 * owner route is remote does too — even inside a local-primary window (#115167).
 */
function useCanRevealLocally(storedSession: null | string): boolean {
  const connection = useStore($connection)

  const taggedConnection = useStoreSelector($sessions, sessions =>
    storedSession ? sessions.find(row => sessionMatchesStoredId(row, storedSession))?.connection_id?.trim() || '' : ''
  )

  const remoteOwner = useStoreSelector($sessionTiles, () => isSessionRemote(storedSession))

  return !remoteOwner && shouldOfferLocalReveal(taggedConnection, connection?.mode === 'remote')
}

/**
 * The folder a chat works in, on the composer's top edge. Projects own the
 * workspace (DESIGN.md), so this is a door into them, not a second picker: on a
 * fresh draft, choosing a project enters it and the draft takes its root (the
 * same path a sidebar project click takes); in a stored conversation, whose
 * folder never moves under it, the same choice starts a new session there. The
 * last row is the app's one Open folder action (⌘O, the right sidebar); below it, what to do with
 * the folder already chosen — copy its path, show it in the file manager (local only) or in the tree.
 */
export function WorkspaceChip({ cwd }: { cwd: string }) {
  const { t } = useI18n()
  const projects = useStore($projectTree)
  const storedSession = useStore($selectedStoredSessionId)
  const current = cwd.trim()
  const canRevealLocally = useCanRevealLocally(storedSession)
  const currentId = current ? projectIdForCwd(current) : null
  const label = current ? projectNameForCwd(current) || pathLeaf(current) : t.rightSidebar.openFolder

  const choices = projects
    .filter(project => !project.isNoProject && !project.archived && projectRootCwd(project))
    .slice(0, MAX_CHOICES)

  const choose = (project: SidebarProjectTree) => {
    if (storedSession) {
      goToProject(project.id, { newSession: true })

      return
    }

    enterProject(project.id)
    followEnteredProjectCwd(projectRootCwd(project))
  }

  return (
    <DropdownMenu>
      <Tip label={current || t.rightSidebar.openFolder} side="top">
        <DropdownMenuTrigger asChild>
          <Button
            aria-label={t.commandCenter.projects}
            className="max-w-64 text-(--ui-text-tertiary) hover:text-(--ui-text-primary)"
            data-slot="composer-workspace-chip"
            size="xs"
            type="button"
            variant="ghost"
          >
            <Codicon name={current ? 'folder' : 'folder-opened'} size="0.8125rem" />
            <span className="min-w-0 truncate">{label}</span>
            <Codicon className="opacity-60" name="chevron-down" size="0.625rem" />
          </Button>
        </DropdownMenuTrigger>
      </Tip>
      <DropdownMenuContent align="start" className="min-w-60" side="top" sideOffset={6}>
        {choices.length > 0 && (
          <>
            <DropdownMenuLabel className={dropdownMenuSectionLabel}>{t.commandCenter.projects}</DropdownMenuLabel>
            {choices.map(project => (
              <DropdownMenuItem key={project.id} onSelect={() => choose(project)}>
                <Codicon name="folder" size="0.8125rem" />
                <span className="min-w-0 flex-1 truncate">
                  {storedSession ? t.commandCenter.newSessionInProject(project.label) : project.label}
                </span>
                {project.id === currentId && !storedSession && (
                  <Codicon className="text-(--ui-accent)" name="check" size="0.8125rem" />
                )}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuItem onSelect={() => void openFolderAsProject()}>
          <Codicon name="folder-opened" size="0.8125rem" />
          {t.commandCenter.openFolder}
        </DropdownMenuItem>
        {current && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => void copyFilePath(current)} title={displayPath(current)}>
              <Codicon name="copy" size="0.8125rem" />
              {t.fileMenu.copyPath}
            </DropdownMenuItem>
            {canRevealLocally && (
              <DropdownMenuItem onSelect={() => void revealFile(current)} title={displayPath(current)}>
                <Codicon name="folder-opened" size="0.8125rem" />
                {t.fileMenu.revealFileManager}
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onSelect={() => revealFileInTree(current)} title={displayPath(current)}>
              <Codicon name="list-tree" size="0.8125rem" />
              {t.fileMenu.revealInSidebar}
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

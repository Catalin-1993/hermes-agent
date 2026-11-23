import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Codicon } from '@/components/ui/codicon'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Kbd } from '@/components/ui/kbd'
import { Tip } from '@/components/ui/tooltip'
import { useI18n } from '@/i18n'
import { Clipboard, FileText, FolderOpen, type IconComponent, ImageIcon, Link, MessageSquareText } from '@/lib/icons'
import { cn } from '@/lib/utils'
import { useProMode } from '@/store/pro-mode'

import { ATTACH_ROW, AttachTaskRows, AttachTiles, CameraDialog } from './attach-tiles'
import { type ComposerAttachmentProvider, useComposerAttachmentProviders } from './contrib'
import { GHOST_ICON_BTN } from './controls'
import type { ChatBarState } from './types'

const SNIPPET_KEYS = ['codeReview', 'implementationPlan', 'explainThis']

export function ContextMenu({
  state,
  onAttachImageBlob,
  onInsertText,
  onOpenUrlDialog,
  onPasteClipboardImage,
  onPickFiles,
  onPickFolders,
  onPickImages
}: ContextMenuProps) {
  // Prompt snippets used to be a Radix submenu. That submenu didn't open
  // reliably when the parent menu was positioned at the bottom of the
  // window (composer "+" anchor), so we promoted it to a real Dialog —
  // easier to grow with search / descriptions, and no positioning math.
  const [snippetsOpen, setSnippetsOpen] = useState(false)
  // Brain: the Camera tile's dialog (Pro Mode); Pro off renders the community menu unchanged.
  const [cameraOpen, setCameraOpen] = useState(false)
  const pro = useProMode()

  const items = {
    onCamera: onAttachImageBlob ? () => setCameraOpen(true) : undefined,
    onInsertText,
    onOpenSnippets: () => setSnippetsOpen(true),
    onOpenUrlDialog,
    onPasteClipboardImage,
    onPickFiles,
    onPickFolders,
    onPickImages
  }

  return (
    <>
      <DropdownMenu>
        <Tip label={state.tools.label} placement="control">
          <DropdownMenuTrigger asChild>
            <Button
              aria-label={state.tools.label}
              className={cn(
                GHOST_ICON_BTN,
                'data-[state=open]:bg-(--chrome-action-hover) data-[state=open]:text-foreground'
              )}
              disabled={!state.tools.enabled}
              size="icon"
              type="button"
              variant="ghost"
            >
              <Codicon name="add" size="0.875rem" />
            </Button>
          </DropdownMenuTrigger>
        </Tip>
        <DropdownMenuContent align="start" className="w-64 p-1" side="top" sideOffset={8}>
          {pro ? <ProMenuItems {...items} /> : <ClassicMenuItems {...items} />}
        </DropdownMenuContent>
      </DropdownMenu>

      <PromptSnippetsDialog onInsertText={onInsertText} onOpenChange={setSnippetsOpen} open={snippetsOpen} />
      <CameraDialog
        onCapture={photo => void onAttachImageBlob?.(photo)}
        onOpenChange={setCameraOpen}
        open={cameraOpen}
      />
    </>
  )
}

/** Brain (Pro Mode): four tiles, the two jobs, the list, the agents in one submenu — no rules, one row size. */
function ProMenuItems(props: MenuItemsProps) {
  const { t } = useI18n()
  const c = t.composer
  // `composer.attachments` contributions — plugin/core-registered rows that
  // extend this menu through the same registry as every other surface.
  const attachmentProviders = useComposerAttachmentProviders()
  const library = attachmentProviders.find(provider => provider.key.endsWith(':library'))
  // Agents fold into one submenu; any other contributed row stays in the list.
  const agents = attachmentProviders.filter(provider => provider.group === 'agents')
  const listedProviders = attachmentProviders.filter(provider => provider !== library && provider.group !== 'agents')

  return (
    <>
      <AttachTiles
        onCamera={props.onCamera}
        onLibrary={library ? () => void library.run({ insertText: props.onInsertText }) : undefined}
        onPickFiles={props.onPickFiles}
        onPickImages={props.onPickImages}
      />
      <AttachTaskRows />
      <ContextMenuItem disabled={!props.onPickFolders} icon={FolderOpen} onSelect={props.onPickFolders}>
        {c.folder}
      </ContextMenuItem>
      <ContextMenuItem
        disabled={!props.onPasteClipboardImage}
        icon={Clipboard}
        onSelect={props.onPasteClipboardImage ? () => void props.onPasteClipboardImage?.() : undefined}
      >
        {c.pasteImage}
      </ContextMenuItem>
      <ContextMenuItem icon={Link} onSelect={props.onOpenUrlDialog}>
        {c.url}
      </ContextMenuItem>
      <ContextMenuItem icon={MessageSquareText} onSelect={props.onOpenSnippets}>
        {c.promptSnippets}
      </ContextMenuItem>

      {agents.length > 0 && (
        <DropdownMenuSub>
          <DropdownMenuSubTrigger className={ATTACH_ROW}>
            <Codicon name="organization" size="1rem" />
            <span>{c.attachTasks.agents}</span>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-56 p-1">
            {agents.map(provider => (
              <ProviderRow key={provider.key} onInsertText={props.onInsertText} provider={provider} />
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      )}
      {listedProviders.map(provider => (
        <ProviderRow key={provider.key} onInsertText={props.onInsertText} provider={provider} />
      ))}

      <div className="px-2 pt-1.5 pb-1 text-[0.6875rem] text-(--ui-text-tertiary)">
        {c.tipPre}
        <Kbd size="sm">@</Kbd>
        {c.tipPost}
      </div>
    </>
  )
}

/** The community app's + menu, as it ships upstream (Pro Mode off). */
function ClassicMenuItems(props: MenuItemsProps) {
  const { t } = useI18n()
  const c = t.composer
  const attachmentProviders = useComposerAttachmentProviders()

  return (
    <>
      <DropdownMenuLabel>{c.attachLabel}</DropdownMenuLabel>
      <DropdownMenuSeparator />
      <DropdownMenuItem disabled={!props.onPickFiles} onSelect={props.onPickFiles}>
        <FileText />
        <span>{c.files}</span>
      </DropdownMenuItem>
      <DropdownMenuItem disabled={!props.onPickFolders} onSelect={props.onPickFolders}>
        <FolderOpen />
        <span>{c.folder}</span>
      </DropdownMenuItem>
      <DropdownMenuItem disabled={!props.onPickImages} onSelect={props.onPickImages}>
        <ImageIcon />
        <span>{c.images}</span>
      </DropdownMenuItem>
      <DropdownMenuItem
        disabled={!props.onPasteClipboardImage}
        onSelect={props.onPasteClipboardImage ? () => void props.onPasteClipboardImage?.() : undefined}
      >
        <Clipboard />
        <span>{c.pasteImage}</span>
      </DropdownMenuItem>
      <DropdownMenuItem onSelect={props.onOpenUrlDialog}>
        <Link />
        <span>{c.url}</span>
      </DropdownMenuItem>

      <DropdownMenuSeparator />

      <DropdownMenuItem onSelect={props.onOpenSnippets}>
        <MessageSquareText />
        <span>{c.promptSnippets}</span>
      </DropdownMenuItem>

      {attachmentProviders.length > 0 && <DropdownMenuSeparator />}
      {attachmentProviders.map(provider => (
        <DropdownMenuItem key={provider.key} onSelect={() => void provider.run({ insertText: props.onInsertText })}>
          <Codicon name={provider.icon ?? 'plug'} size="0.875rem" />
          <span>{provider.group === 'agents' ? c.agentRow(provider.label) : provider.label}</span>
        </DropdownMenuItem>
      ))}

      <DropdownMenuSeparator />

      <div className="px-2 py-1 text-[0.7rem] text-(--ui-text-tertiary)">
        {c.tipPre}
        <Kbd size="sm">@</Kbd>
        {c.tipPost}
      </div>
    </>
  )
}

function PromptSnippetsDialog({ onInsertText, onOpenChange, open }: PromptSnippetsDialogProps) {
  const { t } = useI18n()
  const c = t.composer

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{c.snippetsTitle}</DialogTitle>
          <DialogDescription>{c.snippetsDesc}</DialogDescription>
        </DialogHeader>
        <ul className="grid gap-1">
          {SNIPPET_KEYS.map(key => {
            const snippet = c.snippets[key]

            return (
              <li key={key}>
                <button
                  className="group/snippet flex w-full cursor-pointer items-start gap-2.5 rounded-md border border-transparent px-2.5 py-2 text-left transition-colors hover:border-(--ui-stroke-tertiary) hover:bg-(--ui-control-hover-background) focus-visible:border-(--ui-stroke-tertiary) focus-visible:bg-(--ui-control-hover-background) focus-visible:outline-hidden"
                  onClick={() => {
                    onInsertText(snippet.text)
                    onOpenChange(false)
                  }}
                  type="button"
                >
                  <MessageSquareText className="mt-0.5 size-3.5 shrink-0 text-(--ui-text-tertiary) group-hover/snippet:text-foreground" />
                  <span className="grid min-w-0 gap-0.5">
                    <span className="text-sm font-medium text-foreground">{snippet.label}</span>
                    <span className="text-[length:var(--conversation-caption-font-size)] text-(--ui-text-tertiary)">
                      {snippet.description}
                    </span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      </DialogContent>
    </Dialog>
  )
}

function ProviderRow({
  onInsertText,
  provider
}: {
  onInsertText: (text: string) => void
  provider: ComposerAttachmentProvider
}) {
  return (
    <DropdownMenuItem className={ATTACH_ROW} onSelect={() => void provider.run({ insertText: onInsertText })}>
      <Codicon name={provider.icon ?? 'plug'} size="1rem" />
      <span className="truncate">{provider.label}</span>
    </DropdownMenuItem>
  )
}

export function ContextMenuItem({ children, disabled, icon: Icon, onSelect }: ContextMenuItemProps) {
  return (
    <DropdownMenuItem className={ATTACH_ROW} disabled={disabled} onSelect={onSelect}>
      <Icon />
      <span>{children}</span>
    </DropdownMenuItem>
  )
}

interface ContextMenuItemProps {
  children: string
  disabled?: boolean
  icon: IconComponent
  onSelect?: () => void
}

interface MenuItemsProps {
  onCamera?: () => void
  onInsertText: (text: string) => void
  onOpenSnippets: () => void
  onOpenUrlDialog: () => void
  onPasteClipboardImage?: (opts?: { silent?: boolean }) => Promise<boolean> | void
  onPickFiles?: () => void
  onPickFolders?: () => void
  onPickImages?: () => void
}

interface ContextMenuProps {
  onAttachImageBlob?: (blob: Blob) => Promise<boolean | void> | boolean | void
  onInsertText: (text: string) => void
  onOpenUrlDialog: () => void
  onPasteClipboardImage?: (opts?: { silent?: boolean }) => Promise<boolean> | void
  onPickFiles?: () => void
  onPickFolders?: () => void
  onPickImages?: () => void
  state: ChatBarState
}

interface PromptSnippetsDialogProps {
  onInsertText: (text: string) => void
  onOpenChange: (open: boolean) => void
  open: boolean
}

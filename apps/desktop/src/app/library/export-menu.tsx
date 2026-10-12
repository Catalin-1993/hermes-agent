import { Codicon } from '@/components/ui/codicon'
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger
} from '@/components/ui/dropdown-menu'
import { useI18n } from '@/i18n'

import type { LibraryItem } from './data'
import { isDeck } from './deck'
import { exportItem } from './export-actions'
import { type ExportFormat, exportFormatsFor } from './export-formats'

const ICON: Record<ExportFormat, string> = {
  bundle: 'file-zip',
  csv: 'table',
  docx: 'file',
  html: 'globe',
  images: 'file-media',
  jpeg: 'file-media',
  json: 'json',
  markdown: 'markdown',
  original: 'cloud-download',
  pdf: 'file-pdf',
  png: 'file-media',
  pptx: 'play-circle',
  tsv: 'table',
  webp: 'file-media',
  xlsx: 'table',
  zip: 'file-zip'
}

/** The formats an item can be exported as, in a menu: `before` runs first (to save what is being typed). */
export function ExportItems({ before, item }: { before?: () => Promise<void>; item: LibraryItem }) {
  const copy = useI18n().t.library.export
  const formats = exportFormatsFor({ ...item, deck: Boolean(item.deck) || isDeck(item.markdown) })

  return (
    <>
      {formats.map(format => (
        <span key={format}>
          {(format === 'zip' || format === 'bundle') && formats.length > 1 && <DropdownMenuSeparator />}
          <DropdownMenuItem
            onSelect={() => void (before?.() ?? Promise.resolve()).then(() => exportItem(item, format))}
          >
            <Codicon name={ICON[format]} size="0.8125rem" />
            {copy.formats[format]}
          </DropdownMenuItem>
        </span>
      ))}
    </>
  )
}

/** "Export ▸" with the item's formats beneath it. */
export function ExportSubmenu({ before, item }: { before?: () => Promise<void>; item: LibraryItem }) {
  const copy = useI18n().t.library.export

  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger>
        <Codicon name="export" size="0.8125rem" />
        {copy.title}
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent className="min-w-52">
        <ExportItems before={before} item={item} />
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  )
}

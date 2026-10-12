import { BlockNoteSchema, defaultBlockSpecs } from '@blocknote/core'

import { interactiveBlockSpec } from './interactive-block'
import { pageBlockSpec } from './page-block'

/** The Library page's block types: BlockNote's own, plus sub-pages and interactive blocks. */
export const pageSchema = BlockNoteSchema.create({
  blockSpecs: { ...defaultBlockSpecs, interactive: interactiveBlockSpec(), page: pageBlockSpec() }
})

export type PageDocument = typeof pageSchema.PartialBlock
export type PageEditorInstance = typeof pageSchema.BlockNoteEditor

/** A page's saved block document, or undefined when it has none (or it is damaged). */
export function parseDocument(content: null | string): PageDocument[] | undefined {
  if (!content) {
    return undefined
  }

  try {
    const blocks = JSON.parse(content) as unknown

    return Array.isArray(blocks) && blocks.length > 0 ? (blocks as PageDocument[]) : undefined
  } catch {
    return undefined
  }
}

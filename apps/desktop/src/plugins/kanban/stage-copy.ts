import type { StageId } from './stage-model'
/** The Board's four stages: their names, what each holds, and their colour (English, like the Kanban views). */
import { columnMeta } from './types'

export const STAGE_COPY: Record<StageId, { help: string; label: string }> = {
  todo: {
    label: 'To do',
    help: 'Ideas, waiting and queued work. Drop a card here and an agent picks it up when it is free.'
  },
  progress: { label: 'In progress', help: 'An agent is working on it now. The dispatcher moves cards here.' },
  needs: {
    label: 'Needs you',
    help: 'Stuck, a question for you, or waiting for your approval. Settle them in the Inbox.'
  },
  done: { label: 'Done', help: 'Finished. Cards that depended on it can start.' }
}

export const STAGE_TONE: Record<StageId, string> = {
  todo: columnMeta('ready').tone,
  progress: columnMeta('running').tone,
  needs: columnMeta('blocked').tone,
  done: columnMeta('done').tone
}

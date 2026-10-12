import { useStore } from '@nanostores/react'
import { useState } from 'react'
import { useNavigate } from 'react-router'

import { openSessionFromPicker, openSessionIntentFromModifiers } from '@/app/open-session'
import { Button } from '@/components/ui/button'
import { Codicon } from '@/components/ui/codicon'
import { Tip } from '@/components/ui/tooltip'
import { useViewedInterval } from '@/hooks/use-viewed-interval'
import { type Translations, useI18n } from '@/i18n'
import { relativeTime } from '@/lib/time'
import { cn } from '@/lib/utils'
import {
  $notificationFeed,
  $notificationFeedUnread,
  clearFeed,
  type FeedItem,
  type FeedKind,
  markFeedItemRead,
  markFeedRead
} from '@/store/notification-feed'
import { requestSessionResume } from '@/store/session'

type Tone = 'attention' | 'failure' | 'quiet'

// What each kind looks like, and the short line that says what happened.
const KIND: Record<FeedKind, { icon: string; label: (copy: Copy, failed: boolean) => string; tone: Tone }> = {
  agent: { icon: 'hubot', label: (c, failed) => (failed ? c.agentFailed : c.agent), tone: 'quiet' },
  approval: { icon: 'shield', label: c => c.approval, tone: 'attention' },
  error: { icon: 'error', label: c => c.error, tone: 'failure' },
  plugin: { icon: 'extensions', label: c => c.plugin, tone: 'quiet' },
  process: { icon: 'terminal', label: (c, failed) => (failed ? c.processFailed : c.process), tone: 'quiet' },
  question: { icon: 'question', label: c => c.question, tone: 'attention' },
  reply: { icon: 'comment-discussion', label: c => c.reply, tone: 'quiet' },
  scheduled: { icon: 'watch', label: c => c.scheduled, tone: 'quiet' }
}

type Copy = Translations['notificationFeed']

const BADGE: Record<Tone, string> = {
  attention: 'bg-amber-500/14 text-amber-600 dark:text-amber-400',
  failure: 'bg-(--ui-red)/12 text-(--ui-red)',
  quiet: 'bg-[color-mix(in_srgb,var(--ui-text-primary)_7%,transparent)] text-(--ui-text-secondary)'
}

const toneOf = (item: FeedItem): Tone => (item.failed ? 'failure' : KIND[item.kind].tone)

interface FeedRowProps {
  copy: Copy
  item: FeedItem
  now: number
  onOpen: (event: React.MouseEvent) => void
}

function FeedRow({ copy, item, now, onOpen }: FeedRowProps) {
  const kind = KIND[item.kind]

  return (
    <li>
      <button
        className="group/feed flex w-full cursor-pointer items-start gap-2.5 rounded-lg px-2 py-2 text-left transition-colors hover:bg-(--ui-row-hover-background)"
        onClick={onOpen}
        type="button"
      >
        <span className={cn('mt-0.5 grid size-6 shrink-0 place-items-center rounded-md', BADGE[toneOf(item)])}>
          <Codicon name={kind.icon} size="0.8125rem" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex min-w-0 items-start gap-2">
            <span
              className={cn(
                'line-clamp-2 min-w-0 flex-1 text-[0.8125rem] leading-5',
                item.read ? 'text-(--ui-text-secondary)' : 'font-medium text-(--ui-text-primary)'
              )}
            >
              {item.title}
            </span>
            <time className="mt-0.5 shrink-0 text-[0.6875rem] tabular-nums text-(--ui-text-quaternary)">
              {relativeTime(item.at, now)}
            </time>
          </span>
          <span
            className={cn(
              'block text-[0.6875rem] leading-4',
              item.failed ? 'text-(--ui-red)' : 'text-(--ui-text-tertiary)'
            )}
          >
            {kind.label(copy, Boolean(item.failed))}
            {item.detail && <span className="text-(--ui-text-quaternary)"> · {item.detail}</span>}
          </span>
          {item.body && (
            <span className="mt-1 line-clamp-2 block whitespace-pre-line text-[0.75rem] leading-snug text-(--ui-text-secondary)">
              {item.body}
            </span>
          )}
        </span>
        {!item.read && <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-(--ui-accent)" />}
      </button>
    </li>
  )
}

/**
 * The notifications panel behind the titlebar bell: what happened while you were somewhere else — which
 * chat finished and what it said, which agent delivered and what it wrote, which scheduled job ran and
 * what it produced, which command exited, which session is waiting on you. A row opens the place it is
 * about; `onOpened` lets the bell close itself behind it.
 */
export function NotificationsPanel({ onOpened }: { onOpened?: () => void }) {
  const { t } = useI18n()
  const copy = t.notificationFeed
  const navigate = useNavigate()
  const items = useStore($notificationFeed)
  const unread = useStore($notificationFeedUnread)
  const [now, setNow] = useState(() => Date.now())

  useViewedInterval(() => setNow(Date.now()), 30_000, items.length > 0)

  // A session opens like it does from ⌘K (⌘-click: a tab, ⇧⌘-click: a window), on the backend its row
  // named when it was recorded.
  const open = (item: FeedItem, event: React.MouseEvent) => {
    markFeedItemRead(item.id)
    const target = item.target

    if (target?.kind === 'session') {
      if (target.owner) {
        requestSessionResume(target.storedSessionId, target.owner)
      }

      openSessionFromPicker(target.storedSessionId, navigate, openSessionIntentFromModifiers(event))
    } else if (target?.kind === 'route') {
      navigate(target.path)
    }

    onOpened?.()
  }

  return (
    <div className="flex max-h-[min(34rem,70vh)] min-h-0 flex-col" data-slot="notification-feed">
      <header className="flex h-10 shrink-0 items-center gap-1 pl-3 pr-1.5">
        <span className="min-w-0 flex-1 truncate">
          <span className="text-[0.875rem] font-semibold text-(--ui-text-primary)">{t.sidebar.notifications}</span>
          {items.length > 0 && (
            <span className="ml-2 text-[0.75rem] text-(--ui-text-tertiary)">
              {unread > 0 ? copy.unread(unread) : copy.allRead}
            </span>
          )}
        </span>
        {items.length > 0 && (
          <>
            <Tip label={copy.markAllRead}>
              <Button
                aria-label={copy.markAllRead}
                className="text-(--ui-text-tertiary)"
                disabled={unread === 0}
                onClick={markFeedRead}
                size="icon-xs"
                variant="ghost"
              >
                <Codicon name="check-all" size="0.875rem" />
              </Button>
            </Tip>
            <Tip label={copy.clear}>
              <Button
                aria-label={copy.clear}
                className="text-(--ui-text-tertiary)"
                onClick={clearFeed}
                size="icon-xs"
                variant="ghost"
              >
                <Codicon name="clear-all" size="0.875rem" />
              </Button>
            </Tip>
          </>
        )}
      </header>

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 px-6 pb-8 pt-6 text-center">
          <Codicon className="text-(--ui-text-quaternary)" name="bell" size="1.25rem" />
          <p className="m-0 text-[0.8125rem] font-medium text-(--ui-text-secondary)">{copy.emptyTitle}</p>
          <p className="m-0 max-w-64 text-[0.75rem] leading-relaxed text-(--ui-text-tertiary)">{copy.emptyBody}</p>
        </div>
      ) : (
        <ul className="m-0 flex min-h-0 flex-1 list-none flex-col gap-0.5 overflow-y-auto px-1.5 pb-2">
          {items.map(item => (
            <FeedRow copy={copy} item={item} key={item.id} now={now} onOpen={event => open(item, event)} />
          ))}
        </ul>
      )}
    </div>
  )
}

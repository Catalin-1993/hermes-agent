import './intro.css'

import { type CSSProperties, useState } from 'react'

import { useI18n } from '@/i18n'
import { capitalize, normalize } from '@/lib/text'

import introCopyJsonl from './intro-copy.jsonl?raw'

type IntroCopy = {
  headline: string
  body: string
}

type IntroCopyRecord = IntroCopy & {
  personality: string
}

export type IntroProps = {
  personality?: string
  seed?: number
}

const NEUTRAL_PERSONALITIES = new Set(['', 'default', 'none', 'neutral'])

const FALLBACK_COPY: IntroCopy[] = [
  {
    headline: 'What are we moving today?',
    body: "Send a bug, branch, plan, or rough idea. I'll inspect the repo and turn it into the next concrete step."
  },
  {
    headline: "What's on your mind?",
    body: "Bring the code, question, or stuck part. I'll read the room before making changes."
  },
  {
    headline: 'What should Brain look at?',
    body: "Send the task, failing path, or half-formed plan. I'll help turn it into action."
  },
  {
    headline: 'Where should we start?',
    body: "Bring the problem, goal, or file. I'll inspect first and keep the next step concrete."
  },
  {
    headline: 'What needs attention?',
    body: "Send the context you have. I'll help sort it into a plan or a fix."
  }
]

function normalizeKey(value?: string): string {
  return normalize(value)
}

function titleize(value: string): string {
  return value
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map(capitalize)
    .join(' ')
}

function isIntroCopyRecord(value: unknown): value is IntroCopyRecord {
  if (!value || typeof value !== 'object') {
    return false
  }

  const record = value as Record<string, unknown>

  return (
    typeof record.personality === 'string' &&
    typeof record.headline === 'string' &&
    typeof record.body === 'string' &&
    Boolean(record.personality.trim()) &&
    Boolean(record.headline.trim()) &&
    Boolean(record.body.trim())
  )
}

function parseIntroCopy(raw: string): Record<string, IntroCopy[]> {
  const byPersonality: Record<string, IntroCopy[]> = {}

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim()

    if (!trimmed) {
      continue
    }

    try {
      const parsed: unknown = JSON.parse(trimmed)

      if (!isIntroCopyRecord(parsed)) {
        continue
      }

      const key = normalizeKey(parsed.personality)
      byPersonality[key] ??= []
      byPersonality[key].push({
        headline: parsed.headline.trim(),
        body: parsed.body.trim()
      })
    } catch {
      // Bad generated copy should not break the whole desktop app.
    }
  }

  return byPersonality
}

const INTRO_COPY_BY_PERSONALITY = parseIntroCopy(introCopyJsonl)

function neutralCopy(): IntroCopy[] {
  return INTRO_COPY_BY_PERSONALITY.none || INTRO_COPY_BY_PERSONALITY.default || FALLBACK_COPY
}

function fallbackCopyForPersonality(personalityKey: string): IntroCopy[] {
  if (NEUTRAL_PERSONALITIES.has(personalityKey)) {
    return neutralCopy()
  }

  const label = titleize(personalityKey)

  return [
    {
      headline: `${label} mode is on. What should we work on?`,
      body: "Send the task, file, or rough idea. I'll use your configured voice and keep the work grounded in this repo."
    },
    {
      headline: `What does ${label} Brain need to see?`,
      body: "Bring the context or the stuck part. I'll adapt to your configured personality."
    },
    {
      headline: `${label} mode is ready.`,
      body: "Send the problem, file, or idea. I'll follow the personality you've configured."
    },
    {
      headline: `What should ${label} Brain tackle?`,
      body: "Drop the task here. I'll keep the work grounded in the repo."
    },
    {
      headline: 'Where should we begin?',
      body: `Give me the context and I'll answer in ${label} mode.`
    }
  ]
}

function pickCopy(copies: IntroCopy[], seed = 0): IntroCopy {
  return copies[Math.abs(seed) % copies.length] || FALLBACK_COPY[0]
}

// The empty-chat artwork, served from public/ like the other shell art. Each is a mask — white with the
// image's own alpha — so the stylesheet can ink it for any theme. Light pages get a cut with a lower black
// point and more local contrast, so the fine web reads as drawing rather than haze.
/** The figure's address, made absolute against the page. It is handed over in a custom property and used by
 *  intro.css, and a relative url() there resolves against the STYLESHEET (dist/assets/) in the packaged app,
 *  where BASE_URL is './' — the image would be looked for in assets/ and never load. The dev server's '/' hid it. */
const publicAsset = (name: string) => new URL(`${import.meta.env.BASE_URL}${name}`, document.baseURI).href

const BRAIN_ART = publicAsset('intro-brain.png')
const BRAIN_ART_LIGHT = publicAsset('intro-brain-light.png')

export type DayPart = 'afternoon' | 'evening' | 'morning'

/** Which greeting a local hour gets: morning 5–11, afternoon 12–17, else evening. */
export function dayPart(hour: number): DayPart {
  if (hour >= 5 && hour < 12) {
    return 'morning'
  }

  return hour >= 12 && hour < 18 ? 'afternoon' : 'evening'
}

function resolveCopy(personality?: string, seed?: number): IntroCopy {
  const personalityKey = normalizeKey(personality)

  const copies = NEUTRAL_PERSONALITIES.has(personalityKey)
    ? INTRO_COPY_BY_PERSONALITY[personalityKey] || neutralCopy()
    : INTRO_COPY_BY_PERSONALITY[personalityKey] || fallbackCopyForPersonality(personalityKey)

  return pickCopy(copies, seed)
}

export function Intro({ personality, seed }: IntroProps) {
  const [mountSeed] = useState(() => Math.floor(Math.random() * 100000))
  // Fixed for the life of the splash — a greeting that flips mid-glance reads as a glitch.
  const [part] = useState(() => dayPart(new Date().getHours()))
  const { t } = useI18n()
  const rotationSeed = mountSeed + (seed ?? 0)
  const copy = resolveCopy(personality, rotationSeed)
  const key = normalizeKey(personality)

  const bodies =
    t.intro.stock[key] ?? (NEUTRAL_PERSONALITIES.has(key) ? t.intro.stock.none : t.intro.custom(personality || ''))

  const body = bodies?.[Math.abs(rotationSeed) % bodies.length] ?? copy.body

  return (
    <div
      className="pointer-events-none flex w-full min-w-0 flex-col items-center justify-center px-0.5 py-6 text-muted-foreground sm:px-6 lg:px-8"
      data-slot="aui_intro"
    >
      <div className="intro-hero w-full min-w-0">
        <div
          aria-hidden
          className="intro-brain"
          style={
            {
              '--intro-brain-art': `url(${BRAIN_ART})`,
              '--intro-brain-art-light': `url(${BRAIN_ART_LIGHT})`
            } as CSSProperties
          }
        >
          <span className="intro-brain-art" />
          <span className="intro-brain-glints">
            <span />
          </span>
          <svg aria-hidden className="absolute size-0">
            <filter colorInterpolationFilters="sRGB" id="intro-brain-glints">
              <feComponentTransfer>
                <feFuncA intercept="-2.04" slope="3.4" type="linear" />
              </feComponentTransfer>
            </filter>
            <filter colorInterpolationFilters="sRGB" id="intro-brain-contrast">
              <feComponentTransfer>
                <feFuncR amplitude="1.12" exponent="1.15" type="gamma" />
                <feFuncG amplitude="1.12" exponent="1.15" type="gamma" />
                <feFuncB amplitude="1.12" exponent="1.15" type="gamma" />
                <feFuncA amplitude="1.3" exponent="1.3" type="gamma" />
              </feComponentTransfer>
            </filter>
          </svg>
        </div>

        <p className="intro-greeting">{t.introGreeting[part]}</p>
        <p className="intro-body m-0 leading-normal tracking-tight">{body}</p>
      </div>
    </div>
  )
}

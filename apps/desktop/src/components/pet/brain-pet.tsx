import './brain-pet.css'

import { useStore } from '@nanostores/react'
import { type CSSProperties, useEffect, useId, useRef } from 'react'

import { $petState, type PetState } from '@/store/pet'

/**
 * Brain: the built-in "Brain" companion — a vector pet drawn and animated here, no spritesheet. A soft, lit brain
 * with a face: it breathes, floats, blinks at its own pace, follows the pointer with its eyes, and signals run along
 * its folds. Each agent state retunes the same loops (faster and brighter while it works, a tilt while it waits on
 * you, a droop when something failed, a hop with sparkles when a turn lands), so changes read as one creature
 * changing mood rather than frames swapping. Reduced motion holds it still.
 */

// The left hemisphere's folds; the right is the same group mirrored, so the two halves always match.
const FOLDS = [
  'M24 22 C29 19 33 24 30 28 C27 32 33 36 38 33',
  'M40 15 C45 18 42 23 47 26 C52 29 50 34 55 36',
  'M14 34 C19 31 24 34 22 39 C20 44 26 46 30 43',
  'M30 38 C34 35 39 39 36 43 C34 47 39 48 42 46',
  'M10 50 C15 47 19 51 17 55 C15 59 20 62 24 59',
  'M13 66 C18 63 23 67 21 71 C19 75 25 77 29 74',
  'M26 81 C30 77 35 80 34 84',
  'M40 77 C43 73 48 75 48 79 C48 82 52 84 55 81',
  'M49 44 C53 41 57 44 56 48',
  'M19 27 C16 29 15 31 16 34',
  'M30 58 C33 62 29 66 32 71',
  'M51 11 C54 14 53 17 56 20'
]

// Signals run only along the longer folds, so the surface stays calm.
const SPARK_FOLDS = [0, 1, 2, 4, 5, 7]

const HEMISPHERE = 'M60 18 C52 9 38 9 31 17 C21 15 11 23 13 35 C5 42 5 56 13 62 C11 73 20 83 32 80 C38 89 52 89 60 82 Z'

const MOUTH: Record<PetState, string> = {
  failed: 'M55 69 C58 66.6 62 66.6 65 69',
  idle: 'M55 66.5 C58 69.2 62 69.2 65 66.5',
  jump: 'M54 66 C57 71.5 63 71.5 66 66',
  review: 'M56 67.5 C58.5 68.4 61.5 68.4 64 67.5',
  run: 'M56 67 C58.5 68.6 61.5 68.6 64 67',
  waiting: 'M55.5 66.8 C58 68.8 62 68.8 64.5 66.8',
  wave: 'M54 66 C57 71.5 63 71.5 66 66'
}

const SPARKLES = [
  [18, 14],
  [104, 18],
  [10, 70],
  [110, 66],
  [60, 4]
] as const

const LOOK_RANGE = 1.8

function useBlink(ref: React.RefObject<SVGSVGElement | null>, still: boolean) {
  useEffect(() => {
    const el = ref.current

    if (!el || still) {
      return
    }

    let timer: ReturnType<typeof setTimeout>

    const next = () => {
      timer = setTimeout(
        () => {
          el.setAttribute('data-blink', '')
          timer = setTimeout(() => {
            el.removeAttribute('data-blink')
            next()
          }, 130)
        },
        2600 + Math.random() * 3800
      )
    }

    next()

    return () => clearTimeout(timer)
  }, [ref, still])
}

/** Eyes drift toward the pointer, a frame at a time and without a React render. */
function useLook(ref: React.RefObject<SVGSVGElement | null>, still: boolean) {
  useEffect(() => {
    const el = ref.current

    if (!el || still) {
      return
    }

    let frame = 0

    const onMove = (event: PointerEvent) => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const box = el.getBoundingClientRect()
        const dx = event.clientX - (box.left + box.width / 2)
        const dy = event.clientY - (box.top + box.height / 2)
        const reach = Math.max(1, Math.hypot(dx, dy))
        const pull = Math.min(1, reach / 240)
        el.style.setProperty('--bp-look-x', `${((dx / reach) * LOOK_RANGE * pull).toFixed(2)}px`)
        el.style.setProperty('--bp-look-y', `${((dy / reach) * LOOK_RANGE * pull).toFixed(2)}px`)
      })
    }

    window.addEventListener('pointermove', onMove, { passive: true })

    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('pointermove', onMove)
    }
  }, [ref, still])
}

export function BrainPet({ className, size = 72, state }: { className?: string; size?: number; state?: PetState }) {
  const live = useStore($petState)
  const mood = state ?? live
  const ref = useRef<SVGSVGElement | null>(null)
  const id = useId().replace(/:/g, '')
  const still = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  useBlink(ref, Boolean(still))
  useLook(ref, Boolean(still))

  const url = (name: string) => `url(#${id}-${name})`

  const hemisphere = (
    <>
      <path d={HEMISPHERE} fill={url('skin')} />
      <path d={HEMISPHERE} fill={url('depth')} />
      <g clipPath={url('hemi')}>
        {FOLDS.map(d => (
          <g key={d}>
            <path d={d} fill="none" stroke="#923a66" strokeLinecap="round" strokeOpacity={0.5} strokeWidth={2.6} />
            <path
              d={d}
              fill="none"
              stroke="#ffeaf2"
              strokeLinecap="round"
              strokeOpacity={0.55}
              strokeWidth={0.9}
              transform="translate(-0.7 -0.9)"
            />
          </g>
        ))}
      </g>
      <path d={HEMISPHERE} fill="none" stroke="#7d2f58" strokeOpacity={0.35} strokeWidth={0.8} />
      <path
        d={HEMISPHERE}
        fill="none"
        stroke="var(--bp-aura)"
        strokeOpacity={0.35}
        strokeWidth={0.6}
        transform="translate(0.3 0.4)"
      />
      {SPARK_FOLDS.map(index => FOLDS[index]).map((d, index) => (
        <path
          d={d}
          data-part="spark"
          fill="none"
          filter={url('glow')}
          key={`spark-${d}`}
          pathLength={100}
          stroke="var(--bp-aura)"
          strokeLinecap="round"
          strokeWidth={1.6}
          style={{ '--bp-i': index } as CSSProperties}
        />
      ))}
    </>
  )

  return (
    <svg
      aria-hidden
      className={['brain-pet', className].filter(Boolean).join(' ')}
      data-state={mood}
      height={size}
      ref={ref}
      viewBox="0 0 120 100"
      width={size * 1.2}
    >
      <defs>
        <clipPath id={`${id}-hemi`}>
          <path d={HEMISPHERE} />
        </clipPath>
        <radialGradient cx="40%" cy="30%" id={`${id}-skin`} r="80%">
          <stop offset="0%" stopColor="#ffe3ec" />
          <stop offset="42%" stopColor="#f6a8c3" />
          <stop offset="100%" stopColor="#c75f8d" />
        </radialGradient>
        <radialGradient cx="50%" cy="95%" id={`${id}-depth`} r="70%">
          <stop offset="0%" stopColor="#5b1d45" stopOpacity={0.38} />
          <stop offset="100%" stopColor="#5b1d45" stopOpacity={0} />
        </radialGradient>
        <radialGradient id={`${id}-aura`}>
          <stop offset="0%" stopColor="currentColor" stopOpacity={0.75} />
          <stop offset="55%" stopColor="currentColor" stopOpacity={0.22} />
          <stop offset="100%" stopColor="currentColor" stopOpacity={0} />
        </radialGradient>
        <radialGradient cx="35%" cy="30%" id={`${id}-eye`} r="75%">
          <stop offset="0%" stopColor="#3a3350" />
          <stop offset="100%" stopColor="#0f0c19" />
        </radialGradient>
        <filter height="200%" id={`${id}-glow`} width="200%" x="-50%" y="-50%">
          <feGaussianBlur result="blur" stdDeviation="1.1" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter height="160%" id={`${id}-soft`} width="160%" x="-30%" y="-30%">
          <feGaussianBlur stdDeviation="2.2" />
        </filter>
      </defs>

      <ellipse cx="60" cy="52" data-part="aura" fill={url('aura')} rx="58" ry="50" />
      <ellipse cx="60" cy="95" data-part="shadow" fill="#000" filter={url('soft')} rx="30" ry="3.2" />

      <g data-part="float">
        <g data-part="body">
          {hemisphere}
          <g transform="translate(120 0) scale(-1 1)">{hemisphere}</g>
          <path
            d="M60 20 C57.5 40 62.5 60 60 81"
            fill="none"
            stroke="#8f3562"
            strokeLinecap="round"
            strokeOpacity={0.55}
            strokeWidth={1.6}
          />
          <ellipse cx="38" cy="24" fill="#fff" filter={url('soft')} opacity={0.5} rx="12" ry="5" />
          <ellipse cx="86" cy="22" fill="#fff" filter={url('soft')} opacity={0.22} rx="7" ry="3" />

          <g data-part="eyes">
            <g data-part="lids">
              {[47, 73].map(cx => (
                <g key={cx}>
                  <ellipse cx={cx} cy="56" fill={url('eye')} rx="4.4" ry="5.4" />
                  <circle cx={cx - 1.4} cy="54" fill="#fff" opacity={0.95} r="1.45" />
                  <circle cx={cx + 1.3} cy="57.6" fill="#fff" opacity={0.45} r="0.6" />
                </g>
              ))}
            </g>
          </g>
          <ellipse cx="40" cy="63" fill="#ff6f9c" opacity={0.28} rx="4" ry="2.2" />
          <ellipse cx="80" cy="63" fill="#ff6f9c" opacity={0.28} rx="4" ry="2.2" />
          <path
            data-part="mouth"
            fill="none"
            stroke="#6b2149"
            strokeLinecap="round"
            strokeWidth={1.7}
            style={{ d: `path('${MOUTH[mood]}')` } as CSSProperties}
          />
        </g>
      </g>

      <g data-part="orbit">
        <circle cx="60" cy="4" fill="var(--bp-aura)" filter={url('glow')} r="1.8" />
      </g>

      {SPARKLES.map(([x, y], index) => (
        <path
          d={`M${x} ${y - 4} L${x + 1} ${y - 1} L${x + 4} ${y} L${x + 1} ${y + 1} L${x} ${y + 4} L${x - 1} ${y + 1} L${x - 4} ${y} L${x - 1} ${y - 1} Z`}
          data-part="sparkle"
          fill="#fff6c9"
          key={`${x}-${y}`}
          style={{ '--bp-i': index } as CSSProperties}
        />
      ))}
    </svg>
  )
}

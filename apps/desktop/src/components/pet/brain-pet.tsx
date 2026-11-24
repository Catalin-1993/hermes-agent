import './brain-pet.css'

import { useStore } from '@nanostores/react'
import { type CSSProperties, useEffect, useId, useRef } from 'react'

import { $petState, type PetState } from '@/store/pet'

/**
 * Brain: the built-in "Brain" companion — the project's own art (the starlit brain of the welcome screen,
 * public/intro-brain.png) brought to life. Its stars twinkle, signals run along the network between them, a soft
 * silhouette glow breathes, the whole brain leans toward the pointer, and two eyes made of the same light give it a
 * face that blinks and looks around. Each agent state retunes the same loops — racing signals while it works, eyes
 * up while it thinks, a nod while it waits on you, a dim droop when something failed, smiling eyes and a burst of
 * stars when a turn lands — so a change reads as one creature changing mood. Reduced motion holds it still.
 */

const ART = new URL(`${import.meta.env.BASE_URL}intro-brain.png`, document.baseURI).href

// Bright points of the art itself (its 512 × 474 pixel grid): the stars that twinkle and the network they span.
const STARS = [
  [297, 117],
  [386, 105],
  [228, 90],
  [411, 129],
  [217, 158],
  [369, 193],
  [442, 212],
  [415, 323],
  [366, 347],
  [285, 330],
  [232, 296],
  [178, 262],
  [327, 80],
  [150, 150]
] as const

const LINKS = [
  [2, 0],
  [0, 12],
  [12, 1],
  [1, 3],
  [3, 5],
  [5, 6],
  [6, 7],
  [7, 8],
  [8, 9],
  [9, 10],
  [10, 11],
  [11, 13],
  [13, 4],
  [4, 2],
  [0, 5],
  [5, 8]
] as const

// A three-quarter face on the frontal lobe (the art looks left): the near eye full size, the far one smaller.
const EYES = [
  { scale: 1, x: 196, y: 204 },
  { scale: 0.8, x: 268, y: 196 }
] as const

const LOOK_RANGE = 9
const TILT_RANGE = 7

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
          }, 140)
        },
        2800 + Math.random() * 4200
      )
    }

    next()

    return () => clearTimeout(timer)
  }, [ref, still])
}

/** Eyes and a slight lean follow the pointer, a frame at a time and without a React render. */
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
        const pull = Math.min(1, reach / 260)
        const x = (dx / reach) * pull
        const y = (dy / reach) * pull
        el.style.setProperty('--bp-look-x', `${(x * LOOK_RANGE).toFixed(2)}px`)
        el.style.setProperty('--bp-look-y', `${(y * LOOK_RANGE).toFixed(2)}px`)
        el.style.setProperty('--bp-tilt-x', `${(-y * TILT_RANGE).toFixed(2)}deg`)
        el.style.setProperty('--bp-tilt-y', `${(x * TILT_RANGE).toFixed(2)}deg`)
      })
    }

    window.addEventListener('pointermove', onMove, { passive: true })

    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('pointermove', onMove)
    }
  }, [ref, still])
}

const star = (x: number, y: number, r: number) =>
  `M${x} ${y - r} Q${x + r * 0.12} ${y - r * 0.12} ${x + r} ${y} Q${x + r * 0.12} ${y + r * 0.12} ${x} ${y + r} ` +
  `Q${x - r * 0.12} ${y + r * 0.12} ${x - r} ${y} Q${x - r * 0.12} ${y - r * 0.12} ${x} ${y - r} Z`

export function BrainPet({ className, size = 72, state }: { className?: string; size?: number; state?: PetState }) {
  const live = useStore($petState)
  const mood = state ?? live
  const ref = useRef<SVGSVGElement | null>(null)
  const id = useId().replace(/:/g, '')

  const still = Boolean(
    typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  )

  useBlink(ref, still)
  useLook(ref, still)

  const url = (name: string) => `url(#${id}-${name})`

  return (
    <svg
      aria-hidden
      className={['brain-pet', className].filter(Boolean).join(' ')}
      data-state={mood}
      height={size}
      ref={ref}
      viewBox="-24 -24 560 522"
      width={size * (560 / 522)}
    >
      <defs>
        <radialGradient id={`${id}-aura`}>
          <stop offset="0%" stopColor="currentColor" stopOpacity={0.26} />
          <stop offset="55%" stopColor="currentColor" stopOpacity={0.06} />
          <stop offset="100%" stopColor="currentColor" stopOpacity={0} />
        </radialGradient>
        <radialGradient id={`${id}-core`}>
          <stop offset="0%" stopColor="#fff" />
          <stop offset="40%" stopColor="#fff" stopOpacity={0.55} />
          <stop offset="100%" stopColor="#fff" stopOpacity={0} />
        </radialGradient>
        <radialGradient cx="45%" cy="40%" id={`${id}-iris`} r="65%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="55%" stopColor="#e9eeff" />
          <stop offset="100%" stopColor="#b9c4e6" />
        </radialGradient>
        <filter height="200%" id={`${id}-glow`} width="200%" x="-50%" y="-50%">
          <feGaussianBlur result="blur" stdDeviation="4" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <ellipse cx="256" cy="230" data-part="aura" fill={url('aura')} rx="270" ry="250" />

      <g data-part="float">
        <g data-part="body">
          <image data-part="halo" height="474" href={ART} width="512" />
          <image data-part="art" height="474" href={ART} width="512" />

          <g data-part="network">
            {LINKS.map(([a, b]) => (
              <line
                key={`l-${a}-${b}`}
                stroke="#fff"
                strokeOpacity={0.1}
                strokeWidth={1.2}
                x1={STARS[a][0]}
                x2={STARS[b][0]}
                y1={STARS[a][1]}
                y2={STARS[b][1]}
              />
            ))}
            {LINKS.map(([a, b], index) => (
              <line
                data-part="signal"
                filter={url('glow')}
                key={`s-${a}-${b}`}
                pathLength={100}
                stroke="var(--bp-signal)"
                strokeLinecap="round"
                strokeWidth={2.2}
                style={{ '--bp-i': index } as CSSProperties}
                x1={STARS[a][0]}
                x2={STARS[b][0]}
                y1={STARS[a][1]}
                y2={STARS[b][1]}
              />
            ))}
          </g>

          {STARS.map(([x, y], index) => (
            <g data-part="star" key={`${x}-${y}`} style={{ '--bp-i': index } as CSSProperties}>
              <circle cx={x} cy={y} fill={url('core')} r={11} />
              <path
                d={`M${x - 17} ${y} H${x + 17} M${x} ${y - 17} V${y + 17}`}
                stroke="#fff"
                strokeLinecap="round"
                strokeOpacity={0.55}
                strokeWidth={1.4}
              />
              <circle cx={x} cy={y} fill="#fff" r={2.6} />
            </g>
          ))}

          <g data-part="face">
            {EYES.map(eye => (
              <g data-part="eye" key={eye.x} transform={`translate(${eye.x} ${eye.y}) scale(${eye.scale})`}>
                <g data-part="gaze">
                  <ellipse cx="0" cy="0" data-part="eye-glow" fill={url('core')} rx="28" ry="36" />
                  <g data-part="eye-open">
                    <ellipse cx="0" cy="0" fill={url('iris')} rx="10" ry="16" />
                    <ellipse cx="-2.5" cy="-6" fill="#fff" opacity={0.95} rx="3" ry="4" />
                  </g>
                  <path
                    d="M-12 5 Q0 -9 12 5"
                    data-part="eye-happy"
                    fill="none"
                    stroke="#fff"
                    strokeLinecap="round"
                    strokeWidth="4.5"
                  />
                </g>
              </g>
            ))}
          </g>
        </g>
      </g>

      {[
        [40, 40],
        [480, 30],
        [20, 330],
        [500, 300],
        [260, -6]
      ].map(([x, y], index) => (
        <path
          d={star(x, y, 18)}
          data-part="sparkle"
          fill="#fff"
          key={`${x}-${y}`}
          style={{ '--bp-i': index } as CSSProperties}
        />
      ))}
    </svg>
  )
}

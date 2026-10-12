import type { PointerEvent } from 'react'

import { TITLEBAR_CONTROL_SIZE, TITLEBAR_CONTROLS_TOP } from './titlebar'

const LIGHT =
  'grid size-3 place-items-center rounded-full p-0 text-[0.5rem] leading-none text-black/60 [-webkit-app-region:no-drag]'

// Same as the other titlebar tools: keep the drag region off the press, never preventDefault.
const stopTitlebarDrag = (event: PointerEvent<HTMLButtonElement>) => event.stopPropagation()

/**
 * macOS native fullscreen hides the traffic lights; the app keeps them on
 * screen in the same spot (`windowButtonPosition`). Red closes, yellow
 * minimizes (main leaves fullscreen first — macOS cannot minimize a
 * fullscreen window), green leaves fullscreen. Glyphs show on hover, as on
 * the native ones.
 */
export function MacTrafficLights({ x }: { x: number }) {
  const controls = window.hermesDesktop?.windowControls

  if (!controls) {
    return null
  }

  return (
    <div
      className="group/lights fixed z-80 flex items-center gap-2"
      data-slot="mac-traffic-lights"
      style={{ height: TITLEBAR_CONTROL_SIZE, left: x, top: TITLEBAR_CONTROLS_TOP }}
    >
      <button
        aria-label="Close window"
        className={`${LIGHT} bg-[#ff5f57]`}
        onClick={() => controls.close()}
        onPointerDown={stopTitlebarDrag}
        type="button"
      >
        <span className="opacity-0 group-hover/lights:opacity-100">✕</span>
      </button>
      <button
        aria-label="Minimize window"
        className={`${LIGHT} bg-[#febc2e]`}
        onClick={() => controls.minimize()}
        onPointerDown={stopTitlebarDrag}
        type="button"
      >
        <span className="opacity-0 group-hover/lights:opacity-100">−</span>
      </button>
      <button
        aria-label="Exit full screen"
        className={`${LIGHT} bg-[#28c840]`}
        onClick={() => controls.exitFullscreen()}
        onPointerDown={stopTitlebarDrag}
        type="button"
      >
        <span className="opacity-0 group-hover/lights:opacity-100">⤡</span>
      </button>
    </div>
  )
}

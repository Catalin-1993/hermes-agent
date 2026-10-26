/** Comparing symbols: another symbol's closes laid onto the main chart's bars, so both share one time axis. */

import type { Bar } from './market-feed'

export const COMPARE_COLORS = ['#fbbf24', '#34d399', '#f472b6']

/** For each main bar, the last close of `other` at or before it (nothing before `other` begins). */
export function resampleCloses(main: Bar[], other: Bar[]): { time: number; value: number }[] {
  const points: { time: number; value: number }[] = []
  let at = -1

  for (const bar of main) {
    while (at + 1 < other.length && other[at + 1].time <= bar.time) {
      at += 1
    }

    if (at >= 0) {
      points.push({ time: bar.time, value: other[at].close })
    }
  }

  return points
}

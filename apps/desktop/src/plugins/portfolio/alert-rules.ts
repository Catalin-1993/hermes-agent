/** Small pure rules for price alerts, kept apart so they are tested. */

import type { AlertOp, PriceAlert } from './api'
import { quotePrice } from './format'

/** Which way a level is crossed from where the price is now: a level above the price waits for a rise. */
export const directionFor = (level: number, current: number): AlertOp => (level >= current ? 'above' : 'below')

/** The level a new alert starts from: the current price, to the precision a person would type. */
export const startingLevel = (current: number) =>
  current >= 1 ? Math.round(current * 100) / 100 : Number(current.toPrecision(4))

/** The waiting alerts' levels for one symbol, for the chart's lines. */
export const levelsFor = (alerts: PriceAlert[], symbol: string) =>
  alerts.filter(alert => alert.active && alert.symbol === symbol).map(alert => alert.price)

/** "BTC peste 70.000,00 USDT" */
export const describeAlert = (alert: Pick<PriceAlert, 'currency' | 'op' | 'price' | 'symbol'>) =>
  `${alert.symbol} ${alert.op === 'above' ? 'peste' : 'sub'} ${quotePrice(alert.price)}${alert.currency ? ` ${alert.currency}` : ''}`

/** The alerts that were waiting before and are reached now: the ones to announce. */
export function newlyReached(before: PriceAlert[], now: PriceAlert[]): PriceAlert[] {
  const waiting = new Set(before.filter(alert => alert.active).map(alert => alert.id))

  return now.filter(alert => !alert.active && alert.triggered_at && waiting.has(alert.id))
}

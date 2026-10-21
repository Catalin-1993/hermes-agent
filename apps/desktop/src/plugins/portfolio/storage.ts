/** The plugin's own small preferences (the app's per-plugin storage), bound once at register time. */

import type { PluginStorage } from '@hermes/plugin-sdk'

let storage: null | PluginStorage = null

export function bindPortfolioStorage(next: PluginStorage): () => void {
  storage = next

  return () => {
    storage = null
  }
}

export const readPreference = <T>(key: string, fallback: T): T => storage?.get(key, fallback) ?? fallback

export const writePreference = (key: string, value: unknown) => storage?.set(key, value)

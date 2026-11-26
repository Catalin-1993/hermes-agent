import type {
  AtlasLink,
  AtlasNode,
  AtlasOverview,
  MemoryAtlasDetailResult,
  MemoryAtlasGraphResult,
  MemoryAtlasOverviewResult,
  MemoryAtlasWakeResult
} from '@hermes/shared'
import { atom } from 'nanostores'

import { persistentAtom } from '@/lib/persisted'
import { requestGatewayForProfile } from '@/store/gateway'
import { $activeGatewayProfile } from '@/store/profile'

/** The Library home's view of the agent's long-term memory (`memory_atlas.*`, read-only). */
export type AtlasMode = MemoryAtlasGraphResult['mode']
export type AtlasState = MemoryAtlasOverviewResult['state']
export type AtlasDetailKind = 'document' | 'entity' | 'memory'
export type { AtlasLink, AtlasNode, AtlasOverview }

export const ATLAS_MODES: readonly AtlasMode[] = ['entities', 'world', 'experience', 'observation']

// The daemon can take a while to come up from cold (embedding model, database).
const WAKE_TIMEOUT_MS = 90_000

const rpc = <T>(method: string, params: Record<string, unknown> = {}, timeoutMs?: number) =>
  requestGatewayForProfile<T>($activeGatewayProfile.get(), method, params, timeoutMs)

export const fetchAtlasOverview = () => rpc<MemoryAtlasOverviewResult>('memory_atlas.overview')

export const fetchAtlasGraph = (mode: AtlasMode) => rpc<MemoryAtlasGraphResult>('memory_atlas.graph', { mode })

export const fetchAtlasDetail = (kind: AtlasDetailKind, id: string) =>
  rpc<MemoryAtlasDetailResult>('memory_atlas.detail', { id, kind })

export const wakeAtlas = () => rpc<MemoryAtlasWakeResult>('memory_atlas.wake', {}, WAKE_TIMEOUT_MS)

/** Which view the graph shows; remembered for the window. */
export const $atlasMode = persistentAtom<AtlasMode>('hermes.desktop.library.atlas-mode.v1', 'entities', {
  decode: raw => (ATLAS_MODES as readonly string[]).includes(raw) ? (raw as AtlasMode) : 'entities',
  encode: value => value
})

/** What the detail panel shows: a node picked in the graph, or a row picked beside it. */
export interface AtlasSelection {
  id: string
  kind: AtlasDetailKind
  /** Shown while the record loads. */
  label: string
}

export const $atlasSelection = atom<AtlasSelection | null>(null)

/** Bumped by "Wake" and "Retry": every Atlas read looks again. */
export const $atlasRevision = atom(0)

/** A sleeping local memory is woken once per window; after that "Try again" asks the owner. */
export const $atlasWakeTried = atom(false)

export const refreshAtlas = () => $atlasRevision.set($atlasRevision.get() + 1)

/** A graph node in the current mode is a memory, except in the entity view. */
export const selectionKindFor = (mode: AtlasMode): AtlasDetailKind => (mode === 'entities' ? 'entity' : 'memory')

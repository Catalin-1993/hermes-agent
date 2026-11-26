import './home.css'

import { useStore } from '@nanostores/react'
import type * as React from 'react'
import { useCallback, useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Codicon } from '@/components/ui/codicon'
import { Loader } from '@/components/ui/loader'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { useI18n } from '@/i18n'
import { $gatewayState } from '@/store/session'

import { LibraryHeader } from '../library-browser'

import {
  $atlasMode,
  $atlasRevision,
  $atlasSelection,
  $atlasWakeTried,
  ATLAS_MODES,
  type AtlasLink,
  type AtlasNode,
  type AtlasOverview,
  type AtlasState,
  fetchAtlasGraph,
  fetchAtlasOverview,
  refreshAtlas,
  selectionKindFor,
  wakeAtlas
} from './atlas-data'
import { AtlasDetail } from './atlas-detail'
import { AtlasGraph, LINK_KINDS } from './atlas-graph'
import { AtlasSide } from './atlas-side'

type Phase = 'loading' | 'waking' | AtlasState

interface GraphData {
  links: AtlasLink[]
  nodes: AtlasNode[]
}

const LINK_DOT: Record<(typeof LINK_KINDS)[number], string> = {
  causal: 'bg-(--ui-purple)',
  cooccurrence: 'bg-(--ui-accent)',
  entity: 'bg-(--ui-orange)',
  semantic: 'bg-(--ui-blue)',
  temporal: 'bg-(--ui-cyan)'
}

/** Reads the overview and the graph for the current mode; a sleeping local memory is woken once. */
function useAtlas() {
  const mode = useStore($atlasMode)
  const revision = useStore($atlasRevision)
  // Asked again once the backend is connected: a read sent before it would only report the socket.
  const connected = useStore($gatewayState) === 'open'
  const [phase, setPhase] = useState<Phase>('loading')
  const [message, setMessage] = useState('')
  const [overview, setOverview] = useState<AtlasOverview | null>(null)
  const [graph, setGraph] = useState<GraphData | null>(null)
  useEffect(() => {
    if (!connected) {
      return
    }

    let live = true

    const load = async () => {
      const reply = await fetchAtlasOverview()

      if (!live) {
        return
      }

      if (reply.state === 'asleep' && !$atlasWakeTried.get()) {
        $atlasWakeTried.set(true)
        setPhase('waking')
        const woke = await wakeAtlas().catch(() => null)

        if (live && woke?.state === 'ready') {
          refreshAtlas()
        } else if (live) {
          setPhase('asleep')
        }

        return
      }

      setOverview(reply.overview ?? null)
      setMessage(reply.message ?? '')
      setPhase(reply.state)
    }

    load().catch(error => {
      if (live) {
        setMessage(error instanceof Error ? error.message : String(error))
        setPhase('error')
      }
    })

    return () => {
      live = false
    }
  }, [connected, revision])

  useEffect(() => {
    if (phase !== 'ready') {
      return
    }

    let live = true

    setGraph(null)
    fetchAtlasGraph(mode).then(
      reply => live && setGraph(reply.state === 'ready' ? { links: reply.links ?? [], nodes: reply.nodes ?? [] } : { links: [], nodes: [] }),
      () => live && setGraph({ links: [], nodes: [] })
    )

    return () => {
      live = false
    }
  }, [mode, phase, revision])

  return { graph, message, mode, overview, phase }
}

function StateCard({
  action,
  body,
  icon,
  spin = false,
  title
}: {
  action?: React.ReactNode
  body: string
  icon: string
  spin?: boolean
  title: string
}) {
  return (
    <div className="grid size-full place-items-center p-8">
      <div className="max-w-sm text-center">
        <span className="mx-auto mb-4 grid size-11 place-items-center rounded-2xl bg-(--ui-bg-tertiary) text-(--ui-text-tertiary)">
          <Codicon name={icon} size="1.125rem" spinning={spin} />
        </span>
        <div className="text-sm font-medium text-(--ui-text-primary)">{title}</div>
        <p className="mt-1.5 mb-0 text-xs leading-relaxed text-(--ui-text-tertiary)">{body}</p>
        {action && <div className="mt-4">{action}</div>}
      </div>
    </div>
  )
}

interface LibraryMemoryProps {
  actions: React.ReactNode
  tabs: React.ReactNode
  /** The toolbar's view buttons, so the way back to the items stays where it was. */
  tools: React.ReactNode
}

/** All as the agent's memory: its graph, large, with the memory at a glance beside it. */
export function LibraryMemory({ actions, tabs, tools }: LibraryMemoryProps) {
  const copy = useI18n().t.library.home
  const { graph, message, mode, overview, phase } = useAtlas()

  const onSelect = useCallback(
    (node: AtlasNode | null) =>
      $atlasSelection.set(node ? { id: node.id, kind: selectionKindFor($atlasMode.get()), label: node.label } : null),
    []
  )

  const retry = <Button onClick={refreshAtlas} size="sm" variant="outline">{copy.retry}</Button>

  const states: Partial<Record<Phase, React.ReactNode>> = {
    asleep: <StateCard action={retry} body={copy.asleepBody} icon="debug-pause" title={copy.asleepTitle} />,
    error: <StateCard action={retry} body={message || copy.errorBody} icon="warning" title={copy.errorTitle} />,
    provider: <StateCard body={copy.providerBody} icon="database" title={copy.providerTitle} />,
    waking: <StateCard body={copy.wakingBody} icon="loading" spin title={copy.wakingTitle} />
  }

  const counts = overview?.counts

  const modeOptions = ATLAS_MODES.filter(id => id !== 'experience' || (counts?.experience ?? 0) > 0).map(id => ({
    id,
    label: counts ? `${copy.modes[id]}  ${id === 'entities' ? counts.entities : counts[id]}` : copy.modes[id]
  }))

  return (
    <>
      <LibraryHeader actions={actions} tabs={tabs} tools={tools} />
      <div className="library-home-frame min-h-0 flex-1 px-8 pb-6" data-library-home>
      <div className="library-home h-full">
        <section className="library-home-graph relative flex min-h-0 flex-col overflow-hidden rounded-2xl border border-(--ui-stroke-tertiary) bg-(--ui-bg-editor)">
          <div className="flex flex-wrap items-center gap-3 px-4 pt-3.5">
            <div className="mr-auto">
              <div className="text-[0.9375rem] font-semibold tracking-tight text-(--ui-text-primary)">{copy.memory}</div>
              <div className="text-[0.6875rem] text-(--ui-text-tertiary)">{copy.graphHint}</div>
            </div>
            {phase === 'ready' && (
              <SegmentedControl
                className="[&>button]:px-3 [&>button]:py-1 [&>button]:text-xs [&>button]:whitespace-pre"
                onChange={id => {
                  $atlasSelection.set(null)
                  $atlasMode.set(id)
                }}
                options={modeOptions}
                sizing="content"
                value={mode}
              />
            )}
          </div>

          <div className="relative min-h-0 flex-1">
            {phase === 'ready' ? (
              !graph ? (
                <div className="grid size-full place-items-center">
                  <Loader />
                </div>
              ) : graph.nodes.length ? (
                <AtlasGraph
                  links={graph.links}
                  mode={mode}
                  nodes={graph.nodes}
                  onSelect={onSelect}
                />
              ) : (
                <StateCard body={copy.emptyModeBody} icon="circle-large-outline" title={copy.emptyModeTitle(copy.modes[mode])} />
              )
            ) : phase === 'loading' ? (
              <div className="grid size-full place-items-center">
                <Loader />
              </div>
            ) : (
              states[phase]
            )}
          </div>

          {phase === 'ready' && graph && graph.nodes.length > 0 && (
            <div className="pointer-events-none flex flex-wrap items-center gap-x-4 gap-y-1 px-4 pb-3 text-[0.6875rem] text-(--ui-text-tertiary)">
              <span className="tabular-nums">{copy.graphCount(graph.nodes.length, graph.links.length)}</span>
              <span className="flex items-center gap-1.5">
                {copy.few}
                <span className="library-home-heat h-1.5 w-14 rounded-full" />
                {copy.many}
              </span>
              <span className="ml-auto flex flex-wrap items-center gap-3">
                {LINK_KINDS.filter(kind => graph.links.some(link => link.type === kind)).map(kind => (
                  <span className="flex items-center gap-1.5" key={kind}>
                    <span className={`size-1.5 rounded-full ${LINK_DOT[kind]}`} />
                    {copy.linkKinds[kind]}
                  </span>
                ))}
              </span>
            </div>
          )}
        </section>

        <aside className="library-home-side relative min-h-0 overflow-hidden rounded-2xl border border-(--ui-stroke-tertiary)">
          <div className="size-full overflow-y-auto">
            {overview && phase === 'ready' ? (
              <AtlasSide overview={overview} />
            ) : (
              <div className="px-5 py-4 text-xs leading-relaxed text-(--ui-text-tertiary)">{copy.sideIdle}</div>
            )}
          </div>
          <AtlasDetail />
        </aside>
      </div>
      </div>
    </>
  )
}

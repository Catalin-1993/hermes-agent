/**
 * Settings of an Image or Video step: what to generate, an optional image to start from, the format
 * (and, for a video, resolution and length). The backend and model are the agent's own (Settings ▸
 * Tools), so this says which one runs and, when none is set up, that nothing will until it is.
 */

import { useQuery } from '@hermes/plugin-sdk'

import { fetchMediaStatus, type ImageAspect, keys, type NodeConfigs, VIDEO_ASPECTS, VIDEO_RESOLUTIONS } from './api'
import { Notice } from './connect'
import { COPY } from './copy'
import { Choice, TextInput } from './fields'
import { Field, FIELD, HINT } from './ui'

const M = COPY.media

type Patch<K extends 'image' | 'video'> = (config: Partial<NodeConfigs[K]>, record: boolean) => void

function Backend({ kind }: { kind: 'image' | 'video' }) {
  const { data } = useQuery({ queryFn: fetchMediaStatus, queryKey: keys.media, staleTime: 30_000 })
  const state = data?.[kind]

  if (!state) {
    return null
  }

  return state.ready ? (
    <p className={HINT}>{M.uses(state.provider, state.model)}</p>
  ) : (
    <Notice tone="warn">{M.notReady(kind === 'image' ? M.images : M.videos)}</Notice>
  )
}

function Common({
  config,
  kind,
  patch
}: {
  config: NodeConfigs['image'] | NodeConfigs['video']
  kind: 'image' | 'video'
  patch: (config: { prompt?: string; source?: string }, record: boolean) => void
}) {
  return (
    <>
      <Backend kind={kind} />
      <Field label={M.prompt}>
        <TextInput
          multiline
          onChange={(prompt, record) => patch({ prompt }, record)}
          placeholder={kind === 'image' ? M.promptPlaceholder : M.videoPromptPlaceholder}
          rows={5}
          value={config.prompt}
        />
      </Field>
      <Field hint={M.sourceHint} label={M.source}>
        <TextInput
          mono
          onChange={(source, record) => patch({ source }, record)}
          placeholder={M.sourcePlaceholder}
          value={config.source}
        />
      </Field>
    </>
  )
}

export function ImageSettings({ config, patch }: { config: NodeConfigs['image']; patch: Patch<'image'> }) {
  const aspects = (Object.keys(M.aspects) as ImageAspect[]).map(value => ({ label: M.aspects[value], value }))

  return (
    <>
      <Common config={config} kind="image" patch={patch} />
      <Field label={M.aspect}>
        <Choice
          label={M.aspect}
          onChange={aspect_ratio => patch({ aspect_ratio }, true)}
          options={aspects}
          value={config.aspect_ratio}
        />
      </Field>
    </>
  )
}

export function VideoSettings({ config, patch }: { config: NodeConfigs['video']; patch: Patch<'video'> }) {
  return (
    <>
      <Common config={config} kind="video" patch={patch} />
      <div className="grid grid-cols-2 gap-2">
        <Field label={M.aspect}>
          <Choice
            label={M.aspect}
            onChange={aspect_ratio => patch({ aspect_ratio }, true)}
            options={VIDEO_ASPECTS.map(value => ({ label: value, value }))}
            value={config.aspect_ratio}
          />
        </Field>
        <Field label={M.resolution}>
          <Choice
            label={M.resolution}
            onChange={resolution => patch({ resolution }, true)}
            options={VIDEO_RESOLUTIONS.map(value => ({ label: value, value }))}
            value={config.resolution}
          />
        </Field>
      </div>
      <Field hint={M.durationHint} label={M.duration}>
        <input
          className={FIELD}
          max={60}
          min={0}
          onChange={e => patch({ duration: Math.min(60, Math.max(0, Math.round(Number(e.target.value) || 0))) }, true)}
          type="number"
          value={config.duration}
        />
      </Field>
    </>
  )
}

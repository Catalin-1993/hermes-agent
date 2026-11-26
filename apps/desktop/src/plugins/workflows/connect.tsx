/**
 * The settings of a trigger or an Output that reaches outside Brain: the webhook address and secret
 * (with a signed test), a GitHub repository and its events, the conversation a chat trigger listens to,
 * where an Output sends. Each says plainly what is not connected yet and offers the one action that
 * fixes it: start the gateway hooks, open the Webhooks page, set up the bot.
 */

import { cn, Codicon, ConfirmDialog, CopyButton, host, Switch, useQuery, useQueryClient } from '@hermes/plugin-sdk'
import { type ReactNode, useState } from 'react'

import {
  type ChatPlatform,
  type Connectors,
  enableConnectors,
  fetchConnectors,
  keys,
  type NodeConfigs,
  rotateHookSecret,
  testHook,
  type TriggerType
} from './api'
import { COPY } from './copy'
import type { Editor } from './editor-state'
import { Choice, TextInput } from './fields'
import { BTN, Field, FIELD, HINT, LABEL, MONO } from './ui'

const C = COPY.connect

export type Patch<K extends 'output' | 'trigger'> = (config: Partial<NodeConfigs[K]>, record: boolean) => void

export function useConnectors() {
  return useQuery({ queryFn: fetchConnectors, queryKey: keys.connectors, staleTime: 20_000 }).data
}

type Tone = 'info' | 'ok' | 'warn'

const TONE: Record<Tone, { bg: string; icon: string; mark: string }> = {
  info: { bg: 'border border-(--card-stroke)', icon: 'info', mark: 'text-(--ui-text-tertiary)' },
  ok: { bg: 'bg-[color-mix(in_srgb,var(--ui-green)_10%,transparent)]', icon: 'pass', mark: 'text-(--ui-green)' },
  warn: { bg: 'bg-[color-mix(in_srgb,var(--ui-yellow)_12%,transparent)]', icon: 'warning', mark: 'text-(--ui-yellow)' }
}

export function Notice({ action, children, tone = 'info' }: { action?: ReactNode; children: ReactNode; tone?: Tone }) {
  return (
    <div
      className={cn(
        'flex flex-col gap-2 rounded-[10px] px-3 py-2.5 text-[0.75rem] leading-relaxed text-(--ui-text-primary)',
        TONE[tone].bg
      )}
    >
      <p className="m-0 flex items-start gap-2">
        <Codicon className={cn('mt-0.5 shrink-0', TONE[tone].mark)} name={TONE[tone].icon} size="0.8125rem" />
        <span>{children}</span>
      </p>
      {action && <div className="flex flex-wrap gap-2 pl-5">{action}</div>}
    </div>
  )
}

/** The gateway hooks every webhook, GitHub and chat trigger depends on, switched on in one click. */
function HooksNotice({ connectors }: { connectors: Connectors }) {
  const queryClient = useQueryClient()
  const [state, setState] = useState<'busy' | 'failed' | 'idle' | 'restart'>('idle')

  if (connectors.hooks && state !== 'restart') {
    return null
  }

  if (state === 'restart') {
    return <Notice tone="ok">{C.hooksRestart}</Notice>
  }

  const enable = () => {
    setState('busy')
    enableConnectors()
      .then(next => {
        queryClient.setQueryData(keys.connectors, next)
        setState(next.restart_required ? 'restart' : 'idle')
      })
      .catch(() => {
        // A slow answer can fail here after the switch went through: ask again what is on.
        void queryClient.invalidateQueries({ queryKey: keys.connectors })
        setState('failed')
      })
  }

  return (
    <Notice
      action={
        <button className={BTN} disabled={state === 'busy'} onClick={enable} type="button">
          <Codicon name="plug" size="0.8125rem" />
          {state === 'busy' ? C.hooksBusy : C.hooksOn}
        </button>
      }
      tone="warn"
    >
      {state === 'failed' ? C.hooksFailed : C.hooksOff}
    </Notice>
  )
}

function SecretField({ secret }: { secret: string }) {
  const [shown, setShown] = useState(false)

  return (
    <div className="flex items-center gap-1.5">
      <input
        aria-label={C.secret}
        className={cn(FIELD, MONO, 'text-[0.75rem]')}
        readOnly
        type={shown ? 'text' : 'password'}
        value={secret}
      />
      <button className={cn(BTN, 'px-2.5')} onClick={() => setShown(!shown)} type="button">
        {shown ? C.hide : C.show}
      </button>
      <CopyButton text={secret} />
    </div>
  )
}

function curlExample(url: string, secret: string): string {
  return [
    `BODY='{"text":"salut"}'; TS=$(date +%s)`,
    `SIG=$(printf '%s.%s' "$TS" "$BODY" | openssl dgst -sha256 -hmac '${secret}' | sed 's/^.* //')`,
    `curl -X POST '${url}' -H 'Content-Type: application/json' \\`,
    `  -H "X-Webhook-Timestamp: $TS" -H "X-Webhook-Signature-V2: $SIG" -d "$BODY"`
  ].join('\n')
}

/** Address, secret, test and rotation of a webhook or GitHub trigger. */
export function HookPanel({ editor, type, workflowId }: { editor: Editor; type: TriggerType; workflowId: string }) {
  const hook = editor.meta.hook
  const [test, setTest] = useState<{ ok: boolean; text: string } | 'busy' | null>(null)
  const [confirm, setConfirm] = useState(false)

  if (!hook) {
    return <p className={HINT}>{C.preparing}</p>
  }

  const send = () => {
    setTest('busy')
    testHook(workflowId)
      .then(({ body, status }) =>
        setTest(status < 300 ? { ok: true, text: C.testOk } : { ok: false, text: C.testRefused(status, body) })
      )
      .catch((error: Error) => setTest({ ok: false, text: error.message }))
  }

  return (
    <>
      {!hook.server_enabled && (
        <Notice
          action={
            <button className={BTN} onClick={() => host.navigate('/webhooks')} type="button">
              <Codicon name="link-external" size="0.8125rem" />
              {C.openWebhooks}
            </button>
          }
          tone="warn"
        >
          {C.webhookOff}
        </Notice>
      )}
      {hook.server_enabled && !hook.route_enabled && <Notice tone="warn">{C.routeOff}</Notice>}
      <div className="flex flex-col gap-1.5">
        <span className={LABEL}>{C.url}</span>
        <div className="flex items-center gap-1.5">
          <input className={cn(FIELD, MONO, 'text-[0.75rem]')} readOnly value={hook.url} />
          <CopyButton text={hook.url} />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <span className={LABEL}>{C.secret}</span>
        <SecretField secret={hook.secret} />
      </div>
      <div className="flex flex-wrap gap-2">
        <button className={BTN} disabled={test === 'busy' || !hook.server_enabled} onClick={send} type="button">
          <Codicon name="debug-start" size="0.8125rem" />
          {test === 'busy' ? C.testing : C.test}
        </button>
        <button className={BTN} onClick={() => setConfirm(true)} type="button">
          <Codicon name="refresh" size="0.8125rem" />
          {C.rotate}
        </button>
      </div>
      {test && test !== 'busy' && <Notice tone={test.ok ? 'ok' : 'warn'}>{test.text}</Notice>}
      <p className={HINT}>{type === 'github' ? C.githubHelp : C.webhookHelp}</p>
      {type === 'webhook' && (
        <details className="group">
          <summary className={cn(LABEL, 'cursor-pointer select-none')}>{C.example}</summary>
          <div className="relative mt-2">
            <pre
              className={cn(
                MONO,
                'm-0 overflow-x-auto rounded-[10px] bg-(--card-well) p-3 text-[0.6875rem] leading-relaxed text-(--ui-text-secondary)'
              )}
            >
              {curlExample(hook.url, hook.secret)}
            </pre>
            <span className="absolute top-1.5 right-1.5">
              <CopyButton text={curlExample(hook.url, hook.secret)} />
            </span>
          </div>
        </details>
      )}
      <ConfirmDialog
        busyLabel={C.rotateBusy}
        confirmLabel={C.rotate}
        description={C.rotateDescription}
        onClose={() => setConfirm(false)}
        onConfirm={async () => {
          editor.refresh(await rotateHookSecret(workflowId))
          setTest({ ok: true, text: C.rotated })
        }}
        open={confirm}
        title={C.rotateTitle}
      />
    </>
  )
}

const GITHUB_EVENTS = [
  'push',
  'pull_request',
  'pull_request.opened',
  'issues',
  'issues.opened',
  'issue_comment',
  'release',
  'workflow_run'
]

export function GithubFields({ config, patch }: { config: NodeConfigs['trigger']; patch: Patch<'trigger'> }) {
  const [custom, setCustom] = useState('')

  const toggle = (event: string) =>
    patch(
      { events: config.events.includes(event) ? config.events.filter(e => e !== event) : [...config.events, event] },
      true
    )

  const addCustom = () => {
    const event = custom.trim().toLowerCase()

    if (/^[a-z_]+(\.[a-z_]+)?$/.test(event) && !config.events.includes(event)) {
      patch({ events: [...config.events, event] }, true)
    }

    setCustom('')
  }

  const extra = config.events.filter(event => !GITHUB_EVENTS.includes(event))

  return (
    <>
      <Field label={C.repository}>
        <TextInput
          mono
          onChange={(repository, record) => patch({ repository }, record)}
          placeholder={C.repositoryPlaceholder}
          value={config.repository}
        />
      </Field>
      <div className="flex flex-col gap-1.5">
        <span className={LABEL}>{C.events}</span>
        <div className="flex flex-wrap gap-1.5">
          {[...GITHUB_EVENTS, ...extra].map(event => {
            const on = config.events.includes(event)

            return (
              <button
                aria-label={on && extra.includes(event) ? C.removeEvent(event) : undefined}
                aria-pressed={on}
                className={cn(
                  MONO,
                  'inline-flex h-7 items-center gap-1 rounded-full border px-2.5 text-[0.6875rem] transition-colors',
                  on
                    ? 'border-(--ui-accent) bg-[color-mix(in_srgb,var(--ui-accent)_12%,transparent)] text-(--ui-text-primary)'
                    : 'border-(--card-stroke) text-(--ui-text-secondary) hover:border-(--ui-text-quaternary)'
                )}
                key={event}
                onClick={() => toggle(event)}
                type="button"
              >
                {on && <Codicon name="check" size="0.6875rem" />}
                {event}
              </button>
            )
          })}
        </div>
        <div className="flex gap-1.5">
          <input
            className={cn(FIELD, MONO, 'text-[0.75rem]')}
            onChange={e => setCustom(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addCustom())}
            placeholder={C.customEvent}
            value={custom}
          />
          <button className={BTN} disabled={!custom.trim()} onClick={addCustom} type="button">
            {C.addEvent}
          </button>
        </div>
        <span className={HINT}>{C.eventsHint}</span>
      </div>
    </>
  )
}

const OTHER = '__other'
const ANY = '__any'

function ConversationPicker({
  connectors,
  label,
  onChange,
  platform,
  value,
  empty
}: {
  connectors: Connectors | undefined
  empty: string
  label: string
  onChange: (value: string, record: boolean) => void
  platform: ChatPlatform
  value: string
}) {
  const channels = connectors?.platforms[platform].channels ?? []
  const known = !value || channels.some(channel => channel.id === value)
  const [other, setOther] = useState(!known)

  const options = [
    { label: empty, value: ANY },
    ...channels.map(channel => ({ label: channel.name, value: channel.id })),
    { label: C.otherConversation, value: OTHER }
  ]

  return (
    <>
      <Field label={label}>
        <Choice
          label={label}
          onChange={next => {
            setOther(next === OTHER)
            onChange(next === OTHER || next === ANY ? '' : next, true)
          }}
          options={options}
          value={other ? OTHER : value || ANY}
        />
      </Field>
      {other && (
        <Field label={C.conversationId}>
          <TextInput mono onChange={onChange} placeholder="-1001234567890" value={value} />
        </Field>
      )}
    </>
  )
}

export function ChatFields({
  config,
  connectors,
  patch,
  platform
}: {
  config: NodeConfigs['trigger']
  connectors: Connectors | undefined
  patch: Patch<'trigger'>
  platform: ChatPlatform
}) {
  const name = COPY.triggers[platform]

  return (
    <>
      {connectors && !connectors.platforms[platform].configured && <Notice tone="warn">{C.botMissing(name)}</Notice>}
      <ConversationPicker
        connectors={connectors}
        empty={C.anyConversation}
        label={C.conversation}
        onChange={(channel, record) => patch({ channel }, record)}
        platform={platform}
        value={config.channel}
      />
      <Field label={C.filter}>
        <TextInput
          onChange={(filter, record) => patch({ filter }, record)}
          placeholder={C.filterPlaceholder}
          value={config.filter}
        />
      </Field>
      <label className="flex items-start justify-between gap-3">
        <span className="flex flex-col gap-0.5">
          <span className={LABEL}>{C.passThrough}</span>
          <span className={HINT}>{C.passThroughHint}</span>
        </span>
        <Switch checked={config.pass_through} onCheckedChange={pass_through => patch({ pass_through }, true)} />
      </label>
      {!config.channel && !config.filter.trim() && !config.pass_through && (
        <Notice tone="warn">{C.everyMessage(name)}</Notice>
      )}
      <p className={HINT}>{C.chatInput}</p>
    </>
  )
}

/** The part of a trigger's settings that depends on the outside: hooks, address, conversation. */
export function ExternalTrigger({
  config,
  editor,
  patch,
  workflowId
}: {
  config: NodeConfigs['trigger']
  editor: Editor
  patch: Patch<'trigger'>
  workflowId: string
}) {
  const connectors = useConnectors()
  const type = config.type

  return (
    <>
      {connectors && <HooksNotice connectors={connectors} />}
      {type === 'github' && <GithubFields config={config} patch={patch} />}
      {(type === 'webhook' || type === 'github') && <HookPanel editor={editor} type={type} workflowId={workflowId} />}
      {(type === 'telegram' || type === 'discord' || type === 'slack') && (
        <ChatFields config={config} connectors={connectors} patch={patch} platform={type} />
      )}
    </>
  )
}

/** Where an Output goes, for every channel but the in-app notification. */
export function OutputTarget({
  config,
  patch,
  triggerType
}: {
  config: NodeConfigs['output']
  patch: Patch<'output'>
  triggerType: TriggerType
}) {
  const connectors = useConnectors()
  const channel = config.channel

  if (channel === 'chat') {
    const fits = triggerType === 'telegram' || triggerType === 'discord' || triggerType === 'slack'

    return <Notice tone={fits ? 'info' : 'warn'}>{fits ? C.chatReply : C.chatNeedsTrigger}</Notice>
  }

  if (channel === 'github') {
    return (
      <>
        {connectors && !connectors.gh && <Notice tone="warn">{C.ghMissing}</Notice>}
        <Field label={C.githubTarget}>
          <TextInput
            mono
            onChange={(target, record) => patch({ target }, record)}
            placeholder={C.githubTargetPlaceholder}
            value={config.target}
          />
        </Field>
      </>
    )
  }

  if (channel === 'telegram' || channel === 'discord' || channel === 'slack') {
    const state = connectors?.platforms[channel]
    const name = COPY.triggers[channel]

    return (
      <>
        {state && !state.configured && <Notice tone="warn">{C.botMissing(name)}</Notice>}
        <ConversationPicker
          connectors={connectors}
          empty={C.homeChannel}
          label={C.conversation}
          onChange={(target, record) => patch({ target }, record)}
          platform={channel}
          value={config.target}
        />
        {state?.configured && !state.home && !config.target && <Notice tone="warn">{C.noHome(name)}</Notice>}
      </>
    )
  }

  return null
}

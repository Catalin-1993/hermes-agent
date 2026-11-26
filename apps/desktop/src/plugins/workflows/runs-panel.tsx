/**
 * The right panel's Runs tab: every run of the workflow, newest first, and one run opened — each
 * step's status, output and error, in the order the run reached them. A run that waits for the
 * owner shows its question here: Approve / Reject, or the Answer's fields. A run never blocks the
 * page: it is followed by polling while anything is still in flight.
 */

import { cn, Codicon, CopyButton, host, MessageTextContent, Switch, useQuery, useQueryClient } from '@hermes/plugin-sdk'
import { useMemo, useState } from 'react'

import {
  ACTIVE_RUN,
  type AnswerField,
  cancelRun,
  fetchRun,
  fetchRuns,
  keys,
  type NodeConfigs,
  replyToRun,
  type RunDetail,
  type RunStep,
  type RunSummary,
  type WorkflowNode
} from './api'
import { COPY } from './copy'
import { runOrder } from './doc'
import { KIND_ICON, KIND_TONE, nodeLabel } from './kinds'
import {
  BTN_DANGER,
  BTN_PRIMARY,
  clock,
  FIELD,
  HINT,
  KindTile,
  LABEL,
  MONO,
  StatusMark,
  StatusPill,
  TEXTAREA
} from './ui'

const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error))

function RunRow({ onOpen, run }: { onOpen: () => void; run: RunSummary }) {
  const done = run.counts?.succeeded ?? 0
  const total = Object.values(run.counts ?? {}).reduce((a, b) => a + (b ?? 0), 0)

  return (
    <button
      className="flex w-full items-center gap-3 rounded-[12px] px-3 py-2.5 text-left transition-colors hover:bg-(--card-well)"
      onClick={onOpen}
      type="button"
    >
      <StatusMark status={run.status} />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-[0.8125rem] font-medium text-(--ui-text-primary)">
          {COPY.runs.status[run.status]} · {COPY.runs.modes[run.mode]}
        </span>
        <span className="truncate text-[0.71875rem] text-(--ui-text-tertiary)">
          {clock(run.created_at)} · {COPY.runs.triggers(run.trigger.type)} · {COPY.runs.version(run.version)}
          {total ? ` · ${done}/${total}` : ''}
        </span>
      </span>
      <Codicon className="text-(--ui-text-tertiary)" name="chevron-right" size="0.8125rem" />
    </button>
  )
}

function ApprovalReply({ nodeId, run }: { nodeId: string; run: RunDetail }) {
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const queryClient = useQueryClient()

  const send = async (approved: boolean) => {
    setBusy(true)

    try {
      await replyToRun(run.id, { approved, node_id: nodeId, note })
      await queryClient.invalidateQueries({ queryKey: ['workflows'] })
    } catch (error) {
      host.notify({ kind: 'error', message: errorText(error) })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <input className={FIELD} onChange={e => setNote(e.target.value)} placeholder={COPY.runs.note} value={note} />
      <div className="flex gap-2">
        <button className={BTN_PRIMARY} disabled={busy} onClick={() => void send(true)} type="button">
          <Codicon name="check" size="0.8125rem" />
          {COPY.runs.approve}
        </button>
        <button className={BTN_DANGER} disabled={busy} onClick={() => void send(false)} type="button">
          <Codicon name="close" size="0.8125rem" />
          {COPY.runs.reject}
        </button>
      </div>
    </div>
  )
}

function AnswerInput({
  field,
  onChange,
  value
}: {
  field: AnswerField
  onChange: (v: unknown) => void
  value: unknown
}) {
  if (field.type === 'boolean') {
    return <Switch checked={value === true} onCheckedChange={onChange} />
  }

  if (field.type === 'list' && field.options.length) {
    return (
      <select className={FIELD} onChange={e => onChange(e.target.value)} value={String(value ?? '')}>
        <option value="" />
        {field.options.map(option => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    )
  }

  if (field.type === 'list') {
    return (
      <textarea
        className={TEXTAREA}
        onChange={e => onChange(e.target.value)}
        placeholder="unu, doi, trei"
        rows={2}
        value={String(value ?? '')}
      />
    )
  }

  return (
    <input
      className={FIELD}
      inputMode={field.type === 'number' ? 'decimal' : undefined}
      onChange={e => onChange(e.target.value)}
      value={String(value ?? '')}
    />
  )
}

function AnswerReply({ fields, nodeId, run }: { fields: AnswerField[]; nodeId: string; run: RunDetail }) {
  const [values, setValues] = useState<Record<string, unknown>>(() =>
    Object.fromEntries(fields.map(f => [f.key, f.type === 'boolean' ? false : '']))
  )

  const [mode, setMode] = useState<'form' | 'json'>('form')
  const [raw, setRaw] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const queryClient = useQueryClient()

  const submit = async () => {
    setError('')
    let payload: Record<string, unknown> = values

    if (mode === 'json') {
      try {
        payload = JSON.parse(raw || '{}')
      } catch {
        setError('JSON-ul nu e valid.')

        return
      }
    }

    setBusy(true)

    try {
      await replyToRun(run.id, { node_id: nodeId, values: payload })
      await queryClient.invalidateQueries({ queryKey: ['workflows'] })
    } catch (e) {
      setError(errorText(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-1 self-start rounded-[9px] bg-(--card-well) p-0.5">
        {(['form', 'json'] as const).map(m => (
          <button
            aria-pressed={mode === m}
            className={cn(
              'rounded-[7px] px-2.5 py-1 text-[0.71875rem] font-medium',
              mode === m
                ? 'bg-(--card-surface) text-(--ui-text-primary) shadow-(--card-shadow)'
                : 'text-(--ui-text-tertiary)'
            )}
            key={m}
            onClick={() => {
              setMode(m)
              setRaw(JSON.stringify(values, null, 2))
            }}
            type="button"
          >
            {m === 'form' ? 'Formular' : 'JSON'}
          </button>
        ))}
      </div>
      {mode === 'form' ? (
        fields.map(field => (
          <label className="flex flex-col gap-1.5" key={field.key}>
            <span className={LABEL}>
              {field.label}
              {field.required && <span className="text-(--ui-red)"> *</span>}
            </span>
            <AnswerInput
              field={field}
              onChange={v => setValues(c => ({ ...c, [field.key]: v }))}
              value={values[field.key]}
            />
          </label>
        ))
      ) : (
        <textarea className={cn(TEXTAREA, MONO)} onChange={e => setRaw(e.target.value)} rows={6} value={raw} />
      )}
      {error && <p className="m-0 text-[0.75rem] text-(--ui-red)">{error}</p>}
      <button className={cn(BTN_PRIMARY, 'self-start')} disabled={busy} onClick={() => void submit()} type="button">
        <Codicon name="send" size="0.8125rem" />
        {COPY.runs.submit}
      </button>
    </div>
  )
}

/** An opened step: its error, its output (copyable), and the reply it waits for. */
function StepBody({
  node,
  run,
  step,
  waiting
}: {
  node: WorkflowNode
  run: RunDetail
  step: RunStep
  waiting: boolean
}) {
  return (
    <div className="flex flex-col gap-2.5 border-t border-(--card-well-stroke) px-3 py-3">
      {step.error && (
        <p className="m-0 rounded-[10px] bg-[color-mix(in_srgb,var(--ui-red)_10%,transparent)] px-3 py-2 text-[0.75rem] whitespace-pre-wrap text-(--ui-red)">
          {step.error}
        </p>
      )}
      {step.status === 'succeeded' && step.output && (node.kind === 'image' || node.kind === 'video') && (
        <div className="overflow-hidden rounded-[10px] text-[0.8125rem]">
          <MessageTextContent text={`MEDIA:${step.output}`} />
        </div>
      )}
      {step.output && (
        <div className="group relative">
          <pre
            className={cn(
              MONO,
              'm-0 max-h-72 overflow-auto rounded-[10px] bg-(--card-well) px-3 py-2 text-[0.71875rem] leading-relaxed whitespace-pre-wrap text-(--ui-text-primary)'
            )}
          >
            {step.output}
          </pre>
          <span className="absolute top-1.5 right-1.5 opacity-0 transition-opacity group-hover:opacity-100">
            <CopyButton text={step.output} />
          </span>
        </div>
      )}
      {waiting && node.kind === 'approval' && <ApprovalReply nodeId={node.id} run={run} />}
      {waiting && node.kind === 'answer' && (
        <AnswerReply fields={(node.config as NodeConfigs['answer']).fields} nodeId={node.id} run={run} />
      )}
    </div>
  )
}

function StepBlock({ run, step }: { run: RunDetail; step: RunStep }) {
  const node = run.doc.nodes.find(n => n.id === step.node_id)
  const [open, setOpen] = useState(step.status !== 'skipped' && step.status !== 'pending')

  if (!node) {
    return null
  }

  const waiting = run.status === 'waiting' && run.waiting_node === step.node_id
  const seconds = step.started_at && step.finished_at ? step.finished_at - step.started_at : null

  const branch =
    node.kind === 'condition' && step.data ? (step.data.branch === 'yes' ? COPY.branch.yes : COPY.branch.no) : null

  return (
    <div
      className={cn(
        'rounded-[14px] border border-(--card-stroke) bg-(--card-surface)',
        waiting && 'border-(--ui-orange)'
      )}
    >
      <button
        className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left"
        onClick={() => setOpen(o => !o)}
        type="button"
      >
        <KindTile icon={KIND_ICON[node.kind]} size="sm" tone={KIND_TONE[node.kind]} />
        <span className="min-w-0 flex-1 truncate text-[0.8125rem] font-medium text-(--ui-text-primary)">
          {nodeLabel(node)}
        </span>
        {branch && (
          <span className="rounded-full bg-(--card-well) px-2 py-0.5 text-[0.6875rem] text-(--ui-text-secondary)">
            {branch}
          </span>
        )}
        {seconds !== null && (
          <span className="text-[0.6875rem] text-(--ui-text-tertiary) tabular-nums">{COPY.runs.duration(seconds)}</span>
        )}
        <StatusPill kind="step" status={step.status} />
      </button>
      {(open || waiting) && (step.output || step.error || waiting) && (
        <StepBody node={node} run={run} step={step} waiting={waiting} />
      )}
    </div>
  )
}

function RunView({
  onBack,
  overlay,
  runId,
  setOverlay
}: {
  onBack: () => void
  overlay: boolean
  runId: string
  setOverlay: (on: boolean) => void
}) {
  const { data: run, error } = useQuery({
    queryFn: () => fetchRun(runId),
    queryKey: keys.run(runId),
    refetchInterval: query => (query.state.data && !ACTIVE_RUN.includes(query.state.data.status) ? false : 1_500)
  })

  const queryClient = useQueryClient()
  const order = useMemo(() => (run ? runOrder(run.doc) : []), [run])

  const steps = useMemo(
    () => (run ? [...run.steps].sort((a, b) => order.indexOf(a.node_id) - order.indexOf(b.node_id)) : []),
    [order, run]
  )

  return (
    <div className="flex flex-col gap-3 px-4 py-4">
      <button
        className="flex items-center gap-1.5 self-start text-[0.75rem] text-(--ui-text-secondary) hover:text-(--ui-text-primary)"
        onClick={onBack}
        type="button"
      >
        <Codicon name="arrow-left" size="0.75rem" />
        {COPY.runs.back}
      </button>
      {error && <p className="m-0 text-[0.8125rem] text-(--ui-red)">{errorText(error)}</p>}
      {run && (
        <>
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 flex-col gap-1">
              <StatusPill kind="run" status={run.status} />
              <span className="text-[0.75rem] text-(--ui-text-tertiary)">
                {clock(run.created_at)} · {COPY.runs.modes[run.mode]} · {COPY.runs.version(run.version)}
                {run.finished_at && run.started_at ? ` · ${COPY.runs.duration(run.finished_at - run.started_at)}` : ''}
              </span>
            </div>
            {ACTIVE_RUN.includes(run.status) && (
              <button
                className={BTN_DANGER}
                onClick={() =>
                  void cancelRun(run.id)
                    .then(() => queryClient.invalidateQueries({ queryKey: ['workflows'] }))
                    .catch(e => host.notify({ kind: 'error', message: errorText(e) }))
                }
                type="button"
              >
                <Codicon name="debug-stop" size="0.8125rem" />
                {COPY.runs.cancel}
              </button>
            )}
          </div>
          {run.error && run.status !== 'cancelled' && (
            <p className="m-0 rounded-[10px] bg-[color-mix(in_srgb,var(--ui-red)_10%,transparent)] px-3 py-2 text-[0.75rem] text-(--ui-red)">
              {run.error}
            </p>
          )}
          <label className="flex items-center justify-between gap-2 text-[0.75rem] text-(--ui-text-secondary)">
            {COPY.runs.showOnCanvas}
            <Switch checked={overlay} onCheckedChange={setOverlay} size="xs" />
          </label>
          <div className="flex flex-col gap-2">
            {steps.map(step => (
              <StepBlock key={step.node_id} run={run} step={step} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

export interface RunsPanelProps {
  onOpenRun: (id: null | string) => void
  openRun: null | string
  overlay: boolean
  setOverlay: (on: boolean) => void
  workflowId: string
}

export function RunsPanel({ onOpenRun, openRun, overlay, setOverlay, workflowId }: RunsPanelProps) {
  const { data: runs, isLoading } = useQuery({
    queryFn: () => fetchRuns(workflowId),
    queryKey: keys.runs(workflowId),
    refetchInterval: query => (query.state.data?.some(r => ACTIVE_RUN.includes(r.status)) ? 2_000 : 15_000)
  })

  if (openRun) {
    return <RunView onBack={() => onOpenRun(null)} overlay={overlay} runId={openRun} setOverlay={setOverlay} />
  }

  if (isLoading) {
    return <p className={cn(HINT, 'px-4 py-4')}>…</p>
  }

  if (!runs?.length) {
    return (
      <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
        <Codicon className="text-(--ui-text-tertiary)" name="history" size="1.5rem" />
        <span className="text-[0.875rem] font-medium text-(--ui-text-primary)">{COPY.runs.empty}</span>
        <span className={HINT}>{COPY.runs.emptyHint}</span>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-0.5 px-2 py-2">
      {runs.map(run => (
        <RunRow key={run.id} onOpen={() => onOpenRun(run.id)} run={run} />
      ))}
    </div>
  )
}

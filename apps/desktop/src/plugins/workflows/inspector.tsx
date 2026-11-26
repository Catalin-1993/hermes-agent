/**
 * The right panel's Settings tab: the selected step's settings, or the workflow's own when nothing
 * is selected. Every change is an edit of the document (undoable, autosaved); text fields record one
 * history entry per field focus, so typing a prompt is one undo, not one per letter.
 */

import { cn, Codicon, Switch, useQuery } from '@hermes/plugin-sdk'
import { type ReactNode, useEffect, useState } from 'react'

import {
  type AnswerField,
  type AnswerFieldType,
  checkRule,
  fetchAgents,
  keys,
  type NodeConfigs,
  type NodeKind,
  type NoteColor,
  type OutputChannel,
  type ScheduleMode,
  type ShapeKind,
  type TriggerType,
  type WorkflowNode
} from './api'
import { ExternalTrigger, OutputTarget } from './connect'
import { COPY, WEEKDAYS } from './copy'
import { findNode, removeNodes, updateNode } from './doc'
import type { Editor } from './editor-state'
import { Choice, TextInput } from './fields'
import { KIND_ICON, KIND_TONE, nodeLabel, TRIGGER_ICON } from './kinds'
import { ImageSettings, VideoSettings } from './media-settings'
import { BTN, BTN_DANGER, Field, FIELD, HINT, KindTile, LABEL, MONO, Section } from './ui'

type Patch<K extends NodeKind> = (config: Partial<NodeConfigs[K]>) => void

function ScheduleFields({ config, patch }: { config: NodeConfigs['trigger']; patch: Patch<'trigger'> }) {
  const s = config.schedule
  const set = (next: Partial<NodeConfigs['trigger']['schedule']>) => patch({ schedule: { ...s, ...next } })
  const modes = Object.entries(COPY.schedule.modes).map(([value, label]) => ({ label, value: value as ScheduleMode }))

  return (
    <>
      <Field label={COPY.schedule.mode}>
        <Choice label={COPY.schedule.mode} onChange={mode => set({ mode })} options={modes} value={s.mode} />
      </Field>
      {s.mode === 'weekly' && (
        <Field label={COPY.schedule.day}>
          <Choice
            label={COPY.schedule.day}
            onChange={day => set({ weekday: Number(day) })}
            options={WEEKDAYS.map((label, index) => ({ label, value: String(index) }))}
            value={String(s.weekday)}
          />
        </Field>
      )}
      {['daily', 'weekdays', 'weekly'].includes(s.mode) && (
        <Field label={COPY.schedule.time}>
          <input
            className={FIELD}
            onChange={e => set({ time: e.target.value || '09:00' })}
            type="time"
            value={s.time}
          />
        </Field>
      )}
      {s.mode === 'hourly' && (
        <Field label={COPY.schedule.minute}>
          <input
            className={FIELD}
            max={59}
            min={0}
            onChange={e => set({ minute: Math.min(59, Math.max(0, Number(e.target.value) || 0)) })}
            type="number"
            value={s.minute}
          />
        </Field>
      )}
      {s.mode === 'cron' && (
        <Field hint={COPY.schedule.cronHint} label={COPY.schedule.cron}>
          <input
            className={cn(FIELD, MONO)}
            onChange={e => set({ cron: e.target.value })}
            placeholder="0 9 * * 1-5"
            value={s.cron}
          />
        </Field>
      )}
    </>
  )
}

function TriggerSettings({
  config,
  editor,
  patch
}: {
  config: NodeConfigs['trigger']
  editor: Editor
  patch: (c: Partial<NodeConfigs['trigger']>, record: boolean) => void
}) {
  const types = (Object.keys(COPY.triggers) as TriggerType[]).map(value => ({ label: COPY.triggers[value], value }))

  return (
    <>
      <div className="grid grid-cols-4 gap-1.5">
        {types.map(type => (
          <button
            aria-pressed={config.type === type.value}
            className={cn(
              'flex flex-col items-center gap-1 rounded-[10px] border px-1 py-2 text-[0.6875rem] transition-colors',
              config.type === type.value
                ? 'border-(--ui-accent) bg-[color-mix(in_srgb,var(--ui-accent)_10%,transparent)] text-(--ui-text-primary)'
                : 'border-(--card-stroke) text-(--ui-text-secondary) hover:border-(--ui-text-quaternary)'
            )}
            key={type.value}
            onClick={() => patch({ type: type.value }, true)}
            type="button"
          >
            <Codicon name={TRIGGER_ICON[type.value]} size="0.9375rem" />
            {type.label}
          </button>
        ))}
      </div>
      {config.type === 'schedule' && (
        <>
          <ScheduleFields config={config} patch={next => patch(next, true)} />
          <p className={HINT}>
            {editor.meta.next_run
              ? COPY.schedule.next(new Date(editor.meta.next_run).toLocaleString('ro-RO')) + ' · '
              : ''}
            {COPY.schedule.viaCron}
          </p>
        </>
      )}
      {!['manual', 'schedule'].includes(config.type) && (
        <ExternalTrigger config={config} editor={editor} patch={patch} workflowId={editor.id} />
      )}
    </>
  )
}

function AgentSettings({
  config,
  patch
}: {
  config: NodeConfigs['agent']
  patch: (c: Partial<NodeConfigs['agent']>, record: boolean) => void
}) {
  const { data: agents = [] } = useQuery({ queryFn: fetchAgents, queryKey: keys.agents, staleTime: 60_000 })

  const options = [
    { label: COPY.inspector.defaultAgent, value: '__default' },
    ...agents.filter(a => !a.default).map(a => ({ label: a.name, value: a.name }))
  ]

  return (
    <>
      <Field label={COPY.inspector.agent}>
        <Choice
          label={COPY.inspector.agent}
          onChange={value => patch({ agent: value === '__default' ? '' : value }, true)}
          options={options}
          value={config.agent || '__default'}
        />
      </Field>
      <Field label={COPY.inspector.task}>
        <TextInput
          multiline
          onChange={(task, record) => patch({ task }, record)}
          placeholder={COPY.inspector.taskPlaceholder}
          rows={6}
          value={config.task}
        />
      </Field>
      <Field label={COPY.inspector.timeout}>
        <input
          className={FIELD}
          max={240}
          min={1}
          onChange={e => patch({ timeout_min: Math.min(240, Math.max(1, Number(e.target.value) || 30)) }, true)}
          type="number"
          value={config.timeout_min}
        />
      </Field>
    </>
  )
}

function LlmSettings({
  config,
  patch
}: {
  config: NodeConfigs['llm']
  patch: (c: Partial<NodeConfigs['llm']>, record: boolean) => void
}) {
  return (
    <>
      <Field label={COPY.inspector.prompt}>
        <TextInput
          multiline
          onChange={(prompt, r) => patch({ prompt }, r)}
          placeholder={COPY.inspector.promptPlaceholder}
          rows={6}
          value={config.prompt}
        />
      </Field>
      <Field label={COPY.inspector.system}>
        <TextInput
          multiline
          onChange={(system, r) => patch({ system }, r)}
          placeholder={COPY.inspector.systemPlaceholder}
          rows={3}
          value={config.system}
        />
      </Field>
      <Field label={COPY.inspector.model}>
        <TextInput
          mono
          onChange={(model, r) => patch({ model }, r)}
          placeholder={COPY.inspector.modelPlaceholder}
          value={config.model}
        />
      </Field>
      <label className="flex items-start justify-between gap-3">
        <span className="flex flex-col gap-0.5">
          <span className={LABEL}>{COPY.inspector.jsonOut}</span>
          <span className={HINT}>{COPY.inspector.jsonHint}</span>
        </span>
        <Switch checked={config.json} onCheckedChange={json => patch({ json }, true)} />
      </label>
    </>
  )
}

function ConditionSettings({
  config,
  patch
}: {
  config: NodeConfigs['condition']
  patch: (c: Partial<NodeConfigs['condition']>, record: boolean) => void
}) {
  const [error, setError] = useState<null | string>(null)

  useEffect(() => {
    if (!config.rule.trim()) {
      setError(null)

      return
    }

    const timer = setTimeout(() => void checkRule(config.rule).then(setError, () => setError(null)), 300)

    return () => clearTimeout(timer)
  }, [config.rule])

  return (
    <>
      <Field hint={COPY.inspector.ruleHelp} label={COPY.inspector.rule}>
        <TextInput
          mono
          multiline
          onChange={(rule, r) => patch({ rule }, r)}
          placeholder={COPY.inspector.rulePlaceholder}
          rows={3}
          value={config.rule}
        />
      </Field>
      {error !== null && config.rule.trim() && (
        <p
          className={cn(
            'm-0 flex items-center gap-1.5 text-[0.75rem]',
            error ? 'text-(--ui-red)' : 'text-(--ui-green)'
          )}
        >
          <Codicon name={error ? 'error' : 'pass'} size="0.8125rem" />
          {error || COPY.inspector.ruleOk}
        </p>
      )}
      <p className={HINT}>{COPY.inspector.branches}</p>
    </>
  )
}

function FieldRow({
  field,
  onChange,
  onRemove
}: {
  field: AnswerField
  onChange: (f: AnswerField) => void
  onRemove: () => void
}) {
  const types = (Object.keys(COPY.fieldTypes) as AnswerFieldType[]).map(value => ({
    label: COPY.fieldTypes[value],
    value
  }))

  return (
    <div className="flex flex-col gap-2 rounded-[12px] border border-(--card-stroke) bg-(--card-well) p-2.5">
      <div className="flex items-center gap-2">
        <input
          aria-label={COPY.inspector.fieldLabel}
          className={cn(FIELD, 'h-8 bg-(--card-surface)')}
          onChange={e => onChange({ ...field, label: e.target.value })}
          placeholder={COPY.inspector.fieldLabel}
          value={field.label}
        />
        <div className="w-28 shrink-0">
          <Choice
            label={COPY.inspector.fieldType}
            onChange={type => onChange({ ...field, type })}
            options={types}
            value={field.type}
          />
        </div>
        <button
          aria-label={COPY.inspector.removeField}
          className="shrink-0 text-(--ui-text-tertiary) hover:text-(--ui-red)"
          onClick={onRemove}
          type="button"
        >
          <Codicon name="trash" size="0.875rem" />
        </button>
      </div>
      {field.type === 'list' && (
        <input
          className={cn(FIELD, 'h-8 bg-(--card-surface)')}
          onChange={e => onChange({ ...field, options: e.target.value.split(',').map(o => o.trim()) })}
          placeholder={COPY.inspector.fieldOptions}
          value={field.options.join(', ')}
        />
      )}
      <div className="flex items-center justify-between">
        <span className={cn(MONO, 'text-[0.6875rem] text-(--ui-text-tertiary)')}>{field.key}</span>
        <label className="flex items-center gap-2 text-[0.71875rem] text-(--ui-text-secondary)">
          {COPY.inspector.required}
          <Switch checked={field.required} onCheckedChange={required => onChange({ ...field, required })} size="xs" />
        </label>
      </div>
    </div>
  )
}

const fieldKey = (label: string, index: number) =>
  label
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40) || `field_${index + 1}`

function AnswerSettings({
  config,
  patch
}: {
  config: NodeConfigs['answer']
  patch: (c: Partial<NodeConfigs['answer']>, record: boolean) => void
}) {
  const setFields = (fields: AnswerField[]) =>
    patch(
      { fields: fields.map((f, i) => ({ ...f, key: fieldKey(f.label, i), options: f.options.filter(Boolean) })) },
      true
    )

  return (
    <>
      <Field label={COPY.inspector.message}>
        <TextInput
          multiline
          onChange={(message, r) => patch({ message }, r)}
          placeholder={COPY.inspector.answerPlaceholder}
          rows={3}
          value={config.message}
        />
      </Field>
      <div className="flex flex-col gap-2">
        <span className={LABEL}>{COPY.inspector.fields}</span>
        {config.fields.map((field, index) => (
          <FieldRow
            field={field}
            key={index}
            onChange={next =>
              setFields(config.fields.map((f, i) => (i === index ? { ...next, options: next.options } : f)))
            }
            onRemove={() => setFields(config.fields.filter((_, i) => i !== index))}
          />
        ))}
        <button
          className={cn(BTN, 'self-start')}
          onClick={() =>
            setFields([
              ...config.fields,
              { key: '', label: `Câmp ${config.fields.length + 1}`, options: [], required: true, type: 'text' }
            ])
          }
          type="button"
        >
          <Codicon name="add" size="0.8125rem" />
          {COPY.inspector.addField}
        </button>
      </div>
    </>
  )
}

function OutputSettings({
  config,
  patch,
  triggerType
}: {
  config: NodeConfigs['output']
  patch: (c: Partial<NodeConfigs['output']>, record: boolean) => void
  triggerType: TriggerType
}) {
  const channels = (Object.keys(COPY.channels) as OutputChannel[]).map(value => ({
    label: COPY.channels[value],
    value
  }))

  return (
    <>
      <Field label={COPY.inspector.channel}>
        <Choice
          label={COPY.inspector.channel}
          onChange={channel => patch({ channel, target: '' }, true)}
          options={channels}
          value={config.channel}
        />
      </Field>
      <OutputTarget config={config} patch={patch} triggerType={triggerType} />
      <Field label={COPY.inspector.message}>
        <TextInput
          multiline
          onChange={(message, r) => patch({ message }, r)}
          placeholder={COPY.inspector.outputPlaceholder}
          rows={5}
          value={config.message}
        />
      </Field>
    </>
  )
}

const COLOR_OPTIONS = (Object.keys(COPY.colors) as NoteColor[]).map(value => ({ label: COPY.colors[value], value }))

function VisualSettings({
  node,
  patch
}: {
  node: WorkflowNode
  patch: (c: Record<string, unknown>, record: boolean) => void
}) {
  if (node.kind === 'text') {
    const config = node.config as NodeConfigs['text']

    return (
      <>
        <Field label={COPY.inspector.text}>
          <TextInput multiline onChange={(text, r) => patch({ text }, r)} rows={2} value={config.text} />
        </Field>
        <Field label={COPY.inspector.size}>
          <input
            className={FIELD}
            max={96}
            min={10}
            onChange={e => patch({ size: Number(e.target.value) || 22 }, true)}
            type="number"
            value={config.size}
          />
        </Field>
      </>
    )
  }

  if (node.kind === 'note') {
    const config = node.config as NodeConfigs['note']

    return (
      <>
        <Field label={COPY.inspector.text}>
          <TextInput multiline onChange={(text, r) => patch({ text }, r)} rows={5} value={config.text} />
        </Field>
        <Field label={COPY.inspector.color}>
          <Choice
            label={COPY.inspector.color}
            onChange={color => patch({ color }, true)}
            options={COLOR_OPTIONS}
            value={config.color}
          />
        </Field>
      </>
    )
  }

  const config = node.config as NodeConfigs['shape']
  const shapes = (Object.keys(COPY.shapes) as ShapeKind[]).map(value => ({ label: COPY.shapes[value], value }))

  return (
    <>
      <Field label={COPY.inspector.label}>
        <TextInput onChange={(label, r) => patch({ label }, r)} value={config.label} />
      </Field>
      <Field label={COPY.inspector.shape}>
        <Choice
          label={COPY.inspector.shape}
          onChange={shape => patch({ shape }, true)}
          options={shapes}
          value={config.shape}
        />
      </Field>
      <Field label={COPY.inspector.color}>
        <Choice
          label={COPY.inspector.color}
          onChange={color => patch({ color }, true)}
          options={COLOR_OPTIONS}
          value={config.color}
        />
      </Field>
    </>
  )
}

function KindSettings({ editor, node }: { editor: Editor; node: WorkflowNode }) {
  const patch = (config: Record<string, unknown>, record = true) =>
    editor.edit(doc => updateNode(doc, node.id, { config }), { record })

  const trigger = editor.doc.nodes.find(n => n.kind === 'trigger')

  const views: Partial<Record<NodeKind, () => ReactNode>> = {
    agent: () => <AgentSettings config={node.config as NodeConfigs['agent']} patch={patch} />,
    answer: () => <AnswerSettings config={node.config as NodeConfigs['answer']} patch={patch} />,
    approval: () => (
      <Field label={COPY.inspector.message}>
        <TextInput
          multiline
          onChange={(message, r) => patch({ message }, r)}
          placeholder={COPY.inspector.approvalPlaceholder}
          rows={4}
          value={(node.config as NodeConfigs['approval']).message}
        />
      </Field>
    ),
    condition: () => <ConditionSettings config={node.config as NodeConfigs['condition']} patch={patch} />,
    image: () => <ImageSettings config={node.config as NodeConfigs['image']} patch={patch} />,
    llm: () => <LlmSettings config={node.config as NodeConfigs['llm']} patch={patch} />,
    output: () => (
      <OutputSettings
        config={node.config as NodeConfigs['output']}
        patch={patch}
        triggerType={(trigger?.config as NodeConfigs['trigger'] | undefined)?.type ?? 'manual'}
      />
    ),
    video: () => <VideoSettings config={node.config as NodeConfigs['video']} patch={patch} />,
    trigger: () => <TriggerSettings config={node.config as NodeConfigs['trigger']} editor={editor} patch={patch} />
  }

  return views[node.kind]?.() ?? <VisualSettings node={node} patch={patch} />
}

function NodeInspector({
  editor,
  node,
  onRun
}: {
  editor: Editor
  node: WorkflowNode
  onRun: (mode: 'from' | 'step', nodeId: string) => void
}) {
  const problem = editor.meta.problems.find(p => p.node_id === node.id)
  const visual = ['text', 'note', 'shape'].includes(node.kind)

  const icon =
    node.kind === 'trigger' ? TRIGGER_ICON[(node.config as NodeConfigs['trigger']).type] : KIND_ICON[node.kind]

  return (
    <>
      <Section>
        <div className="flex items-center gap-3">
          <KindTile icon={icon} size="lg" tone={KIND_TONE[node.kind]} />
          <div className="flex min-w-0 flex-col">
            <span className="text-[0.875rem] font-medium text-(--ui-text-primary)">{COPY.kinds[node.kind].label}</span>
            <span className={HINT}>{COPY.kinds[node.kind].hint}</span>
          </div>
        </div>
        {!visual && (
          <Field label={COPY.inspector.title}>
            <TextInput
              onChange={(title, record) => editor.edit(doc => updateNode(doc, node.id, { title }), { record })}
              placeholder={nodeLabel({ ...node, title: '' })}
              value={node.title}
            />
          </Field>
        )}
        {problem && (
          <p className="m-0 flex items-start gap-2 rounded-[10px] bg-[color-mix(in_srgb,var(--ui-yellow)_12%,transparent)] px-3 py-2 text-[0.75rem] text-(--ui-text-primary)">
            <Codicon className="mt-0.5 shrink-0 text-(--ui-yellow)" name="warning" size="0.8125rem" />
            {problem.message}
          </p>
        )}
      </Section>
      <Section>
        <KindSettings editor={editor} node={node} />
      </Section>
      {!visual && (
        <Section title={COPY.inspector.refs}>
          <p className={cn(HINT, MONO)}>{COPY.inspector.refsHelp}</p>
          <p className={cn(HINT, MONO)}>{COPY.inspector.stepId(node.id)}</p>
        </Section>
      )}
      <Section>
        <div className="flex flex-wrap gap-2">
          {!visual && (
            <>
              <button className={BTN} onClick={() => onRun('from', node.id)} type="button">
                <Codicon name="debug-continue" size="0.8125rem" />
                {COPY.inspector.runFrom}
              </button>
              {node.kind !== 'trigger' && (
                <button className={BTN} onClick={() => onRun('step', node.id)} type="button">
                  <Codicon name="debug-step-over" size="0.8125rem" />
                  {COPY.inspector.runOnly}
                </button>
              )}
            </>
          )}
          {node.kind !== 'trigger' && (
            <button
              className={BTN_DANGER}
              onClick={() => {
                editor.edit(doc => removeNodes(doc, [node.id]))
                editor.select(null)
              }}
              type="button"
            >
              <Codicon name="trash" size="0.8125rem" />
              {COPY.inspector.delete}
            </button>
          )}
        </div>
      </Section>
    </>
  )
}

function WorkflowInspector({ editor }: { editor: Editor }) {
  const { doc } = editor

  return (
    <>
      <Section title={COPY.inspector.workflow}>
        <Field label={COPY.inspector.name}>
          <TextInput onChange={(name, record) => editor.edit(d => ({ ...d, name }), { record })} value={doc.name} />
        </Field>
        <Field label={COPY.inspector.description}>
          <TextInput
            multiline
            onChange={(description, record) => editor.edit(d => ({ ...d, description }), { record })}
            placeholder={COPY.inspector.descriptionPlaceholder}
            rows={3}
            value={doc.description}
          />
        </Field>
      </Section>
      {editor.meta.problems.length > 0 && (
        <Section title={COPY.inspector.problems}>
          {editor.meta.problems.map(problem => {
            const node = findNode(doc, problem.node_id)

            return (
              <button
                className="flex items-start gap-2 rounded-[10px] px-2 py-1.5 text-left text-[0.78125rem] text-(--ui-text-secondary) hover:bg-(--card-well)"
                key={problem.node_id}
                onClick={() => editor.select({ id: problem.node_id, type: 'node' })}
                type="button"
              >
                <Codicon className="mt-0.5 shrink-0 text-(--ui-yellow)" name="warning" size="0.8125rem" />
                <span>
                  <span className="font-medium text-(--ui-text-primary)">
                    {node ? nodeLabel(node) : problem.node_id}
                  </span>{' '}
                  · {problem.message}
                </span>
              </button>
            )
          })}
        </Section>
      )}
      <Section title={COPY.page.whenTitle}>
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {COPY.page.when.map(line => (
            <li className="flex gap-2 text-[0.75rem] leading-relaxed text-(--ui-text-secondary)" key={line}>
              <Codicon className="mt-0.5 shrink-0 text-(--ui-text-tertiary)" name="lightbulb" size="0.75rem" />
              {line}
            </li>
          ))}
        </ul>
      </Section>
    </>
  )
}

export function Inspector({
  editor,
  onRun
}: {
  editor: Editor
  onRun: (mode: 'from' | 'step', nodeId: string) => void
}) {
  const node = editor.selection?.type === 'node' ? findNode(editor.doc, editor.selection.id) : undefined

  return node ? (
    <NodeInspector editor={editor} key={node.id} node={node} onRun={onRun} />
  ) : (
    <WorkflowInspector editor={editor} />
  )
}

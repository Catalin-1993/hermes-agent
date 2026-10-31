/**
 * The run's settings in three groups: the strategy and its parameters; risk (stop-loss as a percentage
 * or by volatility, take-profit, trailing stop, position size as a share of capital or a fixed risk);
 * and the conditions (trend and ADX filters, bar length, period, capital, fee).
 */

import { cn, Codicon, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@hermes/plugin-sdk'
import { useState } from 'react'

import type { BacktestExecution, BacktestRequest, BacktestStrategy } from './api'
import {
  DEFAULT_RISK_PCT,
  DEFAULT_STOP_ATR,
  defaultParams,
  executionField,
  type ExecutionNumber,
  PARAMS,
  STRATEGY_ORDER
} from './backtest-strategies'
import { COPY } from './copy'
import { Segmented } from './segmented'
import { BTN_PRIMARY, CARD, CARD_PAD, CardHead, FIELD, LABEL, MUTED } from './ui'

const GROUP = 'text-[0.6875rem] font-medium tracking-[0.04em] text-(--ui-text-tertiary) uppercase'

/** The number fields sit two to a row in the narrow settings column. */
const FIELDS = 'grid grid-cols-2 gap-3'

/** A number with its label above and its unit inside the field's right edge, as the design draws them. */
function NumberInput({
  hint,
  label,
  max,
  min,
  onChange,
  step,
  unit,
  value
}: {
  hint?: string
  label: string
  max: number
  min: number
  onChange: (value: number) => void
  step: number
  /** Shown at the field's right edge; a label ending in " %" gives "%" without repeating it. */
  unit?: string
  value: number
}) {
  const percent = label.endsWith(' %')
  const shown = percent ? label.slice(0, -2) : label
  const suffix = unit ?? (percent ? '%' : '')

  return (
    <label className="flex min-w-0 flex-col gap-1.5" title={hint}>
      <span className={cn(LABEL, 'truncate')}>{shown}</span>
      <span className="relative">
        <input
          aria-label={label}
          className={cn(FIELD, 'tabular-nums', suffix && 'pr-9')}
          max={max}
          min={min}
          onChange={event => onChange(Number(event.target.value.replace(',', '.')))}
          step={step}
          type="number"
          value={Number.isFinite(value) ? value : ''}
        />
        {suffix && (
          <span
            className={cn('pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-[0.78125rem]', MUTED)}
          >
            {suffix}
          </span>
        )}
      </span>
    </label>
  )
}

interface Editor {
  onChange: (next: BacktestRequest) => void
  request: BacktestRequest
}

function StrategyGroup({ onChange, request }: Editor) {
  const copy = COPY.backtest
  const choose = (strategy: BacktestStrategy) => onChange({ ...request, params: defaultParams(strategy), strategy })

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <span className={LABEL}>{copy.settings.strategy}</span>
        <Select onValueChange={value => choose(value as BacktestStrategy)} value={request.strategy}>
          <SelectTrigger aria-label={copy.settings.strategy} className={cn(FIELD, 'justify-between')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STRATEGY_ORDER.map(id => (
              <SelectItem key={id} value={id}>
                {copy.strategies[id].name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <p className="m-0 text-[0.78125rem] leading-relaxed text-(--ui-text-secondary)">
        {copy.strategies[request.strategy].rule}
      </p>
      {PARAMS[request.strategy].length > 0 && (
        <div className={FIELDS}>
          {PARAMS[request.strategy].map(spec => (
            <NumberInput
              key={spec.name}
              label={copy.params[spec.name as keyof typeof copy.params]}
              max={spec.max}
              min={spec.min}
              onChange={value => onChange({ ...request, params: { ...request.params, [spec.name]: value } })}
              step={spec.step}
              value={request.params[spec.name] ?? spec.default}
            />
          ))}
        </div>
      )}
    </section>
  )
}

/** One execution number as a field, with its label, hint and range. */
function ExecutionInput({ name, onChange, request }: Editor & { name: ExecutionNumber }) {
  const copy = COPY.backtest.execution
  const field = executionField(name)

  return (
    <NumberInput
      hint={copy.hints[name]}
      label={copy.labels[name]}
      max={field.max}
      min={name === 'stop_atr' || name === 'risk_pct' ? 0 : field.min}
      onChange={value => onChange({ ...request, execution: { ...request.execution, [name]: value } })}
      step={field.step}
      value={request.execution[name]}
    />
  )
}

/** A choice with its own small label above: "Stop-loss  [Procent fix | ATR]". */
function Choice<T extends string>({
  label,
  onSelect,
  options,
  value
}: {
  label: string
  onSelect: (value: T) => void
  options: { id: T; text: string }[]
  value: T
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className={LABEL}>{label}</span>
      <Segmented fill label={label} onSelect={onSelect} options={options} value={value} />
    </div>
  )
}

type Sizing = 'capital' | 'risk'

function RiskGroup({ onChange, request }: Editor) {
  const copy = COPY.backtest.execution
  const how = request.execution
  // The sizing switch is the owner's choice, not derived from the number: typing "0," on the way to
  // "0,5" must not flip it back.
  const [sizing, setSizing] = useState<Sizing>(how.risk_pct > 0 ? 'risk' : 'capital')
  const hasStop = (how.stop_mode === 'atr' ? how.stop_atr : how.stop_loss_pct) > 0 || how.trailing_pct > 0
  const set = (next: Partial<BacktestExecution>) => onChange({ ...request, execution: { ...how, ...next } })

  return (
    <section className="flex flex-col gap-3">
      <span className={GROUP}>{copy.riskTitle}</span>
      <Choice
        label={copy.stop}
        onSelect={mode =>
          set(mode === 'atr' ? { stop_atr: how.stop_atr || DEFAULT_STOP_ATR, stop_mode: mode } : { stop_mode: mode })
        }
        options={[
          { id: 'pct', text: copy.stopModes.pct },
          { id: 'atr', text: copy.stopModes.atr }
        ]}
        value={how.stop_mode}
      />
      <div className={FIELDS}>
        <ExecutionInput
          name={how.stop_mode === 'atr' ? 'stop_atr' : 'stop_loss_pct'}
          onChange={onChange}
          request={request}
        />
        <ExecutionInput name="take_profit_pct" onChange={onChange} request={request} />
        <ExecutionInput name="trailing_pct" onChange={onChange} request={request} />
      </div>
      <Choice<Sizing>
        label={copy.sizing}
        onSelect={mode => {
          setSizing(mode)
          set(mode === 'risk' ? { risk_pct: how.risk_pct || DEFAULT_RISK_PCT } : { risk_pct: 0 })
        }}
        options={[
          { id: 'capital', text: copy.sizingModes.capital },
          { id: 'risk', text: copy.sizingModes.risk }
        ]}
        value={sizing}
      />
      <div className={FIELDS}>
        <ExecutionInput name={sizing === 'risk' ? 'risk_pct' : 'size_pct'} onChange={onChange} request={request} />
      </div>
      {sizing === 'risk' && !hasStop && (
        <p className="m-0 text-[0.75rem] leading-relaxed text-(--ui-yellow)">{copy.riskNeedsStop}</p>
      )}
      <p className={cn('m-0 text-[0.75rem] leading-relaxed', MUTED)}>{copy.riskNote}</p>
    </section>
  )
}

/** The trend and ADX filters, the capital and the fee. The period and the bar length are on the chart's bar. */
function ConditionsGroup({ onChange, request }: Editor) {
  const copy = COPY.backtest

  return (
    <section className="flex flex-col gap-3">
      <span className={GROUP}>{copy.execution.conditionsTitle}</span>
      <div className={FIELDS}>
        <ExecutionInput name="trend_filter" onChange={onChange} request={request} />
        <ExecutionInput name="adx_filter" onChange={onChange} request={request} />
        <NumberInput
          label={copy.settings.capital}
          max={10_000_000}
          min={100}
          onChange={capital => onChange({ ...request, capital })}
          step={100}
          unit="€"
          value={request.capital}
        />
        <NumberInput
          label={copy.settings.fee}
          max={2}
          min={0}
          onChange={fee_pct => onChange({ ...request, fee_pct })}
          step={0.05}
          value={request.fee_pct}
        />
      </div>
    </section>
  )
}

export function SettingsCard({
  busy,
  canRun,
  onChange,
  onRun,
  request
}: Editor & {
  busy: boolean
  /** False while the market-data service is not ready: a run would only fail. */
  canRun: boolean
  onRun: () => void
}) {
  const copy = COPY.backtest.settings

  return (
    <section className={cn(CARD, CARD_PAD, 'gap-3.5')} data-portfolio-backtest-settings="">
      <CardHead subtitle={copy.subtitle} title={copy.title} />
      <StrategyGroup onChange={onChange} request={request} />
      <RiskGroup onChange={onChange} request={request} />
      <ConditionsGroup onChange={onChange} request={request} />
      <button className={cn(BTN_PRIMARY, 'w-full')} disabled={busy || !canRun} onClick={onRun} type="button">
        <Codicon name={busy ? 'loading' : 'play'} spinning={busy} />
        {busy ? copy.running : copy.run}
      </button>
      <p className={cn('m-0 text-[0.75rem] leading-relaxed', MUTED)}>
        {copy.about} {copy.howItWorks}
      </p>
    </section>
  )
}

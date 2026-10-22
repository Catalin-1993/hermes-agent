/**
 * The run's settings in three groups: the strategy and its parameters; risk (stop-loss, take-profit,
 * trailing stop, position size); and the conditions (trend filter, bar length, period, capital, fee).
 */

import {
  Button,
  cn,
  Codicon,
  FIGURE_CARD_CLASS,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@hermes/plugin-sdk'

import type { BacktestExecution, BacktestRequest, BacktestStrategy } from './api'
import { defaultParams, EXECUTION_FIELDS, PARAMS, STRATEGY_ORDER, YEARS } from './backtest-strategies'
import { COPY } from './copy'
import { Segmented } from './segmented'

const TITLE = 'text-[0.9375rem] leading-snug font-semibold tracking-[-0.01em] text-(--ui-text-primary)'
const GROUP = 'text-[0.6875rem] font-medium tracking-[0.04em] text-(--ui-text-tertiary) uppercase'

const FIELD =
  'h-7 w-20 min-w-0 rounded-lg bg-(--card-well) px-2.5 text-right text-[0.8125rem] text-(--ui-text-primary) tabular-nums focus:outline-none focus-visible:ring-1 focus-visible:ring-(--ui-text-tertiary)'

function NumberInput({
  hint,
  label,
  max,
  min,
  onChange,
  step,
  value
}: {
  hint?: string
  label: string
  max: number
  min: number
  onChange: (value: number) => void
  step: number
  value: number
}) {
  return (
    <label className="flex items-center gap-2 text-[0.75rem] text-(--ui-text-tertiary)" title={hint}>
      {label}
      <input
        aria-label={label}
        className={FIELD}
        max={max}
        min={min}
        onChange={event => onChange(Number(event.target.value.replace(',', '.')))}
        step={step}
        type="number"
        value={Number.isFinite(value) ? value : ''}
      />
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
    <section className="flex flex-col gap-2.5">
      <div className="flex flex-wrap items-center gap-3">
        <span className={GROUP}>{copy.settings.strategy}</span>
        <Select onValueChange={value => choose(value as BacktestStrategy)} value={request.strategy}>
          <SelectTrigger aria-label={copy.settings.strategy} className="h-8 min-w-48 rounded-full text-[0.8125rem]">
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
      <p className="text-[0.75rem] leading-relaxed text-(--ui-text-secondary)">
        {copy.strategies[request.strategy].rule}
      </p>
      {PARAMS[request.strategy].length > 0 && (
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
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

function RiskGroup({ onChange, request }: Editor) {
  const copy = COPY.backtest.execution

  const set = (name: keyof BacktestExecution, value: number | string) =>
    onChange({ ...request, execution: { ...request.execution, [name]: value } })

  return (
    <section className="flex flex-col gap-2.5">
      <span className={GROUP}>{copy.riskTitle}</span>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        {EXECUTION_FIELDS.filter(field => field.name !== 'trend_filter').map(field => (
          <NumberInput
            hint={copy.hints[field.name]}
            key={field.name}
            label={copy.labels[field.name]}
            max={field.max}
            min={field.min}
            onChange={value => set(field.name, value)}
            step={field.step}
            value={request.execution[field.name]}
          />
        ))}
      </div>
      <p className="text-[0.6875rem] leading-relaxed text-(--ui-text-tertiary)">{copy.riskNote}</p>
    </section>
  )
}

function ConditionsGroup({ onChange, request }: Editor) {
  const copy = COPY.backtest
  const trend = EXECUTION_FIELDS.find(field => field.name === 'trend_filter')!

  return (
    <section className="flex flex-col gap-2.5">
      <span className={GROUP}>{copy.execution.conditionsTitle}</span>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <NumberInput
          hint={copy.execution.hints.trend_filter}
          label={copy.execution.labels.trend_filter}
          max={trend.max}
          min={trend.min}
          onChange={value => onChange({ ...request, execution: { ...request.execution, trend_filter: value } })}
          step={trend.step}
          value={request.execution.trend_filter}
        />
        <Segmented
          label={copy.execution.timeframe}
          onSelect={timeframe => onChange({ ...request, execution: { ...request.execution, timeframe } })}
          options={[
            { id: '1d', text: copy.execution.timeframes['1d'] },
            { id: '1w', text: copy.execution.timeframes['1w'] }
          ]}
          value={request.execution.timeframe}
        />
      </div>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <Segmented
          label={copy.settings.period}
          onSelect={years => onChange({ ...request, years: Number(years) })}
          options={YEARS.map(years => ({ id: String(years), text: copy.settings.years(years) }))}
          value={String(request.years)}
        />
        <NumberInput
          label={copy.settings.capital}
          max={10_000_000}
          min={100}
          onChange={capital => onChange({ ...request, capital })}
          step={100}
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
    <div className={cn(FIGURE_CARD_CLASS, 'gap-4')} data-portfolio-backtest-settings="">
      <div>
        <div className={TITLE}>{copy.title(request.symbol)}</div>
        <div className="mt-0.5 text-[0.75rem] text-(--ui-text-tertiary)">{copy.subtitle}</div>
      </div>
      <StrategyGroup onChange={onChange} request={request} />
      <RiskGroup onChange={onChange} request={request} />
      <ConditionsGroup onChange={onChange} request={request} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[0.6875rem] leading-relaxed text-(--ui-text-tertiary)">{copy.howItWorks}</p>
        <Button disabled={busy || !canRun} onClick={onRun} size="sm">
          <Codicon className="mr-1.5" name={busy ? 'loading' : 'play'} spinning={busy} />
          {busy ? copy.running : copy.run}
        </Button>
      </div>
    </div>
  )
}

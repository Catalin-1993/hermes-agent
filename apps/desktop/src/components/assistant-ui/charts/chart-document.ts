import type { EChartsOption } from 'echarts'

import { type ChartSpec, formatValue } from './chart-spec'

/** The ECharts build a saved chart loads — the same release the app bundles. */
export const ECHARTS_CDN = 'https://cdn.jsdelivr.net/npm/echarts@6.1.0/dist/echarts.min.js'

const escape = (value: unknown) =>
  String(value).replace(/[&<>"]/g, char => ({ '"': '&quot;', '&': '&amp;', '<': '&lt;', '>': '&gt;' })[char] ?? char)

/** JSON that is safe inside a `<script>`. */
const scriptJson = (value: unknown) => JSON.stringify(value).replace(/</g, '\\u003c')

const STYLE = `<style>
*{box-sizing:border-box}
body{margin:0;padding:4px;font:14px/1.45 system-ui,-apple-system,"Segoe UI",sans-serif;color:var(--foreground,#1d1d1f)}
h3{margin:0;font-size:15px;font-weight:600;letter-spacing:-.01em}
.sub{margin:2px 0 0;font-size:12px;color:var(--muted-foreground,#6b7280)}
.head{margin-bottom:14px}
.plot{width:100%;height:clamp(220px,46vw,420px)}
.kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px}
.kpi{padding:14px 16px;border:1px solid var(--border,#e4e4e7);border-radius:16px}
.kpi span{font-size:12px;color:var(--muted-foreground,#6b7280)}
.kpi b{display:block;margin-top:6px;font-size:26px;font-weight:600;letter-spacing:-.02em;font-variant-numeric:tabular-nums}
.up{color:#15803d}.down{color:#b91c1c}
table{width:100%;border-collapse:collapse;font-size:13px}
th{padding:8px 10px;text-align:left;font-size:12px;font-weight:500;color:var(--muted-foreground,#6b7280);border-bottom:1px solid var(--border,#e4e4e7)}
td{padding:9px 10px;border-bottom:1px solid var(--border,#e4e4e7)}
.num{text-align:right;font-variant-numeric:tabular-nums}
</style>`

/**
 * A chart as a self-contained page, for the Library: the same picture, alive (ECharts from the shared
 * CDN, the option as data — tooltips, legend and zoom keep working), with its title on top. Formatters
 * are functions and do not travel; the saved chart uses ECharts' own number formatting.
 */
export function chartDocument(spec: ChartSpec, option: EChartsOption | null): string {
  const title = spec.title || 'Chart'

  const head = `<div class="head">${spec.title ? `<h3>${escape(spec.title)}</h3>` : ''}${
    spec.subtitle ? `<p class="sub">${escape(spec.subtitle)}</p>` : ''
  }</div>`

  const page = (body: string, scripts = '') =>
    `<!doctype html><html><head><meta charset="utf-8"><title>${escape(title)}</title>${STYLE}</head><body>${head}${body}${scripts}</body></html>`

  if (spec.kind === 'kpi') {
    return page(
      `<div class="kpis">${spec.kpis
        .map(
          kpi =>
            `<div class="kpi"><span>${escape(kpi.label)}</span><b>${escape(
              typeof kpi.value === 'number' ? formatValue(spec, kpi.value) : kpi.value
            )}</b>${
              kpi.delta === undefined
                ? ''
                : `<span class="${kpi.delta >= 0 ? 'up' : 'down'}">${kpi.delta >= 0 ? '+' : ''}${kpi.delta}%</span>`
            }</div>`
        )
        .join('')}</div>`
    )
  }

  if (spec.kind === 'table') {
    const numeric = spec.columns.map((_, index) => spec.rows.every(row => typeof row[index] === 'number'))

    return page(
      `<table><thead><tr>${spec.columns
        .map((column, index) => `<th class="${numeric[index] ? 'num' : ''}">${escape(column)}</th>`)
        .join('')}</tr></thead><tbody>${spec.rows
        .map(
          row =>
            `<tr>${row
              .map((cell, index) =>
                numeric[index]
                  ? `<td class="num">${escape(formatValue(spec, cell as number))}</td>`
                  : `<td>${escape(cell)}</td>`
              )
              .join('')}</tr>`
        )
        .join('')}</tbody></table>`
    )
  }

  return page(
    '<div class="plot" id="chart"></div>',
    `<script src="${ECHARTS_CDN}"></script><script>(function(){var c=echarts.init(document.getElementById('chart'),null,{renderer:'svg'});c.setOption(${scriptJson(
      option ?? {}
    )});addEventListener('resize',function(){c.resize()})})()</script>`
  )
}

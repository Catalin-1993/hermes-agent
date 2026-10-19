import { BarChart, FunnelChart, GaugeChart, LineChart, PieChart, RadarChart, ScatterChart } from 'echarts/charts'
import {
  DataZoomComponent,
  GridComponent,
  LegendComponent,
  RadarComponent,
  TitleComponent,
  TooltipComponent
} from 'echarts/components'
import * as echarts from 'echarts/core'
import { SVGRenderer } from 'echarts/renderers'

// Only what the ```chart kinds draw, rendered as SVG (crisp text at any zoom, light on a few hundred
// points). Lives in the chart chunk, loaded the first time a chart appears.
echarts.use([
  BarChart,
  DataZoomComponent,
  FunnelChart,
  GaugeChart,
  GridComponent,
  LegendComponent,
  LineChart,
  PieChart,
  RadarChart,
  RadarComponent,
  ScatterChart,
  SVGRenderer,
  TitleComponent,
  TooltipComponent
])

export { echarts }

export type ArtifactTheme = 'light' | 'dark' | 'auto'

export interface ArtifactSource {
  label: string
  detail?: string
}

export interface KpiItem {
  label: string
  value: string
  delta?: string
  tone?: 'neutral' | 'good' | 'warning' | 'bad' | 'accent'
}

export interface ChartDataset {
  label: string
  data: number[]
}

export type ChartKind = 'bar' | 'line' | 'area' | 'donut' | 'dotMatrix'

export interface KpiBlock {
  type: 'kpi'
  title?: string
  items: KpiItem[]
}

export interface ChartBlock {
  type: 'chart'
  title?: string
  subtitle?: string
  kind: ChartKind
  labels: string[]
  datasets: ChartDataset[]
  unit?: string
  xAxisLabel?: string
  yAxisLabel?: string
  caption?: string
  summaryValue?: string
  annotation?: string
  highlightIndex?: number
  showValueLabels?: boolean
}

export interface TableBlock {
  type: 'table'
  title?: string
  headers: string[]
  rows: Array<Array<string | number | null>>
}

export interface TextBlock {
  type: 'text'
  title?: string
  bullets: string[]
}

export interface InsightBlock {
  type: 'insight'
  title?: string
  text: string
  tone?: 'neutral' | 'good' | 'warning' | 'bad' | 'accent'
}

export type ArtifactBlock = KpiBlock | ChartBlock | TableBlock | TextBlock | InsightBlock

export type SlideLayout =
  | 'cover'
  | 'toc'
  | 'big-number'
  | 'chart-focus'
  | 'kpi-grid'
  | 'table-focus'
  | 'timeline'
  | 'summary'

export interface ArtifactSpec {
  title: string
  subtitle?: string
  description?: string
  layout?: SlideLayout
  theme?: ArtifactTheme
  blocks: ArtifactBlock[]
  sources?: ArtifactSource[]
}

export interface ArtifactDeck {
  title: string
  subtitle?: string
  description?: string
  theme?: ArtifactTheme
  slides: ArtifactSpec[]
  sources?: ArtifactSource[]
}

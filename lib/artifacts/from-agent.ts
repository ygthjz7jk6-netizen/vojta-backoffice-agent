import type { ChartConfiguration } from 'chart.js'
import type { ArtifactBlock, ArtifactDeck, ArtifactSpec, ChartBlock, ChartDataset, ChartKind, KpiItem } from './types'
import type { PresentationInput, SlideSpec } from '@/lib/export/pptx'

function asString(value: unknown, fallback = '') {
  return typeof value === 'string' && value.trim() ? value : fallback
}

function asNumberArray(value: unknown): number[] {
  return Array.isArray(value) ? value.map(Number).filter(Number.isFinite) : []
}

function normalizeChartKind(type: unknown): ChartKind {
  if (type === 'line') return 'line'
  if (type === 'pie' || type === 'doughnut' || type === 'donut') return 'donut'
  if (type === 'area') return 'area'
  return 'bar'
}

function chartDatasets(datasets: unknown): ChartDataset[] {
  if (!Array.isArray(datasets)) return []
  return datasets
    .map((dataset, index) => {
      const d = dataset as Record<string, unknown>
      return {
        label: asString(d.label, `Řada ${index + 1}`),
        data: asNumberArray(d.data),
      }
    })
    .filter(dataset => dataset.data.length > 0)
}

export function artifactFromVisualization(args: Record<string, unknown>): ArtifactSpec {
  const labels = Array.isArray(args.labels) ? args.labels.map(label => String(label)) : []
  const datasets = chartDatasets(args.datasets)
  const title = asString(args.title, 'Graf')
  const kind = normalizeChartKind(args.chart_type)
  const values = datasets[0]?.data ?? []
  const total = values.reduce((sum, value) => sum + value, 0)
  const max = values.length ? Math.max(...values) : 0
  const maxIndex = values.indexOf(max)

  const blocks: ArtifactBlock[] = [
    {
      type: 'chart',
      title,
      subtitle: asString(args.subtitle, datasets[0]?.label ?? 'Data pro graf'),
      kind,
      labels,
      datasets,
      unit: asString(args.unit),
      xAxisLabel: asString(args.x_axis_label),
      yAxisLabel: asString(args.y_axis_label),
      annotation: maxIndex >= 0 && labels[maxIndex] ? `Nejvyšší hodnota: ${labels[maxIndex]} (${max})` : undefined,
      summaryValue: kind === 'donut' && total > 0 ? String(total) : undefined,
      highlightIndex: maxIndex >= 0 ? maxIndex : undefined,
      showValueLabels: true,
    },
  ]

  if (total > 0 || max > 0) {
    const kpis: KpiItem[] = []
    if (total > 0) kpis.push({ label: 'Součet', value: String(total), tone: 'good' })
    if (maxIndex >= 0 && labels[maxIndex]) kpis.push({ label: 'Maximum', value: `${labels[maxIndex]}: ${max}`, tone: 'accent' })
    blocks.unshift({ type: 'kpi', items: kpis })
  }

  return {
    title,
    subtitle: 'Designový graf',
    description: asString(args.source_description, 'Graf vygenerovaný agentem ze strukturovaných dat.'),
    layout: 'chart-focus',
    blocks,
    sources: [{ label: asString(args.source_description, 'agent_visualization') }],
  }
}

export function chartConfigFromArtifact(spec: ArtifactSpec): ChartConfiguration {
  const chart = spec.blocks.find((block): block is ChartBlock => block.type === 'chart')
  const type = chart?.kind === 'donut' ? 'doughnut' : chart?.kind === 'line' || chart?.kind === 'area' ? 'line' : 'bar'
  return {
    type,
    data: {
      labels: chart?.labels ?? [],
      datasets: chart?.datasets ?? [],
    },
    options: {
      responsive: true,
      plugins: { title: { display: true, text: spec.title } },
    },
  } as ChartConfiguration
}

function slideBlocks(slide: SlideSpec): ArtifactBlock[] {
  const blocks: ArtifactBlock[] = []
  if (slide.kpis?.length) {
    blocks.push({
      type: 'kpi',
      items: slide.kpis.map(kpi => ({
        label: kpi.label,
        value: kpi.value,
        tone: kpi.highlight ? 'accent' : 'neutral',
      })),
    })
  }
  if (slide.table?.headers.length) {
    blocks.push({
      type: 'table',
      title: slide.table.headers.join(' / '),
      headers: slide.table.headers,
      rows: slide.table.rows,
    })
  }
  if (slide.bullets?.length) {
    blocks.push({ type: 'text', title: 'Klíčové body', bullets: slide.bullets })
  }
  if (slide.note) {
    blocks.push({ type: 'insight', text: slide.note })
  }
  return blocks.length ? blocks : [{ type: 'insight', text: slide.heading }]
}

export function artifactDeckFromPresentation(input: PresentationInput): ArtifactDeck {
  return {
    title: input.title,
    subtitle: input.subtitle,
    description: input.subtitle,
    slides: input.slides.map((slide, index) => ({
      title: slide.heading,
      subtitle: `Slide ${index + 1}`,
      layout: slide.table ? 'table-focus' : slide.kpis && slide.bullets ? 'summary' : slide.kpis ? 'big-number' : 'summary',
      blocks: slideBlocks(slide),
      sources: slide.note ? [{ label: slide.note }] : undefined,
    })),
  }
}

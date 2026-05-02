import pptxgen from 'pptxgenjs'
import type { ArtifactBlock, ArtifactDeck, ArtifactSpec, ChartBlock, KpiItem } from './types'

type PptxTheme = 'light' | 'dark'
type Prs = InstanceType<typeof pptxgen>
type Slide = ReturnType<Prs['addSlide']>

const W = 13.333
const H = 7.5

const T = {
  light: {
    page: 'F5F8FF',
    paper: 'FFFFFF',
    ink: '07111F',
    muted: '526174',
    faint: 'D8E3F2',
    blue: '245BFF',
    blue2: '42A5FF',
    navy: '071B3A',
    red: 'FF5554',
    yellow: 'FFC73D',
    pink: 'FA5CAE',
    orange: 'F79234',
  },
  dark: {
    page: '05070D',
    paper: '0A0F1A',
    ink: 'F7FBFF',
    muted: 'A8B3C3',
    faint: '273244',
    blue: '4D83FF',
    blue2: '6EC8FF',
    navy: '071B3A',
    red: 'FF5554',
    yellow: 'FFC73D',
    pink: 'FA5CAE',
    orange: 'F79234',
  },
} as const

const FONT = 'Aptos Mono'
const DISPLAY = 'Arial Narrow'
function color(theme: PptxTheme) {
  return T[theme]
}

function text(slide: Slide, value: string, x: number, y: number, w: number, h: number, opts: Parameters<Slide['addText']>[1] = {}) {
  slide.addText(value, {
    x, y, w, h,
    fontFace: FONT,
    margin: 0,
    breakLine: false,
    fit: 'shrink',
    ...opts,
  })
}

function rect(slide: Slide, x: number, y: number, w: number, h: number, fill: string, line = fill, transparency = 0) {
  slide.addShape('rect', {
    x, y, w, h,
    fill: { color: fill, transparency },
    line: { color: line, transparency: line === fill ? 100 : 0, pt: 0.8 },
  })
}

function panel(slide: Slide, x: number, y: number, w: number, h: number, fill: string, lineColor: string) {
  slide.addShape('roundRect', {
    x, y, w, h,
    rectRadius: 0.08,
    fill: { color: fill },
    line: { color: lineColor, pt: 0.85 },
  })
}

function line(slide: Slide, x: number, y: number, w: number, h: number, c: string, pt = 0.9) {
  slide.addShape('line', { x, y, w, h, line: { color: c, pt } })
}

function dot(slide: Slide, x: number, y: number, size: number, fill: string, transparency = 0) {
  slide.addShape('ellipse', {
    x, y, w: size, h: size,
    fill: { color: fill, transparency },
    line: { color: fill, transparency: 100 },
  })
}

function addBase(slide: Slide, theme: PptxTheme, variant: 'paper' | 'blue' | 'dark' = 'paper') {
  const p = color(theme)
  const bg = variant === 'blue' ? p.blue : variant === 'dark' ? p.ink : p.page
  slide.background = { color: bg }
  rect(slide, 0, 0, W, H, bg)
}

function footer(slide: Slide, theme: PptxTheme, source?: string, page?: number) {
  const p = color(theme)
  line(slide, 0.62, 6.92, 12.05, 0, p.faint, 0.7)
  text(slide, 'Back Office Agent', 0.65, 7.08, 2.3, 0.16, { fontSize: 6.6, color: p.muted })
  text(slide, source ?? 'artifact lab', 4.3, 7.08, 4.7, 0.16, { fontSize: 6.6, color: p.muted, align: 'center' })
  text(slide, page ? String(page).padStart(2, '0') : '', 11.7, 7.08, 0.9, 0.16, { fontSize: 6.6, color: p.muted, align: 'right' })
}

function titleBlock(slide: Slide, spec: ArtifactSpec, theme: PptxTheme, page: number) {
  const p = color(theme)
  text(slide, spec.subtitle ?? `Slide ${page}`, 0.65, 0.45, 4.8, 0.18, {
    fontSize: 7.4,
    bold: true,
    color: p.blue,
    charSpace: 0.4,
  } as Parameters<Slide['addText']>[1])
  text(slide, spec.title.toUpperCase(), 0.62, 0.82, 7.55, 0.72, {
    fontFace: DISPLAY,
    fontSize: 27,
    bold: true,
    color: p.ink,
  })
  if (spec.description) {
    text(slide, spec.description, 8.6, 0.82, 3.8, 0.5, {
      fontSize: 9.5,
      color: p.muted,
      valign: 'middle',
    })
  }
}

function firstKpi(spec: ArtifactSpec): KpiItem | undefined {
  return spec.blocks.find((b): b is Extract<ArtifactBlock, { type: 'kpi' }> => b.type === 'kpi')?.items[0]
}

function get<T extends ArtifactBlock['type']>(spec: ArtifactSpec, type: T): Extract<ArtifactBlock, { type: T }> | undefined {
  return spec.blocks.find((block): block is Extract<ArtifactBlock, { type: T }> => block.type === type)
}

function toneColor(theme: PptxTheme, tone?: KpiItem['tone']) {
  const p = color(theme)
  if (tone === 'good') return p.blue
  if (tone === 'warning') return p.yellow
  if (tone === 'bad') return p.red
  if (tone === 'accent') return p.pink
  return p.ink
}

function accentFor(index: number, theme: PptxTheme) {
  const p = color(theme)
  return [p.red, p.yellow, p.pink, p.orange][index % 4]
}

function seriesColor(index: number, theme: PptxTheme) {
  const p = color(theme)
  return [p.blue, p.orange, p.pink, p.yellow, p.blue2][index % 5]
}

function surface(theme: PptxTheme) {
  return theme === 'dark' ? T.dark.paper : 'FFFFFF'
}

function surfaceAlt(theme: PptxTheme) {
  return theme === 'dark' ? '111827' : 'F0F6FF'
}

function renderKpiRow(slide: Slide, items: KpiItem[], theme: PptxTheme, x: number, y: number, w: number) {
  const p = color(theme)
  const count = Math.min(items.length, 4)
  const cellW = w / count
  items.slice(0, count).forEach((item, index) => {
    const cx = x + index * cellW
    if (index > 0) line(slide, cx, y + 0.05, 0, 1.0, p.faint, 0.7)
    text(slide, item.value, cx + 0.18, y + 0.02, cellW - 0.34, 0.42, {
      fontFace: DISPLAY,
      fontSize: 24,
      bold: true,
      color: toneColor(theme, item.tone),
    })
    text(slide, item.label, cx + 0.18, y + 0.55, cellW - 0.34, 0.22, {
      fontSize: 7.8,
      color: p.muted,
    })
    if (item.delta) {
      const badgeColor = item.tone && item.tone !== 'neutral' ? toneColor(theme, item.tone) : accentFor(index, theme)
      rect(slide, cx + 0.18, y + 0.82, 0.13, 0.13, badgeColor)
      text(slide, item.delta, cx + 0.38, y + 0.79, cellW - 0.54, 0.18, {
        fontSize: 7.2,
        bold: true,
        color: p.ink,
      })
    }
  })
}

function renderInsight(slide: Slide, value: string, theme: PptxTheme, x: number, y: number, w: number, h: number, strong = false) {
  const p = color(theme)
  panel(slide, x, y, w, h, strong ? p.blue : p.paper, strong ? p.blue : p.faint)
  text(slide, value, x + 0.26, y + 0.26, w - 0.52, h - 0.52, {
    fontSize: strong ? 20 : 14,
    bold: true,
    color: strong ? 'FFFFFF' : p.ink,
    valign: 'middle',
  })
}

function chartValues(block: ChartBlock) {
  return block.datasets.flatMap(dataset => dataset.data)
}

function renderBarOrLineChart(slide: Slide, block: ChartBlock, theme: PptxTheme, x: number, y: number, w: number, h: number) {
  const p = color(theme)
  const datasets = block.datasets.filter(dataset => dataset.data.length > 0)
  const values = datasets.flatMap(dataset => dataset.data)
  const max = Math.max(...values, 1)
  const min = Math.min(0, ...values)
  const chartTop = y + 0.92
  const chartBottom = y + h - 0.62
  const chartLeft = x + 0.58
  const chartRight = x + w - 0.28
  const chartH = chartBottom - chartTop
  const chartW = chartRight - chartLeft
  const range = Math.max(max - min, 1)

  text(slide, block.title ?? block.datasets[0]?.label ?? 'Graf', x + 0.26, y + 0.18, w * 0.58, 0.26, {
    fontSize: 11,
    bold: true,
    color: p.ink,
  })
  if (block.subtitle || block.yAxisLabel) {
    text(slide, block.subtitle ?? block.yAxisLabel ?? '', x + 0.26, y + 0.48, w * 0.62, 0.2, {
      fontSize: 7.2,
      color: p.muted,
    })
  }
  if (block.summaryValue) {
    text(slide, block.summaryValue, x + w - 1.95, y + 0.12, 1.65, 0.46, {
      fontFace: DISPLAY,
      fontSize: 23,
      bold: true,
      color: p.blue,
      align: 'right',
    })
  }

  datasets.slice(0, 4).forEach((dataset, index) => {
    const lx = x + w - 2.25
    const ly = y + 0.2 + index * 0.22
    rect(slide, lx, ly + 0.04, 0.14, 0.08, seriesColor(index, theme))
    text(slide, dataset.label, lx + 0.22, ly, 1.85, 0.16, {
      fontSize: 6.4,
      color: p.muted,
    })
  })

  for (let i = 0; i <= 4; i += 1) {
    const gy = chartTop + (chartH / 4) * i
    line(slide, chartLeft, gy, chartW, 0, p.faint, 0.45)
    const tick = Math.round(max - (range / 4) * i)
    text(slide, `${tick}`, x + 0.14, gy - 0.06, 0.32, 0.14, { fontSize: 5.8, color: p.muted, align: 'right' })
  }
  line(slide, chartLeft, chartBottom, chartW, 0, p.ink, 0.8)
  line(slide, chartLeft, chartTop, 0, chartH, p.faint, 0.55)

  if (block.kind === 'line' || block.kind === 'area') {
    datasets.forEach((dataset, datasetIndex) => {
      const stroke = seriesColor(datasetIndex, theme)
      const points = block.labels.map((_, index) => {
        const value = dataset.data[index] ?? 0
        return {
          x: chartLeft + (chartW / Math.max(block.labels.length - 1, 1)) * index,
          y: chartBottom - ((value - min) / range) * chartH,
          value,
        }
      })
      for (let i = 0; i < points.length - 1; i += 1) {
        line(slide, points[i].x, points[i].y, points[i + 1].x - points[i].x, points[i + 1].y - points[i].y, stroke, datasetIndex === 0 ? 2.2 : 1.7)
      }
      points.forEach((point, index) => {
        const highlight = datasetIndex === 0 && index === block.highlightIndex
        dot(slide, point.x - 0.05, point.y - 0.05, highlight ? 0.13 : 0.1, stroke)
        if ((block.showValueLabels || highlight) && (datasetIndex === 0 || point.value !== 0)) {
          text(slide, `${point.value}${block.unit ? ` ${block.unit}` : ''}`, point.x - 0.3, point.y - 0.28 - datasetIndex * 0.12, 0.6, 0.13, {
            fontSize: 5.8,
            bold: highlight,
            color: p.ink,
            align: 'center',
          })
        }
      })
    })
  } else {
    const groupGap = 0.14
    const seriesGap = 0.04
    const groupW = Math.max(0.22, (chartW - groupGap * (block.labels.length - 1)) / Math.max(block.labels.length, 1))
    const barW = Math.max(0.08, (groupW - seriesGap * Math.max(datasets.length - 1, 0)) / Math.max(datasets.length, 1))
    block.labels.forEach((_, labelIndex) => {
      datasets.forEach((dataset, datasetIndex) => {
        const value = dataset.data[labelIndex] ?? 0
        const bh = Math.max(0.04, ((value - min) / range) * chartH)
        const bx = chartLeft + labelIndex * (groupW + groupGap) + datasetIndex * (barW + seriesGap)
        const by = chartBottom - bh
        rect(slide, bx, by, barW, bh, seriesColor(datasetIndex, theme))
        if (block.showValueLabels !== false && (datasetIndex === 0 || value !== 0)) {
          text(slide, `${value}${block.unit ? ` ${block.unit}` : ''}`, bx - 0.08, by - 0.22 - datasetIndex * 0.1, barW + 0.16, 0.16, {
            fontSize: 5.8,
            bold: true,
            color: p.ink,
            align: 'center',
          })
        }
      })
    })
  }

  block.labels.forEach((label, index) => {
    const lx = block.kind === 'line' || block.kind === 'area'
      ? chartLeft + (chartW / Math.max(block.labels.length - 1, 1)) * index
      : chartLeft + ((chartW / Math.max(block.labels.length, 1)) * index) + chartW / Math.max(block.labels.length, 1) / 2
    text(slide, label.length > 10 ? `${label.slice(0, 9)}.` : label, lx - 0.34, chartBottom + 0.16, 0.68, 0.16, {
      fontSize: 5.9,
      color: p.muted,
      align: 'center',
    })
  })

  if (block.annotation || block.caption) {
    text(slide, block.annotation ?? block.caption ?? '', x + 0.28, y + h - 0.28, w - 0.56, 0.16, {
      fontSize: 6.8,
      color: p.muted,
    })
  }
}

function renderDotChart(slide: Slide, block: ChartBlock, theme: PptxTheme, x: number, y: number, w: number, h: number) {
  const p = color(theme)
  const values = chartValues(block)
  const max = Math.max(...values, 1)
  const rows = 10
  const colsPer = 4
  const dotSize = Math.min((w - 0.9) / (values.length * colsPer * 1.55), (h - 1.65) / (rows * 1.55))
  const gap = dotSize * 0.55
  const gridW = values.length * colsPer * dotSize + (values.length * colsPer - 1) * gap
  const startX = x + Math.max(0.35, (w - gridW) / 2)
  const startY = y + 0.82

  text(slide, block.title ?? 'Dot matrix', x + 0.25, y + 0.18, w - 1.9, 0.24, { fontSize: 10.5, bold: true, color: p.ink })
  if (block.summaryValue) {
    text(slide, block.summaryValue, x + w - 1.85, y + 0.12, 1.55, 0.38, {
      fontFace: DISPLAY,
      fontSize: 20,
      bold: true,
      color: p.blue,
      align: 'right',
    })
  }
  if (block.subtitle) text(slide, block.subtitle, x + 0.25, y + 0.48, w - 0.5, 0.18, { fontSize: 6.8, color: p.muted })

  values.forEach((value, valueIndex) => {
    const activeRows = Math.max(1, Math.round((value / max) * rows))
    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < colsPer; col += 1) {
        const active = rows - row <= activeRows
        dot(
          slide,
          startX + valueIndex * colsPer * (dotSize + gap) + col * (dotSize + gap),
          startY + row * (dotSize + gap),
          dotSize,
          active ? p.blue : p.faint,
          active ? 0 : 18
        )
      }
    }
    const labelX = startX + valueIndex * colsPer * (dotSize + gap) - 0.05
    text(slide, block.labels[valueIndex] ?? '', labelX, startY + rows * (dotSize + gap) + 0.1, colsPer * (dotSize + gap) + 0.1, 0.14, {
      fontSize: 5.8,
      color: p.muted,
      align: 'center',
    })
    text(slide, `${value}${block.unit ? ` ${block.unit}` : ''}`, labelX - 0.05, startY + rows * (dotSize + gap) + 0.3, colsPer * (dotSize + gap) + 0.2, 0.14, {
      fontSize: 5.8,
      bold: true,
      color: p.ink,
      align: 'center',
    })
  })
  if (block.annotation) text(slide, block.annotation, x + 0.25, y + h - 0.28, w - 0.5, 0.16, { fontSize: 6.7, color: p.muted })
}

function renderDonutLegend(slide: Slide, block: ChartBlock, theme: PptxTheme, x: number, y: number, w: number) {
  const p = color(theme)
  const values = chartValues(block)
  const total = values.reduce((sum, v) => sum + v, 0) || 1
  text(slide, block.title ?? 'Rozpad', x + 0.24, y + 0.18, w - 0.48, 0.24, { fontSize: 10.5, bold: true, color: p.ink })
  values.slice(0, 5).forEach((value, index) => {
    const pct = Math.round((value / total) * 100)
    const cy = y + 0.7 + index * 0.42
    const shade = index === 0 ? p.blue : index === 1 ? p.blue2 : index === 2 ? p.navy : p.faint
    rect(slide, x + 0.26, cy, 0.18, 0.18, shade)
    text(slide, block.labels[index] ?? '', x + 0.55, cy - 0.02, w - 1.55, 0.18, { fontSize: 7.4, color: p.ink })
    text(slide, `${pct}%`, x + w - 0.85, cy - 0.02, 0.55, 0.18, { fontSize: 7.4, bold: true, color: p.ink, align: 'right' })
    rect(slide, x + 0.55, cy + 0.22, (w - 1.45) * (pct / 100), 0.035, shade)
  })
}

function renderChart(slide: Slide, block: ChartBlock, theme: PptxTheme, x: number, y: number, w: number, h: number) {
  const p = color(theme)
  panel(slide, x, y, w, h, surface(theme), p.faint)
  if (block.kind === 'dotMatrix') renderDotChart(slide, block, theme, x, y, w, h)
  else if (block.kind === 'donut') renderDonutLegend(slide, block, theme, x, y, w)
  else renderBarOrLineChart(slide, block, theme, x, y, w, h)
}

function renderTable(slide: Slide, block: Extract<ArtifactBlock, { type: 'table' }>, theme: PptxTheme, x: number, y: number, w: number, h: number) {
  const p = color(theme)
  panel(slide, x, y, w, h, surface(theme), p.faint)
  text(slide, block.title ?? 'Tabulka', x + 0.28, y + 0.22, w - 0.56, 0.28, { fontSize: 13, bold: true, color: p.ink })
  const headers = block.headers.slice(0, 5)
  const rows = block.rows.slice(0, 6)
  const colW = (w - 0.56) / headers.length
  const top = y + 0.78
  rect(slide, x + 0.28, top, w - 0.56, 0.34, p.blue)
  headers.forEach((header, i) => text(slide, header, x + 0.38 + i * colW, top + 0.1, colW - 0.1, 0.12, {
    fontSize: 6.3,
    bold: true,
    color: 'FFFFFF',
  }))
  rows.forEach((row, ri) => {
    const ry = top + 0.44 + ri * 0.38
    if (ri % 2 === 0) rect(slide, x + 0.28, ry - 0.04, w - 0.56, 0.32, surfaceAlt(theme))
    headers.forEach((header, ci) => text(slide, String(row[ci] ?? ''), x + 0.38 + ci * colW, ry + 0.04, colW - 0.12, 0.16, {
      fontSize: 6.4,
      color: p.ink,
    }))
  })
}

function renderBullets(slide: Slide, block: Extract<ArtifactBlock, { type: 'text' }>, theme: PptxTheme, x: number, y: number, w: number, h: number) {
  const p = color(theme)
  panel(slide, x, y, w, h, surface(theme), p.faint)
  text(slide, block.title ?? 'Poznámky', x + 0.28, y + 0.24, w - 0.56, 0.24, { fontSize: 11.5, bold: true, color: p.ink })
  block.bullets.slice(0, 4).forEach((bullet, index) => {
    const by = y + 0.72 + index * 0.48
    rect(slide, x + 0.3, by + 0.04, 0.09, 0.09, accentFor(index, theme))
    text(slide, bullet, x + 0.48, by, w - 0.72, 0.28, { fontSize: 8.4, color: p.ink })
  })
}

function renderCover(prs: Prs, deck: ArtifactDeck, theme: PptxTheme) {
  const slide = prs.addSlide()
  const p = color(theme)
  addBase(slide, theme, 'blue')
  text(slide, deck.subtitle ?? 'Back Office Agent', 0.68, 0.9, 3.6, 0.18, { fontSize: 7.6, bold: true, color: 'DDEBFF' })
  text(slide, deck.title.toUpperCase(), 0.65, 1.55, 7.2, 2.1, {
    fontFace: DISPLAY,
    fontSize: 43,
    bold: true,
    color: 'FFFFFF',
  })
  if (deck.description) text(slide, deck.description, 0.72, 4.15, 5.9, 0.5, { fontSize: 12, color: 'DDEBFF' })
  text(slide, `${deck.slides.length} slidů`, 10.65, 6.55, 1.3, 0.18, { fontSize: 8, bold: true, color: 'FFFFFF', align: 'right' })
  text(slide, 'PPTX render / LibreOffice verified', 0.72, 6.55, 3.2, 0.18, { fontSize: 7.2, color: p.blue2 })
}

function renderSummary(slide: Slide, spec: ArtifactSpec, theme: PptxTheme, page: number) {
  titleBlock(slide, spec, theme, page)
  const kpi = get(spec, 'kpi')
  const insight = get(spec, 'insight')
  const bullets = get(spec, 'text')
  if (kpi) renderKpiRow(slide, kpi.items, theme, 0.65, 1.85, 11.7)
  if (insight) renderInsight(slide, insight.text, theme, 0.65, 3.22, 5.85, 2.35, true)
  if (bullets) renderBullets(slide, bullets, theme, 6.78, 3.22, 5.75, 2.35)
}

function renderChartFocus(slide: Slide, spec: ArtifactSpec, theme: PptxTheme, page: number) {
  titleBlock(slide, spec, theme, page)
  const chart = get(spec, 'chart')
  const donut = spec.blocks.find((b): b is ChartBlock => b.type === 'chart' && b.kind === 'donut')
  const insight = get(spec, 'insight')
  if (chart) renderChart(slide, chart, theme, 0.65, 1.72, 8.35, 5.02)
  if (donut && donut !== chart) renderChart(slide, donut, theme, 9.25, 1.72, 3.05, 2.45)
  if (insight) renderInsight(slide, insight.text, theme, 9.25, 4.38, 3.05, 2.02)
}

function renderBigNumber(slide: Slide, spec: ArtifactSpec, theme: PptxTheme, page: number) {
  const p = color(theme)
  titleBlock(slide, spec, theme, page)
  const main = firstKpi(spec)
  const chart = get(spec, 'chart')
  const insight = get(spec, 'insight')
  text(slide, main?.value ?? '0', 0.68, 2.0, 3.35, 1.3, {
    fontFace: DISPLAY,
    fontSize: 64,
    bold: true,
    color: p.blue,
  })
  text(slide, main?.label ?? '', 0.76, 3.32, 3.0, 0.24, { fontSize: 9, bold: true, color: p.ink })
  if (insight) text(slide, insight.text, 0.76, 3.82, 3.05, 1.1, { fontSize: 12.2, color: p.ink, bold: true })
  if (chart) renderChart(slide, chart, theme, 4.18, 1.78, 8.05, 4.9)
}

function renderTableFocus(slide: Slide, spec: ArtifactSpec, theme: PptxTheme, page: number) {
  titleBlock(slide, spec, theme, page)
  const table = get(spec, 'table')
  const bullets = get(spec, 'text')
  const insight = get(spec, 'insight')
  if (table) renderTable(slide, table, theme, 0.65, 1.85, 8.0, 4.75)
  if (bullets) renderBullets(slide, bullets, theme, 9.0, 1.85, 3.25, 2.15)
  if (insight) renderInsight(slide, insight.text, theme, 9.0, 4.3, 3.25, 1.45)
}

function renderTimeline(slide: Slide, spec: ArtifactSpec, theme: PptxTheme, page: number) {
  const p = color(theme)
  titleBlock(slide, spec, theme, page)
  const bullets = get(spec, 'text')?.bullets.slice(0, 4) ?? []
  line(slide, 0.85, 3.15, 11.55, 0, p.faint, 1)
  bullets.forEach((bullet, index) => {
    const x = 0.9 + index * 3.0
    dot(slide, x, 3.08, 0.15, accentFor(index, theme))
    text(slide, `0${index + 1}`, x - 0.02, 3.45, 0.5, 0.26, { fontFace: DISPLAY, fontSize: 18, bold: true, color: p.blue })
    text(slide, bullet, x, 4.0, 2.3, 0.72, { fontSize: 10, bold: true, color: p.ink })
  })
  const insight = get(spec, 'insight')
  if (insight) renderInsight(slide, insight.text, theme, 0.82, 5.55, 11.5, 0.78)
}

function renderContentSlide(prs: Prs, spec: ArtifactSpec, theme: PptxTheme, page: number) {
  const slide = prs.addSlide()
  addBase(slide, theme, 'paper')
  const layout = spec.layout ?? 'summary'
  if (layout === 'chart-focus') renderChartFocus(slide, spec, theme, page)
  else if (layout === 'big-number') renderBigNumber(slide, spec, theme, page)
  else if (layout === 'table-focus') renderTableFocus(slide, spec, theme, page)
  else if (layout === 'timeline') renderTimeline(slide, spec, theme, page)
  else renderSummary(slide, spec, theme, page)
  footer(slide, theme, spec.sources?.[0]?.label, page)
}

export async function generateArtifactPptx(spec: ArtifactSpec, theme: PptxTheme): Promise<string> {
  const prs = new pptxgen()
  prs.layout = 'LAYOUT_WIDE'
  prs.author = 'Back Office Agent Artifact Lab'
  renderContentSlide(prs, spec, theme, 1)
  return await prs.write({ outputType: 'base64' }) as string
}

export async function generateArtifactDeckPptx(deck: ArtifactDeck, theme: PptxTheme): Promise<string> {
  const prs = new pptxgen()
  prs.layout = 'LAYOUT_WIDE'
  prs.author = 'Back Office Agent Artifact Lab'
  renderCover(prs, deck, theme)
  deck.slides.slice(0, 12).forEach((slide, index) => renderContentSlide(prs, slide, theme, index + 2))
  return await prs.write({ outputType: 'base64' }) as string
}

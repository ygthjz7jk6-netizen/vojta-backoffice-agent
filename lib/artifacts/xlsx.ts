import * as XLSX from 'xlsx'
import type { ArtifactBlock, ArtifactDeck, ArtifactSpec, ChartBlock } from './types'

function safeSheetName(value: string, fallback: string) {
  return (value || fallback).replace(/[:\\/?*[\]]/g, ' ').slice(0, 31).trim() || fallback
}

function safeFilePart(value: string) {
  return value.replace(/[^a-z0-9_-]+/gi, '_').replace(/^_+|_+$/g, '').slice(0, 80) || 'artifact'
}

function chartRows(block: ChartBlock): Array<Array<string | number>> {
  const headers = ['Kategorie', ...block.datasets.map(dataset => dataset.label)]
  const rows = block.labels.map((label, index) => [
    label,
    ...block.datasets.map(dataset => dataset.data[index] ?? null),
  ])
  return [
    [block.title ?? 'Graf'],
    [block.subtitle ?? block.yAxisLabel ?? ''],
    [],
    headers,
    ...rows,
  ]
}

function tableRows(block: Extract<ArtifactBlock, { type: 'table' }>): Array<Array<string | number | null>> {
  return [
    [block.title ?? 'Tabulka'],
    [],
    block.headers,
    ...block.rows,
  ]
}

function kpiRows(block: Extract<ArtifactBlock, { type: 'kpi' }>): Array<Array<string | number | null>> {
  return [
    ['KPI', 'Hodnota', 'Změna', 'Tón'],
    ...block.items.map(item => [item.label, item.value, item.delta ?? '', item.tone ?? 'neutral']),
  ]
}

function appendSpecSheets(workbook: XLSX.WorkBook, spec: ArtifactSpec, prefix = '') {
  const summaryRows: Array<Array<string | number | null>> = [
    ['Název', spec.title],
    ['Podtitul', spec.subtitle ?? ''],
    ['Popis', spec.description ?? ''],
    ['Layout', spec.layout ?? 'summary'],
    ['Zdroj', spec.sources?.map(source => source.label).join(', ') ?? ''],
  ]
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(summaryRows), safeSheetName(`${prefix}Souhrn`, 'Souhrn'))

  spec.blocks.forEach((block, index) => {
    if (block.type === 'chart') {
      const sheet = XLSX.utils.aoa_to_sheet(chartRows(block))
      XLSX.utils.book_append_sheet(workbook, sheet, safeSheetName(`${prefix}Graf ${index + 1}`, `Graf ${index + 1}`))
    } else if (block.type === 'table') {
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(tableRows(block)), safeSheetName(`${prefix}Tabulka ${index + 1}`, `Tabulka ${index + 1}`))
    } else if (block.type === 'kpi') {
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(kpiRows(block)), safeSheetName(`${prefix}KPI ${index + 1}`, `KPI ${index + 1}`))
    }
  })
}

export function generateArtifactXlsx(input: ArtifactSpec | ArtifactDeck): { base64: string; filename: string } {
  const workbook = XLSX.utils.book_new()

  if ('slides' in input) {
    input.slides.forEach((slide, index) => appendSpecSheets(workbook, slide, `${index + 1} `))
  } else {
    appendSpecSheets(workbook, input)
  }

  const base64 = XLSX.write(workbook, {
    type: 'base64',
    bookType: 'xlsx',
    compression: true,
  }) as string

  return {
    base64,
    filename: `${safeFilePart(input.title)}_data.xlsx`,
  }
}

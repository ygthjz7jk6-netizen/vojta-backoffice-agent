'use client'

import { Badge } from '@/components/ui/badge'
import { Download, ExternalLink, FileText } from 'lucide-react'
import { ChartEmbed } from '@/components/charts/ChartEmbed'
import { AgentMark } from '@/components/brand/AgentMark'
import type { AgentMessage } from '@/types'
import type { ChartConfiguration } from 'chart.js'

interface Props {
  message: AgentMessage
}

function extractChartConfig(tool_calls?: AgentMessage['tool_calls']): ChartConfiguration | null {
  if (!tool_calls) return null
  for (const tc of tool_calls) {
    const t = tc as { name: string; output?: { chart_config?: ChartConfiguration } }
    if (t.output?.chart_config) return t.output.chart_config
  }
  return null
}

interface PptxInfo { slidesSpec: unknown; title: string }

function extractPptx(tool_calls?: AgentMessage['tool_calls']): PptxInfo | null {
  if (!tool_calls) return null
  for (const tc of tool_calls) {
    const t = tc as { name: string; output?: { presentation_ready?: boolean; slides_spec?: unknown; title?: string } }
    if (t.output?.presentation_ready && t.output.slides_spec) {
      return { slidesSpec: t.output.slides_spec, title: t.output.title ?? 'prezentace' }
    }
  }
  return null
}

async function downloadPptx(slidesSpec: unknown, title: string) {
  const res = await fetch('/api/export/pptx', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(slidesSpec),
  })
  if (!res.ok) { alert('Chyba při generování PPTX'); return }
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${title.replace(/\s+/g, '_')}.pptx`
  a.click()
  URL.revokeObjectURL(url)
}

export function MessageBubble({ message }: Props) {
  const isUser = message.role === 'user'
  const chartConfig = isUser ? null : extractChartConfig(message.tool_calls)
  const pptxInfo = isUser ? null : extractPptx(message.tool_calls)

  if (isUser) {
    return (
      <div className="mx-auto flex w-full max-w-3xl justify-end px-1">
        <div className="max-w-[min(560px,82%)] rounded-[1.35rem] bg-slate-100 px-4 py-2.5 text-sm leading-6 text-slate-900 shadow-sm">
          <p className="whitespace-pre-wrap">{message.content}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl gap-3 px-1">
      <AgentMark className="mt-0.5 h-9 w-9" />

      <div className="min-w-0 flex-1">
        <div className="max-w-[min(720px,100%)] pt-1">
          <p className="whitespace-pre-wrap text-[15px] leading-7 text-slate-900">{message.content}</p>
          <p className="mt-5 text-xs text-slate-400">
            {new Date(message.created_at).toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>

        {/* Sources / Citations */}
        {message.sources && message.sources.length > 0 && (
          <div className="mt-3 space-y-2">
            <p className="px-1 text-xs font-semibold text-slate-500">Zdroje</p>
            {message.sources.map((citation, i) => (
              <div
                key={i}
                className="flex items-start gap-2 rounded-2xl border border-white/70 bg-white/70 px-3 py-2 shadow-sm shadow-blue-950/5 backdrop-blur-xl"
              >
                <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-600" />
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-slate-800">{citation.source_file}</p>
                  <p className="text-xs text-slate-500">
                    {[citation.source_type, citation.rows, citation.ingested_at
                      ? new Date(citation.ingested_at).toLocaleDateString('cs-CZ')
                      : null
                    ].filter(Boolean).join(' • ')}
                  </p>
                </div>
                {citation.url && (
                  <a href={citation.url} target="_blank" rel="noopener noreferrer" className="ml-auto">
                    <ExternalLink className="h-3.5 w-3.5 text-slate-500 hover:text-blue-700" />
                  </a>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Graf */}
        {chartConfig && <ChartEmbed config={chartConfig} />}

        {/* PPTX download */}
        {pptxInfo && (
          <div className="mt-3">
            <button
              onClick={() => downloadPptx(pptxInfo.slidesSpec, pptxInfo.title)}
              className="flex items-center gap-2 rounded-full bg-gradient-to-r from-sky-500 to-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 transition-all hover:brightness-105"
            >
              <Download className="w-4 h-4" />
              Stáhnout prezentaci (.pptx)
            </button>
          </div>
        )}

        {/* Tool calls badge */}
        {message.tool_calls && message.tool_calls.length > 0 && (
          <details className="mt-2 px-1">
            <summary className="cursor-pointer text-xs font-semibold text-slate-500">Použité nástroje</summary>
            <div className="mt-2 flex flex-wrap gap-1">
              {message.tool_calls.map((tc, i) => (
                <Badge key={i} variant="secondary" className="rounded-full bg-sky-100 text-xs text-blue-700">
                  {(tc as { name: string }).name}
                </Badge>
              ))}
            </div>
          </details>
        )}
      </div>
    </div>
  )
}

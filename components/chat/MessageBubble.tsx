'use client'

import { Badge } from '@/components/ui/badge'
import { Bot, Download, ExternalLink, FileText, User } from 'lucide-react'
import { ChartEmbed } from '@/components/charts/ChartEmbed'
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

  return (
    <div className="mx-auto flex w-full max-w-4xl gap-3">
      <div
        className={`mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${
          isUser ? 'bg-neutral-200 text-neutral-700' : 'bg-neutral-950 text-white'
        }`}
      >
        {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </div>

      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-center gap-2">
          <span className="text-xs font-medium text-neutral-500">{isUser ? 'Ty' : 'Agent'}</span>
          <span className="text-xs text-neutral-400">
            {new Date(message.created_at).toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>

        <div className={`rounded-md border px-4 py-3 ${
          isUser
            ? 'border-neutral-200 bg-neutral-100 text-neutral-900'
            : 'border-neutral-200 bg-white text-neutral-950'
        }`}>
          <p className="whitespace-pre-wrap text-sm leading-6">{message.content}</p>
        </div>

        {/* Sources / Citations */}
        {message.sources && message.sources.length > 0 && (
          <div className="mt-3 space-y-2">
            <p className="px-1 text-xs font-medium text-neutral-500">Zdroje</p>
            {message.sources.map((citation, i) => (
              <div
                key={i}
                className="flex items-start gap-2 rounded-md border border-neutral-200 bg-white px-3 py-2"
              >
                <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0 text-neutral-500" />
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium text-neutral-800">{citation.source_file}</p>
                  <p className="text-xs text-neutral-500">
                    {[citation.source_type, citation.rows, citation.ingested_at
                      ? new Date(citation.ingested_at).toLocaleDateString('cs-CZ')
                      : null
                    ].filter(Boolean).join(' • ')}
                  </p>
                </div>
                {citation.url && (
                  <a href={citation.url} target="_blank" rel="noopener noreferrer" className="ml-auto">
                    <ExternalLink className="h-3.5 w-3.5 text-neutral-500" />
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
              className="flex items-center gap-2 rounded-md bg-neutral-950 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-neutral-800"
            >
              <Download className="w-4 h-4" />
              Stáhnout prezentaci (.pptx)
            </button>
          </div>
        )}

        {/* Tool calls badge */}
        {message.tool_calls && message.tool_calls.length > 0 && (
          <details className="mt-2 px-1">
            <summary className="cursor-pointer text-xs font-medium text-neutral-500">Použité nástroje</summary>
            <div className="mt-2 flex flex-wrap gap-1">
              {message.tool_calls.map((tc, i) => (
                <Badge key={i} variant="secondary" className="text-xs">
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

'use client'

import { Badge } from '@/components/ui/badge'
import { FileText, ExternalLink } from 'lucide-react'
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

export function MessageBubble({ message }: Props) {
  const isUser = message.role === 'user'
  const chartConfig = isUser ? null : extractChartConfig(message.tool_calls)

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} max-w-4xl mx-auto w-full`}>
      <div className={`max-w-[80%] ${isUser ? 'order-2' : 'order-1'}`}>
        {/* Bubble */}
        <div
          className={`rounded-2xl px-4 py-3 ${
            isUser
              ? 'bg-blue-600 text-white rounded-br-sm'
              : 'bg-white border border-gray-200 text-gray-900 rounded-bl-sm shadow-sm'
          }`}
        >
          <p className="text-sm whitespace-pre-wrap leading-relaxed">{message.content}</p>
        </div>

        {/* Sources / Citations */}
        {message.sources && message.sources.length > 0 && (
          <div className="mt-2 space-y-1">
            <p className="text-xs text-gray-400 font-medium px-1">Zdroje:</p>
            {message.sources.map((citation, i) => (
              <div
                key={i}
                className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2"
              >
                <FileText className="w-3 h-3 text-amber-600 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-medium text-amber-800">{citation.source_file}</p>
                  <p className="text-xs text-amber-600">
                    {[citation.source_type, citation.rows, citation.ingested_at
                      ? new Date(citation.ingested_at).toLocaleDateString('cs-CZ')
                      : null
                    ].filter(Boolean).join(' • ')}
                  </p>
                </div>
                {citation.url && (
                  <a href={citation.url} target="_blank" rel="noopener noreferrer" className="ml-auto">
                    <ExternalLink className="w-3 h-3 text-amber-600" />
                  </a>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Graf */}
        {chartConfig && <ChartEmbed config={chartConfig} />}

        {/* Tool calls badge */}
        {message.tool_calls && message.tool_calls.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1 px-1">
            {message.tool_calls.map((tc, i) => (
              <Badge key={i} variant="secondary" className="text-xs">
                {(tc as { name: string }).name}
              </Badge>
            ))}
          </div>
        )}

        <p className="text-xs text-gray-400 mt-1 px-1">
          {new Date(message.created_at).toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
    </div>
  )
}

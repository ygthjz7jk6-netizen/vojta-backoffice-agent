// @ts-nocheck
'use client'

import { Badge } from '@/components/ui/badge'
import { Download, ExternalLink, FileText } from 'lucide-react'
import { ChartEmbed } from '@/components/charts/ChartEmbed'
import { AgentMark } from '@/components/brand/AgentMark'
import type { UIMessage } from '@ai-sdk/react'
import type { ChartConfiguration } from 'chart.js'
import type { ArtifactDeck, ArtifactSpec } from '@/lib/artifacts/types'

interface Props {
  message: UIMessage | any
}

function getMessageText(message: any): string {
  if (typeof message.content === 'string') return message.content
  if (Array.isArray(message.parts)) {
    return message.parts
      .filter((part: any) => part.type === 'text' && typeof part.text === 'string')
      .map((part: any) => part.text)
      .join('')
  }
  return ''
}

function hideAttachmentMetadata(text: string): string {
  return text
    .replace(
      /\n*\n?(?:Soubor už je uložený v systému, použij existující zpracovanou verzi\.\n)?Přiložený soubor: .+\nuploaded_file_id: .+\nchunk_count: .+\nPoužij search_documents s tímto uploaded_file_id, pokud odpovídáš na obsah souboru\.\s*$/s,
      ''
    )
    .trim()
}

function extractToolResults(message: any) {
  const outputsFromParts = (message?.parts || [])
    .filter((part: any) => part.type?.startsWith('tool-') && part.state === 'output-available')
    .map((part: any) => part.output)

  const outputsFromInvocations = (message?.toolInvocations || [])
    .filter((inv: any) => inv.state === 'result' && inv.result)
    .map((inv: any) => inv.result)

  return [...outputsFromParts, ...outputsFromInvocations]
}

function extractToolBadges(message: any) {
  const parts = (message?.parts || [])
    .filter((part: any) => part.type?.startsWith('tool-'))
    .map((part: any) => ({
      toolName: part.type.replace(/^tool-/, ''),
      state: part.state,
    }))

  const invocations = (message?.toolInvocations || []).map((inv: any) => ({
    toolName: inv.toolName,
    state: inv.state,
  }))

  return [...parts, ...invocations]
}

function extractCitations(message: any) {
  const results = extractToolResults(message)
  return results.flatMap(r => r.citations || [])
}

function extractChartConfig(message: any): ChartConfiguration | null {
  const results = extractToolResults(message)
  for (const t of results) {
    if (t.chart_config) return t.chart_config
  }
  return null
}

interface PptxInfo { slidesSpec: unknown; title: string }
interface ArtifactInfo {
  spec?: ArtifactSpec
  deck?: ArtifactDeck
  title: string
  type?: 'chart' | 'deck' | string
  pptxReady?: boolean
}

function extractPptx(message: any): PptxInfo | null {
  const results = extractToolResults(message)
  for (const t of results) {
    if (t.presentation_ready && t.slides_spec) {
      return { slidesSpec: t.slides_spec, title: t.title ?? 'prezentace' }
    }
  }
  return null
}

function extractArtifact(message: any): ArtifactInfo | null {
  const results = extractToolResults(message)
  for (const t of results) {
    if (t.artifact_ready && (t.artifact_spec || t.artifact_deck)) {
      const title = t.artifact_deck?.title ?? t.artifact_spec?.title ?? 'artifact'
      return {
        spec: t.artifact_spec,
        deck: t.artifact_deck,
        title,
        type: t.artifact_type,
        pptxReady: t.pptx_ready !== false,
      }
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

async function downloadArtifact(path: '/api/export/artifact-pptx', artifact: ArtifactInfo, extension: 'pptx') {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ spec: artifact.spec, deck: artifact.deck, theme: 'light' }),
  })
  if (!res.ok) { alert(`Chyba při generování ${extension.toUpperCase()}`); return }
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${artifact.title.replace(/\s+/g, '_')}.${extension}`
  a.click()
  URL.revokeObjectURL(url)
}

export function MessageBubble({ message }: Props) {
  const isUser = message.role === 'user'
  const rawText = getMessageText(message)
  const text = isUser ? hideAttachmentMetadata(rawText) : rawText
  const chartConfig = isUser ? null : extractChartConfig(message)
  const pptxInfo = isUser ? null : extractPptx(message)
  const artifactInfo = isUser ? null : extractArtifact(message)
  const isArtifactDeck = artifactInfo?.type === 'deck' || Boolean(artifactInfo?.deck)
  const showArtifactPptx = Boolean(artifactInfo?.pptxReady)
  const citations = isUser ? [] : extractCitations(message)
  const toolBadges = isUser ? [] : extractToolBadges(message)

  if (isUser) {
    return (
      <div className="mx-auto flex w-full max-w-3xl justify-end px-1">
        <div className="max-w-[min(560px,82%)] rounded-[1.35rem] bg-slate-100 px-4 py-2.5 text-sm leading-6 text-slate-900 shadow-sm">
          <p className="whitespace-pre-wrap">{text}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl gap-3 px-1">
      <AgentMark className="mt-0.5 h-9 w-9" />

      <div className="min-w-0 flex-1">
        <div className="max-w-[min(720px,100%)] pt-1">
          <p className="whitespace-pre-wrap text-[15px] leading-7 text-slate-900">{text}</p>
        </div>

        {/* Sources / Citations */}
        {citations.length > 0 && (
          <div className="mt-3 space-y-2">
            <p className="px-1 text-xs font-semibold text-slate-500">Zdroje</p>
            {citations.map((citation: any, i: number) => (
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
        {pptxInfo && !artifactInfo && (
          <div className="mt-3">
            <button
              type="button"
              onClick={() => downloadPptx(pptxInfo.slidesSpec, pptxInfo.title)}
              className="flex items-center gap-2 rounded-full bg-gradient-to-r from-sky-500 to-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 transition-all hover:brightness-105"
            >
              <Download className="w-4 h-4" />
              Stáhnout prezentaci (.pptx)
            </button>
          </div>
        )}

        {/* Artifact exports */}
        {artifactInfo && showArtifactPptx && (
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => downloadArtifact('/api/export/artifact-pptx', artifactInfo, 'pptx')}
              className="flex items-center gap-2 rounded-full bg-gradient-to-r from-sky-500 to-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 transition-all hover:brightness-105"
            >
              <Download className="w-4 h-4" />
              {isArtifactDeck ? 'Stáhnout prezentaci (.pptx)' : 'Stáhnout graf (.pptx)'}
            </button>
          </div>
        )}

        {/* Tool calls badge */}
        {toolBadges.length > 0 && (
          <details className="mt-2 px-1">
            <summary className="cursor-pointer text-xs font-semibold text-slate-500">Použité nástroje</summary>
            <div className="mt-2 flex flex-wrap gap-1">
              {toolBadges.map((tc, i) => (
                <Badge key={i} variant="secondary" className="rounded-full bg-sky-100 text-xs text-blue-700">
                  {tc.toolName}
                  {tc.state === 'input-streaming' || tc.state === 'input-available' ? ' (pracuji...)' : ''}
                </Badge>
              ))}
            </div>
          </details>
        )}
      </div>
    </div>
  )
}

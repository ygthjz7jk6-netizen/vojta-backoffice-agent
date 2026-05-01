'use client'

import { useMemo, useState } from 'react'
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  Database,
  FileSpreadsheet,
  FileText,
  Loader2,
  RefreshCw,
  Search,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import type { DocumentFile, DocumentsResponse, DocumentStatus } from '@/lib/documents/data'

const STATUS_FILTERS = [
  { value: 'all', label: 'Vše' },
  { value: 'ingested', label: 'Nasáté' },
  { value: 'error', label: 'Chyby' },
  { value: 'pending', label: 'Čeká' },
  { value: 'skipped', label: 'Přeskočené' },
]

const TYPE_FILTERS = [
  { value: 'all', label: 'Všechny typy' },
  { value: 'rag', label: 'Dokumenty' },
  { value: 'structured', label: 'Tabulky' },
]

function formatDate(value: string | null) {
  if (!value) return '—'
  return new Date(value).toLocaleString('cs-CZ', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function readableMime(mimeType: string) {
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel') || mimeType.includes('csv')) return 'Tabulka'
  if (mimeType.includes('pdf')) return 'PDF'
  if (mimeType.includes('document') || mimeType.includes('word')) return 'Dokument'
  if (mimeType.includes('text')) return 'Text'
  return mimeType.split('/').at(-1)?.toUpperCase() ?? mimeType
}

function StatusBadge({ status }: { status: DocumentStatus | null }) {
  if (status === 'ingested') {
    return <Badge className="bg-emerald-50 text-emerald-700 hover:bg-emerald-50">Nasáté</Badge>
  }
  if (status === 'error') {
    return <Badge className="bg-red-50 text-red-700 hover:bg-red-50">Chyba</Badge>
  }
  if (status === 'pending') {
    return <Badge className="bg-amber-50 text-amber-700 hover:bg-amber-50">Čeká</Badge>
  }
  if (status === 'skipped') {
    return <Badge className="bg-neutral-100 text-neutral-600 hover:bg-neutral-100">Přeskočeno</Badge>
  }
  return <Badge variant="secondary">{status ?? 'Neznámé'}</Badge>
}

function FileIcon({ file }: { file: DocumentFile }) {
  if (file.file_type === 'structured') return <FileSpreadsheet className="h-4 w-4 text-emerald-700" />
  return <FileText className="h-4 w-4 text-neutral-700" />
}

export function DocumentsPage({
  initialData,
  initialError,
}: {
  initialData: DocumentsResponse | null
  initialError: string | null
}) {
  const [data, setData] = useState<DocumentsResponse | null>(initialData)
  const [error, setError] = useState<string | null>(initialError)
  const [loading, setLoading] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')

  async function loadDocuments() {
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/documents')
      const payload = await res.json()
      if (!res.ok) throw new Error(payload.error ?? 'Dokumenty se nepodařilo načíst.')
      setData(payload)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  async function syncDrive() {
    setSyncing(true)
    setError(null)

    try {
      const res = await fetch('/api/cron/drive-sync?manual=1')
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(payload.error ?? 'Synchronizace selhala.')
      await loadDocuments()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSyncing(false)
    }
  }

  const filteredDocuments = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    return (data?.documents ?? []).filter(file => {
      const matchesQuery = !normalizedQuery || file.name.toLowerCase().includes(normalizedQuery)
      const matchesStatus = statusFilter === 'all' || file.status === statusFilter
      const matchesType = typeFilter === 'all' || file.file_type === typeFilter
      return matchesQuery && matchesStatus && matchesType
    })
  }, [data?.documents, query, statusFilter, typeFilter])

  return (
    <div className="flex h-full flex-col bg-neutral-50">
      <div className="shrink-0 border-b border-neutral-200 bg-white px-4 py-4 md:px-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-base font-semibold text-neutral-950">Dokumenty</h1>
            <p className="text-sm text-neutral-500">Drive soubory dostupné agentovi pro RAG a strukturované dotazy</p>
          </div>
          <Button onClick={syncDrive} disabled={syncing} className="w-full gap-2 lg:w-auto">
            {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Synchronizovat Drive
          </Button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 md:px-6">
        {error && (
          <div className="mb-4 flex items-start gap-3 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error === 'Unauthorized' ? 'Přihlas se Google účtem pro zobrazení dokumentů.' : error}</span>
          </div>
        )}

        <div className="grid gap-3 md:grid-cols-4">
          <Metric icon={Database} label="Souborů" value={data?.summary.total ?? 0} />
          <Metric icon={CheckCircle2} label="Nasáté" value={data?.summary.ingested ?? 0} />
          <Metric icon={FileText} label="Chunků" value={data?.summary.chunks ?? 0} />
          <Metric icon={Clock3} label="Poslední sync" value={formatDate(data?.summary.last_ingested_at ?? null)} compact />
        </div>

        <div className="mt-5 rounded-md border border-neutral-200 bg-white">
          <div className="flex flex-col gap-3 border-b border-neutral-200 p-3 lg:flex-row lg:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
              <Input
                value={query}
                onChange={event => setQuery(event.target.value)}
                placeholder="Hledat soubor"
                className="pl-9"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              {STATUS_FILTERS.map(filter => (
                <FilterButton
                  key={filter.value}
                  active={statusFilter === filter.value}
                  onClick={() => setStatusFilter(filter.value)}
                >
                  {filter.label}
                </FilterButton>
              ))}
            </div>

            <div className="flex flex-wrap gap-2">
              {TYPE_FILTERS.map(filter => (
                <FilterButton
                  key={filter.value}
                  active={typeFilter === filter.value}
                  onClick={() => setTypeFilter(filter.value)}
                >
                  {filter.label}
                </FilterButton>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="flex h-64 items-center justify-center gap-2 text-sm text-neutral-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Načítám dokumenty
            </div>
          ) : filteredDocuments.length === 0 ? (
            <div className="flex h-64 flex-col items-center justify-center text-center">
              <FileText className="mb-3 h-8 w-8 text-neutral-300" />
              <p className="text-sm font-medium text-neutral-800">Žádné dokumenty</p>
              <p className="mt-1 text-sm text-neutral-500">Změň filtr nebo spusť synchronizaci Drive.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] text-left text-sm">
                <thead className="bg-neutral-50 text-xs font-medium uppercase text-neutral-500">
                  <tr>
                    <th className="px-4 py-3">Soubor</th>
                    <th className="px-4 py-3">Stav</th>
                    <th className="px-4 py-3">Typ</th>
                    <th className="px-4 py-3 text-right">Chunky</th>
                    <th className="px-4 py-3">Změněno</th>
                    <th className="px-4 py-3">Nasáto</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {filteredDocuments.map(file => (
                    <tr key={file.id} className="align-top hover:bg-neutral-50">
                      <td className="px-4 py-3">
                        <div className="flex gap-3">
                          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-neutral-100">
                            <FileIcon file={file} />
                          </div>
                          <div className="min-w-0">
                            <p className="truncate font-medium text-neutral-950">{file.name}</p>
                            <p className="mt-0.5 text-xs text-neutral-500">{readableMime(file.mime_type)}</p>
                            {file.error_message && (
                              <p className="mt-2 max-w-xl text-xs text-red-700">{file.error_message}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3"><StatusBadge status={file.status} /></td>
                      <td className="px-4 py-3 text-neutral-700">
                        {file.file_type === 'structured' ? file.target_table ?? 'structured' : file.file_type ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-neutral-700">{file.chunk_count}</td>
                      <td className="px-4 py-3 text-neutral-600">{formatDate(file.modified_time)}</td>
                      <td className="px-4 py-3 text-neutral-600">{formatDate(file.ingested_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function Metric({
  icon: Icon,
  label,
  value,
  compact = false,
}: {
  icon: React.ElementType
  label: string
  value: string | number
  compact?: boolean
}) {
  return (
    <div className="rounded-md border border-neutral-200 bg-white px-4 py-3">
      <div className="flex items-center gap-2 text-xs font-medium text-neutral-500">
        <Icon className="h-4 w-4" />
        {label}
      </div>
      <div className={`mt-2 font-semibold text-neutral-950 ${compact ? 'text-sm' : 'text-2xl tabular-nums'}`}>
        {value}
      </div>
    </div>
  )
}

function FilterButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-9 rounded-md border px-3 text-sm font-medium transition-colors ${
        active
          ? 'border-neutral-950 bg-neutral-950 text-white'
          : 'border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50'
      }`}
    >
      {children}
    </button>
  )
}

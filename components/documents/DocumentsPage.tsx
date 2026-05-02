'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertCircle,
  ExternalLink,
  File,
  FileSpreadsheet,
  FileText,
  FolderOpen,
  HardDrive,
  LayoutGrid,
  List,
  Loader2,
  RefreshCw,
  Search,
  Tag,
  Trash2,
  Upload,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import type { DocumentFile, DocumentsResponse } from '@/lib/documents/data'

// ─── Typy ────────────────────────────────────────────────────────────────────

type UploadedFile = {
  id: string
  name: string
  category: string | null
  mime_type: string
  size_bytes: number | null
  chunk_count: number
  status: 'processing' | 'ready' | 'error'
  error_message: string | null
  uploaded_at: string
}

type UnifiedFile =
  | { source: 'drive'; data: DocumentFile }
  | { source: 'upload'; data: UploadedFile }

type SidebarSelection =
  | { type: 'all' }
  | { type: 'drive' }
  | { type: 'uploaded' }
  | { type: 'category'; name: string }

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fileDate(f: UnifiedFile): string {
  if (f.source === 'drive') return f.data.ingested_at ?? f.data.modified_time ?? ''
  return f.data.uploaded_at
}

function fileName(f: UnifiedFile): string {
  return f.data.name
}

function fileMime(f: UnifiedFile): string {
  return f.data.mime_type
}

function fileKey(f: UnifiedFile): string {
  return f.source === 'drive' ? `drive-${f.data.id}` : `upload-${f.data.id}`
}

function formatDate(val: string | null) {
  if (!val) return '—'
  return new Date(val).toLocaleDateString('cs-CZ', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function mimeIcon(mimeType: string) {
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel') || mimeType.includes('csv'))
    return <FileSpreadsheet className="h-8 w-8 text-emerald-600" />
  if (mimeType.includes('pdf'))
    return <FileText className="h-8 w-8 text-red-500" />
  if (mimeType.includes('document') || mimeType.includes('word'))
    return <FileText className="h-8 w-8 text-blue-600" />
  return <File className="h-8 w-8 text-neutral-500" />
}

function mimeIconSmall(mimeType: string) {
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel') || mimeType.includes('csv'))
    return <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
  if (mimeType.includes('pdf'))
    return <FileText className="h-4 w-4 text-red-500" />
  if (mimeType.includes('document') || mimeType.includes('word'))
    return <FileText className="h-4 w-4 text-blue-600" />
  return <File className="h-4 w-4 text-neutral-500" />
}

// ─── Kategorie — výběr barvy ──────────────────────────────────────────────────

const CATEGORY_COLORS = [
  'bg-blue-100 text-blue-700 ring-1 ring-blue-200/70',
  'bg-violet-100 text-violet-700 ring-1 ring-violet-200/70',
  'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200/70',
  'bg-amber-100 text-amber-700 ring-1 ring-amber-200/70',
  'bg-rose-100 text-rose-700 ring-1 ring-rose-200/70',
  'bg-cyan-100 text-cyan-700 ring-1 ring-cyan-200/70',
  'bg-orange-100 text-orange-700 ring-1 ring-orange-200/70',
  'bg-indigo-100 text-indigo-700 ring-1 ring-indigo-200/70',
]

function categoryColor(category: string): string {
  let hash = 0
  for (let i = 0; i < category.length; i++) hash = (hash * 31 + category.charCodeAt(i)) | 0
  return CATEGORY_COLORS[Math.abs(hash) % CATEGORY_COLORS.length]
}

// ─── Inline kategorie editor ──────────────────────────────────────────────────

function CategoryEditor({
  fileId,
  current,
  allCategories,
  onSaved,
}: {
  fileId: string
  current: string | null
  allCategories: string[]
  onSaved: (cat: string | null) => void
}) {
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState(current ?? '')
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50)
  }, [open])

  async function save() {
    setSaving(true)
    const cat = value.trim() || null
    await fetch(`/api/documents/uploaded/${fileId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category: cat }),
    })
    onSaved(cat)
    setOpen(false)
    setSaving(false)
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold transition-opacity hover:opacity-75 ${
          current ? categoryColor(current) : 'bg-slate-100 text-slate-500 ring-1 ring-slate-200'
        }`}
        title="Klikni pro úpravu kategorie"
      >
        <Tag className="h-3 w-3" />
        {current ?? 'bez kategorie'}
      </button>
    )
  }

  return (
    <div className="flex items-center gap-1">
      <Input
        ref={inputRef}
        value={value}
        onChange={e => setValue(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setOpen(false) }}
        placeholder="kategorie..."
        className="h-7 w-36 rounded-full border-sky-200 bg-white/80 py-0 text-xs"
        list={`cats-${fileId}`}
      />
      <datalist id={`cats-${fileId}`}>
        {allCategories.map(c => <option key={c} value={c} />)}
      </datalist>
      <button
        onClick={save}
        disabled={saving}
        className="rounded-full bg-blue-600 px-2 py-0.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {saving ? '...' : 'OK'}
      </button>
      <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-700">
        <X className="h-3 w-3" />
      </button>
    </div>
  )
}

// ─── Hlavní komponenta ────────────────────────────────────────────────────────

export function DocumentsPage({
  initialData,
  initialError,
}: {
  initialData: DocumentsResponse | null
  initialError: string | null
}) {
  const [driveData, setDriveData] = useState<DocumentsResponse | null>(initialData)
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([])
  const [error, setError] = useState<string | null>(initialError)
  const [loading, setLoading] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [query, setQuery] = useState('')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [selection, setSelection] = useState<SidebarSelection>({ type: 'all' })
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dragCounter = useRef(0)

  // Načíst nahrané soubory
  const loadUploaded = useCallback(async () => {
    try {
      const res = await fetch('/api/documents/uploaded')
      if (!res.ok) return
      const payload = await res.json()
      setUploadedFiles(payload.files ?? [])
    } catch { /* best effort */ }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadUploaded()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [loadUploaded])

  // Kategorie z uploadovaných souborů
  const allCategories = useMemo(() => {
    const cats = uploadedFiles.map(f => f.category).filter(Boolean) as string[]
    return [...new Set(cats)].sort()
  }, [uploadedFiles])

  // Unified seznam souborů
  const allFiles = useMemo<UnifiedFile[]>(() => {
    const drive: UnifiedFile[] = (driveData?.documents ?? []).map(d => ({ source: 'drive', data: d }))
    const uploaded: UnifiedFile[] = uploadedFiles.map(u => ({ source: 'upload', data: u }))
    return [...drive, ...uploaded].sort((a, b) => fileDate(b).localeCompare(fileDate(a)))
  }, [driveData, uploadedFiles])

  // Filtrace podle sidebar selection + search
  const filteredFiles = useMemo(() => {
    const q = query.trim().toLowerCase()
    return allFiles.filter(f => {
      if (q && !fileName(f).toLowerCase().includes(q)) return false
      if (selection.type === 'drive') return f.source === 'drive'
      if (selection.type === 'uploaded') return f.source === 'upload'
      if (selection.type === 'category') {
        if (f.source !== 'upload') return false
        return f.data.category === selection.name
      }
      return true
    })
  }, [allFiles, selection, query])

  // Počty pro sidebar
  const counts = useMemo(() => ({
    all: allFiles.length,
    drive: allFiles.filter(f => f.source === 'drive').length,
    uploaded: allFiles.filter(f => f.source === 'upload').length,
    byCategory: Object.fromEntries(
      allCategories.map(cat => [
        cat,
        uploadedFiles.filter(f => f.category === cat).length,
      ])
    ),
  }), [allFiles, allCategories, uploadedFiles])

  async function loadDocuments() {
    setLoading(true)
    try {
      const res = await fetch('/api/documents')
      const payload = await res.json()
      if (!res.ok) throw new Error(payload.error ?? 'Chyba načítání')
      setDriveData(payload)
      await loadUploaded()
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

  async function uploadFile(file: File) {
    setUploading(true)
    setError(null)
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch('/api/upload', { method: 'POST', body: form })
      const payload = await res.json()
      if (!res.ok) throw new Error(payload.error ?? 'Upload selhal.')
      if (payload.duplicate) {
        await loadUploaded()
        return
      }
      // Přidat optimisticky, pak reload
      setUploadedFiles(prev => [
        {
          id: payload.id,
          name: payload.name,
          category: null,
          mime_type: file.type,
          size_bytes: file.size,
          chunk_count: payload.chunk_count,
          status: payload.status,
          error_message: null,
          uploaded_at: new Date().toISOString(),
        },
        ...prev,
      ])
      // Počkej chvíli na AI kategorizaci, pak refresh
      setTimeout(() => loadUploaded(), 4000)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setUploading(false)
    }
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) uploadFile(file)
    e.target.value = ''
  }

  // Drag & drop
  function handleDragEnter(e: React.DragEvent) {
    e.preventDefault()
    dragCounter.current++
    setDragging(true)
  }
  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault()
    dragCounter.current--
    if (dragCounter.current === 0) setDragging(false)
  }
  function handleDragOver(e: React.DragEvent) { e.preventDefault() }
  async function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    dragCounter.current = 0
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) uploadFile(file)
  }

  async function deleteUploadedFile(id: string) {
    if (!confirm('Smazat soubor a všechny jeho RAG chunky?')) return
    await fetch(`/api/documents/uploaded/${id}`, { method: 'DELETE' })
    setUploadedFiles(prev => prev.filter(f => f.id !== id))
  }

  function updateCategory(id: string, category: string | null) {
    setUploadedFiles(prev => prev.map(f => f.id === id ? { ...f, category } : f))
  }

  return (
    <div
      className="flex h-full flex-col bg-transparent"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Drag overlay */}
      {dragging && (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-sky-50/80 backdrop-blur-sm">
          <div className="blue-glass flex flex-col items-center gap-3 rounded-[2rem] border-2 border-dashed border-sky-300 px-12 py-8">
            <Upload className="h-10 w-10 text-blue-500" />
            <p className="text-lg font-semibold text-blue-700">Pusť soubor pro nahrání</p>
            <p className="text-sm text-slate-500">PDF, DOCX, XLSX, CSV, TXT — max 4 MB</p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="shrink-0 border-b border-white/70 bg-white/60 px-4 py-3 backdrop-blur-xl md:px-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-sm font-semibold text-slate-950">Dokumenty</h1>
            <p className="text-xs text-slate-500">Správa souborů dostupných agentovi</p>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={syncDrive} disabled={syncing} variant="outline" size="sm" className="gap-1.5 rounded-full border-sky-200 bg-white/70 text-blue-700 hover:bg-sky-50">
              {syncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              Sync Drive
            </Button>
            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              size="sm"
              className="gap-1.5 rounded-full bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow-lg shadow-blue-500/20 hover:brightness-105"
            >
              {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
              Nahrát soubor
            </Button>
            <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileInput}
              accept=".pdf,.docx,.doc,.xlsx,.xls,.csv,.txt" />
          </div>
        </div>
      </div>

      {error && (
        <div className="flex shrink-0 items-center gap-2 border-b border-red-200 bg-red-50 px-4 py-2 text-xs text-red-700">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          {error}
          <button onClick={() => setError(null)} className="ml-auto"><X className="h-3.5 w-3.5" /></button>
        </div>
      )}

      {/* Main layout */}
      <div className="flex min-h-0 flex-1">
        {/* Sidebar */}
        <aside className="w-52 shrink-0 overflow-y-auto border-r border-white/70 bg-white/50 p-3 backdrop-blur-xl">
          <nav className="space-y-0.5">
            <SidebarItem
              icon={<LayoutGrid className="h-4 w-4" />}
              label="Vše"
              count={counts.all}
              active={selection.type === 'all'}
              onClick={() => setSelection({ type: 'all' })}
            />
            <SidebarItem
              icon={<HardDrive className="h-4 w-4" />}
              label="Drive"
              count={counts.drive}
              active={selection.type === 'drive'}
              onClick={() => setSelection({ type: 'drive' })}
            />
            <SidebarItem
              icon={<Upload className="h-4 w-4" />}
              label="Nahrané"
              count={counts.uploaded}
              active={selection.type === 'uploaded'}
              onClick={() => setSelection({ type: 'uploaded' })}
            />

            {allCategories.length > 0 && (
              <>
                <div className="my-2 border-t border-sky-100" />
                <p className="px-2 py-1 text-[10px] font-semibold uppercase text-slate-400">
                  Kategorie
                </p>
                {allCategories.map(cat => (
                  <SidebarItem
                    key={cat}
                    icon={<FolderOpen className="h-4 w-4" />}
                    label={cat}
                    count={counts.byCategory[cat] ?? 0}
                    active={selection.type === 'category' && selection.name === cat}
                    onClick={() => setSelection({ type: 'category', name: cat })}
                  />
                ))}
              </>
            )}
          </nav>
        </aside>

        {/* Right panel */}
        <div className="flex min-h-0 flex-1 flex-col">
          {/* Toolbar */}
          <div className="flex shrink-0 items-center gap-2 border-b border-white/70 bg-white/50 px-4 py-2 backdrop-blur-xl">
            <div className="relative flex-1 max-w-xs">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <Input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Hledat soubor..."
                className="h-9 rounded-full border-sky-200 bg-white/80 pl-8 text-sm"
              />
            </div>
            <div className="ml-auto flex items-center gap-1">
              <button
                onClick={() => setViewMode('grid')}
                className={`rounded-full p-2 transition-colors ${viewMode === 'grid' ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/20' : 'text-slate-400 hover:bg-sky-100 hover:text-blue-700'}`}
                title="Mřížka"
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`rounded-full p-2 transition-colors ${viewMode === 'list' ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/20' : 'text-slate-400 hover:bg-sky-100 hover:text-blue-700'}`}
                title="Seznam"
              >
                <List className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Files */}
          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            {loading ? (
              <div className="flex h-40 items-center justify-center gap-2 text-sm text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin" /> Načítám…
              </div>
            ) : filteredFiles.length === 0 ? (
              <div className="flex h-40 flex-col items-center justify-center text-center">
                <FileText className="mb-3 h-8 w-8 text-sky-300" />
                <p className="text-sm font-semibold text-slate-700">Žádné soubory</p>
                <p className="mt-1 text-xs text-slate-400">Nahraj soubor nebo spusť sync Drive.</p>
              </div>
            ) : viewMode === 'grid' ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                {filteredFiles.map(f => (
                  <FileCard
                    key={fileKey(f)}
                    file={f}
                    allCategories={allCategories}
                    onDelete={deleteUploadedFile}
                    onCategoryChange={updateCategory}
                  />
                ))}
              </div>
            ) : (
              <div className="overflow-x-auto rounded-3xl border border-white/70 bg-white/80 shadow-sm shadow-blue-950/5 backdrop-blur-xl">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead className="bg-sky-50/70 text-xs font-semibold uppercase text-slate-400">
                    <tr>
                      <th className="px-4 py-3">Název</th>
                      <th className="px-4 py-3">Kategorie</th>
                      <th className="px-4 py-3">Zdroj</th>
                      <th className="px-4 py-3 text-right">Chunků</th>
                      <th className="px-4 py-3">Datum</th>
                      <th className="px-4 py-3 text-right">Akce</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {filteredFiles.map(f => (
                      <FileRow
                        key={fileKey(f)}
                        file={f}
                        allCategories={allCategories}
                        onDelete={deleteUploadedFile}
                        onCategoryChange={updateCategory}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Sidebar item ─────────────────────────────────────────────────────────────

function SidebarItem({
  icon,
  label,
  count,
  active,
  onClick,
}: {
  icon: React.ReactNode
  label: string
  count: number
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-2 rounded-2xl px-2.5 py-2 text-left text-sm transition-all ${
        active ? 'bg-gradient-to-r from-sky-100 to-blue-100 font-semibold text-blue-800 shadow-sm' : 'text-slate-600 hover:bg-white/70 hover:text-blue-700'
      }`}
    >
      <span className={active ? 'text-blue-700' : 'text-slate-400'}>{icon}</span>
      <span className="flex-1 truncate">{label}</span>
      <span className="text-xs tabular-nums text-slate-400">{count}</span>
    </button>
  )
}

// ─── File Card (grid) ─────────────────────────────────────────────────────────

function FileCard({
  file,
  allCategories,
  onDelete,
  onCategoryChange,
}: {
  file: UnifiedFile
  allCategories: string[]
  onDelete: (id: string) => void
  onCategoryChange: (id: string, cat: string | null) => void
}) {
  const isUpload = file.source === 'upload'
  const uploadData = isUpload ? (file.data as UploadedFile) : null
  const driveData = !isUpload ? (file.data as DocumentFile) : null
  const category = uploadData?.category ?? null
  const chunks = isUpload ? uploadData!.chunk_count : driveData!.chunk_count

  return (
    <div className="group relative flex flex-col gap-2 rounded-3xl border border-white/70 bg-white/80 p-3 shadow-sm shadow-blue-950/5 backdrop-blur-xl transition-all hover:-translate-y-0.5 hover:border-sky-200 hover:bg-white hover:shadow-lg hover:shadow-blue-500/10">
      {/* File type icon */}
      <div className="flex h-12 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-50 to-blue-50">
        {mimeIcon(fileMime(file))}
      </div>

      {/* Name */}
      <p className="line-clamp-2 text-center text-xs font-semibold leading-tight text-slate-900" title={fileName(file)}>
        {fileName(file)}
      </p>

      {/* Category */}
      <div className="flex justify-center">
        {isUpload ? (
          <CategoryEditor
            fileId={uploadData!.id}
            current={category}
            allCategories={allCategories}
            onSaved={cat => onCategoryChange(uploadData!.id, cat)}
          />
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-2 py-0.5 text-xs font-semibold text-blue-700 ring-1 ring-sky-200/70">
            <HardDrive className="h-3 w-3" /> Drive
          </span>
        )}
      </div>

      {/* Meta */}
      <div className="flex items-center justify-between text-[10px] text-slate-400">
        <span>{formatDate(fileDate(file))}</span>
        <span>{chunks} ch.</span>
      </div>

      {/* Actions — vždy viditelné, i při chybě */}
      <div className="flex justify-center gap-1">
        {driveData?.drive_file_id && (
          <a
            href={`https://drive.google.com/open?id=${driveData.drive_file_id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full p-1 text-slate-400 hover:bg-sky-100 hover:text-blue-700"
            title="Otevřít v Drive"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
        {isUpload && (
          <button
            onClick={() => onDelete(uploadData!.id)}
            className={`rounded p-1 transition-colors ${
              uploadData!.status === 'error'
                ? 'text-red-400 hover:bg-red-100 hover:text-red-700'
                : 'text-slate-400 hover:bg-red-50 hover:text-red-600'
            }`}
            title="Smazat"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Stavy */}
      {isUpload && uploadData!.status === 'processing' && (
        <div className="absolute inset-0 flex items-center justify-center rounded-3xl bg-white/80 backdrop-blur-sm">
          <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
        </div>
      )}
      {isUpload && uploadData!.status === 'error' && (
        <div
          className="mt-1 cursor-help rounded-2xl bg-red-50 px-2 py-1 text-center text-[10px] leading-tight text-red-600"
          title={uploadData!.error_message ?? 'Chyba při zpracování'}
        >
          {uploadData!.error_message
            ? uploadData!.error_message.slice(0, 80)
            : 'Chyba při zpracování'}
        </div>
      )}
    </div>
  )
}

// ─── File Row (list) ──────────────────────────────────────────────────────────

function FileRow({
  file,
  allCategories,
  onDelete,
  onCategoryChange,
}: {
  file: UnifiedFile
  allCategories: string[]
  onDelete: (id: string) => void
  onCategoryChange: (id: string, cat: string | null) => void
}) {
  const isUpload = file.source === 'upload'
  const uploadData = isUpload ? (file.data as UploadedFile) : null
  const driveData = !isUpload ? (file.data as DocumentFile) : null
  const chunks = isUpload ? uploadData!.chunk_count : driveData!.chunk_count

  return (
    <tr className="hover:bg-sky-50/60">
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          {mimeIconSmall(fileMime(file))}
          <span className="max-w-xs truncate font-semibold text-slate-900" title={fileName(file)}>
            {fileName(file)}
          </span>
        </div>
      </td>
      <td className="px-4 py-3">
        {isUpload ? (
          <CategoryEditor
            fileId={uploadData!.id}
            current={uploadData!.category}
            allCategories={allCategories}
            onSaved={cat => onCategoryChange(uploadData!.id, cat)}
          />
        ) : (
          <Badge variant="secondary" className="rounded-full bg-sky-100 text-xs text-blue-700">Drive</Badge>
        )}
      </td>
      <td className="px-4 py-3 text-xs text-slate-500">
        {isUpload ? 'Nahrané' : 'Google Drive'}
      </td>
      <td className="px-4 py-3 text-right text-sm tabular-nums text-slate-600">{chunks}</td>
      <td className="px-4 py-3 text-sm text-slate-500">{formatDate(fileDate(file))}</td>
      <td className="px-4 py-3 text-right">
        <div className="flex justify-end gap-1">
          {driveData?.drive_file_id && (
            <a
              href={`https://drive.google.com/open?id=${driveData.drive_file_id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-sky-100 bg-white/70 text-slate-500 hover:bg-sky-100 hover:text-blue-700"
              title="Otevřít v Drive"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
          {isUpload && (
            <button
              onClick={() => onDelete(uploadData!.id)}
              className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-sky-100 bg-white/70 text-slate-500 hover:border-red-200 hover:bg-red-50 hover:text-red-600"
              title="Smazat"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </td>
    </tr>
  )
}

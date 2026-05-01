import { supabaseAdmin } from '@/lib/supabase/client'

export type DocumentStatus = 'ingested' | 'error' | 'pending' | 'skipped' | string

export type DocumentFile = {
  id: string
  drive_file_id: string
  name: string
  mime_type: string
  md5_checksum: string | null
  modified_time: string | null
  ingested_at: string | null
  status: DocumentStatus | null
  error_message: string | null
  file_type: string | null
  target_table: string | null
  chunk_count: number
  structured_status: 'mapped' | 'raw_only' | 'mapping_error' | null
  structured_row_count: number
  structured_columns: string[]
  structured_sheet_name: string | null
  structured_error_message: string | null
}

export type DocumentsResponse = {
  documents: DocumentFile[]
  summary: {
    total: number
    ingested: number
    error: number
    pending: number
    skipped: number
    chunks: number
    structured_rows: number
    last_ingested_at: string | null
  }
}

type DriveFileRow = Omit<
  DocumentFile,
  | 'chunk_count'
  | 'structured_status'
  | 'structured_row_count'
  | 'structured_columns'
  | 'structured_sheet_name'
  | 'structured_error_message'
>

type StructuredImportRow = {
  source_file: string
  sheet_name: string | null
  columns: unknown
  row_count: number
  status: 'mapped' | 'raw_only' | 'mapping_error'
  target_table: string | null
  error_message: string | null
  updated_at: string | null
}

export async function listDocuments(): Promise<DocumentsResponse> {
  const { data: files, error } = await supabaseAdmin
    .from('drive_files')
    .select('id, drive_file_id, name, mime_type, md5_checksum, modified_time, ingested_at, status, error_message, file_type, target_table')
    .order('ingested_at', { ascending: false, nullsFirst: false })
    .order('modified_time', { ascending: false, nullsFirst: false })

  if (error) throw new Error(error.message)

  const sourceFiles = Array.from(new Set(((files ?? []) as DriveFileRow[]).map(file => file.name)))
  const chunkCounts = new Map<string, number>()

  if (sourceFiles.length > 0) {
    const { data: chunks } = await supabaseAdmin
      .from('document_chunks')
      .select('source_file')
      .in('source_file', sourceFiles)

    for (const chunk of chunks ?? []) {
      const sourceFile = (chunk as { source_file: string | null }).source_file
      if (!sourceFile) continue
      chunkCounts.set(sourceFile, (chunkCounts.get(sourceFile) ?? 0) + 1)
    }
  }

  const structuredImports = new Map<string, StructuredImportRow>()

  if (sourceFiles.length > 0) {
    const { data: imports } = await supabaseAdmin
      .from('structured_imports')
      .select('source_file, sheet_name, columns, row_count, status, target_table, error_message, updated_at')
      .in('source_file', sourceFiles)
      .order('updated_at', { ascending: false, nullsFirst: false })

    for (const item of (imports ?? []) as StructuredImportRow[]) {
      if (!structuredImports.has(item.source_file)) structuredImports.set(item.source_file, item)
    }
  }

  const documents = ((files ?? []) as DriveFileRow[]).map(file => {
    const structuredImport = structuredImports.get(file.name)
    const columns = Array.isArray(structuredImport?.columns)
      ? structuredImport.columns.filter((column): column is string => typeof column === 'string')
      : []

    return {
      ...file,
      target_table: structuredImport?.target_table ?? file.target_table,
      chunk_count: chunkCounts.get(file.name) ?? 0,
      structured_status: structuredImport?.status ?? null,
      structured_row_count: structuredImport?.row_count ?? 0,
      structured_columns: columns,
      structured_sheet_name: structuredImport?.sheet_name ?? null,
      structured_error_message: structuredImport?.error_message ?? null,
    }
  })

  const summary = documents.reduce(
    (acc, file) => {
      acc.total += 1
      if (file.status === 'ingested') acc.ingested += 1
      if (file.status === 'error') acc.error += 1
      if (file.status === 'pending') acc.pending += 1
      if (file.status === 'skipped') acc.skipped += 1
      acc.chunks += file.chunk_count
      acc.structured_rows += file.structured_row_count
      if (!acc.last_ingested_at || (file.ingested_at && file.ingested_at > acc.last_ingested_at)) {
        acc.last_ingested_at = file.ingested_at
      }
      return acc
    },
    {
      total: 0,
      ingested: 0,
      error: 0,
      pending: 0,
      skipped: 0,
      chunks: 0,
      structured_rows: 0,
      last_ingested_at: null as string | null,
    }
  )

  return { documents, summary }
}

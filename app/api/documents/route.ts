import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { supabaseAdmin } from '@/lib/supabase/client'

type DriveFileRow = {
  id: string
  drive_file_id: string
  name: string
  mime_type: string
  md5_checksum: string | null
  modified_time: string | null
  ingested_at: string | null
  status: string | null
  error_message: string | null
  file_type: string | null
  target_table: string | null
}

export async function GET() {
  const session = await auth()

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: files, error } = await supabaseAdmin
    .from('drive_files')
    .select('id, drive_file_id, name, mime_type, md5_checksum, modified_time, ingested_at, status, error_message, file_type, target_table')
    .order('ingested_at', { ascending: false, nullsFirst: false })
    .order('modified_time', { ascending: false, nullsFirst: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

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

  const documents = ((files ?? []) as DriveFileRow[]).map(file => ({
    ...file,
    chunk_count: chunkCounts.get(file.name) ?? 0,
  }))

  const summary = documents.reduce(
    (acc, file) => {
      acc.total += 1
      if (file.status === 'ingested') acc.ingested += 1
      if (file.status === 'error') acc.error += 1
      if (file.status === 'pending') acc.pending += 1
      if (file.status === 'skipped') acc.skipped += 1
      acc.chunks += file.chunk_count
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
      last_ingested_at: null as string | null,
    }
  )

  return NextResponse.json({ documents, summary })
}

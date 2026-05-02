import { after } from 'next/server'
import { auth } from '@/auth'
import { processUpload, isSupportedMimeType } from '@/lib/upload/process'
import { categorizeUploadedFile } from '@/lib/upload/categorize'
import { supabaseAdmin } from '@/lib/supabase/client'

export const maxDuration = 60

const MAX_SIZE = 4 * 1024 * 1024 // 4 MB

const EXT_MIME: Record<string, string> = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  doc: 'application/msword',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  xls: 'application/vnd.ms-excel',
  csv: 'text/csv',
  txt: 'text/plain',
}

function guessMimeFromExtension(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  return EXT_MIME[ext] ?? 'application/octet-stream'
}

async function findExistingReadyUpload(fileName: string, mimeType: string) {
  let query = supabaseAdmin
    .from('uploaded_files')
    .select('id, name, chunk_count')
    .eq('name', fileName)
    .eq('status', 'ready')
    .gt('chunk_count', 0)
    .order('uploaded_at', { ascending: false })
    .limit(1)

  if (mimeType) query = query.eq('mime_type', mimeType)

  const { data, error } = await query.maybeSingle()
  if (error) throw new Error(error.message)
  return data
}

function existingUploadResponse(existing: { id: string; name?: string | null; chunk_count?: number | null }, fileName: string, uploadError?: string) {
  return Response.json({
    id: existing.id,
    name: existing.name || fileName,
    status: 'ready',
    chunk_count: existing.chunk_count ?? 0,
    duplicate: true,
    reused_existing: true,
    message: 'Soubor už je uložený, používám existující zpracovanou verzi.',
    upload_error: uploadError,
  })
}

export async function POST(request: Request) {
  const session = await auth()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const accessToken = session.accessToken

  const formData = await request.formData()
  const file = formData.get('file') as File | null

  if (!file) return Response.json({ error: 'Žádný soubor.' }, { status: 400 })
  if (file.size > MAX_SIZE) return Response.json({ error: 'Soubor je příliš velký (max 4 MB).' }, { status: 400 })

  const mimeType = file.type || guessMimeFromExtension(file.name)
  if (!isSupportedMimeType(mimeType)) {
    return Response.json(
      { error: 'Nepodporovaný formát. Povolené: PDF, DOCX, XLSX, CSV, TXT.' },
      { status: 400 }
    )
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  let result: Awaited<ReturnType<typeof processUpload>>

  try {
    result = await processUpload(buffer, file.name, mimeType, accessToken)
  } catch (err) {
    const uploadError = err instanceof Error ? err.message : String(err)
    const existing = await findExistingReadyUpload(file.name, mimeType).catch(() => null)
    if (existing) return existingUploadResponse(existing, file.name, uploadError)
    throw err
  }

  if (result.status === 'error') {
    const existing = await findExistingReadyUpload(file.name, mimeType).catch(() => null)
    if (existing) return existingUploadResponse(existing, file.name, result.errorMessage)

    return Response.json(
      {
        error: result.errorMessage || 'Soubor se nepodařilo zpracovat.',
        id: result.fileId,
        status: result.status,
        chunk_count: 0,
      },
      { status: 422 }
    )
  }

  if (!result.duplicate) {
    // AI kategorizace na pozadí po odeslání odpovědi
    after(async () => {
      const { data: chunks } = await supabaseAdmin
        .from('document_chunks')
        .select('content')
        .eq('uploaded_file_id', result.fileId)
        .limit(3)

      const sample = (chunks ?? []).map(c => c.content).join('\n')
      await categorizeUploadedFile(result.fileId, file.name, sample, accessToken)
    })
  }

  return Response.json({
    id: result.fileId,
    name: file.name,
    status: result.status,
    chunk_count: result.chunkCount,
    duplicate: result.duplicate ?? false,
  })
}

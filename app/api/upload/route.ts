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
  const result = await processUpload(buffer, file.name, mimeType, accessToken)

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

  return Response.json({
    id: result.fileId,
    name: file.name,
    status: result.status,
    chunk_count: result.chunkCount,
  })
}

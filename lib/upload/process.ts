import { parseFile } from '@/lib/drive/parsers'
import { ingestRag } from '@/lib/drive/ingest'
import { supabaseAdmin } from '@/lib/supabase/client'

const SUPPORTED_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'text/csv',
  'text/plain',
]

export function isSupportedMimeType(mimeType: string): boolean {
  return SUPPORTED_MIME_TYPES.some(t => mimeType.startsWith(t))
}

export async function processUpload(
  buffer: Buffer,
  fileName: string,
  mimeType: string
): Promise<{ fileId: string; status: 'ready' | 'error'; chunkCount: number }> {
  const { data, error } = await supabaseAdmin
    .from('uploaded_files')
    .insert({ name: fileName, mime_type: mimeType, size_bytes: buffer.length, status: 'processing' })
    .select('id')
    .single()

  if (error) throw new Error(error.message)
  const fileId = data.id as string

  try {
    // Krok 1: parsování souboru
    let text: string
    try {
      const parsed = await parseFile(buffer, mimeType, fileName)
      if (parsed.type === 'rag') {
        text = parsed.text
      } else {
        text = parsed.rows
          .map(row => Object.entries(row).map(([k, v]) => `${k}: ${v}`).join(', '))
          .join('\n')
      }
    } catch (parseErr) {
      const msg = parseErr instanceof Error ? parseErr.message : String(parseErr)
      throw new Error(`Parsování: ${msg}`)
    }

    if (!text.trim()) throw new Error('Soubor neobsahuje žádný čitelný text.')

    // Krok 2: RAG ingest (chunking + embedding)
    let chunkCount: number
    try {
      chunkCount = await ingestRag(fileName, text, { uploadedFileId: fileId })
    } catch (ingestErr) {
      const msg = ingestErr instanceof Error ? ingestErr.message : String(ingestErr)
      throw new Error(`Embedding: ${msg}`)
    }

    await supabaseAdmin
      .from('uploaded_files')
      .update({ status: 'ready', chunk_count: chunkCount })
      .eq('id', fileId)

    return { fileId, status: 'ready', chunkCount }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    await supabaseAdmin
      .from('uploaded_files')
      .update({ status: 'error', error_message: msg.slice(0, 500) })
      .eq('id', fileId)
    return { fileId, status: 'error', chunkCount: 0 }
  }
}

import { google } from 'googleapis'
import { supabaseAdmin } from '@/lib/supabase/client'
import { parseFile } from './parsers'
import { ingestRag, ingestStructured } from './ingest'

const SUPPORTED_MIMES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'text/csv',
  'text/plain',
  // Google Docs/Sheets (exportujeme jako DOCX/XLSX)
  'application/vnd.google-apps.document',
  'application/vnd.google-apps.spreadsheet',
]

const GOOGLE_EXPORT_MIME: Record<string, string> = {
  'application/vnd.google-apps.document': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.google-apps.spreadsheet': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
}

export async function syncDrive(accessToken: string): Promise<{ processed: number; skipped: number; errors: number }> {
  const auth = new google.auth.OAuth2()
  auth.setCredentials({ access_token: accessToken })
  const drive = google.drive({ version: 'v3', auth })

  // Načti všechny soubory k nimž má Pepa přístup (podporované typy)
  const files = await listAllFiles(drive)

  let processed = 0, skipped = 0, errors = 0

  for (const file of files) {
    try {
      const result = await processFile(drive, file)
      if (result === 'skipped') skipped++
      else if (result === 'processed') processed++
    } catch (err) {
      errors++
      await supabaseAdmin.from('drive_files').upsert({
        drive_file_id: file.id!,
        name: file.name!,
        mime_type: file.mimeType!,
        md5_checksum: file.md5Checksum ?? null,
        modified_time: file.modifiedTime ?? null,
        status: 'error',
        error_message: (err as Error).message.slice(0, 500),
      }, { onConflict: 'drive_file_id' })
    }
  }

  return { processed, skipped, errors }
}

async function listAllFiles(drive: ReturnType<typeof google.drive>) {
  const files = []
  let pageToken: string | undefined

  do {
    const res = await drive.files.list({
      q: `(${SUPPORTED_MIMES.map(m => `mimeType='${m}'`).join(' or ')}) and trashed=false`,
      fields: 'nextPageToken, files(id, name, mimeType, md5Checksum, modifiedTime)',
      pageSize: 100,
      pageToken,
    })
    files.push(...(res.data.files ?? []))
    pageToken = res.data.nextPageToken ?? undefined
  } while (pageToken)

  return files
}

async function processFile(
  drive: ReturnType<typeof google.drive>,
  file: { id?: string | null; name?: string | null; mimeType?: string | null; md5Checksum?: string | null; modifiedTime?: string | null }
): Promise<'skipped' | 'processed'> {
  const fileId = file.id!
  const fileName = file.name!
  const mimeType = file.mimeType!

  // Zkontroluj md5 proti DB
  const { data: existing } = await supabaseAdmin
    .from('drive_files')
    .select('md5_checksum, status')
    .eq('drive_file_id', fileId)
    .single()

  const currentMd5 = file.md5Checksum ?? file.modifiedTime ?? null
  if (existing?.status === 'ingested' && existing.md5_checksum === currentMd5) {
    return 'skipped'
  }

  // Stáhni obsah
  const exportMime = GOOGLE_EXPORT_MIME[mimeType]
  let buffer: Buffer

  if (exportMime) {
    const res = await drive.files.export({ fileId, mimeType: exportMime }, { responseType: 'arraybuffer' })
    buffer = Buffer.from(res.data as ArrayBuffer)
  } else {
    const res = await drive.files.get({ fileId, alt: 'media' }, { responseType: 'arraybuffer' })
    buffer = Buffer.from(res.data as ArrayBuffer)
  }

  const effectiveMime = exportMime ?? mimeType
  const parsed = await parseFile(buffer, effectiveMime, fileName)

  if (parsed.type === 'rag') {
    await ingestRag(fileName, parsed.text)
  } else {
    await ingestStructured(parsed.table, parsed.rows, fileName)
  }

  await supabaseAdmin.from('drive_files').upsert({
    drive_file_id: fileId,
    name: fileName,
    mime_type: mimeType,
    md5_checksum: currentMd5,
    modified_time: file.modifiedTime ?? null,
    ingested_at: new Date().toISOString(),
    status: 'ingested',
    file_type: parsed.type,
    target_table: parsed.type === 'structured' ? parsed.table : null,
    error_message: null,
  }, { onConflict: 'drive_file_id' })

  return 'processed'
}

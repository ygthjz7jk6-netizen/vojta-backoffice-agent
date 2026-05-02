import mammoth from 'mammoth'
import * as XLSX from 'xlsx'

export type ParsedFile =
  | { type: 'rag'; text: string }
  | {
      type: 'structured'
      table: 'properties' | 'crm_leads' | null
      sheetName: string
      columns: string[]
      rows: Record<string, unknown>[]
    }

export async function parseFile(
  buffer: Buffer,
  mimeType: string,
  fileName: string
): Promise<ParsedFile> {
  if (mimeType === 'application/pdf') {
    return parsePdf(buffer)
  }
  if (
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    mimeType === 'application/msword'
  ) {
    return parseDocx(buffer)
  }
  if (
    mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    mimeType === 'application/vnd.ms-excel' ||
    mimeType === 'text/csv'
  ) {
    return parseSpreadsheet(buffer, fileName)
  }
  // Google Docs exportované jako text
  if (mimeType === 'text/plain') {
    return { type: 'rag', text: buffer.toString('utf-8') }
  }
  throw new Error(`Nepodporovaný formát: ${mimeType}`)
}

async function parsePdf(buffer: Buffer): Promise<ParsedFile> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfParse = (await import('pdf-parse')) as any
  const fn = pdfParse.default ?? pdfParse
  const data = await fn(buffer)
  return { type: 'rag', text: data.text }
}

async function parseDocx(buffer: Buffer): Promise<ParsedFile> {
  const result = await mammoth.extractRawText({ buffer })
  if (!result.value.trim() && result.messages.length > 0) {
    const warnings = result.messages.map(m => m.message).join('; ')
    throw new Error(`Mammoth DOCX: prázdný výstup. Varování: ${warnings.slice(0, 200)}`)
  }
  return { type: 'rag', text: result.value }
}

function parseSpreadsheet(buffer: Buffer, fileName: string): ParsedFile {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true })
  const sheetName = workbook.SheetNames[0] ?? 'Sheet1'
  const sheet = workbook.Sheets[sheetName]
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: null })
  const columns = rows[0] ? Object.keys(rows[0]) : []

  const table = detectTable(fileName, rows)
  return { type: 'structured', table, sheetName, columns, rows }
}

// Detekce tabulky podle názvu souboru nebo sloupců
function detectTable(fileName: string, rows: Record<string, unknown>[]): 'properties' | 'crm_leads' | null {
  const name = normalizeKey(fileName)
  if (name.includes('nemovit') || name.includes('propert') || name.includes('byt') || name.includes('dum')) {
    return 'properties'
  }
  if (name.includes('lead') || name.includes('kontakt') || name.includes('zajemce') || name.includes('klient')) {
    return 'crm_leads'
  }
  // Heuristika podle sloupců
  const cols = rows[0] ? Object.keys(rows[0]).map(normalizeKey) : []
  if (cols.some(c => c.includes('adresa') || c.includes('address') || c.includes('cena') || c.includes('price'))) {
    return 'properties'
  }
  if (cols.some(c => c.includes('email') || c.includes('telefon') || c.includes('phone') || c.includes('klient'))) {
    return 'crm_leads'
  }
  return null
}

function normalizeKey(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

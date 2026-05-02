import mammoth from 'mammoth'
import * as XLSX from 'xlsx'

// SheetJS vyžaduje DOMMatrix v Node.js/Vercel prostředí
if (typeof globalThis.DOMMatrix === 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(globalThis as any).DOMMatrix = class DOMMatrix {
    a = 1; b = 0; c = 0; d = 1; e = 0; f = 0
    is2D = true; isIdentity = true
  }
}

export type ParsedFile =
  | { type: 'rag'; text: string }
  | {
      type: 'structured'
      table: 'properties' | 'crm_leads' | 'transactions' | null
      sheetName: string
      columns: string[]
      rows: Record<string, unknown>[]
    }

export async function parseFile(
  buffer: Buffer,
  mimeType: string,
  fileName: string,
  accessToken?: string | null
): Promise<ParsedFile> {
  if (mimeType === 'application/pdf') {
    return parsePdf(buffer, accessToken)
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

async function parsePdf(buffer: Buffer, accessToken?: string | null): Promise<ParsedFile> {
  const base64 = buffer.toString('base64')
  const body = JSON.stringify({
    contents: [{
      parts: [
        { inline_data: { mime_type: 'application/pdf', data: base64 } },
        { text: 'Extrahuj veškerý text z tohoto dokumentu. Vrať pouze surový text obsahu, bez komentářů.' },
      ],
    }],
  })

  // Primárně Vertex AI s OAuth tokenem
  if (accessToken && process.env.GOOGLE_CLOUD_PROJECT) {
    try {
      const url = `https://us-central1-aiplatform.googleapis.com/v1/projects/${process.env.GOOGLE_CLOUD_PROJECT}/locations/us-central1/publishers/google/models/gemini-2.5-flash:generateContent`
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body,
      })
      if (res.ok) {
        const data = await res.json()
        const text: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
        if (text.trim()) return { type: 'rag', text }
      }
    } catch {
      // fallback na AI Studio
    }
  }

  // Fallback: AI Studio API key
  const apiKey = process.env.GOOGLE_AI_API_KEY
  if (apiKey) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body }
      )
      if (res.ok) {
        const data = await res.json()
        const text: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
        if (text.trim()) return { type: 'rag', text }
      }
    } catch {
      // fallback na pdf-parse
    }
  }

  // Fallback: pdf-parse
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfParse = (await import('pdf-parse')) as any
  const fn = pdfParse.default ?? pdfParse
  const data = await fn(buffer)
  return { type: 'rag', text: data.text }
}

async function parseDocx(buffer: Buffer): Promise<ParsedFile> {
  // Primárně mammoth
  try {
    const result = await mammoth.extractRawText({ buffer })
    if (result.value.trim()) {
      return { type: 'rag', text: result.value }
    }
  } catch {
    // mammoth selhal — zkusíme přímé čtení XML
  }

  // Fallback: DOCX je ZIP, text je v word/document.xml
  try {
    const JSZip = (await import('jszip')).default
    const zip = await JSZip.loadAsync(buffer)
    const docXml = await zip.file('word/document.xml')?.async('text')
    if (docXml) {
      const text = docXml
        .replace(/<w:br[^>]*\/?>/g, '\n')
        .replace(/<\/w:p>/g, '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
        .replace(/\n{3,}/g, '\n\n')
        .trim()
      if (text) return { type: 'rag', text }
    }
  } catch {
    // JSZip také selhal
  }

  throw new Error('DOCX: nepodařilo se extrahovat text — zkuste uložit jako PDF nebo TXT.')
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
function detectTable(fileName: string, rows: Record<string, unknown>[]): 'properties' | 'crm_leads' | 'transactions' | null {
  const name = normalizeKey(fileName)
  // Bankovní výpisy detekujeme jako první — mají specifický pattern v názvu
  if (name.includes('banka_vypis') || name.includes('bank_statement') || name.includes('vypis_uctu')) {
    return 'transactions'
  }
  // Heuristika podle sloupců — detekce transakčních dat (castka + datum + typ)
  const cols = rows[0] ? Object.keys(rows[0]).map(normalizeKey) : []
  if (
    cols.some(c => c === 'castka' || c === 'castka_kc' || c === 'amount') &&
    cols.some(c => c === 'datum' || c === 'date') &&
    cols.some(c => c === 'typ' || c === 'type' || c === 'kategorie')
  ) {
    return 'transactions'
  }
  if (name.includes('nemovit') || name.includes('propert') || name.includes('byt') || name.includes('dum')) {
    return 'properties'
  }
  if (name.includes('lead') || name.includes('kontakt') || name.includes('zajemce') || name.includes('klient')) {
    return 'crm_leads'
  }
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

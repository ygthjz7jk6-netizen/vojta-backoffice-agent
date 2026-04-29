import { supabaseAdmin } from '@/lib/supabase/client'
import { embedText } from '@/lib/memory/embed'
import type { ParsedFile } from './parsers'

const CHUNK_SIZE = 800
const CHUNK_OVERLAP = 100

export async function ingestRag(sourceFile: string, text: string) {
  // Smaž staré chunky pro tento soubor
  await supabaseAdmin.from('document_chunks').delete().eq('source_file', sourceFile)

  const chunks = chunkText(text, CHUNK_SIZE, CHUNK_OVERLAP)

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i]
    const embedding = await embedText(chunk)
    await supabaseAdmin.from('document_chunks').insert({
      source_file: sourceFile,
      source_type: detectSourceType(sourceFile),
      content: chunk,
      embedding,
      source_row_start: i + 1,
      source_row_end: i + 1,
      ingested_at: new Date().toISOString(),
    })
  }
}

export async function ingestStructured(
  table: 'properties' | 'crm_leads',
  rows: Record<string, unknown>[],
  sourceFile: string
) {
  const mapped = rows.map(row => normalizeRow(table, row, sourceFile))
  const valid = mapped.filter(r => r !== null) as Record<string, unknown>[]

  if (!valid.length) return

  // Upsert podle externího ID nebo kombinace klíčových polí
  if (table === 'properties') {
    const { error } = await supabaseAdmin.from('properties').upsert(valid, {
      onConflict: 'external_id',
      ignoreDuplicates: false,
    })
    if (error) throw new Error(`Upsert properties failed: ${error.message}`)
  } else {
    const { error } = await supabaseAdmin.from('crm_leads').upsert(valid, {
      onConflict: 'external_id',
      ignoreDuplicates: false,
    })
    if (error) throw new Error(`Upsert crm_leads failed: ${error.message}`)
  }
}

function normalizeRow(
  table: string,
  row: Record<string, unknown>,
  sourceFile: string
): Record<string, unknown> | null {
  const lower: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(row)) {
    lower[k.toLowerCase().trim().replace(/\s+/g, '_')] = v
  }

  if (table === 'properties') {
    return {
      external_id: String(lower.id || lower.external_id || lower.cislo || `${sourceFile}-${JSON.stringify(row)}`).slice(0, 100),
      name: lower.nazev || lower.name || lower.adresa || lower.address || 'Bez názvu',
      address: lower.adresa || lower.address || null,
      district: lower.lokalita || lower.district || lower.oblast || null,
      price: toNumber(lower.cena || lower.price),
      area_m2: toNumber(lower.plocha || lower.area_m2 || lower.velikost),
      property_type: lower.typ || lower.property_type || lower.druh || null,
      status: lower.stav || lower.status || 'available',
      missing_fields: detectMissing(lower, ['rekonstrukce', 'reconstruction', 'stavebni_upravy', 'rok_vystavby']),
      source_file: sourceFile,
    }
  } else {
    return {
      external_id: String(lower.id || lower.external_id || `${sourceFile}-${JSON.stringify(row)}`).slice(0, 100),
      name: lower.jmeno || lower.name || lower.kontakt || 'Neznámý',
      email: lower.email || lower.mail || null,
      phone: lower.telefon || lower.phone || lower.tel || null,
      source: lower.zdroj || lower.source || 'import',
      status: lower.stav || lower.status || 'new',
      notes: lower.poznamky || lower.notes || null,
      source_file: sourceFile,
    }
  }
}

function detectMissing(row: Record<string, unknown>, fields: string[]): Record<string, boolean> {
  const missing: Record<string, boolean> = {}
  for (const f of fields) {
    if (!row[f] || row[f] === '' || row[f] === null) {
      missing[f] = true
    }
  }
  return missing
}

function toNumber(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = Number(String(v).replace(/[^\d.]/g, ''))
  return isNaN(n) ? null : n
}

function detectSourceType(fileName: string): string {
  const f = fileName.toLowerCase()
  if (f.includes('smlouv') || f.includes('contract')) return 'contract'
  if (f.includes('email') || f.includes('mail')) return 'email'
  if (f.includes('meeting') || f.includes('schuze') || f.includes('porada')) return 'meeting'
  if (f.includes('poznamk') || f.includes('note')) return 'note'
  return 'document'
}

function chunkText(text: string, size: number, overlap: number): string[] {
  const words = text.split(/\s+/)
  const chunks: string[] = []
  let i = 0
  while (i < words.length) {
    chunks.push(words.slice(i, i + size).join(' '))
    i += size - overlap
  }
  return chunks.filter(c => c.trim().length > 50)
}

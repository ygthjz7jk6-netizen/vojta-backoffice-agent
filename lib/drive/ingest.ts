import { supabaseAdmin } from '@/lib/supabase/client'
import { embedText } from '@/lib/memory/embed'
const CHUNK_SIZE = 800
const CHUNK_OVERLAP = 100

export async function ingestRag(
  sourceFile: string,
  text: string,
  options?: { uploadedFileId?: string }
): Promise<number> {
  const deleteQuery = supabaseAdmin.from('document_chunks').delete()
  const { error: deleteError } = options?.uploadedFileId
    ? await deleteQuery.eq('uploaded_file_id', options.uploadedFileId)
    : await deleteQuery.eq('source_file', sourceFile)

  if (deleteError) throw new Error(`Delete old chunks failed: ${deleteError.message}`)

  const chunks = chunkText(text, CHUNK_SIZE, CHUNK_OVERLAP)
  let insertedCount = 0

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i]
    // Malá pauza mezi volání embedding API aby se předešlo rate limitu
    if (i > 0) await new Promise(r => setTimeout(r, 200))
    const embedding = await embedText(chunk)
    const { error } = await supabaseAdmin.from('document_chunks').insert({
      source_file: sourceFile,
      source_type: detectSourceType(sourceFile),
      content: chunk,
      embedding,
      source_row_start: i + 1,
      source_row_end: i + 1,
      ingested_at: new Date().toISOString(),
      ...(options?.uploadedFileId ? { uploaded_file_id: options.uploadedFileId } : {}),
    })
    if (error) throw new Error(`Insert chunk ${i + 1}/${chunks.length} failed: ${error.message}`)
    insertedCount += 1
  }

  return insertedCount
}

export async function ingestStructured(
  table: 'properties' | 'crm_leads' | 'transactions' | null,
  rows: Record<string, unknown>[],
  sourceFile: string,
  options: {
    driveFileId?: string | null
    sheetName?: string | null
    columns?: string[]
  } = {}
) {
  const importId = await saveRawStructuredImport({
    driveFileId: options.driveFileId ?? null,
    sourceFile,
    sheetName: options.sheetName ?? null,
    columns: options.columns ?? inferColumns(rows),
    rows,
    targetTable: table,
  })

  if (!table) {
    await updateStructuredImport(importId, { status: 'raw_only', targetTable: null })
    return { status: 'raw_only' as const, targetTable: null }
  }

  const mapped = rows.map(row => normalizeRow(table, row, sourceFile))
  const valid = mapped.filter(r => r !== null) as Record<string, unknown>[]

  if (!valid.length) {
    await updateStructuredImport(importId, {
      status: 'mapping_error',
      targetTable: table,
      errorMessage: 'No valid rows after mapping.',
    })
    return { status: 'mapping_error' as const, targetTable: table }
  }

  try {
    // Upsert podle externího ID nebo kombinace klíčových polí
    if (table === 'properties') {
      const { error } = await supabaseAdmin.from('properties').upsert(valid, {
        onConflict: 'external_id',
        ignoreDuplicates: false,
      })
      if (error) throw new Error(`Upsert properties failed: ${error.message}`)
    } else if (table === 'transactions') {
      const { error } = await supabaseAdmin.from('transactions').upsert(valid, {
        onConflict: 'external_id',
        ignoreDuplicates: false,
      })
      if (error) throw new Error(`Upsert transactions failed: ${error.message}`)
    } else {
      const { error } = await supabaseAdmin.from('crm_leads').upsert(valid, {
        onConflict: 'external_id',
        ignoreDuplicates: false,
      })
      if (error) throw new Error(`Upsert crm_leads failed: ${error.message}`)
    }

    await updateStructuredImport(importId, { status: 'mapped', targetTable: table })
    return { status: 'mapped' as const, targetTable: table }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    await updateStructuredImport(importId, {
      status: 'mapping_error',
      targetTable: table,
      errorMessage: message.slice(0, 500),
    })
    return { status: 'mapping_error' as const, targetTable: table }
  }
}

async function saveRawStructuredImport({
  driveFileId,
  sourceFile,
  sheetName,
  columns,
  rows,
  targetTable,
}: {
  driveFileId: string | null
  sourceFile: string
  sheetName: string | null
  columns: string[]
  rows: Record<string, unknown>[]
  targetTable: 'properties' | 'crm_leads' | 'transactions' | null
}): Promise<string> {
  await supabaseAdmin
    .from('structured_imports')
    .delete()
    .eq('source_file', sourceFile)
    .eq('sheet_name', sheetName)

  const { data, error } = await supabaseAdmin
    .from('structured_imports')
    .insert({
      drive_file_id: driveFileId,
      source_file: sourceFile,
      sheet_name: sheetName,
      columns,
      row_count: rows.length,
      status: targetTable ? 'mapping_error' : 'raw_only',
      target_table: targetTable,
      error_message: null,
    })
    .select('id')
    .single()

  if (error) throw new Error(`Structured import failed: ${error.message}`)

  const importId = data.id as string
  if (rows.length > 0) {
    const { error: rowsError } = await supabaseAdmin
      .from('structured_rows')
      .insert(rows.map((row, index) => ({
        import_id: importId,
        row_index: index + 1,
        data: row,
      })))

    if (rowsError) throw new Error(`Structured rows import failed: ${rowsError.message}`)
  }

  return importId
}

async function updateStructuredImport(
  importId: string,
  update: {
    status: 'mapped' | 'raw_only' | 'mapping_error'
    targetTable: 'properties' | 'crm_leads' | 'transactions' | null
    errorMessage?: string | null
  }
) {
  await supabaseAdmin
    .from('structured_imports')
    .update({
      status: update.status,
      target_table: update.targetTable,
      error_message: update.errorMessage ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', importId)
}

function inferColumns(rows: Record<string, unknown>[]): string[] {
  return rows[0] ? Object.keys(rows[0]) : []
}

function normalizeRow(
  table: string,
  row: Record<string, unknown>,
  sourceFile: string
): Record<string, unknown> | null {
  const lower: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(row)) {
    lower[normalizeKey(k)] = v
  }

  if (table === 'transactions') {
    // Castka může být číslo nebo string (SheetJS vrací různé typy)
    const castkaNorm = toNumber(pick(lower, ['castka', 'amount', 'castka_kc', 'suma']))

    // Datum: SheetJS vrací Date objekt (cellDates:true) nebo string
    const datumRaw = pick(lower, ['datum', 'date', 'datum_platby'])
    let datum: string | null = null
    if (datumRaw instanceof Date) {
      datum = datumRaw.toISOString().split('T')[0]
    } else if (typeof datumRaw === 'string' && datumRaw.trim()) {
      datum = datumRaw.trim().slice(0, 10)
    } else if (typeof datumRaw === 'number') {
      // Excel serial date — převod na JS Date (epoch 1900-01-01)
      const jsDate = new Date(Math.round((datumRaw - 25569) * 86400 * 1000))
      datum = jsDate.toISOString().split('T')[0]
    }
    if (!datum) return null

    const rowKey = `${sourceFile}-${datum}-${castkaNorm}-${JSON.stringify(row)}`
    const externalId = String(pick(lower, ['id', 'external_id']) || simpleHash(rowKey)).slice(0, 100)

    const kategorie = normalizeKategorie(String(pick(lower, ['kategorie', 'category', 'popis', 'typ']) ?? ''))

    return {
      external_id: externalId,
      datum,
      typ: String(pick(lower, ['typ', 'type']) ?? 'Příchozí'),
      castka: castkaNorm,
      popis: pick(lower, ['popis', 'description', 'poznamka_platby']) ?? null,
      id_nemovitosti: pick(lower, ['id_nemovitosti', 'property_id', 'nemovitost']) ?? null,
      id_najemnika: pick(lower, ['id_najemnika', 'tenant_id']) ?? null,
      najemnik: pick(lower, ['najemnik', 'tenant', 'klient', 'jmeno']) ?? null,
      vs: pick(lower, ['vs', 'variabilni_symbol', 'variable_symbol']) ?? null,
      kategorie,
      poznamka: pick(lower, ['poznamka', 'note', 'komentar']) ?? null,
      source_file: sourceFile,
    }
  }

  if (table === 'properties') {
    const name = pick(lower, ['nazev', 'nazev_nemovitosti', 'name', 'adresa', 'address']) ?? 'Bez nazvu'
    const address = pick(lower, ['adresa', 'address', 'ulice', 'lokalita']) ?? name

    return {
      external_id: String(pick(lower, ['id', 'external_id', 'cislo', 'kod']) || `${sourceFile}-${JSON.stringify(row)}`).slice(0, 100),
      name,
      address,
      city: pick(lower, ['mesto', 'city', 'obec']) ?? 'Praha',
      district: pick(lower, ['lokalita', 'district', 'oblast', 'cast_mesta', 'ctvrt']) ?? null,
      price: toNumber(pick(lower, ['cena', 'kupni_cena', 'price'])),
      area_sqm: toNumber(pick(lower, ['plocha', 'plocha_m2', 'area_sqm', 'area_m2', 'velikost'])),
      type: pick(lower, ['typ', 'type', 'property_type', 'druh', 'typ_nemovitosti']) ?? null,
      status: pick(lower, ['stav', 'status']) ?? 'available',
      year_built: toNumber(pick(lower, ['rok_vystavby', 'year_built'])),
      last_reconstruction: toNumber(pick(lower, ['rekonstrukce', 'last_reconstruction', 'rok_rekonstrukce', 'posledni_rekonstrukce'])),
      construction_notes: pick(lower, ['stavebni_upravy', 'construction_notes', 'poznamky', 'notes']) ?? null,
      missing_fields: detectMissing(lower, ['rekonstrukce', 'last_reconstruction', 'rok_rekonstrukce', 'stavebni_upravy', 'rok_vystavby']),
      source_file: sourceFile,
    }
  } else {
    return {
      external_id: String(pick(lower, ['id', 'external_id', 'cislo', 'kod']) || `${sourceFile}-${JSON.stringify(row)}`).slice(0, 100),
      name: pick(lower, ['jmeno', 'name', 'kontakt', 'klient', 'zakaznik']) ?? 'Neznamy',
      email: pick(lower, ['email', 'mail', 'e_mail']) ?? null,
      phone: pick(lower, ['telefon', 'phone', 'tel', 'mobil']) ?? null,
      source: pick(lower, ['zdroj', 'source', 'kanal']) ?? 'import',
      status: pick(lower, ['stav', 'status']) ?? 'new',
      property_interest: pick(lower, ['zajem', 'property_interest', 'zajem_o', 'nemovitost']) ?? null,
      budget_min: toNumber(pick(lower, ['rozpocet_min', 'budget_min', 'budget_od'])),
      budget_max: toNumber(pick(lower, ['rozpocet_max', 'budget_max', 'budget_do'])),
      notes: pick(lower, ['poznamky', 'notes', 'komentar']) ?? null,
      source_file: sourceFile,
    }
  }
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

function pick(row: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) {
    const value = row[key]
    if (value !== null && value !== undefined && value !== '') return value
  }
  return null
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
  return 'other'
}

function simpleHash(str: string): string {
  let h = 5381
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) + h) ^ str.charCodeAt(i)
    h = h >>> 0
  }
  return h.toString(36)
}

function normalizeKategorie(raw: string): string | null {
  const v = raw.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  if (v.includes('najem') || v.includes('rent') || v.includes('najemne')) return 'Najem'
  if (v.includes('udrzb') || v.includes('oprav') || v.includes('servis') || v.includes('mainten')) return 'Udrzba'
  if (v.includes('provize') || v.includes('komise') || v.includes('commission')) return 'Provize'
  if (v) return 'Jine'
  return null
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

import { supabaseAdmin } from '@/lib/supabase/client'
import { searchDocuments } from '@/lib/memory/rag'
import { getCalendarSlots } from '@/lib/google/calendar'
import { createGmailDraft } from '@/lib/google/gmail'
import { lookupLocalityDynamic } from '@/lib/scraper/locality'
import type { PresentationInput } from '@/lib/export/pptx'
import { artifactDeckFromPresentation, artifactFromVisualization, chartConfigFromArtifact } from '@/lib/artifacts/from-agent'
import type { Citation } from '@/types'

export async function handleToolCall(
  name: string,
  args: Record<string, unknown>,
  accessToken?: string | null
): Promise<{ result: unknown; citations: Citation[] }> {
  switch (name) {
    case 'search_documents':
      return handleSearchDocuments(args)
    case 'query_structured_data':
      return handleQueryStructuredData(args)
    case 'get_calendar_slots':
      return handleGetCalendarSlots(args, accessToken)
    case 'draft_communication':
      return handleDraftCommunication(args, accessToken)
    case 'create_visualization':
      return handleCreateVisualization(args)
    case 'generate_report':
      return handleGenerateReport(args)
    case 'create_presentation':
      return handleCreatePresentation(args)
    case 'schedule_action':
      return handleScheduleAction(args)
    case 'setup_monitoring':
      return handleSetupMonitoring(args)
    case 'manage_documents':
      return handleManageDocuments(args)
    case 'manage_monitoring':
      return handleManageMonitoring(args)
    default:
      return { result: `Neznámý nástroj: ${name}`, citations: [] }
  }
}

async function handleSearchDocuments(args: Record<string, unknown>) {
  const results = await searchDocuments(args.query as string, {
    sourceType: args.source_type as string | undefined,
    sourceFile: args.source_file as string | undefined,
    uploadedFileId: args.uploaded_file_id as string | undefined,
    limit: (args.limit as number) || 5,
  })

  if (!results.length) {
    return { result: 'Žádné dokumenty nenalezeny pro tento dotaz.', citations: [] }
  }

  const citations: Citation[] = results.map(r => ({
    source_file: r.chunk.source_file,
    source_type: r.chunk.source_type,
    rows: r.chunk.source_row_start
      ? `řádky ${r.chunk.source_row_start}–${r.chunk.source_row_end}`
      : undefined,
    ingested_at: r.chunk.ingested_at,
  }))

  return {
    result: results.map(r => ({
      content: r.chunk.content,
      source: r.chunk.source_file,
      similarity: Math.round(r.similarity * 100) + '%',
    })),
    citations,
  }
}

async function handleQueryStructuredData(args: Record<string, unknown>) {
  const table = args.table as string
  const filters = (args.filters as Record<string, string>) || {}
  const aggregation = args.aggregation as string | undefined

  const allowedTables = ['crm_leads', 'properties', 'scraped_listings', 'transactions']
  if (!allowedTables.includes(table)) {
    return { result: `Tabulka ${table} není povolena.`, citations: [] }
  }

  // Transactions mají datum místo created_at — zpracujeme zvlášť
  if (table === 'transactions') {
    return handleQueryTransactions(filters, aggregation)
  }

  let query = supabaseAdmin.from(table).select('*')

  if (filters.name) query = query.ilike('name', `%${filters.name}%`)
  if (filters.status) query = query.eq('status', filters.status)
  if (filters.district) query = query.eq('district', filters.district)
  if (filters.source) query = query.eq('source', filters.source)
  if (filters.created_after) query = query.gte('created_at', filters.created_after)
  if (filters.created_before) query = query.lte('created_at', filters.created_before)
  // Filtr pro chybějící data — vrátí záznamy kde missing_fields není prázdný objekt
  if (filters.has_missing_fields === 'true') {
    query = query.neq('missing_fields', '{}')
  }

  query = query.limit(200)

  const { data, error } = await query
  if (error) return { result: `Chyba dotazu: ${error.message}`, citations: [] }

  // Post-processing filtr pro missing_fields (Supabase neq může vracet null záznamy)
  let rows = data ?? []
  if (filters.has_missing_fields === 'true') {
    rows = rows.filter((r: Record<string, unknown>) =>
      r.missing_fields && Object.keys(r.missing_fields as object).length > 0
    )
  }

  let result: unknown = rows

  if (aggregation === 'count') {
    result = { count: rows.length }
  } else if (aggregation === 'group_by_source') {
    result = groupBy(rows, 'source')
  } else if (aggregation === 'group_by_status') {
    result = groupBy(rows, 'status')
  } else if (aggregation === 'avg_price') {
    const prices = rows.map((r: Record<string, number>) => r.price).filter(Boolean)
    result = { avg_price: prices.reduce((a: number, b: number) => a + b, 0) / (prices.length || 1) }
  } else if (aggregation === 'monthly_count') {
    const counts: Record<string, number> = {}
    for (const row of rows as Record<string, string>[]) {
      const month = row.created_at?.slice(0, 7)
      if (month) counts[month] = (counts[month] || 0) + 1
    }
    const sorted = Object.entries(counts).sort(([a], [b]) => a.localeCompare(b))
    const labels = sorted.map(([month]) => month)
    const values = sorted.map(([, count]) => count)
    return {
      result: {
        monthly_counts: sorted.map(([month, count]) => ({ month, count })),
        chart_config: {
          type: 'bar',
          data: { labels, datasets: [{ label: 'Počet leadů', data: values }] },
          options: { responsive: true, plugins: { title: { display: true, text: `Vývoj leadů (${table})` } } },
        },
      },
      citations: [{
        source_file: `${table} (Supabase)`,
        source_type: 'visualization',
        rows: `${rows.length} záznamů`,
        ingested_at: new Date().toISOString(),
      }],
    }
  }

  return {
    result,
    citations: [{
      source_file: `${table} (Supabase)`,
      source_type: 'structured_data',
      rows: `${(data ?? []).length} záznamů`,
      ingested_at: new Date().toISOString(),
    }],
  }
}

async function handleQueryTransactions(
  filters: Record<string, string>,
  aggregation: string | undefined
) {
  let query = supabaseAdmin.from('transactions').select('*')

  // Datum filtry — transactions mají sloupec 'datum' (date), ne 'created_at'
  if (filters.created_after) query = query.gte('datum', filters.created_after)
  if (filters.created_before) query = query.lte('datum', filters.created_before)
  if (filters.id_nemovitosti) query = query.eq('id_nemovitosti', filters.id_nemovitosti)
  if (filters.kategorie) query = query.eq('kategorie', filters.kategorie)
  if (filters.typ) query = query.eq('typ', filters.typ)
  if (filters.najemnik) query = query.ilike('najemnik', `%${filters.najemnik}%`)

  query = query.order('datum', { ascending: true }).limit(500)

  const { data, error } = await query
  if (error) return { result: `Chyba dotazu transactions: ${error.message}`, citations: [] }

  const rows = (data ?? []) as Record<string, unknown>[]

  if (aggregation === 'count') {
    return {
      result: { count: rows.length },
      citations: [{ source_file: 'transactions (Supabase)', source_type: 'structured_data', rows: `${rows.length} záznamů`, ingested_at: new Date().toISOString() }],
    }
  }

  if (aggregation === 'monthly_sum') {
    const sums: Record<string, number> = {}
    for (const row of rows) {
      const month = (row.datum as string)?.slice(0, 7)
      const castka = Number(row.castka) || 0
      if (month && row.typ === 'Příchozí') {
        sums[month] = (sums[month] || 0) + castka
      }
    }
    const sorted = Object.entries(sums).sort(([a], [b]) => a.localeCompare(b))
    const labels = sorted.map(([m]) => m)
    const values = sorted.map(([, v]) => Math.round(v))
    return {
      result: {
        monthly_sums: sorted.map(([month, sum]) => ({ month, sum: Math.round(sum) })),
        chart_config: {
          type: 'bar',
          data: { labels, datasets: [{ label: 'Příchozí platby (Kč)', data: values }] },
          options: { responsive: true, plugins: { title: { display: true, text: 'Vývoj příchozích plateb' } } },
        },
      },
      citations: [{ source_file: 'transactions (Supabase)', source_type: 'visualization', rows: `${rows.length} transakcí`, ingested_at: new Date().toISOString() }],
    }
  }

  if (aggregation === 'monthly_count') {
    const counts: Record<string, number> = {}
    for (const row of rows) {
      const month = (row.datum as string)?.slice(0, 7)
      if (month) counts[month] = (counts[month] || 0) + 1
    }
    const sorted = Object.entries(counts).sort(([a], [b]) => a.localeCompare(b))
    const labels = sorted.map(([m]) => m)
    const values = sorted.map(([, v]) => v)
    return {
      result: {
        monthly_counts: sorted.map(([month, count]) => ({ month, count })),
        chart_config: {
          type: 'bar',
          data: { labels, datasets: [{ label: 'Počet transakcí', data: values }] },
          options: { responsive: true, plugins: { title: { display: true, text: 'Počet transakcí po měsících' } } },
        },
      },
      citations: [{ source_file: 'transactions (Supabase)', source_type: 'visualization', rows: `${rows.length} transakcí`, ingested_at: new Date().toISOString() }],
    }
  }

  if (aggregation === 'group_by_nemovitost') {
    const sums: Record<string, { prijato: number; vydano: number; pocet: number }> = {}
    for (const row of rows) {
      const key = (row.id_nemovitosti as string) || 'neznamá'
      if (!sums[key]) sums[key] = { prijato: 0, vydano: 0, pocet: 0 }
      const castka = Number(row.castka) || 0
      if (row.typ === 'Příchozí') sums[key].prijato += castka
      if (row.typ === 'Odchozí') sums[key].vydano += Math.abs(castka)
      sums[key].pocet += 1
    }
    return {
      result: Object.entries(sums).map(([id, v]) => ({
        id_nemovitosti: id,
        celkem_prijato_kc: Math.round(v.prijato),
        celkem_vydano_kc: Math.round(v.vydano),
        pocet_transakci: v.pocet,
      })),
      citations: [{ source_file: 'transactions (Supabase)', source_type: 'structured_data', rows: `${rows.length} transakcí`, ingested_at: new Date().toISOString() }],
    }
  }

  return {
    result: rows,
    citations: [{ source_file: 'transactions (Supabase)', source_type: 'structured_data', rows: `${rows.length} záznamů`, ingested_at: new Date().toISOString() }],
  }
}

async function handleGetCalendarSlots(args: Record<string, unknown>, accessToken?: string | null) {
  if (!accessToken) {
    return {
      result: {
        error: 'Nejsi přihlášen přes Google. Přihlas se tlačítkem v pravém horním rohu.',
        demo_slots: [
          `${args.date_from} 10:00–11:00`,
          `${args.date_from} 14:00–15:00`,
        ],
      },
      citations: [{ source_file: 'Google Calendar (nepřihlášen)', source_type: 'calendar' }],
    }
  }

  try {
    const slots = await getCalendarSlots(
      accessToken,
      args.date_from as string,
      args.date_to as string,
      (args.duration_minutes as number) || 60
    )
    return {
      result: { available_slots: slots, count: slots.length },
      citations: [{ source_file: 'Google Calendar (live)', source_type: 'calendar' }],
    }
  } catch (e) {
    return {
      result: { error: `Chyba Calendar API: ${(e as Error).message}` },
      citations: [{ source_file: 'Google Calendar', source_type: 'calendar' }],
    }
  }
}

async function handleDraftCommunication(args: Record<string, unknown>, accessToken?: string | null) {
  const type = args.type as string
  const recipientName = args.recipient_name as string || 'Vážený zájemce'
  const recipientEmail = args.recipient_email as string || ''
  const context = args.context as string
  const slots = args.proposed_slots as string[] || []

  const slotsText = slots.length
    ? `\n\nNabízím tyto termíny prohlídky:\n${slots.map((s, i) => `${i + 1}. ${s}`).join('\n')}`
    : ''

  const subject = 'Prohlídka nemovitosti — potvrzení termínu'
  const bodyLines = [`Dobrý den, ${recipientName},`]
  if (slots.length) {
    bodyLines.push(`\nRád bych vám navrhl termíny prohlídky nemovitosti.${slotsText}`)
    bodyLines.push(`\nProsím, dejte mi vědět, který termín vám vyhovuje.`)
  } else {
    bodyLines.push(`\n${context}`)
  }
  bodyLines.push(`\nS pozdravem,\nPepa`)
  const body = bodyLines.join('\n')

  // Pokud máme token a email, rovnou vytvoř Gmail draft
  if (accessToken && recipientEmail && type === 'email') {
    try {
      const draftId = await createGmailDraft(accessToken, recipientEmail, subject, body)
      return {
        result: {
          draft: body,
          gmail_draft_id: draftId,
          gmail_draft_created: true,
          message: `Koncept emailu byl uložen do Gmail (ID: ${draftId}). Najdeš ho v Gmail → Koncepty.`,
        },
        citations: [{ source_file: 'Gmail (koncept vytvořen)', source_type: 'gmail' }],
      }
    } catch (e) {
      console.error('Gmail draft error:', (e as Error).message)
      // Fallback na approval flow
    }
  }

  return {
    result: { draft: body, subject, requires_approval: true, type, recipient_email: recipientEmail },
    citations: [{ source_file: 'Šablona emailu (interní)', source_type: 'template' }],
  }
}

async function handleCreateVisualization(args: Record<string, unknown>) {
  const artifact = artifactFromVisualization(args)
  return {
    result: {
      chart_config: chartConfigFromArtifact(artifact),
      artifact_ready: true,
      artifact_type: 'chart',
      artifact_spec: artifact,
      pptx_ready: true,
      source_description: args.source_description,
    },
    citations: [{
      source_file: args.source_description as string,
      source_type: 'visualization',
    }],
  }
}

async function handleGenerateReport(args: Record<string, unknown>) {
  const sections = args.sections as string[]
  const period = args.period as string
  const title = args.title as string

  const { data: leads } = await supabaseAdmin
    .from('crm_leads')
    .select('*')
    .gte('created_at', getDateFromPeriod(period))

  const { data: properties } = await supabaseAdmin
    .from('properties')
    .select('*')

  const citations = [{ source_file: 'Supabase (crm_leads, properties)', source_type: 'structured_data', ingested_at: new Date().toISOString() }]

  const report: string[] = [`# ${title}\n**Období:** ${period}\n`]

  if (sections.includes('leads') && leads) {
    report.push(`## Leady\n- Celkem nových leadů: ${leads.length}`)
    const bySource = groupBy(leads, 'source')
    report.push('- Zdroje: ' + Object.entries(bySource).map(([k, v]) => `${k}: ${(v as unknown[]).length}`).join(', '))
    report.push(`\n→ Zdroj: crm_leads (Supabase), ${leads.length} záznamů, export ${new Date().toLocaleDateString('cs-CZ')}`)
  }

  if (sections.includes('properties') && properties) {
    const missing = properties.filter((p: Record<string, unknown>) => p.missing_fields && Object.keys(p.missing_fields as object).length > 0)
    report.push(`\n## Nemovitosti\n- Celkem v databázi: ${properties.length}\n- S chybějícími daty: ${missing.length}`)
    report.push(`\n→ Zdroj: properties (Supabase), ${properties.length} záznamů`)
  }

  return {
    result: { markdown: report.join('\n'), format: 'markdown' },
    citations,
  }
}

async function handleCreatePresentation(args: Record<string, unknown>) {
  const input = args as unknown as PresentationInput
  if (!input.title || !Array.isArray(input.slides) || input.slides.length === 0) {
    return { result: { error: 'Chybí title nebo slides.' }, citations: [] }
  }

  const deck = artifactDeckFromPresentation(input)

  // Vrátíme jen slide spec — PPTX se generuje až na /api/export/pptx (aby base64 nešlo do LLM)
  return {
    result: {
      presentation_ready: true,
      artifact_ready: true,
      artifact_type: 'deck',
      artifact_deck: deck,
      title: input.title,
      subtitle: input.subtitle,
      slide_count: input.slides.length + 1,
      slides_spec: input,
      pptx_ready: true,
    },
    citations: [],
  }
}

async function handleManageDocuments(args: Record<string, unknown>) {
  const action = args.action as string

  if (action === 'list_categories') {
    const { data } = await supabaseAdmin
      .from('uploaded_files')
      .select('category')
      .not('category', 'is', null)
      .eq('status', 'ready')

    const counts: Record<string, number> = {}
    for (const f of data ?? []) {
      if (f.category) counts[f.category] = (counts[f.category] || 0) + 1
    }

    return {
      result: Object.entries(counts).map(([cat, count]) => `${cat}: ${count} soubor(ů)`),
      citations: [],
    }
  }

  if (action === 'list') {
    let query = supabaseAdmin
      .from('uploaded_files')
      .select('id, name, category, chunk_count, uploaded_at, status')
      .order('uploaded_at', { ascending: false })

    if (args.category) query = query.eq('category', args.category as string)
    if (args.uploaded_before) query = query.lt('uploaded_at', args.uploaded_before as string)
    if (args.uploaded_after) query = query.gte('uploaded_at', args.uploaded_after as string)

    const { data } = await query.limit(50)
    return {
      result: (data ?? []).map(f => ({
        id: f.id,
        název: f.name,
        kategorie: f.category ?? 'bez kategorie',
        chunků: f.chunk_count,
        nahráno: (f.uploaded_at as string)?.slice(0, 10),
        stav: f.status,
      })),
      citations: [],
    }
  }

  if (action === 'delete') {
    if (!args.file_id && !args.category && !args.uploaded_before) {
      return { result: 'Upřesni co smazat — category, uploaded_before, nebo file_id.', citations: [] }
    }

    let query = supabaseAdmin.from('uploaded_files').delete()
    if (args.file_id) query = query.eq('id', args.file_id as string)
    if (args.category) query = query.eq('category', args.category as string)
    if (args.uploaded_before) query = query.lt('uploaded_at', args.uploaded_before as string)

    const { error } = await query
    if (error) return { result: `Chyba: ${error.message}`, citations: [] }

    return { result: 'Dokumenty smazány včetně RAG chunků (kaskádové smazání).', citations: [] }
  }

  return { result: 'Neznámá akce. Použij: list, delete, list_categories.', citations: [] }
}

async function handleManageMonitoring(args: Record<string, unknown>) {
  const action = args.action as string

  if (action === 'list') {
    const { data } = await supabaseAdmin.from('monitoring_configs').select('id, location_name, category_type, active, created_at').order('created_at', { ascending: false })
    return {
      result: data?.length
        ? data.map(c => `• ${c.location_name} (${c.category_type === 2 ? 'pronájem' : 'prodej'}) — id: ${c.id}`)
        : 'Žádné aktivní sledování.',
      citations: [],
    }
  }

  if (action === 'delete_all') {
    await supabaseAdmin.from('monitoring_configs').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    await supabaseAdmin.from('scraped_listings').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    return { result: 'Všechna sledování i scraped listings smazány.', citations: [] }
  }

  if (action === 'delete' && args.location_name) {
    await supabaseAdmin.from('monitoring_configs').delete().ilike('location_name', `%${args.location_name}%`)
    return { result: `Sledování pro "${args.location_name}" smazáno.`, citations: [] }
  }

  return { result: 'Neznámá akce. Použij: list, delete, delete_all.', citations: [] }
}

async function handleSetupMonitoring(args: Record<string, unknown>) {
  const location = (args.location as string) || 'Praha 7'
  const categoryType = args.category_type === 'pronájem' ? 2 : 1
  const categoryMain = args.category_main === 'domy' ? 2 : 1
  const notifyEmail = process.env.NOTIFY_EMAIL ?? ''

  const locality = await lookupLocalityDynamic(location)

  if (!locality.districtId && !locality.verified) {
    return {
      result: `Lokalitu "${location}" se nepodařilo najít na Sreality. Zkus upřesnit název (např. "Praha 7", "Brno-střed") nebo ověř správný název obce.`,
      citations: [],
    }
  }

  const categoryLabel = categoryType === 1 ? 'prodej' : 'pronájem'
  const typeLabel = categoryMain === 1 ? 'byty' : 'domy'
  const displayName = location.trim() || locality.locationName

  return {
    result: {
      requires_approval: true,
      type: 'monitoring',
      description: `Nastavit denní sledování: ${typeLabel} na ${categoryLabel} v lokalitě ${displayName}. Email přijde každý den ráno pokud jsou nové nabídky.`,
      location_name: displayName,
      sreality_district_id: locality.districtId ?? null,
      category_main: categoryMain,
      category_type: categoryType,
      notify_email: notifyEmail,
    },
    citations: [],
  }
}

async function handleScheduleAction(args: Record<string, unknown>) {
  return {
    result: {
      requires_approval: true,
      cron: args.cron,
      action_type: args.action_type,
      action_params: args.action_params,
      description: args.description,
      next_run_human: cronToHuman(args.cron as string),
    },
    citations: [],
  }
}

function groupBy(arr: Record<string, unknown>[], key: string): Record<string, unknown[]> {
  const result: Record<string, unknown[]> = {}
  for (const item of arr) {
    const k = (item[key] as string) || 'neznámý'
    result[k] = result[k] ? [...result[k], item] : [item]
  }
  return result
}

function getDateFromPeriod(period: string): string {
  const now = new Date()
  if (period.includes('Q1')) return `${now.getFullYear()}-01-01`
  if (period.includes('Q2')) return `${now.getFullYear()}-04-01`
  if (period.includes('Q3')) return `${now.getFullYear()}-07-01`
  if (period.includes('Q4')) return `${now.getFullYear()}-10-01`
  if (period.includes('týden') || period.includes('week')) {
    const d = new Date(now)
    d.setDate(d.getDate() - 7)
    return d.toISOString().split('T')[0]
  }
  if (period.includes('měsíc') || period.includes('month')) {
    const d = new Date(now)
    d.setMonth(d.getMonth() - 1)
    return d.toISOString().split('T')[0]
  }
  return new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0]
}

function cronToHuman(cron: string): string {
  if (cron === '0 8 * * 1-5') return 'každý pracovní den v 8:00'
  if (cron === '0 8 * * 1') return 'každé pondělí v 8:00'
  if (cron === '0 8 * * *') return 'každý den v 8:00'
  return `cron: ${cron}`
}

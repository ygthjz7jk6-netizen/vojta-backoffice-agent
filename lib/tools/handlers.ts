import { supabaseAdmin } from '@/lib/supabase/client'
import { searchDocuments } from '@/lib/memory/rag'
import { getCalendarSlots } from '@/lib/google/calendar'
import { createGmailDraft } from '@/lib/google/gmail'
import { lookupLocality } from '@/lib/scraper/locality'
import type { PresentationInput } from '@/lib/export/pptx'
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
    default:
      return { result: `Neznámý nástroj: ${name}`, citations: [] }
  }
}

async function handleSearchDocuments(args: Record<string, unknown>) {
  const results = await searchDocuments(args.query as string, {
    sourceType: args.source_type as string | undefined,
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

  const allowedTables = ['crm_leads', 'properties', 'scraped_listings']
  if (!allowedTables.includes(table)) {
    return { result: `Tabulka ${table} není povolena.`, citations: [] }
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
    // Vrátíme rovnou chart_config — agent nepotřebuje druhý tool call
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
  return {
    result: {
      chart_config: {
        type: args.chart_type,
        data: {
          labels: args.labels,
          datasets: args.datasets,
        },
        options: {
          responsive: true,
          plugins: { title: { display: true, text: args.title } },
        },
      },
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
  const format = (args.format as string) || 'markdown'

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

  // Vrátíme jen slide spec — PPTX se generuje až na /api/export/pptx (aby base64 nešlo do LLM)
  return {
    result: {
      presentation_ready: true,
      title: input.title,
      subtitle: input.subtitle,
      slide_count: input.slides.length + 1,
      slides_spec: input,
    },
    citations: [],
  }
}

async function handleSetupMonitoring(args: Record<string, unknown>) {
  const location = (args.location as string) || 'Praha 7'
  const categoryType = args.category_type === 'pronájem' ? 2 : 1
  const categoryMain = args.category_main === 'domy' ? 2 : 1
  const notifyEmail = process.env.NOTIFY_EMAIL ?? ''

  const locality = lookupLocality(location)

  const categoryLabel = categoryType === 1 ? 'prodej' : 'pronájem'
  const typeLabel = categoryMain === 1 ? 'byty' : 'domy'
  // Zachovej původní název od uživatele, locality slouží jen pro Sreality ID
  const displayName = location.trim() || locality.locationName

  return {
    result: {
      requires_approval: true,
      type: 'monitoring',
      description: `Nastavit denní sledování: ${typeLabel} na ${categoryLabel} v lokalitě ${displayName}. Email přijde každý den ráno pokud jsou nové nabídky.`,
      location_name: displayName,
      sreality_district_id: locality.districtId ?? null,
      sreality_region_id: locality.regionId ?? null,
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

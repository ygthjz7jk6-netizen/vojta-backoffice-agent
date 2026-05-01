import { NextRequest, NextResponse } from 'next/server'
import { scrapeSreality } from '@/lib/scraper/sreality'
import { scrapeBezrealitky } from '@/lib/scraper/bezrealitky'
import { sendNewListingsEmail } from '@/lib/notifications/email'
import { supabaseAdmin } from '@/lib/supabase/client'
import type { ScrapedListing } from '@/lib/scraper/sreality'

export const maxDuration = 60

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const isCron = authHeader === `Bearer ${process.env.CRON_SECRET}`
  const isManual = req.nextUrl.searchParams.get('manual') === '1'

  if (!isCron && !isManual) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Načti aktivní konfigurace z DB
  const { data: configs, error: configError } = await supabaseAdmin
    .from('monitoring_configs')
    .select('*')
    .eq('active', true)

  if (configError) {
    return NextResponse.json({ error: configError.message }, { status: 500 })
  }

  // Pokud nejsou žádné konfigurace, použij fallback (env proměnné / defaulty)
  const activeConfigs = configs && configs.length > 0
    ? configs
    : [{
        id: 'default',
        location_name: process.env.SCRAPE_LOCATION ?? 'Holešovice',
        sreality_district_id: 5007,
        sreality_region_id: null,
        category_main: 1,
        category_type: 1,
        notify_email: process.env.NOTIFY_EMAIL ?? '',
      }]

  const results = []

  for (const config of activeConfigs) {
    const result = await scrapeAndNotify(config)
    results.push({ location: config.location_name, ...result })
  }

  return new NextResponse(JSON.stringify({ ok: true, results }), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  })
}

async function scrapeAndNotify(config: {
  location_name: string
  sreality_district_id?: number | null
  sreality_region_id?: number | null
  category_main: number
  category_type: number
  notify_email: string
}) {
  const [srealityRaw, bezrealitkyRaw] = await Promise.allSettled([
    scrapeSreality({
      categoryMain: config.category_main,
      categoryType: config.category_type,
      districtId: config.sreality_district_id ?? undefined,
      cityFilter: config.sreality_district_id ? config.location_name : undefined,
    }),
    scrapeBezrealitky({ location: config.location_name }),
  ])

  const allListings: ScrapedListing[] = [
    ...(srealityRaw.status === 'fulfilled' ? srealityRaw.value : []),
    ...(bezrealitkyRaw.status === 'fulfilled' ? bezrealitkyRaw.value : []),
  ]

  if (allListings.length === 0) {
    return { new: 0, total: 0, emailSent: false }
  }

  // Zjistit nové
  const { data: existing } = await supabaseAdmin
    .from('scraped_listings')
    .select('source_site, external_id')
    .in('source_site', [...new Set(allListings.map(l => l.sourceSite))])

  const existingSet = new Set(
    (existing ?? []).map(r => `${r.source_site}__${r.external_id}`)
  )
  const newListings = allListings.filter(l => !existingSet.has(`${l.sourceSite}__${l.externalId}`))

  // Upsert
  await supabaseAdmin.from('scraped_listings').upsert(
    allListings.map(l => ({
      source_site: l.sourceSite,
      external_id: l.externalId,
      title: l.title,
      price: l.price,
      location: l.location,
      area_sqm: l.areaSqm,
      url: l.url,
      scraped_at: new Date().toISOString(),
    })),
    { onConflict: 'source_site,external_id', ignoreDuplicates: false }
  )

  // Email
  let emailSent = false
  if (newListings.length > 0 && process.env.RESEND_API_KEY && config.notify_email) {
    await sendNewListingsEmail(newListings, config.location_name)
    emailSent = true
  }

  console.log(`[scrape-notify] ${config.location_name}: total=${allListings.length} new=${newListings.length} emailSent=${emailSent}`)

  return {
    total: allListings.length,
    new: newListings.length,
    emailSent,
    sreality: srealityRaw.status === 'fulfilled' ? srealityRaw.value.length : `error: ${(srealityRaw as PromiseRejectedResult).reason}`,
    bezrealitky: bezrealitkyRaw.status === 'fulfilled' ? bezrealitkyRaw.value.length : `error: ${(bezrealitkyRaw as PromiseRejectedResult).reason}`,
  }
}

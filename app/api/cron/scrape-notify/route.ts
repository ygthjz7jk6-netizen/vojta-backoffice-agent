import { NextRequest, NextResponse } from 'next/server'
import { scrapeAllSreality } from '@/lib/scraper/sreality'
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

  const { data: configs, error: configError } = await supabaseAdmin
    .from('monitoring_configs')
    .select('*')
    .eq('active', true)

  if (configError) {
    return NextResponse.json({ error: configError.message }, { status: 500 })
  }

  const activeConfigs = configs && configs.length > 0
    ? configs
    : [{
        id: 'default',
        location_name: process.env.SCRAPE_LOCATION ?? 'Holešovice',
        sreality_district_id: 5007,
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
  category_main: number
  category_type: number
  notify_email: string
}) {
  const [srealityRaw, bezrealitkyRaw] = await Promise.allSettled([
    scrapeAllSreality({
      categoryMain: config.category_main,
      categoryType: config.category_type,
      districtId: config.sreality_district_id ?? undefined,
      cityName: !config.sreality_district_id ? config.location_name : undefined,
      cityFilter: !config.sreality_district_id ? config.location_name : undefined,
    }),
    scrapeBezrealitky({ location: config.location_name }),
  ])

  const allListings: ScrapedListing[] = [
    ...(srealityRaw.status === 'fulfilled' ? srealityRaw.value : []),
    ...(bezrealitkyRaw.status === 'fulfilled' ? bezrealitkyRaw.value : []),
  ]

  // Načti existující záznamy pro tuto lokaci
  const { data: existing } = await supabaseAdmin
    .from('scraped_listings')
    .select('external_id, source_site')
    .eq('location_name', config.location_name)

  const existingSet = new Set((existing ?? []).map(r => `${r.source_site}__${r.external_id}`))
  const scrapedSet = new Set(allListings.map(l => `${l.sourceSite}__${l.externalId}`))

  // Nové nabídky — nejsou v DB
  const newListings = allListings.filter(l => !existingSet.has(`${l.sourceSite}__${l.externalId}`))

  // Stale nabídky — jsou v DB ale nebyly ve výsledcích (prodáno/smazáno)
  const staleKeys = [...existingSet].filter(k => !scrapedSet.has(k))
  if (staleKeys.length > 0) {
    const staleExternalIds = staleKeys.map(k => k.split('__')[1])
    await supabaseAdmin
      .from('scraped_listings')
      .delete()
      .eq('location_name', config.location_name)
      .in('external_id', staleExternalIds)
  }

  // Ulož nové do DB
  if (newListings.length > 0) {
    await supabaseAdmin.from('scraped_listings').upsert(
      newListings.map(l => ({
        source_site: l.sourceSite,
        external_id: l.externalId,
        title: l.title,
        price: l.price,
        location: l.location,
        area_sqm: l.areaSqm,
        url: l.url,
        location_name: config.location_name,
        scraped_at: new Date().toISOString(),
      })),
      { onConflict: 'source_site,external_id', ignoreDuplicates: false }
    )
  }

  // Email
  let emailSent = false
  if (newListings.length > 0 && process.env.RESEND_API_KEY && config.notify_email) {
    await sendNewListingsEmail(newListings, config.location_name)
    emailSent = true
  }

  console.log(`[scrape-notify] ${config.location_name}: total=${allListings.length} new=${newListings.length} stale=${staleKeys.length} emailSent=${emailSent}`)

  return {
    total: allListings.length,
    new: newListings.length,
    stale: staleKeys.length,
    emailSent,
    sreality: srealityRaw.status === 'fulfilled' ? srealityRaw.value.length : `error: ${(srealityRaw as PromiseRejectedResult).reason}`,
    bezrealitky: bezrealitkyRaw.status === 'fulfilled' ? bezrealitkyRaw.value.length : `error: ${(bezrealitkyRaw as PromiseRejectedResult).reason}`,
  }
}

const { Client } = require('pg')

const client = new Client({
  connectionString: 'postgresql://postgres:Zmrzka54233@db.cvedbzdukgclzbherphm.supabase.co:5432/postgres',
  ssl: { rejectUnauthorized: false }
})

// Helper
const rnd = (arr) => arr[Math.floor(Math.random() * arr.length)]
const date = (y, m, d) => new Date(y, m - 1, d).toISOString()

async function seed() {
  await client.connect()
  console.log('Připojeno. Mazání starých demo dat...')

  await client.query(`DELETE FROM crm_leads WHERE name LIKE '[DEMO]%'`)
  await client.query(`DELETE FROM properties WHERE address LIKE '[DEMO]%'`)
  await client.query(`DELETE FROM scraped_listings WHERE source_site LIKE 'DEMO%'`)
  console.log('✓ Stará demo data smazána')

  // ─── CRM LEADY ───────────────────────────────────────────────────────────────
  // Q1 2025 (leden–březen) — 38 leadů
  // Q4 2024 (říjen–prosinec) — pro 6měsíční graf
  const sources = ['sreality', 'doporučení', 'web', 'inzerát', 'facebook', 'doporučení']
  const statuses = ['new', 'contacted', 'viewing', 'offer', 'closed', 'lost']
  const agents = ['Jana Nováková', 'Tomáš Kovář', 'Pepa Svoboda']
  const interests = [
    'Byt 2+kk Praha 3', 'Dům Praha-západ', 'Byt 3+1 Praha 5',
    'Investiční byt Praha 10', 'Byt 2+1 Praha 6', 'Kancelář Praha 1',
    'Byt 1+kk Praha 2', 'Dům Středočeský kraj'
  ]

  const leads = []

  // Q4 2024 — říjen
  for (let i = 1; i <= 8; i++) {
    leads.push({
      name: `[DEMO] ${['Martin Dvořák','Lucie Marková','Pavel Hájek','Tereza Blažková','Ondřej Šimánek','Kateřina Procházková','Jiří Novák','Eva Pokorná'][i-1]}`,
      email: `demo.lead${i+100}@example.com`,
      phone: `+420 60${i} 111 22${i}`,
      source: rnd(sources),
      status: rnd(['closed','lost','contacted']),
      property_interest: rnd(interests),
      budget_min: [3000000,4000000,5000000,6000000][i%4],
      budget_max: [4500000,5500000,6500000,8000000][i%4],
      assigned_to: rnd(agents),
      created_at: date(2024, 10, i * 3),
    })
  }

  // Q4 2024 — listopad
  for (let i = 1; i <= 10; i++) {
    leads.push({
      name: `[DEMO] ${['Roman Beneš','Veronika Horáčková','Michal Kratochvíl','Petra Červenková','Stanislav Fiala','Ivana Kopecká','Radek Mašek','Dagmar Veselá','Vladimír Tůma','Zuzana Říhová'][i-1]}`,
      email: `demo.lead${i+200}@example.com`,
      phone: `+420 72${i} 222 33${i}`,
      source: rnd(sources),
      status: rnd(['closed','contacted','offer']),
      property_interest: rnd(interests),
      budget_min: [2500000,3500000,4500000,7000000][i%4],
      budget_max: [4000000,5000000,6000000,9000000][i%4],
      assigned_to: rnd(agents),
      created_at: date(2024, 11, Math.min(i * 2 + 1, 28)),
    })
  }

  // Q4 2024 — prosinec
  for (let i = 1; i <= 6; i++) {
    leads.push({
      name: `[DEMO] ${['Aleš Pospíšil','Monika Štefanová','Lubomír Zajíček','Renata Hrubá','Dušan Hampl','Simona Vlčková'][i-1]}`,
      email: `demo.lead${i+300}@example.com`,
      phone: `+420 73${i} 333 44${i}`,
      source: rnd(sources),
      status: rnd(['contacted','new','viewing']),
      property_interest: rnd(interests),
      budget_min: 3000000,
      budget_max: 6000000,
      assigned_to: rnd(agents),
      created_at: date(2024, 12, i * 4),
    })
  }

  // Q1 2025 — leden (12 leadů, různé zdroje pro demo otázku "odkud přišli")
  const q1JanNames = ['Adam Procházka','Barbora Součková','Ctibor Vlček','Dana Kroupová','Emil Stránský','Františka Novotná','Gabriela Šimková','Hynek Polák','Ilona Marečková','Jakub Fixa','Klára Veselá','Leoš Beneš']
  const q1JanSources = ['sreality','sreality','sreality','doporučení','doporučení','web','web','facebook','sreality','inzerát','doporučení','web']
  for (let i = 0; i < 12; i++) {
    leads.push({
      name: `[DEMO] ${q1JanNames[i]}`,
      email: `demo.q1jan${i}@example.com`,
      phone: `+420 60${i} 444 55${i}`,
      source: q1JanSources[i],
      status: rnd(['new','contacted','viewing','offer','closed']),
      property_interest: rnd(interests),
      budget_min: [2800000,3500000,4200000,5500000][i%4],
      budget_max: [4200000,5200000,6500000,8500000][i%4],
      assigned_to: rnd(agents),
      created_at: date(2025, 1, Math.min(i * 2 + 1, 28)),
      notes: i === 3 ? 'Zákazník přišel přes doporučení od Novákových' : null,
    })
  }

  // Q1 2025 — únor (14 leadů)
  const q1FebNames = ['Marie Kolářová','Norbert Špička','Olga Kratochvílová','Patrik Červenka','Radka Benešová','Stanislava Horká','Tomáš Vondráček','Uršula Macková','Václav Konečný','Věra Šimáčková','Xenie Horáková','Yvona Jirásková','Zdeněk Pokorný','Alžběta Hájková']
  const q1FebSources = ['doporučení','sreality','web','doporučení','sreality','facebook','web','inzerát','doporučení','sreality','web','facebook','doporučení','sreality']
  for (let i = 0; i < 14; i++) {
    leads.push({
      name: `[DEMO] ${q1FebNames[i]}`,
      email: `demo.q1feb${i}@example.com`,
      phone: `+420 77${i} 555 66${i}`,
      source: q1FebSources[i],
      status: rnd(['new','contacted','viewing','offer']),
      property_interest: rnd(interests),
      budget_min: [3000000,4000000,5000000,6000000][i%4],
      budget_max: [5000000,6000000,7000000,9000000][i%4],
      assigned_to: rnd(agents),
      created_at: date(2025, 2, Math.min(i * 2 + 1, 26)),
    })
  }

  // Q1 2025 — březen (12 leadů)
  const q1MarNames = ['Bedřich Král','Cecílie Marková','David Smola','Elena Procházková','Filip Novák','Gabriela Kopecká','Hubert Šimánek','Irena Blažková','Jaroslav Dvořák','Kamila Nováková','Lukáš Kratochvíl','Magdaléna Pospíšilová']
  for (let i = 0; i < 12; i++) {
    leads.push({
      name: `[DEMO] ${q1MarNames[i]}`,
      email: `demo.q1mar${i}@example.com`,
      phone: `+420 72${i} 666 77${i}`,
      source: rnd(sources),
      status: rnd(['new','contacted','viewing']),
      property_interest: rnd(interests),
      budget_min: [3500000,4500000,5500000,7000000][i%4],
      budget_max: [5500000,6500000,8000000,10000000][i%4],
      assigned_to: rnd(agents),
      created_at: date(2025, 3, Math.min(i * 2 + 2, 30)),
    })
  }

  // INSERT leads
  for (const lead of leads) {
    await client.query(
      `INSERT INTO crm_leads (name, email, phone, source, status, property_interest, budget_min, budget_max, assigned_to, notes, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [lead.name, lead.email, lead.phone, lead.source, lead.status,
       lead.property_interest, lead.budget_min, lead.budget_max,
       lead.assigned_to, lead.notes || null, lead.created_at]
    )
  }
  console.log(`✓ ${leads.length} demo leadů vloženo`)

  // ─── NEMOVITOSTI ─────────────────────────────────────────────────────────────
  const properties = [
    // Nemovitosti S kompletními daty
    {
      address: '[DEMO] Mánesova 45', city: 'Praha', district: 'Praha 2',
      price: 8500000, area_sqm: 72, type: 'byt', status: 'available',
      year_built: 1935, last_reconstruction: 2019,
      construction_notes: 'Kompletní rekonstrukce 2019: nová koupelna, kuchyně, podlahy.',
      missing_fields: {}
    },
    {
      address: '[DEMO] Korunní 12', city: 'Praha', district: 'Praha 2',
      price: 12000000, area_sqm: 110, type: 'byt', status: 'reserved',
      year_built: 1910, last_reconstruction: 2022,
      construction_notes: 'Rekonstrukce 2022: střecha, fasáda, výtah.',
      missing_fields: {}
    },
    {
      address: '[DEMO] Blanická 8', city: 'Praha', district: 'Praha 2',
      price: 6200000, area_sqm: 58, type: 'byt', status: 'available',
      year_built: 1968, last_reconstruction: 2015,
      construction_notes: 'Rekonstrukce bytového jádra 2015.',
      missing_fields: {}
    },
    {
      address: '[DEMO] Na Příkopě 22', city: 'Praha', district: 'Praha 1',
      price: 45000000, area_sqm: 280, type: 'kancelar', status: 'available',
      year_built: 1990, last_reconstruction: 2020,
      construction_notes: 'Modernizace 2020: klimatizace, IT infrastruktura.',
      missing_fields: {}
    },
    {
      address: '[DEMO] Krkonošská 3', city: 'Praha', district: 'Praha 10',
      price: 5800000, area_sqm: 52, type: 'byt', status: 'sold',
      year_built: 1978, last_reconstruction: 2018,
      construction_notes: 'Kompletní rekonstrukce 2018.',
      missing_fields: {}
    },
    // Nemovitosti S CHYBĚJÍCÍMI daty (pro demo scénář)
    {
      address: '[DEMO] Holečkova 77', city: 'Praha', district: 'Praha 5',
      price: 7200000, area_sqm: 68, type: 'byt', status: 'available',
      year_built: 1925, last_reconstruction: null,
      construction_notes: null,
      missing_fields: { last_reconstruction: 'chybí rok rekonstrukce', construction_notes: 'chybí popis stavebních úprav' }
    },
    {
      address: '[DEMO] Dejvická 14', city: 'Praha', district: 'Praha 6',
      price: 9100000, area_sqm: 85, type: 'byt', status: 'available',
      year_built: 1938, last_reconstruction: null,
      construction_notes: null,
      missing_fields: { last_reconstruction: 'chybí rok rekonstrukce', construction_notes: 'neznámý stav stavebních úprav' }
    },
    {
      address: '[DEMO] Milady Horákové 55', city: 'Praha', district: 'Praha 7',
      price: 6500000, area_sqm: 61, type: 'byt', status: 'available',
      year_built: 1962, last_reconstruction: null,
      construction_notes: null,
      missing_fields: { last_reconstruction: 'chybí', construction_notes: 'chybí dokumentace' }
    },
    {
      address: '[DEMO] Budečská 9', city: 'Praha', district: 'Praha 2',
      price: 11500000, area_sqm: 102, type: 'byt', status: 'available',
      year_built: 1905, last_reconstruction: null,
      construction_notes: 'Částečná rekonstrukce — rozsah neznámý.',
      missing_fields: { last_reconstruction: 'chybí přesný rok', construction_notes: 'neúplná dokumentace' }
    },
    {
      address: '[DEMO] Příční 4', city: 'Praha', district: 'Praha 4',
      price: 4900000, area_sqm: 47, type: 'byt', status: 'available',
      year_built: 1985, last_reconstruction: null,
      construction_notes: null,
      missing_fields: { last_reconstruction: 'chybí', construction_notes: 'chybí', year_built: 'ověřit' }
    },
    {
      address: '[DEMO] Mírová 33', city: 'Průhonice', district: 'Praha-západ',
      price: 15800000, area_sqm: 180, type: 'dum', status: 'available',
      year_built: 2001, last_reconstruction: null,
      construction_notes: null,
      missing_fields: { last_reconstruction: 'chybí', construction_notes: 'chybí stavební dokumentace' }
    },
    {
      address: '[DEMO] Lesní 12', city: 'Černošice', district: 'Praha-západ',
      price: 18500000, area_sqm: 210, type: 'dum', status: 'available',
      year_built: 1998, last_reconstruction: null,
      construction_notes: null,
      missing_fields: { last_reconstruction: 'chybí rok', construction_notes: 'neznámý stav' }
    },
    // Holešovice — pro demo scénář sledování nabídek
    {
      address: '[DEMO] Argentinská 18', city: 'Praha', district: 'Praha 7 - Holešovice',
      price: 7800000, area_sqm: 70, type: 'byt', status: 'available',
      year_built: 1930, last_reconstruction: 2021,
      construction_notes: 'Rekonstrukce 2021.',
      missing_fields: {}
    },
    {
      address: '[DEMO] Dělnická 5', city: 'Praha', district: 'Praha 7 - Holešovice',
      price: 9200000, area_sqm: 88, type: 'byt', status: 'available',
      year_built: 1910, last_reconstruction: 2023,
      construction_notes: 'Novostavba v historickém domě 2023.',
      missing_fields: {}
    },
  ]

  for (const p of properties) {
    await client.query(
      `INSERT INTO properties (address, city, district, price, area_sqm, type, status, year_built, last_reconstruction, construction_notes, missing_fields)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [p.address, p.city, p.district, p.price, p.area_sqm, p.type, p.status,
       p.year_built, p.last_reconstruction, p.construction_notes, JSON.stringify(p.missing_fields)]
    )
  }
  console.log(`✓ ${properties.length} demo nemovitostí vloženo`)

  // ─── SCRAPED LISTINGS (Holešovice) ───────────────────────────────────────────
  const scrapedListings = [
    {
      source_site: 'DEMO-sreality',
      external_id: 'demo-sr-001',
      title: '[DEMO] Prodej bytu 3+kk, 78 m², Praha 7 - Holešovice',
      price: 8900000, location: 'Praha 7 - Holešovice', area_sqm: 78,
      url: 'https://www.sreality.cz/detail/prodej/byt/3+kk/demo-001',
      scraped_at: date(2025, 4, 25)
    },
    {
      source_site: 'DEMO-sreality',
      external_id: 'demo-sr-002',
      title: '[DEMO] Prodej bytu 2+kk, 55 m², Praha 7 - Holešovice',
      price: 6200000, location: 'Praha 7 - Holešovice', area_sqm: 55,
      url: 'https://www.sreality.cz/detail/prodej/byt/2+kk/demo-002',
      scraped_at: date(2025, 4, 26)
    },
    {
      source_site: 'DEMO-bezrealitky',
      external_id: 'demo-br-001',
      title: '[DEMO] Pronájem 2+1, 62 m², Praha - Holešovice',
      price: 22000, location: 'Praha 7 - Holešovice', area_sqm: 62,
      url: 'https://www.bezrealitky.cz/detail/demo-001',
      scraped_at: date(2025, 4, 27)
    },
    {
      source_site: 'DEMO-bezrealitky',
      external_id: 'demo-br-002',
      title: '[DEMO] Prodej atypického loftu 95 m², Holešovice',
      price: 12500000, location: 'Praha 7 - Holešovice', area_sqm: 95,
      url: 'https://www.bezrealitky.cz/detail/demo-002',
      scraped_at: date(2025, 4, 28)
    },
  ]

  for (const l of scrapedListings) {
    await client.query(
      `INSERT INTO scraped_listings (source_site, external_id, title, price, location, area_sqm, url, scraped_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (source_site, external_id) DO NOTHING`,
      [l.source_site, l.external_id, l.title, l.price, l.location, l.area_sqm, l.url, l.scraped_at]
    )
  }
  console.log(`✓ ${scrapedListings.length} demo scraped listings vloženo`)

  // ─── SHRNUTÍ ─────────────────────────────────────────────────────────────────
  const { rows: leadCount } = await client.query(`SELECT COUNT(*) FROM crm_leads WHERE name LIKE '[DEMO]%'`)
  const { rows: propCount } = await client.query(`SELECT COUNT(*) FROM properties WHERE address LIKE '[DEMO]%'`)
  const { rows: q1Count } = await client.query(`SELECT COUNT(*) FROM crm_leads WHERE name LIKE '[DEMO]%' AND created_at >= '2025-01-01' AND created_at < '2025-04-01'`)
  const { rows: missingCount } = await client.query(`SELECT COUNT(*) FROM properties WHERE address LIKE '[DEMO]%' AND missing_fields != '{}'::jsonb`)

  console.log('\n=== DEMO DATA SHRNUTÍ ===')
  console.log(`Leady celkem:       ${leadCount[0].count}`)
  console.log(`Leady Q1 2025:      ${q1Count[0].count}`)
  console.log(`Nemovitosti:        ${propCount[0].count}`)
  console.log(`S chybějícími daty: ${missingCount[0].count}`)
  console.log('========================')

  await client.end()
  console.log('\n✓ Hotovo!')
}

seed().catch(e => { console.error('CHYBA:', e.message); process.exit(1) })

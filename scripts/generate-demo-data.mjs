import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const outDir = join(process.cwd(), 'demo-data')

const csvEscape = (value) => {
  if (value === null || value === undefined) return ''
  const text = value instanceof Date ? value.toISOString().slice(0, 10) : String(value)
  return /[",\n;]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

const toCsv = (rows, headers) => [
  headers.join(','),
  ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(',')),
].join('\n')

const writeCsv = async (name, rows, headers = Object.keys(rows[0] ?? {})) => {
  await writeFile(join(outDir, name), `${toCsv(rows, headers)}\n`, 'utf8')
}

const weightedPick = (items, seed) => {
  const total = items.reduce((sum, item) => sum + item.weight, 0)
  let cursor = seed % total
  for (const item of items) {
    cursor -= item.weight
    if (cursor < 0) return item.value
  }
  return items.at(-1).value
}

const months = [
  ['2025-11', 'listopad 2025'],
  ['2025-12', 'prosinec 2025'],
  ['2026-01', 'leden 2026'],
  ['2026-02', 'unor 2026'],
  ['2026-03', 'brezen 2026'],
  ['2026-04', 'duben 2026'],
]

const firstNames = ['Jan', 'Lucie', 'Petr', 'Anna', 'Tomas', 'Katerina', 'Martin', 'Eva', 'Michal', 'Barbora', 'Filip', 'Tereza', 'David', 'Jana', 'Ondrej', 'Nikola', 'Marek', 'Veronika', 'Adam', 'Simona']
const lastNames = ['Novak', 'Svobodova', 'Dvorak', 'Cerna', 'Prochazka', 'Kralova', 'Vesely', 'Horakova', 'Kucera', 'Nemeckova', 'Marek', 'Pokorna', 'Fiala', 'Urbanova', 'Blaha', 'Kolarova', 'Kadlec', 'Ruzickova', 'Sedlak', 'Malikova']
const channels = [
  { value: 'Sreality.cz', weight: 23 },
  { value: 'Bezrealitky', weight: 9 },
  { value: 'Doporuceni', weight: 18 },
  { value: 'Google Ads', weight: 14 },
  { value: 'Facebook kampan', weight: 10 },
  { value: 'LinkedIn', weight: 4 },
  { value: 'Web formular', weight: 13 },
  { value: 'Reality iDNES', weight: 6 },
  { value: 'Cold outreach', weight: 3 },
]
const localities = ['Praha 7 - Holesovice', 'Praha 7 - Letna', 'Praha 8 - Karlin', 'Praha 1 - Nove Mesto', 'Praha 2 - Vinohrady', 'Praha 5 - Smichov', 'Praha 6 - Dejvice', 'Praha 10 - Vrsovice', 'Brno - stred', 'Kladno']
const leadTypes = ['kupujici', 'prodavajici', 'investor', 'pronajimatel', 'najemce']
const statuses = ['novy', 'kontaktovan', 'kvalifikovan', 'prohlidka', 'nabidka', 'vyhrany', 'ztraceny']

const clients = []
const leads = []
let clientCounter = 1
let leadCounter = 1

for (let monthIndex = 0; monthIndex < months.length; monthIndex++) {
  const [month] = months[monthIndex]
  const volume = [38, 31, 44, 52, 61, 58][monthIndex]
  for (let i = 0; i < volume; i++) {
    const day = String(1 + ((i * 7 + monthIndex * 3) % 27)).padStart(2, '0')
    const channel = weightedPick(channels, i * 11 + monthIndex * 17)
    const leadType = leadTypes[(i + monthIndex) % leadTypes.length]
    const locality = localities[(i * 3 + monthIndex) % localities.length]
    const leadId = `L-${month.replace('-', '')}-${String(i + 1).padStart(3, '0')}`
    const isWon = (i + monthIndex) % 7 === 0 || (leadType === 'prodavajici' && i % 6 === 0)
    const status = isWon ? 'vyhrany' : statuses[(i + monthIndex * 2) % statuses.length]
    const budgetBase = leadType === 'najemce' ? 32000 : 7200000 + ((i * 410000 + monthIndex * 690000) % 9800000)
    const clientId = isWon || i % 4 !== 0 ? `C-${String(clientCounter).padStart(4, '0')}` : ''

    leads.push({
      lead_id: leadId,
      created_at: `${month}-${day}`,
      client_id: clientId,
      full_name: `${firstNames[(i + monthIndex) % firstNames.length]} ${lastNames[(i * 2 + monthIndex) % lastNames.length]}`,
      lead_type: leadType,
      source_channel: channel,
      source_detail: channel === 'Doporuceni' ? 'doporučení od existujícího klienta' : channel === 'Google Ads' ? 'kampan: vykup/prodej bytu Praha' : '',
      requested_locality: locality,
      budget_czk: budgetBase,
      status,
      assigned_broker: ['Pepa Novak', 'Marie Vankova', 'Robert Linhart'][i % 3],
      next_step: status === 'novy' ? 'zavolat do 24 hodin' : status === 'prohlidka' ? 'potvrdit termin prohlidky' : status === 'nabidka' ? 'odeslat navrh kupni ceny' : 'sledovat follow-up',
      gdpr_consent: i % 11 === 0 ? 'chybi obnovit' : 'ano',
    })

    if (clientId) {
      clients.push({
        client_id: clientId,
        full_name: leads.at(-1).full_name,
        client_type: leadType,
        acquired_at: `${month}-${day}`,
        acquisition_channel: channel,
        locality_interest: locality,
        lifecycle_stage: isWon ? 'aktivni klient' : status === 'ztraceny' ? 'neaktivni' : 'lead nurturing',
        owner: leads.at(-1).assigned_broker,
        email: `${leads.at(-1).full_name.toLowerCase().replaceAll(' ', '.')}@example.cz`,
        phone: `+420 7${String(10000000 + clientCounter * 7919).slice(0, 8)}`,
      })
      clientCounter += 1
    }
    leadCounter += 1
  }
}

const properties = [
  ['P-1001', 'Byt 2+kk, Ortenovo namesti', 'Praha 7 - Holesovice', 'byt', 54, 2, 8790000, 'v prodeji', 'C-0002', 1988, 2021, 'nova koupelna, kuchynska linka', 'chybi fotodokumentace stoupacek'],
  ['P-1002', 'Byt 3+1, V Haji', 'Praha 7 - Holesovice', 'byt', 78, 3, 11900000, 'rezervace', 'C-0011', 1974, '', '', 'chybi rozsah rekonstrukce jadra'],
  ['P-1003', 'Atelier u Doxu', 'Praha 7 - Holesovice', 'atelier', 42, 1, 6550000, 'v priprave', 'C-0024', 2009, 2023, 'podlahy, klimatizace', 'overit kolaudaci'],
  ['P-1004', 'Cinzak Tusarova', 'Praha 7 - Holesovice', 'cinzovni dum', 612, 12, 84500000, 'akvizice', 'C-0031', 1912, '', '', 'chybi stavebni upravy a PENB'],
  ['P-1005', 'Byt 1+kk, U Pruhonu', 'Praha 7 - Holesovice', 'byt', 31, 1, 5490000, 'prodano', 'C-0040', 1968, 2018, 'elektroinstalace, koupelna', 'dolozit revizi elektro'],
  ['P-1006', 'Loft Karlin', 'Praha 8 - Karlin', 'byt', 96, 3, 18500000, 'v prodeji', 'C-0057', 2016, '', '', 'chybi informace o stavebnich upravach dispozice'],
  ['P-1007', 'Rodinny dum Dejvice', 'Praha 6 - Dejvice', 'dum', 188, 5, 32900000, 'v priprave', 'C-0068', 1936, 2019, 'strecha, okna, plynove topeni', 'doplnit projektovou dokumentaci'],
  ['P-1008', 'Byt Vinohrady Korunni', 'Praha 2 - Vinohrady', 'byt', 63, 2, 12600000, 'rezervace', 'C-0082', 1928, 2020, 'repase parket, koupelna', 'ok'],
  ['P-1009', 'Nebytovy prostor Smichov', 'Praha 5 - Smichov', 'komerce', 141, 4, 16400000, 'akvizice', 'C-0091', 2001, '', '', 'chybi rekonstrukce vzduchotechniky'],
  ['P-1010', 'Byt Vrsovice Krymska', 'Praha 10 - Vrsovice', 'byt', 49, 2, 7690000, 'v prodeji', 'C-0103', 1955, 2015, 'koupelna, kuchyne', 'ok'],
  ['P-1011', 'Pozemek Kladno', 'Kladno', 'pozemek', 1280, 0, 9900000, 'akvizice', 'C-0114', '', '', '', 'chybi uzemne planovaci informace'],
  ['P-1012', 'Byt Brno stred', 'Brno - stred', 'byt', 71, 3, 8750000, 'prodano', 'C-0120', 1981, 2022, 'kompletni rekonstrukce', 'ok'],
].map(([property_id, title, locality, property_type, floor_area_m2, rooms, asking_price_czk, status, owner_client_id, building_year, last_reconstruction_year, reconstruction_scope, data_quality_note]) => ({
  property_id,
  title,
  locality,
  property_type,
  floor_area_m2,
  rooms,
  asking_price_czk,
  status,
  owner_client_id,
  building_year,
  last_reconstruction_year,
  reconstruction_scope,
  data_quality_note,
}))

const deals = [
  ['D-9001', 'P-1005', 'C-0040', 'prodej', '2025-11-18', 5350000, 160500, 'uzavreno'],
  ['D-9002', 'P-1012', 'C-0120', 'prodej', '2025-12-09', 8610000, 258300, 'uzavreno'],
  ['D-9003', 'P-1008', 'C-0082', 'prodej', '2026-02-21', 12350000, 370500, 'rezervacni smlouva'],
  ['D-9004', 'P-1002', 'C-0011', 'prodej', '2026-03-14', 11650000, 349500, 'rezervacni smlouva'],
  ['D-9005', 'P-1001', 'C-0002', 'prodej', '2026-04-28', 8620000, 258600, 'v jednani'],
  ['D-9006', 'P-1006', 'C-0057', 'prodej', '2026-04-12', 18100000, 543000, 'v jednani'],
].map(([deal_id, property_id, buyer_client_id, deal_type, signed_or_expected_at, price_czk, commission_czk, stage]) => ({
  deal_id,
  property_id,
  buyer_client_id,
  deal_type,
  signed_or_expected_at,
  price_czk,
  commission_czk,
  stage,
}))

const monthlyMetrics = months.map(([month, label], index) => ({
  month,
  label,
  leads_total: [38, 31, 44, 52, 61, 58][index],
  qualified_leads: [17, 15, 22, 28, 33, 31][index],
  viewings_done: [12, 10, 17, 21, 25, 24][index],
  properties_listed: [5, 4, 6, 8, 7, 9][index],
  properties_sold: [1, 1, 0, 1, 1, 2][index],
  avg_response_hours: [9.4, 10.1, 7.8, 6.9, 5.8, 5.5][index],
  revenue_commission_czk: [160500, 258300, 0, 370500, 349500, 801600][index],
}))

const viewings = [
  ['V-3001', 'P-1001', 'C-0007', '2026-05-06', '10:00', 'potvrzeno', 'Pepa Novak', 'zajem o financovani hypotekou'],
  ['V-3002', 'P-1002', 'C-0014', '2026-05-06', '13:30', 'navrzeno', 'Pepa Novak', 'cekame potvrzeni manzelky'],
  ['V-3003', 'P-1006', 'C-0059', '2026-05-07', '15:00', 'potvrzeno', 'Marie Vankova', 'investor chce odhad najmu'],
  ['V-3004', 'P-1003', 'C-0029', '2026-05-09', '09:30', 'navrzeno', 'Robert Linhart', 'overit moznost hypoteky na atelier'],
  ['V-3005', 'P-1010', 'C-0107', '2026-05-10', '16:00', 'potvrzeno', 'Pepa Novak', 'druha prohlidka'],
]
.map(([viewing_id, property_id, client_id, date, time, status, broker, note]) => ({ viewing_id, property_id, client_id, date, time, status, broker, note }))

const calendar = [
  ['2026-05-06', '09:00', '09:45', 'interni standup obchodu', 'busy'],
  ['2026-05-06', '10:00', '11:00', 'prohlidka P-1001', 'busy'],
  ['2026-05-06', '11:30', '12:00', 'volno pro rychly call', 'free'],
  ['2026-05-06', '14:30', '15:30', 'volny blok pro prohlidku', 'free'],
  ['2026-05-07', '09:00', '10:30', 'priprava smluv', 'busy'],
  ['2026-05-07', '11:00', '12:00', 'volny blok pro prohlidku', 'free'],
  ['2026-05-07', '16:30', '17:30', 'volny blok pro prohlidku', 'free'],
  ['2026-05-08', '10:00', '11:30', 'porada s vedenim', 'busy'],
  ['2026-05-08', '13:00', '14:00', 'volny blok pro prohlidku', 'free'],
]
.map(([date, start_time, end_time, title, availability]) => ({ date, start_time, end_time, title, availability, owner: 'Pepa Novak' }))

const tasks = [
  ['T-7001', 'Doplnit rekonstrukce u P-1002', 'data quality', 'P-1002', 'Pepa Novak', '2026-05-07', 'vysoka', 'otevreno'],
  ['T-7002', 'Vyžádat PENB a stavebni upravy k P-1004', 'compliance', 'P-1004', 'Pepa Novak', '2026-05-09', 'vysoka', 'otevreno'],
  ['T-7003', 'Připravit report minulého týdne pro vedeni', 'reporting', '', 'Pepa Novak', '2026-05-06', 'stredni', 'otevreno'],
  ['T-7004', 'Poslat navrh terminu prohlidky zajemci C-0014', 'email', 'P-1002', 'Pepa Novak', '2026-05-05', 'stredni', 'otevreno'],
  ['T-7005', 'Zkontrolovat nove nabidky Holesovice', 'monitoring', '', 'Pepa Novak', 'kazde rano 08:00', 'stredni', 'automatizovano'],
]
.map(([task_id, title, category, related_property_id, assignee, due_date, priority, status]) => ({ task_id, title, category, related_property_id, assignee, due_date, priority, status }))

const emails = [
  ['E-5001', 'C-0014', 'P-1002', 'dotaz na prohlidku bytu V Haji', 'Klient chce videt byt tento tyden, preferuje odpoledne po 14:00.', 'inbox', '2026-05-05'],
  ['E-5002', 'C-0059', 'P-1006', 'investicni otazky k loftu', 'Zajemce zada odhad najemneho, fond oprav a stav SVJ.', 'inbox', '2026-05-04'],
  ['E-5003', 'C-0031', 'P-1004', 'chybejici dokumentace k cinzaku', 'Majitel poslal cast dokumentu, stale chybi PENB a seznam stavebnich uprav.', 'inbox', '2026-05-03'],
  ['E-5004', 'C-0107', 'P-1010', 'druha prohlidka', 'Klientka chce prijit s architektem, pta se na moznost bourani pricky.', 'inbox', '2026-05-02'],
]
.map(([email_id, client_id, property_id, subject, summary, folder, received_at]) => ({ email_id, client_id, property_id, subject, summary, folder, received_at }))

const portalListings = [
  ['M-8001', 'Sreality.cz', 'Byt 2+kk Holesovice, Komunardu', 'Praha 7 - Holesovice', 52, 8350000, '2026-05-02', 'https://example.cz/sreality/m-8001', 'podobne P-1001, konkurencni cena'],
  ['M-8002', 'Bezrealitky', 'Byt 3+kk Tusarova', 'Praha 7 - Holesovice', 81, 12600000, '2026-05-02', 'https://example.cz/bezrealitky/m-8002', 'nad cenou nasi rezervace P-1002'],
  ['M-8003', 'Reality iDNES', 'Atelier Holesovice u trznice', 'Praha 7 - Holesovice', 39, 6100000, '2026-05-01', 'https://example.cz/idnes/m-8003', 'srovnatelne s P-1003'],
  ['M-8004', 'Sreality.cz', 'Byt 1+kk U Pruhonu', 'Praha 7 - Holesovice', 29, 5200000, '2026-05-01', 'https://example.cz/sreality/m-8004', 'benchmark pro male byty'],
  ['M-8005', 'Bezrealitky', 'Loft Argentinska', 'Praha 7 - Holesovice', 88, 15900000, '2026-04-30', 'https://example.cz/bezrealitky/m-8005', 'investicni benchmark'],
]
.map(([monitoring_id, portal, title, locality, area_m2, asking_price_czk, detected_at, url, agent_note]) => ({ monitoring_id, portal, title, locality, area_m2, asking_price_czk, detected_at, url, agent_note }))

const documents = [
  ['DOC-2001', 'P-1001', 'list_vlastnictvi', 'LV_P1001.pdf', 'overeno', '2026-04-22'],
  ['DOC-2002', 'P-1002', 'rekonstrukce', 'rekonstrukce_P1002.docx', 'chybi obsah', '2026-04-27'],
  ['DOC-2003', 'P-1004', 'PENB', 'PENB_P1004.pdf', 'chybi', ''],
  ['DOC-2004', 'P-1006', 'SVJ_zapis', 'SVJ_P1006.pdf', 'overeno', '2026-04-12'],
  ['DOC-2005', 'P-1011', 'uzemni_plan', 'UPI_P1011.pdf', 'chybi', ''],
]
.map(([document_id, property_id, document_type, file_name, status, received_at]) => ({ document_id, property_id, document_type, file_name, status, received_at }))

const weeklyReport = [
  { metric: 'nove_leady', value: 14, period: '2026-04-27 az 2026-05-03', note: 'nejvice Sreality a doporuceni' },
  { metric: 'kvalifikovane_leady', value: 8, period: '2026-04-27 az 2026-05-03', note: '3 investori, 2 prodavajici, 3 kupujici' },
  { metric: 'prohlidky', value: 6, period: '2026-04-27 az 2026-05-03', note: '2 druhe prohlidky' },
  { metric: 'nove_akvizice', value: 2, period: '2026-04-27 az 2026-05-03', note: 'cinzak Tusarova, pozemek Kladno' },
  { metric: 'rizika', value: 4, period: '2026-04-27 az 2026-05-03', note: 'chybejici rekonstrukce/PENB/UPI' },
]

const dataDictionary = [
  { file: 'clients.csv', grain: '1 radek = klient nebo kontakt v CRM', used_for: 'odpovedi na nove klienty, segmentace, zdroj akvizice, vlastnik vztahu' },
  { file: 'leads.csv', grain: '1 radek = obchodni lead', used_for: 'funnel, zdroje leadu, kvalifikace, dalsi kroky' },
  { file: 'monthly_metrics.csv', grain: '1 radek = mesicni souhrn', used_for: 'graf poctu leadu a prodanych nemovitosti za 6 mesicu' },
  { file: 'properties.csv', grain: '1 radek = nemovitost v portfoliu nebo akvizici', used_for: 'portfolio, chybejici rekonstrukce, stav prodeje, oceneni' },
  { file: 'deals.csv', grain: '1 radek = obchodni pripad', used_for: 'trzby, provize, prodane nemovitosti, pipeline' },
  { file: 'viewings.csv', grain: '1 radek = prohlidka', used_for: 'terminy, follow-up, vytizenost obchodniku' },
  { file: 'calendar_availability.csv', grain: '1 radek = kalendarovy blok Pepy', used_for: 'doporuceni terminu prohlidky a navrh emailu' },
  { file: 'tasks.csv', grain: '1 radek = backoffice ukol', used_for: 'workflow, prioritizace, sledovani posunu' },
  { file: 'emails.csv', grain: '1 radek = shrnuti e-mailu', used_for: 'navrhy odpovedi, extrakce pozadavku, follow-up' },
  { file: 'portal_monitoring.csv', grain: '1 radek = nova nabidka z realitniho serveru', used_for: 'ranni monitoring Holesovic a konkurencni benchmark' },
  { file: 'documents.csv', grain: '1 radek = dokument k nemovitosti', used_for: 'kontrola chybejicich podkladu a compliance' },
  { file: 'weekly_report_inputs.csv', grain: '1 radek = metrika pro tydenni report', used_for: 'kratky report pro vedeni a 3 slidy' },
]

const readme = `# Demo data pro Back Office Operations Agenta

Tato slozka simuluje data realitni firmy, ktera spravuje, prodava a akviruje nemovitosti. Data jsou umele, ale navrzena tak, aby odpovidala realnym agendam back office managera.

## Co v takove firme typicky vznika za data

- CRM data: klienti, leady, zdroje akvizice, stav komunikace, vlastnik vztahu.
- Portfolio nemovitosti: lokalita, dispozice, plocha, cena, stav prodeje, vlastnik, technicke parametry.
- Transakcni data: rezervace, kupni ceny, provize, faze obchodu, prodane nemovitosti.
- Operativni data: prohlidky, kalendar, ukoly, follow-upy, interni poznamky.
- Dokumentova evidence: listy vlastnictvi, PENB, SVJ zapisy, rekonstrukce, smlouvy, chybejici podklady.
- Marketing a monitoring trhu: nabidky z realitnich serveru, konkurencni ceny, zdroje leadu, kampane.
- Reporting: tydenni vysledky, funnel, rychlost reakce, rizika, otevrene blokery.

## Jak data pouziva Pepa

Pepa typicky nesedi nad jednou databazi. Sklada odpoved z CRM, e-mailu, kalendare, sdilenych dokumentu, exportu z realitnich portalu a internich tabulek. Proto dataset obsahuje vice propojenych souboru pres identifikatory jako \`client_id\`, \`property_id\` a \`deal_id\`.

## Ukazkove dotazy pokryte daty

- "Jake nove klienty mame za 1. kvartal? Odkud prisli? Znazorni to graficky."
  - Pouzij \`clients.csv\` a \`leads.csv\`, filtr \`acquired_at\` mezi 2026-01-01 a 2026-03-31, agregace podle \`acquisition_channel\`.
- "Vytvor graf vyvoje poctu leadu a prodanych nemovitosti za poslednich 6 mesicu."
  - Pouzij \`monthly_metrics.csv\`, sloupce \`leads_total\` a \`properties_sold\`.
- "Napis e-mail pro zajemce o moji nemovitost a doporuc mu termin prohlidky na zaklade me dostupnosti."
  - Pouzij \`emails.csv\`, \`viewings.csv\`, \`calendar_availability.csv\`, \`properties.csv\`.
- "Najdi nemovitosti, u kterych chybi data o rekonstrukci a stavebnich upravach."
  - Pouzij \`properties.csv\`, filtr prazdny \`last_reconstruction_year\` nebo \`reconstruction_scope\`, dopln \`documents.csv\`.
- "Shrn vysledky minuleho tydne do reportu pro vedeni a priprav 3 slidy."
  - Pouzij \`weekly_report_inputs.csv\`, \`monthly_metrics.csv\`, \`tasks.csv\`.
- "Sleduj realitni servery a kazde rano informuj o novych nabidkach v Praze Holesovicich."
  - Pouzij \`portal_monitoring.csv\`, filtr lokalita \`Praha 7 - Holesovice\`, \`detected_at\` posledni den.

## Doporučene demo flow

1. Nejdriv ukazat, ze agent umi odpovidat nad tabulkami: Q1 klienti a zdroje.
2. Pak ukazat analytiku: 6mesicni trend leadu/prodeju.
3. Pak workflow: navrh e-mailu podle kalendare.
4. Pak data quality: chybejici rekonstrukce a dokumenty.
5. Nakonec automatizace: ranni monitoring portalu.
`

await mkdir(outDir, { recursive: true })
await writeCsv('clients.csv', clients)
await writeCsv('leads.csv', leads)
await writeCsv('properties.csv', properties)
await writeCsv('deals.csv', deals)
await writeCsv('monthly_metrics.csv', monthlyMetrics)
await writeCsv('viewings.csv', viewings)
await writeCsv('calendar_availability.csv', calendar)
await writeCsv('tasks.csv', tasks)
await writeCsv('emails.csv', emails)
await writeCsv('portal_monitoring.csv', portalListings)
await writeCsv('documents.csv', documents)
await writeCsv('weekly_report_inputs.csv', weeklyReport)
await writeCsv('data_dictionary.csv', dataDictionary)
await writeFile(join(outDir, 'README.md'), readme, 'utf8')

await writeFile(
  join(outDir, 'sample_agent_outputs.json'),
  `${JSON.stringify({
    q1_new_clients_summary: {
      period: '2026-01-01 az 2026-03-31',
      source_files: ['clients.csv', 'leads.csv'],
      expected_output: 'pocet novych klientu podle acquisition_channel + doporuceni grafu',
    },
    missing_reconstruction_data_rule: {
      source_files: ['properties.csv', 'documents.csv'],
      rule: 'last_reconstruction_year nebo reconstruction_scope je prazdne, pripadne document status je chybi/chybi obsah',
    },
    morning_monitoring_rule: {
      source_files: ['portal_monitoring.csv'],
      schedule: 'kazdy den 08:00',
      filter: 'locality = Praha 7 - Holesovice',
    },
  }, null, 2)}\n`,
  'utf8',
)

console.log(`Generated ${outDir}`)
console.log(`clients=${clients.length} leads=${leads.length} properties=${properties.length}`)

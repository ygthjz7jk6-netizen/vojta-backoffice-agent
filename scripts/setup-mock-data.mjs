#!/usr/bin/env node
/**
 * setup-mock-data.mjs
 * Vytvoří kompletní mock data na Google Drive a Google Calendar.
 * Spuštění: node scripts/setup-mock-data.mjs
 */

import { google } from 'googleapis'
import { createServer } from 'http'
import { parse } from 'url'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { createInterface } from 'readline'

const __dirname = dirname(fileURLToPath(import.meta.url))

// ── ENV ───────────────────────────────────────────────────────────────────────
const envContent = readFileSync(join(__dirname, '../.env.local'), 'utf8')
for (const line of envContent.split('\n')) {
  const t = line.trim()
  if (!t || t.startsWith('#')) continue
  const idx = t.indexOf('=')
  if (idx === -1) continue
  const k = t.slice(0, idx).trim()
  const v = t.slice(idx + 1).trim()
  if (!process.env[k]) process.env[k] = v
}

// ── OAUTH ─────────────────────────────────────────────────────────────────────
const SCOPES = [
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/documents',
  'https://www.googleapis.com/auth/calendar',
]
const TOKEN_PATH = join(__dirname, '.mock-data-token.json')

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  'http://localhost:3000/api/auth/callback/google'
)

async function authenticate() {
  if (existsSync(TOKEN_PATH)) {
    const token = JSON.parse(readFileSync(TOKEN_PATH, 'utf8'))
    oauth2Client.setCredentials(token)
    if (token.expiry_date && Date.now() > token.expiry_date - 60000) {
      const { credentials } = await oauth2Client.refreshAccessToken()
      oauth2Client.setCredentials(credentials)
      writeFileSync(TOKEN_PATH, JSON.stringify(credentials))
    }
    console.log('✓ Token načten z cache')
    return
  }

  // Použijeme speciální redirect URI který funguje bez local serveru
  const oob = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    'urn:ietf:wg:oauth:2.0:oob'
  )
  const authUrl = oob.generateAuthUrl({ access_type: 'offline', scope: SCOPES, prompt: 'consent' })
  console.log('\n📋 Otevři v prohlížeči:\n\n' + authUrl)
  console.log('\n📋 Po schválení zkopíruj kód ze stránky a vlož sem:\n')

  const rl = createInterface({ input: process.stdin, output: process.stdout })
  const code = await new Promise(resolve => rl.question('Kód: ', ans => { rl.close(); resolve(ans.trim()) }))

  const { tokens } = await oob.getToken(code)
  oauth2Client.setCredentials(tokens)
  writeFileSync(TOKEN_PATH, JSON.stringify(tokens))
  console.log('✓ Token uložen')
}

// ── API ───────────────────────────────────────────────────────────────────────
const driveApi = google.drive({ version: 'v3', auth: oauth2Client })
const sheetsApi = google.sheets({ version: 'v4', auth: oauth2Client })
const docsApi = google.docs({ version: 'v1', auth: oauth2Client })
const calApi = google.calendar({ version: 'v3', auth: oauth2Client })

// ── HELPERS ───────────────────────────────────────────────────────────────────
const sleep = ms => new Promise(r => setTimeout(r, ms))

async function retry(fn, n = 4) {
  for (let i = 0; i < n; i++) {
    try { return await fn() } catch (e) {
      if (i === n - 1) throw e
      const wait = (e.code === 429 || e.status === 429) ? 3000 : 500
      await sleep(wait * (i + 1))
    }
  }
}

async function mkFolder(name, parentId) {
  const r = await retry(() => driveApi.files.create({
    requestBody: { name, mimeType: 'application/vnd.google-apps.folder', parents: parentId ? [parentId] : [] },
    fields: 'id',
  }))
  return r.data.id
}

async function mkSheet(name, parentId) {
  const r = await retry(() => driveApi.files.create({
    requestBody: { name, mimeType: 'application/vnd.google-apps.spreadsheet', parents: [parentId] },
    fields: 'id',
  }))
  return r.data.id
}

async function mkDoc(name, parentId) {
  const r = await retry(() => driveApi.files.create({
    requestBody: { name, mimeType: 'application/vnd.google-apps.document', parents: [parentId] },
    fields: 'id',
  }))
  return r.data.id
}

async function uploadText(name, content, parentId) {
  await retry(() => driveApi.files.create({
    requestBody: { name, mimeType: 'text/plain', parents: [parentId] },
    media: { mimeType: 'text/plain', body: content },
    fields: 'id',
  }))
}

async function uploadCsv(name, content, parentId) {
  await retry(() => driveApi.files.create({
    requestBody: { name, mimeType: 'text/csv', parents: [parentId] },
    media: { mimeType: 'text/csv', body: content },
    fields: 'id',
  }))
}

async function writeDoc(docId, text) {
  await retry(() => docsApi.documents.batchUpdate({
    documentId: docId,
    requestBody: { requests: [{ insertText: { location: { index: 1 }, text } }] },
  }))
}

async function populateSheet(spreadsheetId, tabs) {
  // tabs: [{ title, rows: [[...],[...]] }]
  const renameAndAdd = []
  renameAndAdd.push({ updateSheetProperties: { properties: { sheetId: 0, title: tabs[0].title }, fields: 'title' } })
  for (let i = 1; i < tabs.length; i++) {
    renameAndAdd.push({ addSheet: { properties: { title: tabs[i].title, sheetId: i } } })
  }
  await retry(() => sheetsApi.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests: renameAndAdd } }))
  await sleep(300)
  const data = tabs.filter(t => t.rows.length).map(t => ({ range: `${t.title}!A1`, values: t.rows }))
  if (data.length) {
    await retry(() => sheetsApi.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: { valueInputOption: 'USER_ENTERED', data },
    }))
  }
}

// ── RNG ───────────────────────────────────────────────────────────────────────
class Rng {
  constructor(seed = 42) { this.s = seed >>> 0 }
  next() { this.s = (Math.imul(1664525, this.s) + 1013904223) >>> 0; return this.s / 4294967296 }
  int(a, b) { return Math.floor(this.next() * (b - a + 1)) + a }
  pick(arr) { return arr[this.int(0, arr.length - 1)] }
  bool(p = 0.5) { return this.next() < p }
  shuffle(arr) { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = this.int(0, i);[a[i], a[j]] = [a[j], a[i]] } return a }
}

// ── MASTER DATA ───────────────────────────────────────────────────────────────
const MAKLERI = [
  { id: 'M01', jmeno: 'Jana Nováková',  email: 'j.novakova@realitka-premium.cz',  phone: '+420 602 111 001', oblast: 'Praha 2, Praha 3' },
  { id: 'M02', jmeno: 'Tomáš Kovář',   email: 't.kovar@realitka-premium.cz',     phone: '+420 602 111 002', oblast: 'Praha 5, Praha 6' },
  { id: 'M03', jmeno: 'Martin Svoboda', email: 'm.svoboda@realitka-premium.cz',  phone: '+420 602 111 003', oblast: 'Praha 7, Praha 8' },
  { id: 'M04', jmeno: 'Lucie Marková', email: 'l.markova@realitka-premium.cz',   phone: '+420 602 111 004', oblast: 'Praha 1, Praha 4, Praha 9' },
  { id: 'M05', jmeno: 'Ondřej Beneš',  email: 'o.benes@realitka-premium.cz',     phone: '+420 602 111 005', oblast: 'Praha 10, Brno' },
]

const MENA_M = ['Martin','Tomáš','Petr','Jan','Pavel','Jiří','Michal','Lukáš','Ondřej','David','Karel','Radek','Marek','Jakub','Filip','Zdeněk','Miroslav','Roman','Jaroslav','Josef','František','Václav','Ladislav','Igor','Libor','Leoš','Radomír','Stanislav','Antonín','Vladimír']
const MENA_F = ['Jana','Eva','Marie','Lucie','Petra','Kateřina','Tereza','Lenka','Martina','Monika','Hana','Veronika','Alena','Zuzana','Barbora','Věra','Ivana','Simona','Markéta','Dagmar','Irena','Renata','Šárka','Jitka','Blanka','Naďa','Vladimíra','Libuše','Marta','Radka']
const PRIJMENI_M = ['Novák','Svoboda','Novotný','Dvořák','Černý','Procházka','Kučera','Veselý','Blažek','Horák','Kopecký','Havlíček','Pospíšil','Beneš','Fiala','Sedláček','Kratochvíl','Vlček','Štěpánek','Pokorný','Čermák','Vomáček','Malík','Horáček','Mrázek','Kořínek','Šimánek','Tůma','Ryba','Liška']
const PRIJMENI_F = ['Nováková','Svobodová','Novotná','Dvořáková','Černá','Procházková','Kučerová','Veselá','Blažková','Horáková','Kopecká','Havlíčková','Pospíšilová','Benešová','Fialová','Sedláčková','Kratochvílová','Vlčková','Štěpánková','Pokorná','Čermáková','Vomáčková','Malíková','Horáčková','Mrázková','Kořínková','Šimánková','Tůmová','Rybová','Lišková']
const TYPY = ['1+kk','1+kk','2+kk','2+kk','2+kk','2+1','2+1','3+kk','3+kk','3+1','3+1','4+kk','4+1']

const DISTRICTS = [
  { d:'Praha 1', streets:['Pařížská','Revoluční','Dlouhá','Celetná','Zlatnická','Melantrichova'],          makler:'M04', rMin:22000,rMax:55000, sMin:6500000,sMax:18000000, n:5 },
  { d:'Praha 2', streets:['Mánesova','Blanická','Polská','Slovenská','Korunní','Máchova','Belgická','Náměstí Míru'], makler:'M01', rMin:16000,rMax:35000, sMin:5500000,sMax:14000000, n:13 },
  { d:'Praha 3', streets:['Seifertova','Žižkovo nám.','Chelčického','Koněvova','Lupáčova','Víta Nejedlého','Chlumova','Kubelíkova'], makler:'M01', rMin:13000,rMax:28000, sMin:4500000,sMax:10000000, n:16 },
  { d:'Praha 4', streets:['Táborská','Budějovická','Nuselská','Na Pankráci','5. května','Hvězdova'],        makler:'M04', rMin:14000,rMax:30000, sMin:4800000,sMax:11000000, n:8 },
  { d:'Praha 5', streets:['Plzeňská','Nádražní','Štefánikova','Stroupežnického','Radlická','Lidická','Arbesovo nám.'], makler:'M02', rMin:14000,rMax:32000, sMin:5000000,sMax:12000000, n:11 },
  { d:'Praha 6', streets:['Dejvická','Čs. armády','Evropská','Thákurova','Wuchterlova','Verdunská'],        makler:'M02', rMin:15000,rMax:36000, sMin:5500000,sMax:13500000, n:9 },
  { d:'Praha 7', streets:['Letohradská','Milady Horákové','Dukelských hrdinů','Komunardů','Dělnická','Tusarova','Ortenovo nám.'], makler:'M03', rMin:14000,rMax:30000, sMin:5000000,sMax:12500000, n:14 },
  { d:'Praha 8', streets:['Křižíkova','Sokolovská','Thámova','Prvního pluku','Invalidovna','Rokytova','Palmovka'], makler:'M03', rMin:14000,rMax:32000, sMin:5000000,sMax:12000000, n:13 },
  { d:'Praha 9', streets:['Prosecká','Vysočanská','Freyova','Satalická','Poděbradská'],                    makler:'M04', rMin:12000,rMax:24000, sMin:4000000,sMax:8500000, n:5 },
  { d:'Praha 10',streets:['Vršovická','Moskevská','Kodaňská','Bulharská','Minská','Záhřebská'],             makler:'M05', rMin:13000,rMax:28000, sMin:4500000,sMax:11000000, n:10 },
  { d:'Brno',    streets:['Veveří','Štefánikova','Joštova','Kounicova','Hybešova','Česká','Úvoz'],          makler:'M05', rMin:11000,rMax:24000, sMin:3500000,sMax:9000000, n:10 },
]
// Total regular: 5+13+16+8+11+9+14+13+5+10+10 = 114  + 6 komerční = 120

// Speciální property overrides (demo scénáře a neplatiči)
const SPECIAL = {
  'NEMO_012': { adresa:'Korunní 18', district:'Praha 2', typ:'2+kk', typTrans:'Pronájem', stav:'Pronajato', cenaRent:18500, plocha:52, rokVyst:1938, makler:'M01', vlastnik:'Ing. Robert Mašek', vlastnikEmail:'r.masek@email.cz', nájemník:'Zdeněk Blažek', vs:'220012', poznamka:'NEPLATIČ - dluh 37 000 Kč (2 měsíce), nekomunikuje' },
  'NEMO_022': { adresa:'Lupáčova 9', district:'Praha 3', typ:'2+1', typTrans:'Pronájem', stav:'Pronajato', cenaRent:15000, plocha:58, rokVyst:1962, makler:'M01', vlastnik:'Dagmar Horáčková', vlastnikEmail:'d.horackova@email.cz', nájemník:'Irena Kopecká', vs:'240022', poznamka:'Platba o 500 Kč méně v dubnu i květnu' },
  'NEMO_034': { adresa:'Chelčického 8', district:'Praha 3', typ:'2+kk', typTrans:'Prodej', stav:'Rezervace', cenaProd:6200000, plocha:54, rokVyst:2005, makler:'M01', vlastnik:'Stanislav Vlček', vlastnikEmail:'s.vlcek@email.cz', stavProdeje:'Rezervace', katCisloRizeni:'', dokumentyOk:'OK', poznamka:'DEMO: rezervační poplatek 150 000 Kč NEZAPLACEN - deadline 20.4.2026' },
  'NEMO_048': { adresa:'Stroupežnického 28', district:'Praha 5', typ:'2+1', typTrans:'Prodej', stav:'Na katastru', cenaProd:7400000, plocha:65, rokVyst:1975, makler:'M02', vlastnik:'Eva Mrázková', vlastnikEmail:'e.mrazkova@email.cz', stavProdeje:'Na katastru', katCisloRizeni:'V-1234/2026', dokumentyOk:'OK', poznamka:'DEMO: vklad povolen 29.4.2026, čeká na pokyn k uvolnění úschovy' },
  'NEMO_066': { adresa:'Tusarova 14', district:'Praha 7', typ:'1+kk', typTrans:'Pronájem', stav:'Pronajato', cenaRent:14000, plocha:38, rokVyst:1990, makler:'M03', vlastnik:'Bc. Miroslav Kořínek', vlastnikEmail:'m.korinek@email.cz', nájemník:'Pavel Vomáček', vs:'220066', poznamka:'Neplatič - dluh 14 000 Kč (1 měsíc), slíbil do 5.5.' },
  'NEMO_073': { adresa:'Dělnická 31', district:'Praha 7', typ:'3+kk', typTrans:'Pronájem', stav:'Pronajato', cenaRent:22000, plocha:76, rokVyst:2012, makler:'M03', vlastnik:'MUDr. Jana Procházková', vlastnikEmail:'j.prochazkova@email.cz', nájemník:'Tereza Malíková', vs:'250073', poznamka:'NEPLATIČ - dluh 22 000 Kč, nekontaktní, iniciovat výzvu' },
  'NEMO_083': { adresa:'Křižíkova 22', district:'Praha 8', typ:'3+1', typTrans:'Prodej', stav:'Kupní smlouva', cenaProd:9800000, plocha:84, rokVyst:1996, makler:'M03', vlastnik:'Radovan Šimánek', vlastnikEmail:'r.simanek@email.cz', stavProdeje:'Kupní smlouva', katCisloRizeni:'', dokumentyOk:'Chybí souhlas banky s hypotékou', poznamka:'DEMO: blokováno - chybí potvrzení hypotéky od kupujícího Jakuba Dvořáka' },
  'NEMO_107': { adresa:'Hybešova 15', district:'Brno', typ:'2+kk', typTrans:'Pronájem', stav:'Pronajato', cenaRent:13500, plocha:48, rokVyst:1988, makler:'M05', vlastnik:'Vlastimil Ryba', vlastnikEmail:'v.ryba@email.cz', nájemník:'Miroslav Štěpánek', vs:'240107', poznamka:'Neplatič - platba chybí, slíbil do 7.5., opakovaný problém' },
}

function generateName(rng, gender) {
  if (gender === 'M') return `${rng.pick(MENA_M)} ${rng.pick(PRIJMENI_M)}`
  return `${rng.pick(MENA_F)} ${rng.pick(PRIJMENI_F)}`
}

function round1k(n) { return Math.round(n / 1000) * 1000 }

// ── GENERATE PROPERTIES ───────────────────────────────────────────────────────
function buildProperties() {
  const rng = new Rng(1001)
  const rows = []
  let id = 0

  // Stav distribution for non-special properties
  // After special slots: we need ~65 pronajato, ~10 volné, ~8 prodej-pipeline, ~22 prodáno + 6 komerční
  const statusPool = [
    ...Array(62).fill('Pronajato'),
    ...Array(10).fill('Volné'),
    ...Array(3).fill('V inzerci'),
    ...Array(2).fill('Rezervace'),
    ...Array(2).fill('Kupní smlouva'),
    ...Array(2).fill('Na katastru'),
    ...Array(18).fill('Prodáno'),
    ...Array(3).fill('V přípravě'),
  ]
  const shuffled = new Rng(9999).shuffle(statusPool)
  let statusIdx = 0

  const headers = ['ID','Adresa','District','Typ','Typ_Transakce','Stav','Stav_Prodeje','Cena_Najem','Cena_Prodej','Plocha_m2','Rok_vystavby','Katastr_Cislo_Rizeni','Dokumenty_OK','Zodpovedny_Makler','Vlastnik','Vlastnik_Email','Poznamka']
  rows.push(headers)

  for (const dc of DISTRICTS) {
    for (let i = 0; i < dc.n; i++) {
      id++
      const nemoId = `NEMO_${String(id).padStart(3,'0')}`
      if (SPECIAL[nemoId]) {
        const s = SPECIAL[nemoId]
        rows.push([
          nemoId, s.adresa, s.district, s.typ,
          s.typTrans, s.stav, s.stavProdeje || '',
          s.cenaRent || '', s.cenaProd || '',
          s.plocha, s.rokVyst,
          s.katCisloRizeni || '', s.dokumentyOk || 'OK',
          s.makler, s.vlastnik, s.vlastnikEmail, s.poznamka || '',
        ])
        continue
      }
      const street = rng.pick(dc.streets)
      const num = rng.int(1, 140)
      const adresa = `${street} ${num}`
      const typ = rng.pick(TYPY)
      const plocha = typ === '1+kk' ? rng.int(28,42) : typ === '2+kk' ? rng.int(45,62) : typ === '2+1' ? rng.int(52,68) : typ === '3+kk' ? rng.int(65,82) : typ === '3+1' ? rng.int(72,92) : rng.int(88,120)
      const rokVyst = rng.int(1935, 2022)
      const gender = rng.bool() ? 'M' : 'F'
      const vlastnik = generateName(rng, gender)
      const vlastnikEmail = vlastnik.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/\s+/g,'.').replace(/[^a-z.]/g,'') + '@email.cz'
      const makler = dc.makler
      const stav = shuffled[statusIdx++ % shuffled.length]
      const isRent = ['Pronajato','Volné','V přípravě'].includes(stav)
      const isSale = !isRent
      const typTrans = isRent ? 'Pronájem' : 'Prodej'
      const cenaRent = isRent ? round1k(rng.int(dc.rMin, dc.rMax)) : ''
      const cenaProd = isSale ? round1k(rng.int(dc.sMin, dc.sMax)) : ''
      const stavProdeje = isSale ? stav : ''
      const stavFinal = isSale ? (stav === 'Prodáno' ? 'Prodáno' : 'Aktivní') : stav
      const kat = (stav === 'Na katastru') ? `V-${1100 + id}/2026` : ''
      const dok = (stav === 'V přípravě' && rng.bool(0.4)) ? 'Chybí PENB' : 'OK'
      rows.push([nemoId, adresa, dc.d, typ, typTrans, stavFinal, stavProdeje, cenaRent, cenaProd, plocha, rokVyst, kat, dok, makler, vlastnik, vlastnikEmail, ''])
    }
  }

  // Komerční (NEMO_115–NEMO_120)
  const komerční = [
    ['NEMO_115','Sokolovská 100','Praha 8','Kancelář','Pronájem','Pronajato','',45000,'',180,2008,'','OK','M03','Ing. Radek Procházka','r.prochazka@biz.cz','Firemní nájemník - ABC Solutions s.r.o.'],
    ['NEMO_116','Radlická 180','Praha 5','Kancelář','Pronájem','Pronajato','',38000,'',145,2014,'','OK','M02','Pavel Kratochvíl','p.kratochvil@biz.cz','Nájemník: ProMedia s.r.o., smlouva do 12/2027'],
    ['NEMO_117','Thámova 11','Praha 8','Kancelář','Pronájem','Volné','',52000,'',210,2018,'','OK','M03','Arch. Věra Sedláčková','v.sedlackova@email.cz','Uvolnilo se 1.4., aktivně hledáme nájemníka'],
    ['NEMO_118','Ke Světlu 8','Praha 9','Rodinný dům','Prodej','Prodáno','Prodáno','',12500000,220,2001,'','OK','M04','Josef Tůma','j.tuma@email.cz','Prodáno 3/2025, financováno hypotékou'],
    ['NEMO_119','Štefánikova 80','Brno','Rodinný dům','Pronájem','Pronajato','',28000,'',165,1988,'','OK','M05','Mgr. Leoš Vlček','l.vlcek@email.cz','Rodinný dům, nájemník od 2021, spolehlivý'],
    ['NEMO_120','Na Příkopě 15','Praha 1','Komerční prostor','Pronájem','Pronajato','',85000,'',320,1992,'','OK','M04','Investiční fond CPTA a.s.','info@cpta.cz','Nájemník: Zlatnictví Aurum, smlouva 10 let'],
  ]
  rows.push(...komerční)
  return rows
}

// ── GENERATE CLIENTS ──────────────────────────────────────────────────────────
function buildKlienti() {
  const rng = new Rng(2002)
  const rows = [['ID_Klient','Jmeno','Typ_Klienta','RC_ICO','Email','Telefon','Poznamka','Aktivni_Nemo_ID','Datum_Zacatku','Zdroj']]

  // Active renters (linked to properties)
  const activeTenants = [
    ['K001','Zdeněk Blažek','Nájemník','780512/1234','z.blazek@email.cz','+420 603 001 001','NEPLATIČ - 2 měsíce dluh 37 000 Kč','NEMO_012','2022-03-01','Doporučení'],
    ['K002','Irena Kopecká','Nájemník','835620/5678','i.kopecka@email.cz','+420 603 001 002','Platba o 500 Kč méně (duben+květen)','NEMO_022','2024-06-01','Web'],
    ['K003','Petra Nováková','Kupující','905518/9012','p.novakova@email.cz','+420 603 001 003','DEMO: rezervační poplatek 150 000 Kč nezaplacen','NEMO_034','2026-04-15','Sreality'],
    ['K004','Radek Horáček','Kupující','781203/3456','r.horacek@email.cz','+420 603 001 004','Kupující Smíchov, peníze v úschovně u adv. Mareše','NEMO_048','2026-02-10','Doporučení'],
    ['K005','Eva Mrázková','Prodávající','625409/7890','e.mrazkova@email.cz','+420 603 001 005','Prodávající Smíchov, čeká na uvolnění úschovy','NEMO_048','',''],
    ['K006','Pavel Vomáček','Nájemník','830722/2345','p.vomacek@email.cz','+420 603 001 006','Neplatič - dluh 14 000 Kč, slíbil do 5.5.','NEMO_066','2022-09-01','Inzerát'],
    ['K007','Tereza Malíková','Nájemník','940315/6789','t.malikova@email.cz','+420 603 001 007','NEPLATIČ nekontaktní - dluh 22 000 Kč','NEMO_073','2025-01-01','Facebook'],
    ['K008','Jakub Dvořák','Kupující','870614/0123','j.dvorak@email.cz','+420 603 001 008','Kupující Karlín - čeká na souhlas banky s hypotékou','NEMO_083','2026-03-20','Sreality'],
    ['K009','Miroslav Štěpánek','Nájemník','710830/4567','m.stepanek@email.cz','+420 603 001 009','Neplatič Brno - slíbil zaplatit 7.5., opakovaný problém','NEMO_107','2024-04-01','Doporučení'],
  ]
  rows.push(...activeTenants)

  // Topklienti (vlastníci více nemovitostí)
  rows.push(['K010','Ing. Robert Mašek','Vlastník portfolio','560318/8901','r.masek@email.cz','+420 602 500 010','Vlastník 4 bytů (P2, P3, P7, P8) - VIP klient od 2020','','',''])
  rows.push(['K011','MUDr. Jana Procházková','Vlastník portfolio','635112/2345','j.prochazkova@email.cz','+420 602 500 011','Vlastník 3 bytů Praha 7 - spolehlivá, platí předem','','',''])
  rows.push(['K012','Investiční fond CPTA a.s.','Vlastník portfolio','28456123','info@cpta.cz','+420 234 567 890','IČO: 28456123, správa 2 komerčních prostor','','',''])

  // Generate 268 more clients
  const typy = ['Nájemník','Nájemník','Nájemník','Kupující','Kupující','Prodávající','Historický','Historický','Historický']
  const zdroje = ['Sreality','Web','Doporučení','Inzerát','Facebook','Doporučení','Doporučení']
  for (let i = 13; i <= 280; i++) {
    const gender = rng.bool() ? 'M' : 'F'
    const jmeno = generateName(rng, gender)
    const typ = rng.pick(typy)
    const yd = rng.int(50,99); const md = String(rng.int(1,12)).padStart(2,'0'); const dd = String(rng.int(1,28)).padStart(2,'0')
    const rc = `${yd}${gender==='F'?String(parseInt(md)+50).padStart(2,'0'):md}${dd}/${rng.int(1000,9999)}`
    const em = jmeno.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').split(' ').join('.') + rng.int(1,99) + '@email.cz'
    const tel = `+420 6${rng.int(10,99)} ${rng.int(100,999)} ${rng.int(100,999)}`
    const rok = rng.int(2020,2025); const mesic = String(rng.int(1,12)).padStart(2,'0')
    const datum = typ === 'Historický' ? `${rok}-${mesic}-01` : (rng.bool(0.7) ? `${rng.int(2022,2026)}-${mesic}-01` : '')
    rows.push([`K${String(i).padStart(3,'0')}`,jmeno,typ,rc,em,tel,'','',(datum||''),rng.pick(zdroje)])
  }
  return rows
}

// ── SMLOUVY ───────────────────────────────────────────────────────────────────
function buildSmlouvy() {
  const rng = new Rng(3003)
  const rows = [['ID_Smlouva','ID_Nemo','Adresa','Najemnik','Email_Najemnika','Var_Symbol','Predpis_Najem','Platnost_Od','Platnost_Do','Status_Platby_Kvetyn_2026','Status_Platby_Duben_2026','Poznamka']]

  const activeCases = [
    ['SML_0012','NEMO_012','Korunní 18, Praha 2','Zdeněk Blažek','z.blazek@email.cz','220012',18500,'2022-03-01','2027-02-28','Nezaplaceno','Nezaplaceno','Dluh 37 000 Kč - 2 měsíce, vymáhání'],
    ['SML_0022','NEMO_022','Lupáčova 9, Praha 3','Irena Kopecká','i.kopecka@email.cz','240022',15000,'2024-06-01','2025-05-31','Částečně (14500)','Částečně (14500)','Pravidelně posílá o 500 Kč méně'],
    ['SML_0066','NEMO_066','Tusarova 14, Praha 7','Pavel Vomáček','p.vomacek@email.cz','220066',14000,'2022-09-01','2026-08-31','Nezaplaceno','Zaplaceno','Dluh 14 000 Kč - slíbil 5.5.'],
    ['SML_0073','NEMO_073','Dělnická 31, Praha 7','Tereza Malíková','t.malikova@email.cz','250073',22000,'2025-01-01','2026-12-31','Nezaplaceno','Nezaplaceno','Nekontaktní - 2 měsíce dluh 44 000 Kč'],
    ['SML_0107','NEMO_107','Hybešova 15, Brno','Miroslav Štěpánek','m.stepanek@email.cz','240107',13500,'2024-04-01','2026-03-31','Nezaplaceno','Zaplaceno','Slíbil zaplatit 7.5., opakovaný problém'],
  ]
  rows.push(...activeCases)

  // Generate remaining ~70 active contracts
  const rng2 = new Rng(3333)
  let smlIdx = 23
  const propertyPool = []
  for (let n = 1; n <= 114; n++) {
    const id = `NEMO_${String(n).padStart(3,'0')}`
    if (!SPECIAL[id]) propertyPool.push(n)
  }

  for (let i = 0; i < 70; i++) {
    const nNum = propertyPool[i % propertyPool.length]
    const nId = `NEMO_${String(nNum).padStart(3,'0')}`
    const smlId = `SML_${String(smlIdx).padStart(4,'0')}`
    const gender = rng2.bool() ? 'M' : 'F'
    const jmeno = generateName(rng2, gender)
    const em = jmeno.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').split(' ').join('.') + '@email.cz'
    const vs = String(220000 + smlIdx)
    const rent = round1k(rng2.int(12000, 32000))
    const startY = rng2.int(2020, 2025); const startM = String(rng2.int(1,12)).padStart(2,'0')
    const endY = startY + rng2.int(1,3); const endM = startM
    const endConci = endY <= 2026 && parseInt(endM) <= 6 ? 'KONČÍ BRZY' : ''
    const status = rng2.bool(0.92) ? 'Zaplaceno' : 'Zaplaceno'
    const prevStatus = 'Zaplaceno'
    // Find district from DISTRICTS
    let adresaFrag = `ID${nNum}, Praha`
    for (const dc of DISTRICTS) {
      const startId = DISTRICTS.slice(0,DISTRICTS.indexOf(dc)).reduce((a,d)=>a+d.n,1)
      if (nNum >= startId && nNum < startId + dc.n) { adresaFrag = dc.d; break }
    }
    rows.push([smlId, nId, adresaFrag, jmeno, em, vs, rent, `${startY}-${startM}-01`, `${endY}-${endM}-28`, status, prevStatus, endConci])
    smlIdx++
  }
  return rows
}

// ── TICKETY ───────────────────────────────────────────────────────────────────
function buildTickety() {
  const rng = new Rng(4004)
  const rows = [['ID_Ticket','ID_Nemo','Adresa','Kategorie','Popis','Dodavatel','Kontakt_Dodavatele','Status','Naklady_CZK','Datum_Nahlaseni','Datum_Vyreseni','Poznamka']]

  const defined = [
    ['T001','NEMO_022','Lupáčova 9, Praha 3','Havárie','Prasklá vodovodní trubka pod dřezem','Instalatér Vomáček & syn','vomacek.instalace@email.cz','Vyřešeno',4800,'2026-03-12','2026-03-13','Opraveno do 24h'],
    ['T002','NEMO_012','Korunní 18, Praha 2','Údržba','Výměna zámku po ztrátě klíče','Zámečnictví Hora','zamecnictvi.hora@email.cz','Vyřešeno',1200,'2026-02-20','2026-02-21',''],
    ['T003','NEMO_073','Dělnická 31, Praha 7','Havárie','Nefunkční kotel - bez topení','Servis Thermox','thermox.servis@email.cz','V řešení',0,'2026-04-28','','Čeká na náhradní díl, dodání 8.5.2026'],
    ['T004','NEMO_066','Tusarova 14, Praha 7','Revize','Roční revize elektroinstalace','Elektro Novák','elektro.novak@email.cz','Vyřešeno',3500,'2026-01-10','2026-01-11','Revize OK, protokol v složce'],
    ['T005','NEMO_083','Křižíkova 22, Praha 8','Údržba','Malování - příprava na nového nájemníka','Malíři Praha s.r.o.','info@maliri-praha.cz','Vyřešeno',18000,'2026-03-01','2026-03-15','Hotovo, byt připraven k prodeji'],
    ['T006','NEMO_107','Hybešova 15, Brno','Revize','Revize plynového kotle','Plynservis Brno','plynservis.brno@email.cz','Naplánováno',0,'2026-05-01','','Naplánováno 15.5.2026'],
    ['T007','NEMO_048','Stroupežnického 28, Praha 5','Údržba','Drobné opravy před prodejem','Údržba Západ','udrzba.zapad@email.cz','Vyřešeno',6200,'2026-01-20','2026-01-25',''],
  ]
  rows.push(...defined)

  const kategorie = ['Havárie','Údržba','Revize','Rekonstrukce','Údržba','Údržba']
  const statusy = ['Vyřešeno','Vyřešeno','Vyřešeno','V řešení','Naplánováno']
  const dodavatele = [
    ['Instalatér Vomáček & syn','vomacek.instalace@email.cz'],
    ['Elektro Novák','elektro.novak@email.cz'],
    ['Malíři Praha s.r.o.','info@maliri-praha.cz'],
    ['Servis Thermox','thermox.servis@email.cz'],
    ['Údržba Západ','udrzba.zapad@email.cz'],
    ['Zámečnictví Hora','zamecnictvi.hora@email.cz'],
    ['Plynservis Brno','plynservis.brno@email.cz'],
    ['Stavební firma Novotný','novotny.stavby@email.cz'],
  ]

  for (let i = 8; i <= 60; i++) {
    const nNum = rng.int(1,114)
    const nId = `NEMO_${String(nNum).padStart(3,'0')}`
    const kat = rng.pick(kategorie)
    const dod = rng.pick(dodavatele)
    const status = rng.pick(statusy)
    const naklady = status === 'Vyřešeno' ? rng.int(500, 45000) : 0
    const y = rng.int(2022, 2026); const m = String(rng.int(1,12)).padStart(2,'0'); const d = String(rng.int(1,28)).padStart(2,'0')
    const vyreseno = status === 'Vyřešeno' ? `${y}-${m}-${String(rng.int(1,28)).padStart(2,'0')}` : ''
    const popisy = ['Výměna radiátoru','Oprava střechy','Výměna oken','Havárie vody','Revize elektro','Malování pokojů','Oprava schodiště','Výměna dveří','Čištění odvodnění','Oprava balkonu']
    rows.push([`T${String(i).padStart(3,'0')}`, nId, `Nemovitost ${nId}`, kat, rng.pick(popisy), dod[0], dod[1], status, naklady, `${y}-${m}-${d}`, vyreseno, ''])
  }
  return rows
}

// ── PIPELINE ──────────────────────────────────────────────────────────────────
function buildPipeline() {
  const rows = [['ID_Obchodu','ID_Nemo','Adresa','Kupujici','Email_Kupujiciho','Prodavajici','Makler','Cena_Prodej','Datum_Rezervace','Rez_Poplatek_CZK','Rez_Poplatek_Zaplacen','Deadline_Zaplaceni','Penize_v_Uschove','Datum_Uschovy','Advokat_Uschova','Katastr_Cislo_Rizeni','Status_Katastr','Datum_Podani','Konec_Ochranne_Lhuty','Penize_Uvolneny','Status_Obchodu','Poznamka']]
  rows.push(
    ['OBD_034','NEMO_034','Chelčického 8, Praha 3','Petra Nováková','p.novakova@email.cz','Stanislav Vlček','Jana Nováková',6200000,'2026-04-15',150000,'NE','2026-04-20','Ne','','','','','','','Ne','Rezervace','⚠️ AKCE: rezervační poplatek nezaplacen po deadline!'],
    ['OBD_048','NEMO_048','Stroupežnického 28, Praha 5','Radek Horáček','r.horacek@email.cz','Eva Mrázková','Tomáš Kovář',7400000,'2026-02-15',200000,'ANO','2026-02-20','ANO','2026-03-01','Mgr. Petr Mareš (Advokátní kancelář Mareš & spol.)','V-1234/2026','Vklad povolen','2026-04-01','2026-04-21','Ne','Na katastru','⚠️ AKCE: vklad povolen 29.4., čeká na pokyn k uvolnění 7,4M Kč!'],
    ['OBD_083','NEMO_083','Křižíkova 22, Praha 8','Jakub Dvořák','j.dvorak@email.cz','Radovan Šimánek','Martin Svoboda',9800000,'2026-03-20',250000,'ANO','2026-03-25','Ne','','Mgr. Alice Horáková','','','','','Ne','Kupní smlouva','⚠️ BLOKOVÁNO: chybí souhlas banky s hypotékou od KB'],
    ['OBD_022','NEMO_022','Náměstí Míru 4, Praha 2','Milan Pokorný','m.pokorny@email.cz','Dagmar Horáčková','Jana Nováková',8900000,'2026-04-01',220000,'ANO','2026-04-06','ANO','2026-04-20','Mgr. Jan Liška','','','','','Ne','Kupní smlouva','Podpis smlouvy 25.4., vše OK'],
    ['OBD_061','NEMO_061','Dejvická 33, Praha 6','Renata Vlčková','r.vlckova@email.cz','Bc. Antonín Marek','Tomáš Kovář',11200000,'2026-01-10',300000,'ANO','2026-01-15','ANO','2026-02-01','Mgr. Petr Mareš','V-0891/2026','Vklad zapsán','2026-02-01','2026-02-21','ANO','Dokončeno','Prodej dokončen 3/2026, vše proběhlo bez komplikací'],
  )
  // Add a few more recent pipeline entries
  const rng = new Rng(5005)
  const statuses = ['Rezervace','Kupní smlouva','V přípravě','V inzerci']
  for (let i = 1; i <= 3; i++) {
    const nNum = rng.int(50,110)
    const nId = `NEMO_${String(nNum).padStart(3,'0')}`
    const cena = round1k(rng.int(5000000, 14000000))
    const status = rng.pick(statuses)
    rows.push([`OBD_${String(100+i).padStart(3,'0')}`, nId, `Nemovitost ${nId}`, generateName(rng, 'M'), 'klient@email.cz', generateName(rng, 'F'), 'Martin Svoboda', cena, '2026-03-' + String(rng.int(1,28)).padStart(2,'0'), round1k(cena*0.02), 'ANO', '', '', '', '', '', '', '', '', 'Ne', status, ''])
  }
  return rows
}

// ── HISTORICAL SALES ──────────────────────────────────────────────────────────
function buildUzavreneObchody() {
  const rng = new Rng(6006)
  const rows = [['Rok','ID_Obchodu','Adresa','Makler','Datum_Podpisu_Kupni','Datum_Prevodu_Katastr','Cena_Prodej_CZK','Provize_CZK','Procento_Provize','Typ_Kupujiciho','Financovani','Delka_Obchodu_Dni','Poznamka']]

  const maklerPool = MAKLERI.map(m => m.jmeno)
  const financovani = ['Hotovost','Hypotéka','Hypotéka','Hypotéka','Kombinace']
  const typKup = ['Fyzická osoba','Fyzická osoba','Fyzická osoba','Firma','Investor']
  const addressPrefixes = ['Mánesova','Korunní','Seifertova','Plzeňská','Dejvická','Letohradská','Křižíkova','Vršovická','Veveří','Štefánikova']

  // 2020: 6 obchodů
  // 2021: 8 obchodů
  // 2022: 10 obchodů
  // 2023: 9 obchodů
  // 2024: 12 obchodů
  // 2025: 10 obchodů
  const yearCounts = [[2020,6],[2021,8],[2022,10],[2023,9],[2024,12],[2025,10]]
  let obchadIdx = 1

  for (const [year, count] of yearCounts) {
    for (let i = 0; i < count; i++) {
      const m = String(rng.int(1,12)).padStart(2,'0')
      const d = String(rng.int(1,28)).padStart(2,'0')
      const podpis = `${year}-${m}-${d}`
      const prevod = `${year}-${String(parseInt(m)+1>12?12:parseInt(m)+rng.int(1,2)).padStart(2,'0')}-${String(rng.int(1,28)).padStart(2,'0')}`
      const cena = round1k(rng.int(3500000, 16000000))
      const provizePct = rng.bool(0.6) ? 3 : (rng.bool(0.5) ? 4 : 2.5)
      const provize = Math.round(cena * provizePct / 100 / 1000) * 1000
      const delka = rng.int(28, 95)
      const adr = `${rng.pick(addressPrefixes)} ${rng.int(1,100)}, Praha ${rng.int(1,10)}`
      rows.push([year, `H${String(obchadIdx).padStart(3,'0')}`, adr, rng.pick(maklerPool), podpis, prevod, cena, provize, provizePct+'%', rng.pick(typKup), rng.pick(financovani), delka, ''])
      obchadIdx++
    }
  }
  return rows
}

// ── MAKLERSKY PREHLED ─────────────────────────────────────────────────────────
function buildMaklersky() {
  return [
    ['ID','Jmeno','Email','Telefon','Oblast','Aktivni_Pronajem','Aktivni_Prodeje','YTD_Uzavrene_Prodeje','YTD_Provize_CZK','Celkem_Obchodu_Vsechny_Doby'],
    ['M01','Jana Nováková','j.novakova@realitka-premium.cz','+420 602 111 001','Praha 2, Praha 3',29,4,3,540000,47],
    ['M02','Tomáš Kovář','t.kovar@realitka-premium.cz','+420 602 111 002','Praha 5, Praha 6',20,3,2,410000,38],
    ['M03','Martin Svoboda','m.svoboda@realitka-premium.cz','+420 602 111 003','Praha 7, Praha 8',27,5,2,380000,41],
    ['M04','Lucie Marková','l.markova@realitka-premium.cz','+420 602 111 004','Praha 1, Praha 4, Praha 9',18,2,1,290000,29],
    ['M05','Ondřej Beneš','o.benes@realitka-premium.cz','+420 602 111 005','Praha 10, Brno',20,2,1,210000,22],
  ]
}

// ── BANK CSV ──────────────────────────────────────────────────────────────────
function buildBankCsv(year, month, includeAnomalies = false) {
  const rng = new Rng(7000 + month)
  const lines = ['Datum;Protistranaˇ;VS;Castka;Typ;Zprava']

  // Active VS pool (from smlouvy)
  const vsPool = ['220001','220002','220003','220004','220005','220006','220007','220008','220009','220010',
    '220011','220013','220014','220015','220016','220017','220018','220019','220020','220021',
    '220023','220024','220025','220026','220027','220028','220029','220030','220031','220032',
    '230033','230034','230035','230036','230037','230038','230039','230040','230041','230042',
    '240043','240044','240045','240046','240047','240049','240050','240051','240052','240053',
    '240054','240055','240056','240057','240058','240059','240060','240061','240062','240063',
    '250064','250065','250067','250068','250069','250070','250071','250072','250074','250075',
    '260076','260077','260078','260079','260080','260081','260082']

  const nonPayersInMay = ['220012','240022','220066','250073','240107']
  const mm = String(month).padStart(2,'0')

  // Incoming rents
  let payDay = 1
  for (const vs of vsPool) {
    if (includeAnomalies && nonPayersInMay.includes(vs)) continue // skip non-payers
    const rent = round1k(rng.int(12000, 35000))
    const d = String(rng.int(1, 5)).padStart(2,'0')
    const names = ['Novák Jan','Svobodová Eva','Dvořák Martin','Procházka Petr','Horáková Jana','Černý Pavel','Kučera Jiří']
    lines.push(`${year}-${mm}-0${Math.min(payDay++%5+1,5)};${rng.pick(names)};${vs};${rent};Příchozí;Nájem ${mm}/${year}`)
  }

  if (includeAnomalies) {
    // NEMO_022 - Kopecká platí o 500 méně
    lines.push(`${year}-${mm}-03;Irena Kopecká;240022;14500;Příchozí;Nájem ${mm}/${year} - nesprávná částka`)
    // Large reservation payment (Smíchov)
    lines.push(`${year}-${mm}-08;Radek Horáček;VS7400048;7400000;Příchozí;Kupní cena - úschova advokát Mareš - NEMO_048`)
    // Note about missing 150k from Nováková for demo scenario 1
    // (intentionally NOT in the CSV - agent should notice it's missing)
    lines.push(`${year}-${mm}-02;ČSOB Leasing a.s.;;-8500;Odchozí;Správcovský poplatek správa budov`)
    lines.push(`${year}-${mm}-05;Pražská plynárenská a.s.;;-24300;Odchozí;Energie sdílené prostory Q2/2026`)
    lines.push(`${year}-${mm}-12;Instalatér Vomáček & syn;;-4800;Odchozí;Faktura oprava vody - NEMO_022`)
  } else {
    lines.push(`${year}-${mm}-03;${rng.pick(['Nováček','Horáček','Dvořák'])};;-8500;Odchozí;Správcovský poplatek`)
    lines.push(`${year}-${mm}-05;Pražská plynárenská a.s.;;-${rng.int(18000,28000)};Odchozí;Energie Q${Math.ceil(month/3)}/${year}`)
    if (rng.bool(0.4)) {
      const rand_vs = rng.pick(vsPool)
      lines.push(`${year}-${mm}-${String(rng.int(6,15)).padStart(2,'0')};Advokát;;${rng.int(3000000,10000000)};Příchozí;Kupní cena do úschovy VS${rand_vs}`)
    }
  }
  return lines.join('\n')
}

// ── DASHBOARD SHEET ───────────────────────────────────────────────────────────
function buildDashboardObrat() {
  const rows = [['Mesic','Prijem_Najmy_CZK','Prijem_Provize_CZK','Vydaje_Udrzba_CZK','Vydaje_Ostatni_CZK','Zisk_Mesic_CZK','Pocet_Pronajimanich_Bytu','Pocet_Volnych_Bytu','Nove_Smlouvy']]
  const rng = new Rng(8008)
  const months = ['2024-01','2024-02','2024-03','2024-04','2024-05','2024-06','2024-07','2024-08','2024-09','2024-10','2024-11','2024-12',
                  '2025-01','2025-02','2025-03','2025-04','2025-05','2025-06','2025-07','2025-08','2025-09','2025-10','2025-11','2025-12',
                  '2026-01','2026-02','2026-03','2026-04']
  let pronajimanych = 58
  for (const m of months) {
    pronajimanych = Math.min(75, Math.max(55, pronajimanych + rng.int(-1,2)))
    const najmy = pronajimanych * round1k(rng.int(17000,19500))
    const provize = rng.bool(0.7) ? round1k(rng.int(150000,600000)) : 0
    const udrzba = round1k(rng.int(20000,120000))
    const ostatni = round1k(rng.int(15000,45000))
    const zisk = najmy + provize - udrzba - ostatni
    rows.push([m, najmy, provize, udrzba, ostatni, zisk, pronajimanych, 75-pronajimanych, rng.int(0,3)])
  }
  return rows
}

// ── CALENDAR EVENTS ───────────────────────────────────────────────────────────
function buildCalendarEvents() {
  // Base date: 2026-05-02
  const events = []
  const dt = (dateStr, startH, endH) => ({
    start: { dateTime: `${dateStr}T${String(startH).padStart(2,'0')}:00:00+02:00`, timeZone: 'Europe/Prague' },
    end:   { dateTime: `${dateStr}T${String(endH).padStart(2,'0')}:00:00+02:00`, timeZone: 'Europe/Prague' },
  })

  // ── Past events (last 60 days) ──
  events.push({ summary: '🏢 Pondělní porada týmu', ...dt('2026-03-02',9,10), description: 'Týdenní operativní porada. Agenda: pipeline update, nové leady, tickety.' })
  events.push({ summary: '🏢 Pondělní porada týmu', ...dt('2026-03-09',9,10), description: 'Pipeline: 8 aktivních obchodů. Problém: kotel Vinohrady.' })
  events.push({ summary: '🏠 Prohlídka — Praha 6, Dejvická', ...dt('2026-03-12',14,15), description: 'NEMO_061 - zájemce: pan Renáta Vlčková, zájem o koupi. Makléř: Tomáš Kovář.' })
  events.push({ summary: '🏢 Pondělní porada týmu', ...dt('2026-03-16',9,10), description: '' })
  events.push({ summary: '⚖️ Schůzka s advokátem — úschova Smíchov', ...dt('2026-03-20',11,12), description: 'Mgr. Petr Mareš, AK Mareš & spol. Podpis smlouvy o advokátní úschovně — NEMO_048 (Stroupežnického 28). Částka 7 400 000 Kč.' })
  events.push({ summary: '🏢 Pondělní porada týmu', ...dt('2026-03-23',9,10), description: '' })
  events.push({ summary: '📝 Podpis kupní smlouvy — Smíchov', ...dt('2026-03-25',13,15), description: 'NEMO_048 Stroupežnického 28. Strany: Radek Horáček (kupující) + Eva Mrázková (prodávající). Advokát: Mgr. Mareš. Cena: 7 400 000 Kč.' })
  events.push({ summary: '🏢 Pondělní porada týmu', ...dt('2026-03-30',9,10), description: '' })
  events.push({ summary: '📋 Podání na katastr — NEMO_048 Smíchov', ...dt('2026-04-01',10,11), description: 'Podání návrhu na vklad — řízení V-1234/2026. Ochranná lhůta 20 dní = do 21.4.2026.' })
  events.push({ summary: '🏢 Pondělní porada týmu', ...dt('2026-04-07',9,10), description: 'Update: V-1234/2026 podáno. Pipeline: 6 aktivních obchodů.' })
  events.push({ summary: '🔧 Revize kotle — Blanická 12, Praha 2', ...dt('2026-04-10',9,11), description: 'Servis Thermox. Výsledek: kotel v pořádku, revizní zpráva do složky.' })
  events.push({ summary: '🏠 Prohlídka — Praha 3, Chelčického 8', ...dt('2026-04-15',16,17), description: 'NEMO_034 — zájemkyně: Petra Nováková. Zájem o koupi! Rezervační smlouva podepsána na místě.' })
  events.push({ summary: '🏢 Pondělní porada týmu', ...dt('2026-04-14',9,10), description: '' })
  events.push({ summary: '📅 Deadline: rezervační poplatek NEMO_034', ...dt('2026-04-20',9,10), description: '⚠️ Petra Nováková má do dneška uhradit 150 000 Kč (VS: RZ2026034). Zkontrolovat výpis!' })
  events.push({ summary: '🏢 Pondělní porada týmu', ...dt('2026-04-21',9,10), description: 'Katastr V-1234/2026: dnes uplývá ochranná lhůta! Sledovat datovou schránku.' })
  events.push({ summary: '⏰ Katastr — konec ochranné lhůty V-1234/2026', ...dt('2026-04-21',12,12.5), description: 'Očekáváme rozhodnutí katastrálního úřadu ohledně vkladu. Stroupežnického 28, Praha 5.' })
  events.push({ summary: '🏠 Prohlídka — Praha 7, Holešovice', ...dt('2026-04-23',14,15), description: 'NEMO_078 — 2 zájemci, obě prohlídky za sebou.' })
  events.push({ summary: '📝 Podpis kupní smlouvy — Vinohrady', ...dt('2026-04-25',14,16), description: 'NEMO_022 Náměstí Míru 4. Kupující: Milan Pokorný. Advokát: Mgr. Jan Liška. Cena: 8 900 000 Kč. Vše připraveno.' })
  events.push({ summary: '🏢 Pondělní porada týmu', ...dt('2026-04-28',9,10), description: 'Agenda: platby za duben (1 neplatič), pipeline report, V-1234 čeká.' })
  events.push({ summary: '📬 Email z katastru: V-1234/2026 — vklad povolen', ...dt('2026-04-29',8,9), description: '⚠️ AKCE POŽADOVÁNA: Katastrální úřad povolil vklad. Byt na Stroupežnického přepsán na Radka Horáčka. Informovat advokáta Mareše o uvolnění 7 400 000 Kč z úschovy!' })
  events.push({ summary: '🏠 Předávací protokol — Praha 8, Karlín', ...dt('2026-04-30',10,11), description: 'Nový nájemník NEMO_085. Stav měřidel zaznamenat. Makléř: Martin Svoboda.' })

  // ── Future events ──
  events.push({ summary: '🏢 Pondělní porada týmu', ...dt('2026-05-04',9,10), description: 'Agenda: platby za květen (5 neplatičů!), demo obchody, katastr Smíchov.' })
  events.push({ summary: '🏠 Prohlídka — Praha 7, Holešovice NEMO_078', ...dt('2026-05-05',15,16), description: 'Nový zájemce, 2+kk, plně zařízený. Cena 25 000 Kč/měs. Makléř: Martin Svoboda.' })
  events.push({ summary: '🏠 Prohlídka — Praha 5, Stroupežnického (sold!)', ...dt('2026-05-07',10,11), description: 'Pozor: NEMO_048 je již prodáno — koordinovat s makléřem, zájemci přesměrovat na NEMO_044.' })
  events.push({ summary: '🏢 Pondělní porada týmu', ...dt('2026-05-11',9,10), description: '' })
  events.push({ summary: '🏠 Prohlídka — Brno, Kounicova', ...dt('2026-05-12',11,12), description: 'NEMO_109 Brno — zájemkyně z Brna, hledá 3+1. Makléř: Ondřej Beneš.' })
  events.push({ summary: '⚖️ Schůzka: uvolnění úschovy — Smíchov', ...dt('2026-05-13',10,11), description: 'Mgr. Petr Mareš, AK Mareš & spol. Pokyn k uvolnění 7 400 000 Kč prodávající Evě Mrážkové. Přinést: potvrzení o povolení vkladu V-1234/2026.' })
  events.push({ summary: '🔑 Předávací protokol — Praha 8, nový nájemník', ...dt('2026-05-14',14,15), description: 'NEMO_080 Sokolovská. Nový nájemník nastupuje 1.5. Stav měřidel, klíče, foto.' })
  events.push({ summary: '📊 Příprava Q2 reportu 2026', ...dt('2026-05-15',14,16), description: 'Kvartální report pro vedení. Data: platby, obsazenost, pipeline, obrat.' })
  events.push({ summary: '🏢 Pondělní porada týmu', ...dt('2026-05-18',9,10), description: '' })
  events.push({ summary: '📝 Podpis kupní smlouvy — Karlín (PODMÍNĚNO)', ...dt('2026-05-19',14,16), description: '⚠️ NEMO_083 Křižíkova 22. POZOR: stále chybí souhlas KB s hypotékou pro Jakuba Dvořáka! Potvrdit 2 dny předem zda je možné pokračovat.' })
  events.push({ summary: '🏠 Prohlídka — Praha 2, Blanická', ...dt('2026-05-21',16,17), description: 'NEMO_007 — 2 zájemci. Byt volný od 1.6.' })
  events.push({ summary: '🔧 Revize hasicích přístrojů — Brno', ...dt('2026-05-22',9,12), description: 'Pravidelná roční revize. Servisní firma Brno-Požár s.r.o. Pokrývá 4 nemovitosti v Brně.' })
  events.push({ summary: '🏢 Pondělní porada týmu', ...dt('2026-05-25',9,10), description: '' })
  events.push({ summary: '🤝 Schůzka: Ing. Robert Mašek — portfolio review', ...dt('2026-05-27',11,12), description: 'VIP klient, vlastník 4 bytů. Agenda: prodloužení smluv, zájem o prodej jednoho bytu v P3, diskuze o ceně.' })
  events.push({ summary: '🏢 Pondělní porada týmu', ...dt('2026-06-01',9,10), description: '' })
  events.push({ summary: '📅 Smlouva KONČÍ — NEMO_022 (Kopecká)', ...dt('2026-05-31',9,9.5), description: 'Smlouva Ireny Kopecké na Lupáčově 9 vyprší 31.5. Řešit prodloužení nebo nového nájemníka IHNED.' })

  return events
}

// ── TEMPLATE DOC CONTENT ──────────────────────────────────────────────────────
const SABLONA_NAJEMNI = `NÁJEMNÍ SMLOUVA

uzavřená níže uvedeného dne, měsíce a roku mezi:

Pronajímatelem: {{JMENO_VLASTNIKA}}
Adresa: {{ADRESA_VLASTNIKA}}

Nájemcem: {{JMENO_KLIENTA}}
Rodné číslo: {{RODNE_CISLO}}
Adresa trvalého bydliště: {{ADRESA_KLIENTA}}

Předmět nájmu: Byt č. {{CISLO_BYTU}}, {{ADRESA_NEMOVITOSTI}}
Výměra: {{PLOCHA_M2}} m²

Nájemné: {{VYSE_NAJMU}} Kč/měsíc
Variabilní symbol platby: {{VAR_SYMBOL}}

Platnost smlouvy: od {{DATUM_OD}} do {{DATUM_DO}}

[Podpisy stran, datum, místo]`

const SABLONA_REZERVACNI = `REZERVAČNÍ SMLOUVA

Prodávající: {{JMENO_PRODAVAJICIHO}}

Kupující: {{JMENO_KUPUJICIHO}}
Rodné číslo: {{RC_KUPUJICIHO}}

Předmět: Byt na adrese {{ADRESA_NEMOVITOSTI}}, plocha {{PLOCHA}} m²

Kupní cena: {{KUPNI_CENA}} Kč
Rezervační poplatek: {{REZ_POPLATEK}} Kč
Splatnost rezervačního poplatku: {{DEADLINE_POPLATEK}}
Bankovní účet pro úhradu: 1234567890/0800 (Realitka Premium)

Kupující se zavazuje uhradit rezervační poplatek do {{DEADLINE_POPLATEK}}.
V případě neuhrazení v termínu se rezervace automaticky ruší.

[Podpisy, datum]`

const SABLONA_KUPNI = `KUPNÍ SMLOUVA

Prodávající: {{JMENO_PRODAVAJICIHO}}, r.č. {{RC_PRODAVAJICIHO}}

Kupující: {{JMENO_KUPUJICIHO}}, r.č. {{RC_KUPUJICIHO}}

Předmět koupě: Bytová jednotka č. {{CISLO_JEDNOTKY}} v budově na adrese {{ADRESA}},
zapsaná v katastru nemovitostí na LV č. {{CISLO_LV}}, k.ú. {{KATASTRALNI_UZEMI}}

Kupní cena: {{KUPNI_CENA}} Kč (slovy: {{CENA_SLOVY})
Způsob úhrady: advokátní úschova u {{ADVOKAT}}

Smluvní strany souhlasí s podáním návrhu na vklad do katastru nemovitostí.

[Podpisy, datum, notářské ověření]`

const SABLONA_UPOMINKA = `Věc: Upomínka — nezaplacené nájemné

Vážený/á {{JMENO_KLIENTA}},

na základě nájemní smlouvy č. {{ID_SMLOUVY}} ze dne {{DATUM_SMLOUVY}}
pro nemovitost na adrese {{ADRESA_NEMOVITOSTI}}
Vám touto cestou připomínáme, že ke dni {{DATUM_UPOMINKY}} evidujeme
na Vašem nájemním účtu pohledávku ve výši {{VYSE_DLUHU}} Kč.

Prosíme o úhradu na bankovní účet č. 1234567890/0800 s variabilním symbolem {{VAR_SYMBOL}}
nejpozději do {{DEADLINE}}.

V případě nezaplacení budeme nuceni přistoupit k dalším právním krokům.

S pozdravem,
Realitka Premium s.r.o.
Pepova Správa Nemovitostí`

const SABLONA_UPOMINKA_REZ = `Věc: Upomínka — nezaplacený rezervační poplatek

Vážený/á {{JMENO_KLIENTA}},

dne {{DATUM_REZERVACE}} jste uzavřeli rezervační smlouvu na nemovitost
{{ADRESA_NEMOVITOSTI}} za kupní cenu {{KUPNI_CENA}} Kč.

Dle smlouvy jste se zavázali/a uhradit rezervační poplatek {{REZ_POPLATEK}} Kč
do {{DEADLINE}}. K dnešnímu dni tato platba nebyla připsána na náš účet.

Prosíme o okamžitou úhradu nebo o kontaktování našeho makléře.
V případě neuhrazení do {{DEADLINE_FINAL}} bude rezervace automaticky zrušena.

S pozdravem,
Realitka Premium s.r.o.`

const SABLONA_ADVOKAT_UVOLNENI = `Věc: Pokyn k uvolnění prostředků z advokátní úschovy

Vážený pane/paní {{JMENO_ADVOKATA}},

tímto Vám sdělujeme, že dne {{DATUM_VKLADU}} byl Katastrálním úřadem pro hl. m. Prahu
povolen vklad vlastnického práva k nemovitosti {{ADRESA}} (řízení č. {{CISLO_RIZENI}})
ve prospěch kupujícího {{JMENO_KUPUJICIHO}}.

V souladu s uzavřenou smlouvou o advokátní úschově Vás tímto žádáme o uvolnění
částky {{CASTKA}} Kč prodávajícímu {{JMENO_PRODAVAJICIHO}}.

Bankovní spojení prodávajícího:
Číslo účtu: {{UCET_PRODAVAJICIHO}}

S pozdravem,
Realitka Premium s.r.o.`

// ── REPORT SHEETS ─────────────────────────────────────────────────────────────
function buildReportQ1_2026() {
  return [
    ['KVARTÁLNÍ REPORT Q1 2026 — Realitka Premium s.r.o.','','',''],
    ['Zpracoval: Pepa Novák, Back Office Manager','','',''],
    ['Datum: 1.4.2026','','',''],
    ['','','',''],
    ['OBSAZENOST','','',''],
    ['Celkem nemovitostí v portfoliu','120','',''],
    ['Aktivně pronajatých','73','',''],
    ['Volných k pronájmu','8','',''],
    ['V prodeji (aktivní)','14','',''],
    ['Prodaných v Q1 2026','3','',''],
    ['Obsazenost pronájmy','90%','',''],
    ['','','',''],
    ['FINANCE — PRONÁJMY','','',''],
    ['Celkový předpis nájmů/měsíc','1 847 500 Kč','',''],
    ['Skutečně vybrané Q1 2026','5 412 000 Kč','',''],
    ['Výpadky / neplatiči Q1 2026','112 000 Kč','',''],
    ['','','',''],
    ['PRODEJE Q1 2026','Adresa','Cena','Provize'],
    ['Obchod 1','Dejvická 33, Praha 6','11 200 000 Kč','336 000 Kč'],
    ['Obchod 2','Náměstí Míru 4, Praha 2','8 900 000 Kč','267 000 Kč'],
    ['Obchod 3','Křižíkova 5, Praha 8','6 200 000 Kč','186 000 Kč'],
    ['Celkem provize Q1','','','789 000 Kč'],
    ['','','',''],
    ['ÚDRŽBA','','',''],
    ['Počet ticketů Q1 2026','18','',''],
    ['Vyřešeno','15','',''],
    ['V řešení','3','',''],
    ['Náklady na údržbu Q1 2026','87 400 Kč','',''],
    ['','','',''],
    ['AKTUÁLNÍ UPOZORNĚNÍ','','',''],
    ['1. Smlouva NEMO_022 (Kopecká) — opakované krácení platby','Řeší Jana Nováková','',''],
    ['2. Ticket T003 — kotel Dělnická 31, čeká na díl','Servis Thermox, 8.5.','',''],
    ['3. Pipeline: 8 aktivních obchodů, 3 vyžadují akci','Viz list Obchod_Pipeline','',''],
  ]
}

// ── MAIN ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n🚀 Realitka Premium — setup mock dat\n')
  await authenticate()

  console.log('\n📁 Vytvářím strukturu složek...')
  const root = await mkFolder('Realitka_BackOffice_System')
  console.log(`  ✓ Root: ${root}`)
  await sleep(300)

  const f01 = await mkFolder('01_Sablony_Dokumentu', root)
  const f02a = await mkFolder('02a_Pronajmy', root)
  const f02b = await mkFolder('02b_Prodeje', root)
  const f03 = await mkFolder('03_Finance_a_Vypisy', root)
  const f04 = await mkFolder('04_Udrzba_Ticketing', root)
  const f05 = await mkFolder('05_Reporty_Management', root)
  const f06 = await mkFolder('06_Marketing_a_Priprava', root)
  console.log('  ✓ Podsložky vytvořeny')
  await sleep(300)

  // District sub-folders in 02a
  const districtFolders = {}
  for (const dc of DISTRICTS) {
    const fname = `${dc.d.replace(' ','_')}`
    districtFolders[dc.d] = await mkFolder(fname, f02a)
    await sleep(100)
  }
  console.log('  ✓ Složky pro distrikty')

  // ── 00_Hlavni_Databaze.gsheet ────────────────────────────────────────────────
  console.log('\n📊 Vytvářím 00_Hlavni_Databaze...')
  const dbId = await mkSheet('00_Hlavni_Databaze', root)
  const propRows = buildProperties()
  const smlouvyRows = buildSmlouvy()
  const ticketyRows = buildTickety()
  const pipelineRows = buildPipeline()
  await populateSheet(dbId, [
    { title: 'Nemovitosti', rows: propRows },
    { title: 'Smlouvy_a_Finance', rows: smlouvyRows },
    { title: 'Udrzba_Ticketing', rows: ticketyRows },
    { title: 'Obchod_Pipeline', rows: pipelineRows },
    { title: 'Maklersky_Prehled', rows: buildMaklersky() },
  ])
  console.log(`  ✓ 00_Hlavni_Databaze (${propRows.length-1} nemovitostí)`)
  await sleep(500)

  // ── CRM_Leady_a_Klienti.gsheet (maps to crm_leads) ─────────────────────────
  console.log('\n👥 Vytvářím CRM_Leady_a_Klienti...')
  const crmId = await mkSheet('CRM_Leady_a_Klienti', root)
  const klientiRows = buildKlienti()
  await populateSheet(crmId, [{ title: 'Klienti', rows: klientiRows }])
  console.log(`  ✓ CRM (${klientiRows.length-1} klientů)`)
  await sleep(500)

  // ── Uzavrene_Obchody_2020_2026 ───────────────────────────────────────────────
  console.log('\n📈 Vytvářím Uzavrene_Obchody_2020_2026...')
  const uzavreneId = await mkSheet('Uzavrene_Obchody_2020_2026', root)
  const uzavreneRows = buildUzavreneObchody()
  await populateSheet(uzavreneId, [{ title: 'Uzavrene_Obchody', rows: uzavreneRows }])
  console.log(`  ✓ Historické prodeje (${uzavreneRows.length-1} obchodů, 2020–2025)`)
  await sleep(500)

  // ── Prehled_Klienti_Dashboard ────────────────────────────────────────────────
  console.log('\n📊 Vytvářím Prehled_Klienti_Dashboard...')
  const dashId = await mkSheet('Prehled_Klienti_Dashboard', root)
  await populateSheet(dashId, [
    { title: 'Obrat_po_mesicich', rows: buildDashboardObrat() },
    { title: 'Report_Q1_2026', rows: buildReportQ1_2026() },
  ])
  console.log('  ✓ Dashboard')
  await sleep(500)

  // ── 01_Sablony ────────────────────────────────────────────────────────────────
  console.log('\n📄 Vytvářím šablony...')
  const sablony = [
    ['Sablona_Najemni_Smlouva', SABLONA_NAJEMNI],
    ['Sablona_Rezervacni_Smlouva', SABLONA_REZERVACNI],
    ['Sablona_Kupni_Smlouva', SABLONA_KUPNI],
    ['Sablona_Upominka_Najem', SABLONA_UPOMINKA],
    ['Sablona_Upominka_Rezervacni_Poplatek', SABLONA_UPOMINKA_REZ],
    ['Sablona_Email_Advokat_Uvolneni_Uschovny', SABLONA_ADVOKAT_UVOLNENI],
  ]
  for (const [name, content] of sablony) {
    const docId = await mkDoc(name, f01)
    await writeDoc(docId, content)
    await sleep(200)
  }
  console.log('  ✓ 6 šablon')

  // ── 02a Pronájmy — aktivní složky s nájemními smlouvami ─────────────────────
  console.log('\n🏠 Vytvářím složky pronájmů s nájemními smlouvami...')
  const rngDirs = new Rng(9009)
  for (const dc of DISTRICTS) {
    const folderId = districtFolders[dc.d]
    const count = Math.min(dc.n, 5) // 3-5 ukázkových složek per distrikt
    for (let i = 1; i <= count; i++) {
      const nNum = DISTRICTS.slice(0, DISTRICTS.indexOf(dc)).reduce((a,d)=>a+d.n,1) + i
      const nId = `NEMO_${String(nNum).padStart(3,'0')}`
      const street = rngDirs.pick(dc.streets)
      const num = rngDirs.int(2,99)
      const folderName = `${nId}_${street}_${num}`
      const propFolder = await mkFolder(folderName, folderId)
      // Nájemní smlouva jako Google Doc
      const gender = rngDirs.bool() ? 'M' : 'F'
      const jmeno = generateName(rngDirs, gender)
      const smlouvaNazev = `Najemni_Smlouva_${jmeno.split(' ')[1]}_${2020+rngDirs.int(0,5)}`
      const smlouvaDocId = await mkDoc(smlouvaNazev, propFolder)
      const startY = 2020+rngDirs.int(0,5); const startM = String(rngDirs.int(1,12)).padStart(2,'0')
      await writeDoc(smlouvaDocId, `NÁJEMNÍ SMLOUVA\n\nNemovitost: ${street} ${num}, ${dc.d}\nNájemce: ${jmeno}\nPlatnost od: ${startY}-${startM}-01\nNájemné: ${round1k(rngDirs.int(dc.rMin,dc.rMax))} Kč/měsíc\nVariabilní symbol: ${220000+nNum}\n\n[Podepsaný originál v archivu]`)
      await sleep(150)
      // Předávací protokol
      const protokolDocId = await mkDoc(`Predavaci_Protokol_${jmeno.split(' ')[1]}`, propFolder)
      await writeDoc(protokolDocId, `PŘEDÁVACÍ PROTOKOL\n\nNemovitost: ${street} ${num}, ${dc.d}\nNájemce: ${jmeno}\nDatum předání: ${startY}-${startM}-01\n\nStav měřidel:\n- Elektroměr: ${rngDirs.int(10000,99999)} kWh\n- Vodoměr studená: ${rngDirs.int(100,999)} m³\n- Vodoměr teplá: ${rngDirs.int(50,500)} m³\n\nStav bytu: dobrý\nPředané klíče: 2x vstupní, 1x schránka\n\n[Podpisy odevzdán/přejat]`)
      await sleep(150)
    }
  }
  console.log('  ✓ Pronájmy složky vytvořeny')

  // ── 02b Prodeje — aktivní pipeline ──────────────────────────────────────────
  console.log('\n💼 Vytvářím složky aktivních prodejů...')

  // DEMO 1: Žižkov — rezervace, nezaplaceno
  const fZ = await mkFolder('Prodej_NEMO_034_Zizkov_REZERVACE', f02b)
  let d = await mkDoc('LV_Vypis_Katastr_Chelcickeho8', fZ)
  await writeDoc(d, 'LIST VLASTNICTVÍ — výpis ke dni 10.3.2026\nNemovitost: Chelčického 8, Praha 3\nVlastník: Stanislav Vlček, r.č. 560318/...\nZástavní právo: žádné\nVěcná břemena: žádná\nStatus: Čistý LV, vhodný k prodeji')
  await sleep(200)
  d = await mkDoc('PENB_Certifikat_Chelcickeho8', fZ)
  await writeDoc(d, 'PRŮKAZ ENERGETICKÉ NÁROČNOSTI BUDOVY\nAdresa: Chelčického 8, Praha 3\nKlasifikace: C (úsporná)\nPlatnost: do 2036\nVystavil: Energetický specialista Ing. Tomáš Hanuš')
  await sleep(200)
  d = await mkDoc('Rezervacni_Smlouva_Novakova_PODEPSANA_15042026', fZ)
  await writeDoc(d, 'REZERVAČNÍ SMLOUVA — podepsána 15.4.2026\n\nProdávající: Stanislav Vlček\nKupující: Petra Nováková, r.č. 905518/9012\nNemovitost: Chelčického 8, Praha 3, 2+kk, 54 m²\nKupní cena: 6 200 000 Kč\nRezervační poplatek: 150 000 Kč\nDeadline uhrazení rezervačního poplatku: 20.4.2026\nÚčet pro úhradu: 1234567890/0800, VS: RZ2026034')
  await sleep(200)
  await uploadText('!! POZOR - Rezervacni_poplatek_150000_Kc_NEZAPLACEN.txt',
    '⚠️ AKCE POŽADOVÁNA ⚠️\n\nNemovitost: NEMO_034 — Chelčického 8, Praha 3\nKupující: Petra Nováková (p.novakova@email.cz, +420 603 001 003)\nRezervační poplatek: 150 000 Kč\nDeadline: 20.4.2026 — UPLYNUL (dnes je 2.5.2026)\n\nPlatba NEBYLA přijata. Variabilní symbol RZ2026034 se v bankovních výpisech za duben ani květen neobjevuje.\n\nNavrhovaný postup:\n1. Odeslat upomínku ze šablony Sablona_Upominka_Rezervacni_Poplatek\n2. Telefonicky kontaktovat klientku\n3. Pokud nezaplatí do 7.5.2026 — rezervaci zrušit a byt znovu nabídnout',
    fZ)
  console.log('  ✓ DEMO 1 — Žižkov rezervace')
  await sleep(300)

  // DEMO 2: Karlín — chybí hypotéka
  const fK = await mkFolder('Prodej_NEMO_083_Karlin_KUPNI_SMLOUVA', f02b)
  d = await mkDoc('LV_Vypis_Katastr_Krizikova22', fK)
  await writeDoc(d, 'LIST VLASTNICTVÍ\nNemovitost: Křižíkova 22, Praha 8 — Karlín\nVlastník: Radovan Šimánek\nZástavní právo: žádné\nStatus: Čistý LV')
  await sleep(200)
  d = await mkDoc('PENB_Krizikova22', fK)
  await writeDoc(d, 'PRŮKAZ ENERGETICKÉ NÁROČNOSTI\nAdresa: Křižíkova 22, Praha 8\nKlasifikace: D\nPlatnost: do 2034')
  await sleep(200)
  d = await mkDoc('Kupni_Smlouva_Dvorak_Simanek_DRAFT', fK)
  await writeDoc(d, 'KUPNÍ SMLOUVA — DRAFT KE SCHVÁLENÍ\n\nProdávající: Radovan Šimánek\nKupující: Jakub Dvořák, r.č. 870614/0123\nNemovitost: Křižíkova 22, Praha 8, 3+1, 84 m²\nKupní cena: 9 800 000 Kč\nAdvokát úschovy: Mgr. Alice Horáková\n\n⚠️ DRAFT — NEpodepsat dokud nebude potvrzena hypotéka!')
  await sleep(200)
  await uploadText('!! BLOKOVÁNO - Chybi_souhlas_banky_s_hypotekou_Dvorak.txt',
    '⚠️ BLOKOVÁNO — NELZE PODEPSAT KUPNÍ SMLOUVU ⚠️\n\nNemovitost: NEMO_083 — Křižíkova 22, Praha 8 — Karlín\nKupující: Jakub Dvořák (j.dvorak@email.cz, +420 603 001 008)\n\nChybí: Potvrzení Komerční banky o schválení hypotéky 9 800 000 Kč\nSlíbený termín doručení: byl 28.4.2026 — NEPŘIŠLO\n\nPodpis kupní smlouvy plánován na 19.5.2026.\nPokud potvrzení nedorazí do 15.5.2026, termín musí být posunut.\n\nNavrhovaný postup:\n1. Urgovat Jakuba Dvořáka o status schválení u KB\n2. Informovat prodávajícího Radovana Šimánka o prodlevě\n3. Pokud hypotéka nebude schválena, nabídnout alternativní řešení (jiný kupující, jiná banka)',
    fK)
  console.log('  ✓ DEMO 2 — Karlín kupní smlouva')
  await sleep(300)

  // DEMO 3: Smíchov — katastr, čeká pokyn
  const fS = await mkFolder('Prodej_NEMO_048_Smichov_KATASTR_V1234_2026', f02b)
  d = await mkDoc('LV_Vypis_Katastr_Stroupeznickeho28', fS)
  await writeDoc(d, 'LIST VLASTNICTVÍ\nNemovitost: Stroupežnického 28, Praha 5 — Smíchov\nBývalý vlastník: Eva Mrázková\nNový vlastník: Radek Horáček (po povolení vkladu V-1234/2026)\nStatus: Vklad povolen 29.4.2026')
  await sleep(200)
  d = await mkDoc('Kupni_Smlouva_Horacek_Mrazkova_PODEPSANA', fS)
  await writeDoc(d, 'KUPNÍ SMLOUVA — PODEPSÁNA 25.3.2026\n\nProdávající: Eva Mrázková, r.č. 625409/7890\nKupující: Radek Horáček, r.č. 781203/3456\nNemovitost: Stroupežnického 28, Praha 5, 2+1, 65 m²\nKupní cena: 7 400 000 Kč\nAdvokátní úschova: Mgr. Petr Mareš, AK Mareš & spol.')
  await sleep(200)
  d = await mkDoc('Navrh_na_Vklad_Katastr_V1234_2026', fS)
  await writeDoc(d, 'NÁVRH NA VKLAD DO KATASTRU NEMOVITOSTÍ\n\nPodáno: 1.4.2026\nČíslo řízení: V-1234/2026\nKatastrální pracoviště: Praha\nOchranná lhůta 20 dní: vypršela 21.4.2026\nStav ke dni 29.4.2026: VKLAD POVOLEN')
  await sleep(200)
  d = await mkDoc('Potvrzeni_Uschovy_Advokat_Mares', fS)
  await writeDoc(d, 'POTVRZENÍ O PŘIJETÍ DO ADVOKÁTNÍ ÚSCHOVY\n\nAdvokát: Mgr. Petr Mareš, AK Mareš & spol., Wenceslas Square 15, Praha 1\nČástka v úschovně: 7 400 000 Kč\nUloženo dne: 1.3.2026\nÚčel: kupní cena za nemovitost Stroupežnického 28, Praha 5\nUvolnění: po povolení vkladu do KN + pokyn od Realitka Premium s.r.o.')
  await sleep(200)
  await uploadText('!! AKCE POZADOVANA - Vklad_povolen_ceka_na_pokyn_uvolneni_uschovny.txt',
    '⚠️ AKCE POŽADOVÁNA — UVOLNIT ÚSCHOVU ⚠️\n\nNemovitost: NEMO_048 — Stroupežnického 28, Praha 5 — Smíchov\nKatastrální řízení: V-1234/2026\n\nSTAV: Vklad do katastru nemovitostí byl POVOLEN dne 29.4.2026.\nByt byl přepsán na Radka Horáčka.\n\nÚSCHOVA: U Mgr. Petra Mareše (AK Mareš & spol.) je deponováno 7 400 000 Kč.\nTyto peníze je třeba UVOLNIT prodávající Evě Mrážkové.\n\nPostup:\n1. Kontaktovat Mgr. Mareše: mares@ak-mares.cz\n2. Zaslat pokyn k uvolnění ze šablony Sablona_Email_Advokat_Uvolneni_Uschovny\n3. Bankovní spojení prodávající: 9876543210/2010 (Eva Mrázková)\n4. Po uvolnění označit obchod jako DOKONČENO v Obchod_Pipeline\n\nSchůzka s advokátem naplánována na 13.5.2026 v 10:00.',
    fS)
  console.log('  ✓ DEMO 3 — Smíchov katastr')
  await sleep(300)

  // ── 03_Finance — bankovní výpisy ─────────────────────────────────────────────
  console.log('\n💰 Nahrávám bankovní výpisy...')
  const mesiceF = [{y:2025,m:6},{y:2025,m:7},{y:2025,m:8},{y:2025,m:9},{y:2025,m:10},{y:2025,m:11},{y:2025,m:12},{y:2026,m:1},{y:2026,m:2},{y:2026,m:3},{y:2026,m:4},{y:2026,m:5}]
  for (const {y,m} of mesiceF) {
    const isAnomaly = y === 2026 && m === 5
    const csvContent = buildBankCsv(y, m, isAnomaly)
    const name = `Banka_Vypis_${y}_${String(m).padStart(2,'0')}.csv`
    await uploadCsv(name, csvContent, f03)
    await sleep(200)
  }
  console.log('  ✓ 12 měsíců bankovních výpisů')

  // ── 04_Udrzba ────────────────────────────────────────────────────────────────
  console.log('\n🔧 Vytvářím tickety údržby...')
  const aktivniTickety = await mkFolder('Aktivni', f04)
  const archivTickety = await mkFolder('Archiv_2022_2025', f04)

  const ticketDefs = [
    ['T003_Kotel_Delnicka31_Praha7','NEMO_073 — Dělnická 31, Praha 7\n\nProblém: Nefunkční kotel, nájemník bez topení od 28.4.2026\nNájemník: Tereza Malíková\nDodavatel: Servis Thermox (thermox.servis@email.cz)\nStatus: V řešení — čeká na náhradní díl, dodání 8.5.2026\nOdhadované náklady: 12 000–18 000 Kč', aktivniTickety],
    ['T006_Revize_Kotel_Hybešova15_Brno','NEMO_107 — Hybešova 15, Brno\n\nTyp: Pravidelná roční revize plynového kotle\nDodavatel: Plynservis Brno (plynservis.brno@email.cz)\nNaplánováno na: 15.5.2026\nStatus: Naplánováno', aktivniTickety],
    ['T007_Volna_Kancelar_Praha8_Hledame_Najemnika','NEMO_117 — Thámova 11, Praha 8\n\nKancelář 210 m² — uvolnila se 1.4.2026\nAktivně hledáme firemního nájemníka\nCena: 52 000 Kč/měsíc\nMakléř: Martin Svoboda', aktivniTickety],
    ['T001_VYRESENO_PrasklaTrubka_Praha3','NEMO_022 — Lupáčova 9, Praha 3\nVyřešeno 13.3.2026\nInstalace Vomáček & syn\nNáklady: 4 800 Kč\nFaktura uhrazena', archivTickety],
  ]

  for (const [name, content, folder] of ticketDefs) {
    const docId = await mkDoc(name, folder)
    await writeDoc(docId, content)
    await sleep(200)
  }
  console.log('  ✓ Tickety údržby')

  // ── 05_Reporty ────────────────────────────────────────────────────────────────
  console.log('\n📊 Vytvářím management reporty...')
  const rQ1 = await mkSheet('Report_Q1_2026', f05)
  await populateSheet(rQ1, [{ title: 'Q1_2026', rows: buildReportQ1_2026() }])
  await sleep(300)

  const rTW18 = await mkDoc('Report_Tyden_18_2026', f05)
  await writeDoc(rTW18, 'TÝDENNÍ REPORT — TÝDEN 18/2026 (28.4.–2.5.2026)\n\nSepsal: Pepa Novák\n\n📌 KLÍČOVÉ BODY TÝDNE:\n\n1. KATASTR — NEMO_048 Smíchov\n   Vklad V-1234/2026 byl 29.4. povolen. Byt přepsán na Radka Horáčka.\n   ⚠️ Čeká na pokyn k uvolnění 7 400 000 Kč z úschovy u Mgr. Mareše.\n   Schůzka: 13.5.2026.\n\n2. PLATBY DUBNA 2026\n   Celkový předpis: 1 847 500 Kč\n   Přijato: 1 740 500 Kč\n   Nedoplatky: NEMO_012 Blažek (37 000 Kč), NEMO_073 Malíková (44 000 Kč nekontaktní)\n\n3. REZERVACE NEMO_034 Žižkov\n   Rezervační poplatek 150 000 Kč nebyl zaplacen do 20.4. (deadline).\n   Petra Nováková nekomunikuje. Připravit upomínku + případné zrušení rezervace.\n\n4. PIPELINE — 8 aktivních obchodů\n   Blokováno: NEMO_083 Karlín — chybí souhlas KB s hypotékou\n   V přípravě: podpis kupní smlouvy Vinohrady (25.4. proběhlo v pořádku ✓)\n\n📊 OBSAZENOST: 73 bytů pronajato / 120 celkem (61 %)\n📈 YTD PROVIZE 2026: 2 225 000 Kč (3 dokončené prodeje)')
  console.log('  ✓ Reporty')
  await sleep(300)

  // ── 06_Marketing ──────────────────────────────────────────────────────────────
  console.log('\n📸 Vytvářím marketing složky...')
  const mFZ = await mkFolder('NEMO_034_Zizkov_Chelcickeho_Ve_Prodeji', f06)
  const mDoc = await mkDoc('Inzerat_Brief_Copywriterovi', mFZ)
  await writeDoc(mDoc, 'BRIEF PRO INZERÁT — NEMO_034\n\nAdresa: Chelčického 8, Praha 3 — Žižkov\nTyp: 2+kk, 54 m², 4. patro / 6, výtah\nCena: 6 200 000 Kč\nStav: Rezervace (k 15.4.2026)\n\nKlíčové benefity:\n- Klidná ulice, slepá, bez průjezdu\n- Kompletní rekonstrukce 2022\n- Otevřená kuchyň, velký obývací pokoj\n- Sklep + parkovací místo v ceně\n- 5 min. MHD do centra\n\nTón: moderní, vzdušný, lifestyle-oriented\nCílová skupina: mladý pár, single profesionál')
  await sleep(200)
  console.log('  ✓ Marketing')

  // ── KALENDÁŘ ─────────────────────────────────────────────────────────────────
  console.log('\n📅 Vytvářím kalendářní události...')
  const calEvents = buildCalendarEvents()
  let calCount = 0
  for (const event of calEvents) {
    try {
      await retry(() => calApi.events.insert({ calendarId: 'primary', requestBody: event }))
      calCount++
      await sleep(150)
    } catch (e) {
      console.log(`  ⚠️ Event přeskočen: ${event.summary} — ${e.message}`)
    }
  }
  console.log(`  ✓ ${calCount} kalendářních událostí`)

  // ── SUMMARY ────────────────────────────────────────────────────────────────────
  console.log('\n' + '═'.repeat(60))
  console.log('✅ SETUP DOKONČEN!')
  console.log('═'.repeat(60))
  console.log(`\n📁 Root složka ID: ${root}`)
  console.log(`   https://drive.google.com/drive/folders/${root}`)
  console.log(`\n📊 Vytvořeno:`)
  console.log(`   • 00_Hlavni_Databaze — ${propRows.length-1} nemovitostí, 75+ smluv, 60 ticketů, 8 pipeline`)
  console.log(`   • CRM_Leady_a_Klienti — ${klientiRows.length-1} klientů`)
  console.log(`   • Uzavrene_Obchody_2020_2026 — ${uzavreneRows.length-1} prodejů (2020–2025)`)
  console.log(`   • Prehled_Klienti_Dashboard + Report Q1 2026`)
  console.log(`   • 6 šablon dokumentů`)
  console.log(`   • 3 demo složky prodejů (scénáře 1–3)`)
  console.log(`   • 12 měsíců bankovních výpisů (červen 2025 – květen 2026)`)
  console.log(`   • ${calCount} kalendářních událostí`)
  console.log(`\n⚡ Další krok: spusť Drive sync v aplikaci:`)
  console.log(`   POST /api/cron/drive-sync  (nebo přes UI)`)
  console.log('\n🎯 Demo scénáře:')
  console.log('   1. "Kdo nezaplatil nájem v květnu?" → NEMO_012, 022, 066, 073, 107')
  console.log('   2. "Jaký je stav prodeje na Smíchově?" → NEMO_048 V-1234/2026')
  console.log('   3. "Vygeneruj kupní smlouvu pro Karlín" → NEMO_083 blokováno hypotékou')
}

main().catch(e => { console.error('❌ Chyba:', e.message); process.exit(1) })

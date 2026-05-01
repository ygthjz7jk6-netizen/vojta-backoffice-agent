export interface LocalityResult {
  locationName: string
  districtId?: number
  regionId?: number
}

// Praha districts
const PRAGUE_DISTRICTS: { keywords: string[]; districtId: number; name: string }[] = [
  { keywords: ['holešovice', 'letná', 'troja', 'bubeneč', 'praha 7', 'praha7'], districtId: 5007, name: 'Praha 7' },
  { keywords: ['vinohrady', 'nusle', 'nové město', 'Praha 2', 'Praha2'], districtId: 5002, name: 'Praha 2' },
  { keywords: ['žižkov', 'Praha 3', 'Praha3'], districtId: 5003, name: 'Praha 3' },
  { keywords: ['smíchov', 'anděl', 'Praha 5', 'Praha5'], districtId: 5005, name: 'Praha 5' },
  { keywords: ['dejvice', 'Praha 6', 'Praha6'], districtId: 5006, name: 'Praha 6' },
  { keywords: ['karlín', 'libeň', 'Praha 8', 'Praha8'], districtId: 5008, name: 'Praha 8' },
  { keywords: ['Praha 9', 'Praha9', 'vysočany'], districtId: 5009, name: 'Praha 9' },
  { keywords: ['vršovice', 'strašnice', 'Praha 10', 'Praha10'], districtId: 5010, name: 'Praha 10' },
  { keywords: ['staré město', 'malá strana', 'Praha 1', 'Praha1'], districtId: 5001, name: 'Praha 1' },
  { keywords: ['krč', 'podolí', 'Praha 4', 'Praha4'], districtId: 5004, name: 'Praha 4' },
]

// Ostatní česká města — ověřené Sreality district IDs
const CITY_MAP: { keywords: string[]; districtId: number; regionId: number; name: string }[] = [
  // Jihomoravský (region 14)
  { keywords: ['brno'], districtId: 72, regionId: 14, name: 'Brno' },
  // Moravskoslezský (region 12)
  { keywords: ['ostrava'], districtId: 65, regionId: 12, name: 'Ostrava' },
  { keywords: ['havířov'], districtId: 62, regionId: 12, name: 'Havířov' },
  // Plzeňský (region 2)
  { keywords: ['plzeň', 'plzen'], districtId: 12, regionId: 2, name: 'Plzeň' },
  // Královéhradecký (region 6)
  { keywords: ['trutnov'], districtId: 36, regionId: 6, name: 'Trutnov' },
  { keywords: ['hradec králové', 'hradec kralove'], districtId: 34, regionId: 6, name: 'Hradec Králové' },
  { keywords: ['náchod', 'nachod'], districtId: 35, regionId: 6, name: 'Náchod' },
  { keywords: ['jičín', 'jicin'], districtId: 33, regionId: 6, name: 'Jičín' },
  // Pardubický (region 7)
  { keywords: ['pardubice'], districtId: 30, regionId: 7, name: 'Pardubice' },
  { keywords: ['chrudim'], districtId: 29, regionId: 7, name: 'Chrudim' },
  // Olomoucký (region 8)
  { keywords: ['olomouc'], districtId: 40, regionId: 8, name: 'Olomouc' },
  { keywords: ['šumperk', 'sumperk'], districtId: 44, regionId: 8, name: 'Šumperk' },
  // Zlínský (region 9)
  { keywords: ['zlín', 'zlin'], districtId: 46, regionId: 9, name: 'Zlín' },
  // Jihočeský (region 1)
  { keywords: ['české budějovice', 'ceske budejovice'], districtId: 5, regionId: 1, name: 'České Budějovice' },
  { keywords: ['tábor', 'tabor'], districtId: 7, regionId: 1, name: 'Tábor' },
  { keywords: ['písek', 'pisek'], districtId: 4, regionId: 1, name: 'Písek' },
  { keywords: ['strakonice'], districtId: 6, regionId: 1, name: 'Strakonice' },
  { keywords: ['jindřichův hradec', 'jindrichuv hradec'], districtId: 3, regionId: 1, name: 'Jindřichův Hradec' },
  { keywords: ['prachatice'], districtId: 5, regionId: 1, name: 'Prachatice' },
  { keywords: ['český krumlov', 'cesky krumlov'], districtId: 2, regionId: 1, name: 'Český Krumlov' },
  // Liberecký (region 5)
  { keywords: ['liberec'], districtId: 20, regionId: 5, name: 'Liberec' },
  // Karlovarský (region 3)
  { keywords: ['karlovy vary', 'mariánské lázně', 'marianske lazne'], districtId: 9, regionId: 3, name: 'Karlovarský kraj' },
  // Ústecký (region 4)
  { keywords: ['ústí nad labem', 'usti nad labem', 'teplice'], districtId: 16, regionId: 4, name: 'Ústí nad Labem' },
]

export function lookupLocality(query: string): LocalityResult {
  const q = normalize(query)

  // Praha first
  for (const entry of PRAGUE_DISTRICTS) {
    for (const kw of entry.keywords) {
      if (q.includes(normalize(kw)) || normalize(kw).includes(q)) {
        return { locationName: entry.name, districtId: entry.districtId }
      }
    }
  }

  // Ostatní města
  for (const entry of CITY_MAP) {
    for (const kw of entry.keywords) {
      if (q.includes(normalize(kw)) || normalize(kw).includes(q)) {
        return { locationName: entry.name, districtId: entry.districtId, regionId: entry.regionId }
      }
    }
  }

  // Neznámé město — dynamický lookup
  return { locationName: query }
}

// Dynamický lookup přes Sreality API pro neznámá města
export async function lookupLocalityDynamic(cityName: string): Promise<LocalityResult> {
  const known = lookupLocality(cityName)
  if (known.districtId) return { ...known, locationName: cityName }

  // Prohledej všechny regiony PARALELNĚ — stačí jedna nabídka z daného města
  const searches = Array.from({ length: 14 }, (_, i) =>
    findDistrictInRegion(cityName, i + 1).catch(() => null)
  )
  const results = await Promise.all(searches)
  const found = results.find(r => r !== null)

  if (found) return { locationName: cityName, districtId: found, regionId: results.indexOf(found) + 1 }

  // Nenalezeno
  return { locationName: cityName }
}

async function findDistrictInRegion(cityName: string, regionId: number): Promise<number | null> {
  const url = `https://www.sreality.cz/api/cs/v2/estates?category_main_cb=1&category_type_cb=1&locality_region_id=${regionId}&per_page=60`
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
    signal: AbortSignal.timeout(10000),
  })
  if (!res.ok) return null

  const data = await res.json() as { _embedded?: { estates?: { hash_id: number; locality: string }[] } }
  const estates = data._embedded?.estates ?? []

  const city = normalize(cityName)
  const match = estates.find(e => normalize(e.locality ?? '').includes(city))
  if (!match) return null

  const det = await fetch(`https://www.sreality.cz/api/cs/v2/estates/${match.hash_id}`, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
    signal: AbortSignal.timeout(5000),
  })
  if (!det.ok) return null

  const detail = await det.json() as { _links?: Record<string, { href?: string }> }
  // Hledej district ID ve všech link typech
  for (const key of ['broader_search', 'local_search', 'similar_adverts']) {
    const href = detail._links?.[key]?.href ?? ''
    const m = href.match(/locality_district_id=(\d+)/)
    if (m) return parseInt(m[1])
  }
  return null
}

function normalize(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()
}

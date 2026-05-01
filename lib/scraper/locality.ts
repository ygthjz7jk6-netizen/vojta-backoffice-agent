export interface LocalityResult {
  locationName: string
  districtId?: number      // Praha districts only (5001–5010)
  municipalityId?: number  // Sreality municipality ID for všechna ostatní města
}

// Praha districts — district ID je dostatečně přesný (= celý obvod)
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

// Hint mapa: pro známá města víme ve kterém regionu hledat → single-region lookup místo 14 paralelních
const REGION_HINTS: { keywords: string[]; regionId: number }[] = [
  { keywords: ['brno'], regionId: 14 },
  { keywords: ['ostrava', 'havířov', 'havírov', 'opava', 'karviná'], regionId: 12 },
  { keywords: ['plzeň', 'plzen'], regionId: 2 },
  { keywords: ['trutnov', 'vrchlabí', 'vrchlabi', 'hradec králové', 'hradec kralove', 'náchod', 'nachod', 'jičín', 'jicin'], regionId: 6 },
  { keywords: ['pardubice', 'chrudim'], regionId: 7 },
  { keywords: ['olomouc', 'šumperk', 'sumperk', 'přerov'], regionId: 8 },
  { keywords: ['zlín', 'zlin'], regionId: 9 },
  { keywords: ['české budějovice', 'ceske budejovice', 'tábor', 'tabor', 'písek', 'pisek', 'strakonice', 'prachatice', 'jindřichův hradec', 'český krumlov'], regionId: 1 },
  { keywords: ['liberec'], regionId: 5 },
  { keywords: ['karlovy vary', 'mariánské lázně', 'marianske lazne', 'cheb'], regionId: 3 },
  { keywords: ['ústí nad labem', 'usti nad labem', 'teplice', 'most', 'chomutov', 'děčín', 'decin'], regionId: 4 },
  { keywords: ['jihlava', 'třebíč', 'trebic', 'znojmo'], regionId: 13 },
  { keywords: ['kladno', 'mladá boleslav', 'mlada boleslav', 'příbram', 'pribram', 'kolín', 'kolin'], regionId: 11 },
]

export function lookupLocality(query: string): LocalityResult {
  const q = normalize(query)

  for (const entry of PRAGUE_DISTRICTS) {
    for (const kw of entry.keywords) {
      if (q.includes(normalize(kw)) || normalize(kw).includes(q)) {
        return { locationName: entry.name, districtId: entry.districtId }
      }
    }
  }

  return { locationName: query }
}

// Dynamický lookup přes Sreality API — vždy vrátí municipality ID
export async function lookupLocalityDynamic(cityName: string): Promise<LocalityResult> {
  // Praha — district ID stačí
  const known = lookupLocality(cityName)
  if (known.districtId) return known

  // Zjisti jestli víme v jakém regionu hledat (rychlejší)
  const q = normalize(cityName)
  const hint = REGION_HINTS.find(h => h.keywords.some(kw => q.includes(normalize(kw)) || normalize(kw).includes(q)))

  const regionsToSearch = hint
    ? [hint.regionId]
    : Array.from({ length: 14 }, (_, i) => i + 1)

  const searches = regionsToSearch.map(r => findMunicipalityInRegion(cityName, r).catch(() => null))
  const results = await Promise.all(searches)
  const found = results.find(r => r !== null)

  if (found) return { locationName: cityName, municipalityId: found }

  return { locationName: cityName }
}

async function findMunicipalityInRegion(cityName: string, regionId: number): Promise<number | null> {
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

  // local_search má nejjemnější granularitu — municipality ID (locality_region_id=2949)
  const localHref = detail._links?.['local_search']?.href ?? ''
  const mLocal = localHref.match(/locality_region_id=(\d+)/)
  if (mLocal) return parseInt(mLocal[1])

  // Fallback: broader links mohou mít locality_region_id nebo locality_district_id
  for (const key of ['broader_search', 'similar_adverts']) {
    const href = detail._links?.[key]?.href ?? ''
    const m = href.match(/locality_region_id=(\d+)/)
    if (m) return parseInt(m[1])
  }

  return null
}

function normalize(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()
}

export interface LocalityResult {
  locationName: string
  districtId?: number  // pouze Praha (5001–5010)
  verified?: boolean   // pro ostatní města: potvrzeno že existuje na Sreality
}

// Praha districts
const PRAGUE_DISTRICTS: { keywords: string[]; districtId: number; name: string }[] = [
  { keywords: ['holešovice', 'letná', 'troja', 'bubeneč', 'praha 7', 'praha7'], districtId: 5007, name: 'Praha 7' },
  { keywords: ['vinohrady', 'nusle', 'nové město', 'praha 2', 'praha2'], districtId: 5002, name: 'Praha 2' },
  { keywords: ['žižkov', 'praha 3', 'praha3'], districtId: 5003, name: 'Praha 3' },
  { keywords: ['smíchov', 'anděl', 'praha 5', 'praha5'], districtId: 5005, name: 'Praha 5' },
  { keywords: ['dejvice', 'praha 6', 'praha6'], districtId: 5006, name: 'Praha 6' },
  { keywords: ['karlín', 'libeň', 'praha 8', 'praha8'], districtId: 5008, name: 'Praha 8' },
  { keywords: ['praha 9', 'praha9', 'vysočany'], districtId: 5009, name: 'Praha 9' },
  { keywords: ['vršovice', 'strašnice', 'praha 10', 'praha10'], districtId: 5010, name: 'Praha 10' },
  { keywords: ['staré město', 'malá strana', 'praha 1', 'praha1'], districtId: 5001, name: 'Praha 1' },
  { keywords: ['krč', 'podolí', 'praha 4', 'praha4'], districtId: 5004, name: 'Praha 4' },
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

export async function lookupLocalityDynamic(cityName: string): Promise<LocalityResult> {
  // Praha — district ID stačí, žádný API call
  const known = lookupLocality(cityName)
  if (known.districtId) return known

  // Ostatní města — ověř přes osmm endpoint
  const url = `https://www.sreality.cz/api/cs/v2/estates?category_main_cb=1&category_type_cb=1&region=${encodeURIComponent(cityName)}&region_entity_type=osmm&per_page=1`
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) return { locationName: cityName }
    const data = await res.json() as { result_size?: number }
    if ((data.result_size ?? 0) > 0) {
      return { locationName: cityName, verified: true }
    }
  } catch {
    // timeout nebo síťová chyba
  }

  return { locationName: cityName }
}

function normalize(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()
}

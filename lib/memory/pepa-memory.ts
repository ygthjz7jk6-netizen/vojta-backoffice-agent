import { supabaseAdmin } from '@/lib/supabase/client'
import { embedText } from '@/lib/memory/embed'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { generateText } from 'ai'
import { createGoogleGenerativeAI } from '@ai-sdk/google'

export interface PepaMemory {
  id: string
  fact: string
  category: string
  strength: number
  last_used_at: string
  similarity?: number
  score?: number
}

type ExtractedMemory = {
  fact: string
  category: 'preference' | 'habit' | 'decision' | 'context' | 'person'
}

const MEMORY_CATEGORIES = new Set(['preference', 'habit', 'decision', 'context', 'person'])

const EXTRACTION_PROMPT = `Analyzuj zprávu od uživatele (Pepa, back office manager realitní firmy).
Extrahuj POUZE fakty které stojí za dlouhodobé zapamatování.

ZAPAMATUJ (preference, zvyky, rozhodnutí, osobní kontext, info o klíčových osobách):
- "reporty chci vždy v pondělí" → habit
- "s Novákem jednej vždy formálně" → person
- "přestáváme propagovat byty nad 5M" → decision
- "mám dovolenou od 10. do 20. června" → context
- "nechci v reportech vidět grafy, jen čísla" → preference

NEZAPAMATOVÁVEJ:
- Dotazy na data dohledatelná v DB nebo dokumentech ("kolik leadů máme?")
- Jednorázové instrukce bez trvalé hodnoty ("udělej mi teď report")
- Odpovědi nebo akce agenta

Odpověz POUZE jako JSON array. Pokud není co zapamatovat, vrať [].
Příklad: [{"fact": "Reporty chce Pepa vždy v pondělí ráno", "category": "habit"}]

Zpráva: `

export async function extractAndSaveMemories(userMessage: string, accessToken?: string | null): Promise<void> {
  try {
    let text = ''
    
    // Použití Vertex AI, pokud máme accessToken
    if (accessToken && process.env.GOOGLE_CLOUD_PROJECT) {
      const projectId = process.env.GOOGLE_CLOUD_PROJECT
      const location = process.env.GOOGLE_VERTEX_LOCATION || 'us-central1'
      const vertexProvider = createGoogleGenerativeAI({
        apiKey: 'unused',
        fetch: async (input, init) => {
          const fetchInit = { ...init }
          const urlStr = input.toString()
          const newUrl = urlStr.replace(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash`,
            `https://${location}-aiplatform.googleapis.com/v1beta1/projects/${projectId}/locations/${location}/publishers/google/models/gemini-2.5-flash`
          )
          const headers = new Headers(fetchInit.headers)
          headers.set('Authorization', `Bearer ${accessToken}`)
          headers.delete('x-goog-api-key')
          fetchInit.headers = headers
          
          let res: Response | undefined;
          for (let attempt = 0; attempt <= 3; attempt++) {
            res = await fetch(newUrl, fetchInit)
            if (res.status === 429) {
              if (attempt === 3) break;
              const delay = 3000 * Math.pow(2, attempt) + Math.random() * 1000;
              console.warn(`Vertex AI 429 (memory). Retrying in ${Math.round(delay)}ms...`);
              await new Promise(r => setTimeout(r, delay));
              continue;
            }
            break;
          }

          if (!res!.ok) {
            const err = await res!.clone().text().catch(() => '')
            console.error(`Vertex AI Memory Extract Error: ${res!.status}`, err.slice(0, 1000))
          }
          return res!
        }
      })

      const { text: generatedText } = await generateText({
        model: vertexProvider('gemini-2.5-flash'),
        prompt: EXTRACTION_PROMPT + userMessage,
        temperature: 0,
      })
      text = generatedText.trim()
    } else {
      // Fallback AI Studio Limit free-tier
      if (!process.env.GOOGLE_AI_API_KEY) return
      const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY!)
      const model = genAI.getGenerativeModel({
        model: 'gemini-2.5-flash',
        generationConfig: {
          temperature: 0,
          responseMimeType: 'application/json',
        },
      })
      const result = await model.generateContent(EXTRACTION_PROMPT + userMessage)
      text = result.response.text().trim()
    }

    const jsonMatch = text.match(/\[[\s\S]*\]/)
    if (!jsonMatch) return

    const facts = parseExtractedMemories(jsonMatch[0])
    if (!facts.length) return

    await Promise.all(facts.map(({ fact, category }) => upsertMemory(fact, category)))
  } catch (err) {
    // Best-effort, nikdy neblokuje hlavní flow
    console.error('MEMORY EXTRACTION ERR:', err)
  }
}

function parseExtractedMemories(json: string): ExtractedMemory[] {
  const parsed = JSON.parse(json)
  if (!Array.isArray(parsed)) return []

  return parsed
    .map(item => ({
      fact: typeof item?.fact === 'string' ? item.fact.trim() : '',
      category: typeof item?.category === 'string' ? item.category.trim() : '',
    }))
    .filter((item): item is ExtractedMemory =>
      item.fact.length > 0 &&
      item.fact.length <= 500 &&
      MEMORY_CATEGORIES.has(item.category)
    )
    .slice(0, 5)
}

async function upsertMemory(fact: string, category: ExtractedMemory['category']): Promise<void> {
  const embedding = await embedText(fact)

  // Zkontroluj zda podobný fakt už existuje (threshold 0.92)
  const { data: similar } = await supabaseAdmin.rpc('search_memories', {
    query_embedding: embedding,
    match_count: 1,
    min_similarity: 0.92,
  })

  if (similar?.length) {
    // Posil existující paměť
    const existing = similar[0] as PepaMemory
    await supabaseAdmin
      .from('pepa_memory')
      .update({
        fact,
        category,
        strength: Math.min(1.0, existing.strength + 0.2),
        last_used_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id)
  } else {
    await supabaseAdmin.from('pepa_memory').insert({ fact, category, embedding, strength: 1.0 })
  }
}

export async function loadRelevantMemories(query: string, limit = 8): Promise<PepaMemory[]> {
  try {
    const embedding = await embedText(query)

    const { data } = await supabaseAdmin.rpc('search_memories', {
      query_embedding: embedding,
      match_count: limit,
      min_similarity: 0.65,
    })

    if (!data?.length) return []

    // Použitá paměť lehce zesílí, aby se často relevantní fakta držela při životě.
    const ids = (data as PepaMemory[]).map(m => m.id)
    await supabaseAdmin.rpc('reinforce_pepa_memories', {
      memory_ids: ids,
      boost: 0.08,
    })

    return data as PepaMemory[]
  } catch {
    return []
  }
}

export async function decayMemories(): Promise<void> {
  await supabaseAdmin.rpc('decay_pepa_memories', {
    decay_factor: 0.9771599684342459,
    delete_threshold: 0.1,
  })
}

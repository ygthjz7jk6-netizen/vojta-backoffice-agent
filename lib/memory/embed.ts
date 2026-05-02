const EMBED_MODEL = 'gemini-embedding-001'
const EMBED_DIMENSIONS = 768
const MAX_RETRIES = 4
const INITIAL_DELAY_MS = 2000

export async function embedText(text: string): Promise<number[]> {
  const apiKey = process.env.GOOGLE_AI_API_KEY!
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${EMBED_MODEL}:embedContent?key=${apiKey}`

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: `models/${EMBED_MODEL}`,
        content: { parts: [{ text }] },
        outputDimensionality: EMBED_DIMENSIONS,
      }),
    })

    // Rate limit — čekej a zkus znovu
    if (res.status === 429) {
      if (attempt === MAX_RETRIES) throw new Error('Embedding API 429: rate limit, zkus znovu za chvíli.')
      const delay = INITIAL_DELAY_MS * Math.pow(2, attempt) // 2s, 4s, 8s, 16s
      await new Promise(r => setTimeout(r, delay))
      continue
    }

    if (!res.ok) {
      const err = await res.text().catch(() => '')
      throw new Error(`Embedding API ${res.status}: ${err.slice(0, 200)}`)
    }

    const data: { embedding?: { values?: number[] } } = await res.json()
    const values = data?.embedding?.values
    if (!Array.isArray(values)) {
      throw new Error(`Embedding API: neočekávaný formát — ${JSON.stringify(data).slice(0, 100)}`)
    }
    return values
  }

  throw new Error('Embedding API: překročen počet pokusů.')
}

export async function embedBatch(texts: string[]): Promise<number[][]> {
  return Promise.all(texts.map(embedText))
}

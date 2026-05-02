const EMBED_MODEL = 'gemini-embedding-001'

export async function embedText(text: string): Promise<number[]> {
  const apiKey = process.env.GOOGLE_AI_API_KEY!
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${EMBED_MODEL}:embedContent?key=${apiKey}`

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: `models/${EMBED_MODEL}`,
      content: { parts: [{ text }] },
    }),
  })

  if (!res.ok) {
    const err = await res.text().catch(() => '')
    throw new Error(`Embedding API ${res.status}: ${err.slice(0, 200)}`)
  }

  const data: { embedding?: { values?: number[] } } = await res.json()
  const values = data?.embedding?.values
  if (!Array.isArray(values)) {
    throw new Error(`Embedding API: neočekávaný formát odpovědi — ${JSON.stringify(data).slice(0, 100)}`)
  }
  return values
}

export async function embedBatch(texts: string[]): Promise<number[][]> {
  return Promise.all(texts.map(embedText))
}

const EMBED_MODEL = 'gemini-embedding-001'

export async function embedText(text: string): Promise<number[]> {
  const apiKey = process.env.GOOGLE_AI_API_KEY!
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${EMBED_MODEL}:embedContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: `models/${EMBED_MODEL}`,
        content: { parts: [{ text }], role: 'user' },
        outputDimensionality: 768,
      }),
    }
  )
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Embedding API ${res.status}: ${err.slice(0, 200)}`)
  }
  const data = await res.json()
  return data.embedding.values as number[]
}

export async function embedBatch(texts: string[]): Promise<number[][]> {
  return Promise.all(texts.map(embedText))
}

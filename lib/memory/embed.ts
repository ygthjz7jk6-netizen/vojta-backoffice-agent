import { GoogleGenerativeAI } from '@google/generative-ai'

function getGenAI() {
  return new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY!)
}

const EMBED_REQUEST = (text: string) => ({
  content: { parts: [{ text }], role: 'user' as const },
  outputDimensionality: 768,
})

export async function embedText(text: string): Promise<number[]> {
  const model = getGenAI().getGenerativeModel({ model: 'gemini-embedding-001' })
  const result = await model.embedContent(EMBED_REQUEST(text))
  return result.embedding.values
}

export async function embedBatch(texts: string[]): Promise<number[][]> {
  const model = getGenAI().getGenerativeModel({ model: 'gemini-embedding-001' })
  const results = await Promise.all(texts.map(t => model.embedContent(EMBED_REQUEST(t))))
  return results.map(r => r.embedding.values)
}

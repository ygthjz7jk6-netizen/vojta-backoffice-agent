import { supabaseAdmin } from '@/lib/supabase/client'
import { generateText } from 'ai'
import { createGoogleGenerativeAI } from '@ai-sdk/google'

export async function categorizeUploadedFile(
  fileId: string,
  fileName: string,
  textSample: string,
  accessToken?: string | null
): Promise<void> {
  try {
    const { data: files } = await supabaseAdmin
      .from('uploaded_files')
      .select('category')
      .not('category', 'is', null)
      .neq('id', fileId)
      .eq('status', 'ready')

    const existingCategories = [
      ...new Set((files ?? []).map(f => f.category).filter(Boolean) as string[]),
    ]

    const categoriesHint = existingCategories.length > 0
      ? `Existující kategorie (použij pokud pasuje): ${existingCategories.map(c => `"${c}"`).join(', ')}\n\n`
      : ''

    const prompt = `${categoriesHint}Zařaď dokument do kategorie. Odpověz POUZE názvem kategorie (1–3 slova česky, bez uvozovek).

Název souboru: ${fileName}
Ukázka obsahu: ${textSample.slice(0, 600)}`

    let category: string | null = null

    if (accessToken && process.env.GOOGLE_CLOUD_PROJECT) {
      const projectId = process.env.GOOGLE_CLOUD_PROJECT
      const location = process.env.GOOGLE_VERTEX_LOCATION || 'us-central1'
      
      const vertexProvider = createGoogleGenerativeAI({
        apiKey: 'unused', // Vertex AI s OAuth accessToken nepotřebuje AI Studio klíč
        fetch: async (input, init) => {
          const fetchInit = { ...init }
          const urlStr = input.toString()
          // Přepíšeme AI Studio URL na Vertex AI URL pro aktuální projekt a region
          const newUrl = urlStr.replace(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash`,
            `https://${location}-aiplatform.googleapis.com/v1beta1/projects/${projectId}/locations/${location}/publishers/google/models/gemini-2.5-flash`
          )
          
          const headers = new Headers(fetchInit.headers)
          headers.set('Authorization', `Bearer ${accessToken}`)
          headers.delete('x-goog-api-key')
          fetchInit.headers = headers
          
          const res = await fetch(newUrl, fetchInit)
          if (!res.ok) {
            const err = await res.clone().text().catch(() => '')
            console.error(`Vertex AI Categorize Error ${res.status}:`, err.slice(0, 1000))
          }
          return res
        }
      })

      const { text } = await generateText({
        model: vertexProvider('gemini-2.5-flash'),
        prompt,
        temperature: 0.1,
      })
      category = text.trim().slice(0, 60)
    } else {
      const apiKey = process.env.GOOGLE_AI_API_KEY
      if (apiKey) {
        const googleProvider = createGoogleGenerativeAI({ apiKey })
        const { text } = await generateText({
          model: googleProvider('gemini-2.5-flash'),
          prompt,
          temperature: 0.1,
        })
        category = text.trim().slice(0, 60)
      }
    }

    if (category) {
      await supabaseAdmin.from('uploaded_files').update({ category }).eq('id', fileId)
    }
  } catch (err) {
    console.error('AI Categorization failed:', err instanceof Error ? err.message : String(err))
  }
}

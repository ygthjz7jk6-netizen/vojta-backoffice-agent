import { supabaseAdmin } from '@/lib/supabase/client'

const GEMMA_MODEL = 'gemma-4-26b-a4b-it-maas'

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

    const category = accessToken
      ? await callVertexGemma(accessToken, prompt)
      : await callAiStudio(prompt)

    if (category) {
      await supabaseAdmin.from('uploaded_files').update({ category }).eq('id', fileId)
    }
  } catch {
    // best-effort, neblokuj upload
  }
}

async function callVertexGemma(accessToken: string, prompt: string): Promise<string | null> {
  const projectId = process.env.GOOGLE_CLOUD_PROJECT
  if (!projectId) return callAiStudio(prompt)

  const url = `https://aiplatform.googleapis.com/v1/projects/${projectId}/locations/global/publishers/google/models/${GEMMA_MODEL}:generateContent`

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generation_config: { temperature: 0.1, max_output_tokens: 50 },
    }),
  })

  if (!res.ok) {
    // Fallback na AI Studio při auth chybě
    return callAiStudio(prompt)
  }

  const json = await res.json()
  return json?.candidates?.[0]?.content?.parts?.[0]?.text?.trim()?.slice(0, 60) ?? null
}

async function callAiStudio(prompt: string): Promise<string | null> {
  const apiKey = process.env.GOOGLE_AI_API_KEY
  if (!apiKey) return null

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    }
  )

  if (!res.ok) return null
  const json = await res.json()
  return json?.candidates?.[0]?.content?.parts?.[0]?.text?.trim()?.slice(0, 60) ?? null
}

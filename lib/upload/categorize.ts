import { supabaseAdmin } from '@/lib/supabase/client'

export async function categorizeUploadedFile(
  fileId: string,
  fileName: string,
  textSample: string
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

    const apiKey = process.env.GOOGLE_AI_API_KEY
    if (!apiKey) return

    const categoriesHint = existingCategories.length > 0
      ? `Existující kategorie (použij pokud pasuje): ${existingCategories.map(c => `"${c}"`).join(', ')}\n\n`
      : ''

    const prompt = `${categoriesHint}Zařaď dokument do kategorie. Odpověz POUZE názvem kategorie (1–3 slova česky, bez uvozovek).

Název souboru: ${fileName}
Ukázka obsahu: ${textSample.slice(0, 600)}`

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      }
    )

    const json = await res.json()
    const category = json?.candidates?.[0]?.content?.parts?.[0]?.text?.trim()?.slice(0, 60)
    if (category) {
      await supabaseAdmin.from('uploaded_files').update({ category }).eq('id', fileId)
    }
  } catch {
    // best-effort, neblokuj upload
  }
}

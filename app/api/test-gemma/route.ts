import { auth } from '@/auth'

export async function GET() {
  const session = await auth()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const accessToken = session.accessToken
  const projectId = process.env.GOOGLE_CLOUD_PROJECT

  if (!accessToken || !projectId) {
    return Response.json({ error: 'Chybí accessToken nebo GOOGLE_CLOUD_PROJECT' }, { status: 400 })
  }

  const model = 'gemma-4-26b-a4b-it-maas'
  const url = `https://aiplatform.googleapis.com/v1/projects/${projectId}/locations/global/publishers/google/models/${model}:generateContent`

  const body = {
    contents: [{ role: 'user', parts: [{ text: 'Odpověz jednou větou česky: Kdo jsi a jaký model jsi?' }] }],
    generation_config: { temperature: 0.1, max_output_tokens: 100 },
  }

  const start = Date.now()
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  const latency = Date.now() - start
  const json = await res.json()

  if (!res.ok) {
    return Response.json({ ok: false, status: res.status, error: json, url, model }, { status: 200 })
  }

  const text = json?.candidates?.[0]?.content?.parts?.[0]?.text ?? '(prázdná odpověď)'
  return Response.json({ ok: true, model, latency_ms: latency, response: text, raw: json })
}

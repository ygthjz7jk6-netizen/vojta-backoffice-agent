// @ts-nocheck
import { buildSystemPrompt } from './prompt'
import { getPepaProfile } from '@/lib/memory/pepa-profile'
import { loadRelevantMemories } from '@/lib/memory/pepa-memory'
import { getTools } from '@/lib/tools/index'
import { streamText } from 'ai'
import { createGoogleGenerativeAI } from '@ai-sdk/google'

export async function runAgentStream(
  messages: any[],
  accessToken?: string | null,
  onFinishCallback?: (data: { text: string; toolCalls: any[]; citations: any[] }) => Promise<void>
) {
  const currentMessage = messages[messages.length - 1]?.content || ''
  
  const [profile, memories] = await Promise.all([
    getPepaProfile(),
    loadRelevantMemories(currentMessage),
  ])

  const systemPrompt = buildSystemPrompt(profile, memories)
  const projectId = process.env.GOOGLE_CLOUD_PROJECT
  const useVertex = !!accessToken && !!projectId

  // @ai-sdk/google s custom fetch pro Vertex AI
  // - Pokud máme OAuth Bearer token, přesměrujeme na Vertex v1beta1 (kompatibilní s AI Studio payload formátem)
  // - Odstraňujeme x-goog-api-key header (Vertex ho odmítá)
  // - Bez fallbacku na AI Studio (aby se nespotřebovávala kvóta)
  const provider = createGoogleGenerativeAI({
    apiKey: process.env.GOOGLE_AI_API_KEY || 'unused-for-vertex',
    fetch: useVertex
      ? async (input, init) => {
          const vertexUrl = `https://us-central1-aiplatform.googleapis.com/v1beta1/projects/${projectId}/locations/us-central1/publishers/google/models/gemini-2.5-flash:streamGenerateContent?alt=sse`
          const headers = new Headers(init?.headers)
          headers.set('Authorization', `Bearer ${accessToken}`)
          headers.delete('x-goog-api-key')
          const res = await fetch(vertexUrl, { ...init, headers })
          if (!res.ok) {
            // Logujeme chybu bez čtení body (body si přečte SDK)
            console.error(`Vertex AI error ${res.status}`)
          }
          return res
        }
      : undefined, // Pro AI Studio necháme výchozí fetch
  })

  // Filtrování PPTX slides_spec z tool výsledků v historii (prevence timeoutu 60s)
  const filteredMessages = messages.map(msg => {
    if (msg.role !== 'tool') return msg
    if (Array.isArray(msg.content)) {
      return {
        ...msg,
        content: msg.content.map((part: any) => {
          if (part.type === 'tool-result' && part.toolName === 'create_presentation') {
            const res = part.result
            if (res?.slides_spec) {
              return { ...part, result: { ...res, slides_spec: '[ZKRÁCENO V HISTORII PRO ÚSPORU KONTEXTU]' } }
            }
          }
          return part
        })
      }
    }
    return msg
  })

  const result = streamText({
    model: provider('gemini-2.5-flash', { useStructuredOutputs: false }),
    system: systemPrompt,
    messages: filteredMessages,
    tools: getTools(accessToken),
    maxSteps: 5,
    temperature: 0.1,
    onFinish: async ({ text, toolCalls, toolResults }) => {
      if (!onFinishCallback) return
      const citations: any[] = []
      for (const res of (toolResults || []) as any[]) {
        if (res.result && typeof res.result === 'object' && 'citations' in res.result) {
          citations.push(...res.result.citations)
        }
      }
      await onFinishCallback({ text, toolCalls: toolCalls || [], citations })
    }
  })

  return result
}

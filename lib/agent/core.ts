import { buildSystemPrompt } from './prompt'
import { getPepaProfile } from '@/lib/memory/pepa-profile'
import { loadRelevantMemories } from '@/lib/memory/pepa-memory'
import { getTools } from '@/lib/tools/index'
import { streamText, type CoreMessage } from 'ai'
import { createGoogleGenerativeAI } from '@ai-sdk/google'

export async function runAgentStream(
  messages: CoreMessage[],
  accessToken?: string | null,
  onFinishCallback?: (data: { text: string; toolCalls: any[]; citations: any[] }) => Promise<void>
) {
  // Poslední zpráva od uživatele pro RAG vyhledávání do paměti
  const currentMessage = messages[messages.length - 1]?.content || ''
  
  const [profile, memories] = await Promise.all([
    getPepaProfile(),
    loadRelevantMemories(currentMessage),
  ])

  const systemPrompt = buildSystemPrompt(profile, memories)
  const projectId = process.env.GOOGLE_CLOUD_PROJECT

  const useVertex = !!accessToken && !!projectId

  // Definice Vercel AI providera s custom fetchem pro podporu Vertex OAuth Bearer Tokenu
  const customGoogleProvider = createGoogleGenerativeAI({
    apiKey: process.env.GOOGLE_AI_API_KEY || 'no-key',
    fetch: async (input, init) => {
      let fetchUrl = input
      let fetchInit = { ...init }

      if (useVertex) {
        // Přepis na Vertex AI endpoint pro streaming
        // Vercel AI SDK používá SSE endpoint gemini-2.5-flash:streamGenerateContent?alt=sse
        fetchUrl = `https://us-central1-aiplatform.googleapis.com/v1/projects/${projectId}/locations/us-central1/publishers/google/models/gemini-2.5-flash:streamGenerateContent?alt=sse`
        
        const headers = new Headers(init?.headers)
        headers.set('Authorization', `Bearer ${accessToken}`)
        fetchInit = { ...init, headers }
      }

      const res = await fetch(fetchUrl, fetchInit)
      
      // Fallback na AI Studio: pokud Vertex selže (např. 401 nebo 403), zkusíme AI studio
      if (useVertex && !res.ok) {
        const errText = await res.text()
        console.warn(`Vertex AI selhal (${res.status}: ${errText.slice(0, 50)}). Fallback na AI Studio.`)
        return fetch(input, init)
      }
      return res
    }
  })

  // Odstranění PPTX Slides Specs z historie (kvůli timeout limitu 60s)
  const filteredMessages = messages.map(msg => {
    if (!msg.toolInvocations) return msg

    const cleanedInvocations = msg.toolInvocations.map((inv: any) => {
      if (inv.toolName === 'create_presentation' && inv.state === 'result') {
        const res = inv.result as any
        if (res?.slides_spec) {
          return {
            ...inv,
            result: {
              ...res,
              slides_spec: '[ZKRÁCENO V HISTORII PRO ÚSPORU KONTEXTU]'
            }
          }
        }
      }
      return inv
    })

    return { ...msg, toolInvocations: cleanedInvocations }
  })

  // Zapojení Vercel AI streamText
  const result = streamText({
    model: customGoogleProvider('gemini-2.5-flash', { useStructuredOutputs: false }),
    system: systemPrompt,
    messages: filteredMessages,
    tools: getTools(accessToken),
    maxSteps: 5,
    temperature: 0.1,
    onFinish: async ({ text, toolCalls, toolResults }) => {
      if (!onFinishCallback) return
      
      // Extrakce citací z výsledků nástrojů (protože Citations byly původně vraceny společně s tool results)
      const citations: any[] = []
      for (const res of toolResults as any[]) {
         if (res.result && typeof res.result === 'object' && 'citations' in (res.result as any)) {
            citations.push(...(res.result as any).citations)
         }
      }
      
      await onFinishCallback({ text, toolCalls, citations })
    }
  })

  return result
}

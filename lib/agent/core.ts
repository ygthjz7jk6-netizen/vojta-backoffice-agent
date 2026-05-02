// @ts-nocheck
import { buildSystemPrompt } from './prompt'
import { getPepaProfile } from '@/lib/memory/pepa-profile'
import { loadRelevantMemories } from '@/lib/memory/pepa-memory'
import { getTools } from '@/lib/tools/index'
import { streamText } from 'ai'
import { createVertex } from '@ai-sdk/google-vertex'
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

  // Výběr modelu — pokud máme OAuth token, použijeme Vertex AI správně přes @ai-sdk/google-vertex
  // Jinak fallback na AI Studio (bez kvóty)
  let model: any
  if (useVertex) {
    const vertexProvider = createVertex({
      project: projectId,
      location: 'us-central1',
      // Přepijeme autorizační hlavičku Bearer tokenem z Google OAuth session
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    })
    model = vertexProvider('gemini-2.5-flash')
  } else {
    const googleProvider = createGoogleGenerativeAI({
      apiKey: process.env.GOOGLE_AI_API_KEY || '',
    })
    model = googleProvider('gemini-2.5-flash', { useStructuredOutputs: false })
  }

  // Filtrování PPTX slides_spec z historie zpráv (prevence timeoutu 60s)
  // CoreMessages mají content jako string nebo array, toolInvocations tam není —
  // filtrace se provede na základě tool výsledků v roli "tool"
  const filteredMessages = messages.map(msg => {
    if (msg.role !== 'tool') return msg
    
    // Zkrácení create_presentation výsledků v historii
    if (Array.isArray(msg.content)) {
      return {
        ...msg,
        content: msg.content.map((part: any) => {
          if (part.type === 'tool-result' && part.toolName === 'create_presentation') {
            const res = part.result
            if (res?.slides_spec) {
              return {
                ...part,
                result: { ...res, slides_spec: '[ZKRÁCENO V HISTORII PRO ÚSPORU KONTEXTU]' }
              }
            }
          }
          return part
        })
      }
    }
    return msg
  })

  const result = streamText({
    model,
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

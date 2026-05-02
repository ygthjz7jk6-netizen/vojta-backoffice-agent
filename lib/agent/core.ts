// @ts-nocheck
import { buildSystemPrompt } from './prompt'
import { getPepaProfile } from '@/lib/memory/pepa-profile'
import { loadRelevantMemories } from '@/lib/memory/pepa-memory'
import { getTools } from '@/lib/tools/index'
import { convertToModelMessages, streamText, stepCountIs } from 'ai'
import { createGoogleGenerativeAI } from '@ai-sdk/google'

function extractMessageText(message: any): string {
  if (!message) return ''
  if (typeof message.content === 'string') return message.content
  if (Array.isArray(message.parts)) {
    return message.parts
      .filter((part: any) => part.type === 'text' && typeof part.text === 'string')
      .map((part: any) => part.text)
      .join('\n')
  }
  return ''
}

export async function runAgentStream(
  messages: any[],
  accessToken?: string | null,
  onFinishCallback?: (data: { text: string; toolCalls: any[]; citations: any[] }) => Promise<void>
) {
  const currentMessage = extractMessageText(messages[messages.length - 1])
  
  const [profile, memories] = await Promise.all([
    getPepaProfile(),
    loadRelevantMemories(currentMessage),
  ])

  const systemPrompt = buildSystemPrompt(profile, memories)
  const projectId = process.env.GOOGLE_CLOUD_PROJECT
  const location = process.env.GOOGLE_VERTEX_LOCATION || 'us-central1'
  const tools = getTools(accessToken)

  if (!accessToken) {
    throw new Error('Chybí Google OAuth token. Přihlas se přes Google a zkus to znovu.')
  }
  if (!projectId) {
    throw new Error('Chybí GOOGLE_CLOUD_PROJECT pro Vertex AI.')
  }

  const provider = createGoogleGenerativeAI({
    apiKey: process.env.GOOGLE_AI_API_KEY || 'unused-for-vertex',
    fetch: async (input, init) => {
      const fetchInit = { ...init }

      if (typeof fetchInit.body === 'string') {
        try {
          const bodyJson = JSON.parse(fetchInit.body)
          if (bodyJson.tools && Array.isArray(bodyJson.tools)) {
            const fixTypes = (obj: any) => {
              if (obj && typeof obj === 'object') {
                if (obj.type && typeof obj.type === 'string') {
                  obj.type = obj.type.toUpperCase()
                }
                for (const key of Object.keys(obj)) {
                  fixTypes(obj[key])
                }
              }
            }
            for (const toolGroup of bodyJson.tools) {
              if (toolGroup.functionDeclarations && Array.isArray(toolGroup.functionDeclarations)) {
                for (const func of toolGroup.functionDeclarations) {
                  if (func.parameters && typeof func.parameters === 'object') {
                    fixTypes(func.parameters)
                  } else if (!func.parameters) {
                    func.parameters = { type: 'OBJECT', properties: {} }
                  }
                }
              }
            }
          }
          fetchInit.body = JSON.stringify(bodyJson)
        } catch (e) {
          console.error('Payload patching failed', e)
        }
      }

      const fetchUrl = `https://${location === 'global' ? '' : `${location}-`}aiplatform.googleapis.com/v1beta1/projects/${projectId}/locations/${location}/publishers/google/models/gemini-2.5-flash:streamGenerateContent?alt=sse`
      const headers = new Headers(fetchInit.headers)
      headers.set('Authorization', `Bearer ${accessToken}`)
      headers.delete('x-goog-api-key')
      fetchInit.headers = headers

      let res: Response | undefined;
      for (let attempt = 0; attempt <= 3; attempt++) {
        res = await fetch(fetchUrl, fetchInit)
        if (res.status === 429) {
          if (attempt === 3) break;
          const delay = 3000 * Math.pow(2, attempt) + Math.random() * 1000;
          console.warn(`Vertex AI 429 (core). Retrying in ${Math.round(delay)}ms...`);
          await new Promise(r => setTimeout(r, delay));
          continue;
        }
        break;
      }

      if (!res!.ok) {
        const errorBody = await res!.clone().text().catch(() => '')
        console.error(`Vertex AI error ${res!.status}: ${errorBody.slice(0, 1000)}`)
      }
      return res!
    },
  })

  const modelMessages = Array.isArray(messages) && messages.length > 0 && messages[0].role
    ? await convertToModelMessages(messages, { tools, ignoreIncompleteToolCalls: true })
    : messages

  // Filtrování PPTX slides_spec z tool výsledků v historii (prevence timeoutu 60s)
  const filteredMessages = modelMessages.map(msg => {
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
    model: provider('gemini-2.5-flash'),
    system: systemPrompt,
    messages: filteredMessages,
    tools,
    stopWhen: stepCountIs(5),
    temperature: 0.1,
    providerOptions: {
      google: {
        structuredOutputs: false,
      },
    },
    onFinish: async ({ text, toolCalls, toolResults }) => {
      if (!onFinishCallback) return
      const citations: any[] = []
      for (const res of (toolResults || []) as any[]) {
        const output = res.output ?? res.result
        if (output && typeof output === 'object' && 'citations' in output) {
          citations.push(...output.citations)
        }
      }
      await onFinishCallback({ text, toolCalls: toolCalls || [], citations })
    }
  })

  return result
}

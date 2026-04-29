import { VertexAI } from '@google-cloud/vertexai'
import { buildSystemPrompt } from './prompt'
import { getPepaProfile } from '@/lib/memory/pepa-profile'
import { getRecentMessages } from '@/lib/memory/episodic'
import { TOOLS } from '@/lib/tools/index'
import { handleToolCall } from '@/lib/tools/handlers'
import type { Citation } from '@/types'

function getVertexModel(accessToken: string) {
  const { GoogleAuth } = require('google-auth-library')
  const auth = new GoogleAuth({
    credentials: {
      type: 'authorized_user',
      // Použijeme OAuth access token jako Bearer
    },
  })
  // Přímé volání přes fetch s Bearer tokenem
  return null // viz níže
}

// Vertex AI REST volání s OAuth tokenem
async function callVertexAI(
  accessToken: string,
  projectId: string,
  messages: unknown[],
  systemInstruction: string,
  tools: unknown[]
): Promise<{ text: string; functionCalls: unknown[] }> {
  const model = 'gemini-2.5-flash-preview-04-17'
  const url = `https://us-central1-aiplatform.googleapis.com/v1/projects/${projectId}/locations/us-central1/publishers/google/models/${model}:generateContent`

  const body = {
    system_instruction: { parts: [{ text: systemInstruction }] },
    contents: messages,
    tools: [{ function_declarations: (tools[0] as { functionDeclarations: unknown[] }).functionDeclarations }],
    generation_config: { temperature: 0.1 },
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Vertex AI ${res.status}: ${err.slice(0, 300)}`)
  }

  const data = await res.json()
  const candidate = data.candidates?.[0]
  const parts = candidate?.content?.parts ?? []

  const text = parts.filter((p: { text?: string }) => p.text).map((p: { text: string }) => p.text).join('')
  const functionCalls = parts
    .filter((p: { functionCall?: unknown }) => p.functionCall)
    .map((p: { functionCall: { name: string; args: unknown } }) => ({
      name: p.functionCall.name,
      args: p.functionCall.args,
    }))

  return { text, functionCalls }
}

export async function runAgent(
  userMessage: string,
  sessionId: string,
  onChunk?: (text: string) => void,
  accessToken?: string | null
): Promise<{ text: string; citations: Citation[]; toolCalls: unknown[]; requiresApproval?: unknown }> {
  const [profile, recentMessages] = await Promise.all([
    getPepaProfile(),
    getRecentMessages(sessionId, 5),
  ])

  const systemPrompt = buildSystemPrompt(profile)
  const projectId = process.env.GOOGLE_CLOUD_PROJECT!

  // Sestavení historie
  const firstUserIdx = recentMessages.findIndex(m => m.role === 'user')
  const validMessages = firstUserIdx >= 0 ? recentMessages.slice(firstUserIdx) : []

  const history: unknown[] = []
  for (const msg of validMessages) {
    if (!msg.content?.trim()) continue
    history.push({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }],
    })
  }

  const allCitations: Citation[] = []
  const allToolCalls: unknown[] = []
  let requiresApproval: unknown = null
  let finalText = ''

  // Použij Vertex AI pokud má token + project, jinak fallback na AI Studio
  const useVertex = !!accessToken && !!projectId

  if (useVertex) {
    // Vertex AI přes OAuth token
    const messages = [...history, { role: 'user', parts: [{ text: userMessage }] }]

    for (let iteration = 0; iteration < 3; iteration++) {
      const { text, functionCalls } = await callVertexAI(
        accessToken!,
        projectId,
        messages,
        systemPrompt,
        TOOLS
      )

      if (!functionCalls.length) {
        finalText = text
        break
      }

      const toolResults = []
      for (const fc of functionCalls as { name: string; args: Record<string, unknown> }[]) {
        const { result: toolResult, citations } = await handleToolCall(fc.name, fc.args, accessToken)
        allCitations.push(...citations)
        allToolCalls.push({ name: fc.name, input: fc.args, output: toolResult })

        if (toolResult && typeof toolResult === 'object' && 'requires_approval' in toolResult) {
          requiresApproval = toolResult
        }

        toolResults.push({
          functionResponse: { name: fc.name, response: { result: toolResult } },
        })
      }

      // Přidej tool results do messages
      const typedFCs = functionCalls as { name: string; args: unknown }[]
      messages.push({ role: 'model', parts: typedFCs.map(fc => ({ functionCall: fc })) })
      messages.push({ role: 'user', parts: toolResults.map(r => ({ functionResponse: r.functionResponse })) })
    }
  } else {
    // Fallback: AI Studio
    const { GoogleGenerativeAI } = await import('@google/generative-ai')
    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY!)
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      systemInstruction: systemPrompt,
      tools: TOOLS,
    })

    const chatHistory = history as import('@google/generative-ai').Content[]
    const chat = model.startChat({ history: chatHistory })

    let currentMessage = userMessage
    for (let iteration = 0; iteration < 3; iteration++) {
      const result = await chat.sendMessage(currentMessage)
      const response = result.response
      const fcs = response.functionCalls()

      if (!fcs?.length) {
        finalText = response.text()
        break
      }

      const toolResults = []
      for (const fc of fcs) {
        const { result: toolResult, citations } = await handleToolCall(fc.name, fc.args as Record<string, unknown>, accessToken)
        allCitations.push(...citations)
        allToolCalls.push({ name: fc.name, input: fc.args, output: toolResult })
        if (toolResult && typeof toolResult === 'object' && 'requires_approval' in toolResult) requiresApproval = toolResult
        toolResults.push({ functionResponse: { name: fc.name, response: { result: toolResult } } })
      }

      const followUp = await chat.sendMessage(toolResults)
      finalText = followUp.response.text()
      if (!followUp.response.functionCalls()?.length) break
    }
  }

  if (onChunk) onChunk(finalText)
  return { text: finalText, citations: allCitations, toolCalls: allToolCalls, requiresApproval }
}

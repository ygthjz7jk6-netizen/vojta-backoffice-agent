import { GoogleGenerativeAI, type Content } from '@google/generative-ai'
import { buildSystemPrompt } from './prompt'
import { getPepaProfile } from '@/lib/memory/pepa-profile'
import { getRecentMessages } from '@/lib/memory/episodic'
import { TOOLS } from '@/lib/tools/index'
import { handleToolCall } from '@/lib/tools/handlers'
import type { Citation } from '@/types'

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY!)

export async function runAgent(
  userMessage: string,
  sessionId: string,
  onChunk?: (text: string) => void
): Promise<{ text: string; citations: Citation[]; toolCalls: unknown[]; requiresApproval?: unknown }> {
  // Pepa profil + posledních 5 zpráv session (bez episodické paměti — šetří čas)
  const [profile, recentMessages] = await Promise.all([
    getPepaProfile(),
    getRecentMessages(sessionId, 5),
  ])

  const systemPrompt = buildSystemPrompt(profile)

  const history: Content[] = []

  for (const msg of recentMessages) {
    history.push({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }],
    })
  }

  const model = genAI.getGenerativeModel({
    model: 'gemma-4-26b-a4b-it',
    systemInstruction: systemPrompt,
    tools: TOOLS,
  })

  const chat = model.startChat({ history })

  const allCitations: Citation[] = []
  const allToolCalls: unknown[] = []
  let requiresApproval: unknown = null
  let finalText = ''

  let currentMessage = userMessage
  for (let iteration = 0; iteration < 3; iteration++) {
    const result = await chat.sendMessage(currentMessage)
    const response = result.response

    const functionCalls = response.functionCalls()

    if (!functionCalls || functionCalls.length === 0) {
      finalText = response.text()
      break
    }

    const toolResults = []
    for (const fc of functionCalls) {
      const { result: toolResult, citations } = await handleToolCall(
        fc.name,
        fc.args as Record<string, unknown>
      )

      allCitations.push(...citations)
      allToolCalls.push({ name: fc.name, input: fc.args, output: toolResult })

      if (toolResult && typeof toolResult === 'object' && 'requires_approval' in toolResult) {
        requiresApproval = toolResult
      }

      toolResults.push({
        functionResponse: {
          name: fc.name,
          response: { result: toolResult },
        },
      })
    }

    const followUp = await chat.sendMessage(toolResults)
    finalText = followUp.response.text()

    if (!followUp.response.functionCalls()?.length) break
  }

  if (onChunk) onChunk(finalText)

  return {
    text: finalText,
    citations: allCitations,
    toolCalls: allToolCalls,
    requiresApproval,
  }
}

'use client'

import { useState, useRef, useEffect } from 'react'
import { MessageBubble } from './MessageBubble'
import { QuickActions } from './QuickActions'
import { ApprovalModal } from '@/components/approval/ApprovalModal'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Send, Loader2 } from 'lucide-react'
import { LoginButton } from '@/components/auth/LoginButton'
import type { AgentMessage } from '@/types'

export function ChatInterface() {
  const [messages, setMessages] = useState<AgentMessage[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [sessionId] = useState(() => {
    if (typeof window === 'undefined') return crypto.randomUUID()
    const stored = localStorage.getItem('agent_session_id')
    if (stored) return stored
    const id = crypto.randomUUID()
    localStorage.setItem('agent_session_id', id)
    return id
  })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [pendingApproval, setPendingApproval] = useState<Record<string, any> | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return

    const userMsg: AgentMessage = {
      id: Math.random().toString(36),
      role: 'user',
      content: text,
      created_at: new Date().toISOString(),
    }

    setMessages(prev => [...prev, userMsg])
    setInput('')
    setIsLoading(true)

    try {
      const res = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, sessionId }),
      })

      const data = await res.json()

      if (!res.ok) throw new Error(data.error)

      const agentMsg: AgentMessage = {
        id: Math.random().toString(36),
        role: 'assistant',
        content: data.text,
        sources: data.citations,
        tool_calls: data.toolCalls,
        requires_approval: data.requiresApproval,
        created_at: new Date().toISOString(),
      }

      setMessages(prev => [...prev, agentMsg])

      if (data.requiresApproval) {
        setPendingApproval(data.requiresApproval)
      }
    } catch {
      setMessages(prev => [...prev, {
        id: Math.random().toString(36),
        role: 'assistant',
        content: 'Omlouvám se, nastala chyba. Zkus to prosím znovu.',
        created_at: new Date().toISOString(),
      }])
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4 flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-sm">
          BA
        </div>
        <div>
          <h1 className="font-semibold text-gray-900">Back Office Agent</h1>
          <p className="text-xs text-gray-500">Realitní firma • NotebookLM režim</p>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <span className="w-2 h-2 rounded-full bg-green-500"></span>
          <span className="text-xs text-gray-500">Online</span>
          <LoginButton />
        </div>
      </div>

      {/* Quick Actions */}
      {messages.length === 0 && (
        <QuickActions onSelect={sendMessage} />
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.map(msg => (
          <MessageBubble key={msg.id} message={msg} />
        ))}
        {isLoading && (
          <div className="flex items-center gap-2 text-gray-500 text-sm">
            <Loader2 className="w-4 h-4 animate-spin" />
            Agent přemýšlí...
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="bg-white border-t px-4 py-4">
        <div className="flex gap-2 max-w-4xl mx-auto">
          <Textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Napiš dotaz nebo úkol pro agenta..."
            className="flex-1 min-h-[48px] max-h-[200px] resize-none"
            rows={1}
          />
          <Button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || isLoading}
            size="icon"
            className="h-12 w-12 bg-blue-600 hover:bg-blue-700"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
        <p className="text-center text-xs text-gray-400 mt-2">
          Agent vždy cituje zdroje • Nikdy nevymýšlí data
        </p>
      </div>

      {/* Approval Modal */}
      {pendingApproval && (
        <ApprovalModal
          request={pendingApproval}
          onConfirm={async () => {
            if (pendingApproval.type === 'monitoring') {
              await fetch('/api/monitoring/activate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(pendingApproval),
              })
            }
            setPendingApproval(null)
          }}
          onCancel={() => setPendingApproval(null)}
        />
      )}
    </div>
  )
}

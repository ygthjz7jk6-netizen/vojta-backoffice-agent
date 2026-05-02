'use client'

import { useState, useRef, useEffect } from 'react'
import { MessageBubble } from './MessageBubble'
import { QuickActions } from './QuickActions'
import { ApprovalModal } from '@/components/approval/ApprovalModal'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Send, Loader2, Paperclip } from 'lucide-react'
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
  const [uploadingFile, setUploadingFile] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

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

  const handleFileUpload = async (file: File) => {
    setUploadingFile(true)
    const uploadMsg: AgentMessage = {
      id: Math.random().toString(36),
      role: 'user',
      content: `Nahrávám soubor: **${file.name}**`,
      created_at: new Date().toISOString(),
    }
    setMessages(prev => [...prev, uploadMsg])

    try {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch('/api/upload', { method: 'POST', body: form })
      const data = await res.json()

      const resultMsg: AgentMessage = {
        id: Math.random().toString(36),
        role: 'assistant',
        content: res.ok
          ? `Soubor **${file.name}** byl nahrán a přidán do znalostní báze (${data.chunk_count} chunků). Kategorie se přiřadí automaticky. Teď se můžeš na soubor ptát.`
          : `Nepodařilo se nahrát soubor: ${data.error}`,
        created_at: new Date().toISOString(),
      }
      setMessages(prev => [...prev, resultMsg])
    } catch {
      setMessages(prev => [...prev, {
        id: Math.random().toString(36),
        role: 'assistant',
        content: 'Chyba při nahrávání souboru.',
        created_at: new Date().toISOString(),
      }])
    } finally {
      setUploadingFile(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  return (
    <div className="flex h-full flex-col bg-neutral-50">
      <div className="flex shrink-0 items-center gap-3 border-b border-neutral-200 bg-white px-4 py-3 md:px-6">
        <div>
          <h1 className="text-sm font-semibold text-neutral-950">Chat</h1>
          <p className="text-xs text-neutral-500">Pracovní konverzace s agentem</p>
        </div>
        {messages.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            className="ml-auto"
            onClick={() => {
              const id = crypto.randomUUID()
              localStorage.setItem('agent_session_id', id)
              window.location.reload()
            }}
          >
            Nový chat
          </Button>
        )}
      </div>

      {/* Quick Actions */}
      {messages.length === 0 && (
        <QuickActions onSelect={sendMessage} />
      )}

      {/* Messages */}
      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-5 md:px-6">
        {messages.map(msg => (
          <MessageBubble key={msg.id} message={msg} />
        ))}
        {isLoading && (
          <div className="mx-auto flex w-full max-w-4xl items-center gap-2 rounded-md border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-500">
            <Loader2 className="w-4 h-4 animate-spin" />
            Agent pracuje
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-neutral-200 bg-white px-4 py-4">
        <div className="mx-auto flex max-w-4xl gap-2">
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept=".pdf,.docx,.doc,.xlsx,.xls,.csv,.txt"
            onChange={e => {
              const file = e.target.files?.[0]
              if (file) handleFileUpload(file)
              e.target.value = ''
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-12 w-12 shrink-0 rounded-md"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadingFile || isLoading}
            title="Nahrát soubor do znalostní báze"
          >
            {uploadingFile ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
          </Button>
          <Textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Napiš dotaz nebo úkol pro agenta..."
            className="max-h-[200px] min-h-[48px] flex-1 resize-none rounded-md"
            rows={1}
          />
          <Button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || isLoading}
            size="icon"
            className="h-12 w-12 rounded-md bg-neutral-950 hover:bg-neutral-800"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Approval Modal */}
      {pendingApproval && (
        <ApprovalModal
          request={pendingApproval}
          onConfirm={async () => {
            if (pendingApproval.type === 'monitoring') {
              const res = await fetch('/api/monitoring/activate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(pendingApproval),
              })
              if (!res.ok) {
                const err = await res.json().catch(() => ({ error: 'Neznámá chyba' }))
                alert(`Chyba při nastavení monitoringu: ${err.error}`)
                return
              }
            }
            setPendingApproval(null)
          }}
          onCancel={() => setPendingApproval(null)}
        />
      )}
    </div>
  )
}

// @ts-nocheck
'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import { MessageBubble } from './MessageBubble'
import { QuickActions } from './QuickActions'
import { ApprovalModal } from '@/components/approval/ApprovalModal'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Send, Loader2, Paperclip, Plus, X } from 'lucide-react'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'

function makeLocalMessage(role: 'user' | 'assistant', text: string) {
  return {
    id: crypto.randomUUID(),
    role,
    parts: [{ type: 'text', text }],
  }
}

function getToolOutputs(message: any) {
  return (message?.parts || [])
    .filter((part: any) => part.type?.startsWith('tool-') && part.state === 'output-available')
    .map((part: any) => part.output)
}

export function ChatInterface() {
  const [sessionId] = useState(() => {
    if (typeof window === 'undefined') return crypto.randomUUID()
    const stored = localStorage.getItem('agent_session_id')
    if (stored) return stored
    const id = crypto.randomUUID()
    localStorage.setItem('agent_session_id', id)
    return id
  })

  const transport = useMemo(() => new DefaultChatTransport({
    api: '/api/agent',
    prepareSendMessagesRequest: ({ messages, id }) => ({
      body: { messages, sessionId, id },
    }),
  }), [sessionId])

  const { messages, setMessages, sendMessage, status, error } = useChat({
    id: sessionId,
    transport,
    onError: (error) => {
      console.error('Chat stream error:', error)
      setMessages(prev => [
        ...prev,
        makeLocalMessage('assistant', `Omlouvám se, nastala chyba spojení: ${error.message}`),
      ])
    },
  })

  const [input, setInput] = useState('')
  const [uploadingFile, setUploadingFile] = useState(false)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const isLoading = status === 'submitted' || status === 'streaming'

  const bottomRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const uploadPendingFile = async (file: File) => {
    const form = new FormData()
    form.append('file', file)
    const res = await fetch('/api/upload', { method: 'POST', body: form })
    const data = await res.json().catch(() => ({}))

    if (!res.ok) {
      throw new Error(data.error || 'Nepodařilo se nahrát soubor.')
    }

    return data
  }

  const sendToAgent = async (text: string, file: File | null = null) => {
    if ((!text.trim() && !file) || isLoading || uploadingFile) return
    const originalText = text.trim()

    if (file) {
      setUploadingFile(true)
    }

    try {
      let messageText = originalText

      if (file) {
        const data = await uploadPendingFile(file)
        messageText = [
          originalText || `Shrň mi přiložený soubor ${data.name || file.name}.`,
          '',
          `Přiložený soubor: ${data.name || file.name}`,
          `uploaded_file_id: ${data.id}`,
          `chunk_count: ${data.chunk_count}`,
          'Použij search_documents s tímto uploaded_file_id, pokud odpovídáš na obsah souboru.',
        ].join('\n')
        setPendingFile(null)
      }

      setInput('')
      await sendMessage({ text: messageText })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Chyba při nahrávání souboru.'
      setMessages(prev => [...prev, makeLocalMessage('assistant', message)])
    } finally {
      setUploadingFile(false)
    }
  }

  const sendQuickAction = async (text: string) => {
    if (!text.trim() || isLoading) return
    setInput('')
    await sendMessage({ text })
  }

  const submitMessage = (e?: React.FormEvent) => {
    e?.preventDefault()
    sendToAgent(input, pendingFile)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendToAgent(input, pendingFile)
    }
  }

  // Pending approval logic
  const lastMsg = messages[messages.length - 1]
  const pendingApproval = getToolOutputs(lastMsg).find((output: any) => output?.requires_approval) || null

  return (
    <div className="flex h-full flex-col bg-transparent">
      <div className="flex shrink-0 items-center gap-3 border-b border-white/70 bg-white/60 px-4 py-3 backdrop-blur-xl md:px-6">
        <div>
          <h1 className="text-sm font-semibold text-slate-950">Chat</h1>
        </div>
        {messages.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            className="ml-auto rounded-full border-sky-200 bg-white/70 text-blue-700 hover:bg-sky-50"
            onClick={() => {
              const id = crypto.randomUUID()
              localStorage.setItem('agent_session_id', id)
              window.location.reload()
            }}
          >
            <Plus className="h-3.5 w-3.5" />
            Nový chat
          </Button>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          <QuickActions onSelect={(text) => sendQuickAction(text)} />
        ) : (
          <div className="space-y-7 px-[clamp(1rem,9vw,12rem)] py-8">
            {messages.map(msg => (
              <MessageBubble key={msg.id} message={msg} />
            ))}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      <div className="px-[clamp(1rem,10vw,14rem)] pb-5 pt-3">
        <form onSubmit={submitMessage} className="blue-glass mx-auto flex max-w-3xl flex-col gap-2 rounded-[2rem] p-2.5">
          {pendingFile && (
            <div className="flex w-full items-center gap-2 rounded-2xl border border-sky-100 bg-white/70 px-3 py-2 text-sm text-slate-700">
              <Paperclip className="h-4 w-4 shrink-0 text-blue-600" />
              <span className="min-w-0 flex-1 truncate font-medium">{pendingFile.name}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                className="shrink-0 rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                onClick={() => setPendingFile(null)}
                disabled={uploadingFile}
                title="Odebrat přílohu"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
          <div className="flex w-full items-end gap-2">
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept=".pdf,.docx,.doc,.xlsx,.xls,.csv,.txt"
              onChange={e => {
                const file = e.target.files?.[0]
                if (file) setPendingFile(file)
                e.target.value = ''
              }}
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-11 w-11 shrink-0 rounded-full border-white/70 bg-white/70 text-blue-700 shadow-sm hover:bg-white"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingFile || isLoading}
              title="Přiložit soubor ke zprávě"
            >
              {uploadingFile ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
            </Button>
            <Textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Napiš dotaz nebo úkol pro agenta..."
              className="max-h-[200px] min-h-[44px] flex-1 resize-none border-0 bg-transparent px-2 py-3 text-[15px] text-slate-900 shadow-none placeholder:text-slate-400 focus-visible:ring-0"
              rows={1}
            />
            <Button
              type="submit"
              disabled={(!input?.trim() && !pendingFile) || isLoading || uploadingFile}
              size="icon"
              className="h-11 w-11 rounded-full bg-gradient-to-br from-cyan-300 via-sky-400 to-blue-600 text-white shadow-lg shadow-blue-500/25 hover:brightness-105"
            >
              {uploadingFile ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          </div>
        </form>
      </div>

      {error && (
        <p className="sr-only" role="alert">{error.message}</p>
      )}

      {pendingApproval && (
        <ApprovalModal
          request={pendingApproval}
          onConfirm={async () => {
            if (pendingApproval.type === 'monitoring') {
              const res = await fetch('/api/monitoring/activate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(pendingApproval)
              })
              if (!res.ok) alert('Chyba při nastavení monitoringu')
            }
            alert('Schváleno')
          }}
          onCancel={() => {}}
        />
      )}
    </div>
  )
}

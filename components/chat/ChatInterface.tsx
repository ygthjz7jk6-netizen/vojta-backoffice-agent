'use client'

import { useState, useRef, useEffect, useMemo, type FormEvent, type KeyboardEvent } from 'react'
import { MessageBubble } from './MessageBubble'
import { QuickActions } from './QuickActions'
import { ApprovalModal } from '@/components/approval/ApprovalModal'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Send, Loader2, Paperclip, Plus, X } from 'lucide-react'
import { AgentMark } from '@/components/brand/AgentMark'
import { useChat, type UIMessage } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'

const ACTIVE_SESSION_KEY = 'agent_session_id'
const CHAT_HISTORY_KEY = 'agent_chat_history'
const CHAT_MESSAGES_PREFIX = 'agent_chat_messages:'
const CHAT_HISTORY_EVENT = 'agent_chat_history_updated'
const CHAT_SESSION_EVENT = 'agent_chat_session_changed'

type ChatSummary = {
  id: string
  title: string
  createdAt: string
  updatedAt: string
}

type ToolOutput = Record<string, unknown> & {
  requires_approval?: boolean
  type?: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isToolOutput(value: unknown): value is ToolOutput {
  return isRecord(value)
}

function makeLocalMessage(role: 'user' | 'assistant', text: string): UIMessage {
  return {
    id: crypto.randomUUID(),
    role,
    parts: [{ type: 'text', text }],
  }
}

function getToolOutputs(message: UIMessage | undefined): ToolOutput[] {
  return (message?.parts || [])
    .filter(part => part.type?.startsWith('tool-') && 'state' in part && part.state === 'output-available')
    .map(part => ('output' in part ? part.output : null))
    .filter(isToolOutput)
}

function safelyReadJson<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback

  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

function loadChatHistory(): ChatSummary[] {
  return safelyReadJson<ChatSummary[]>(CHAT_HISTORY_KEY, [])
}

function saveChatHistory(history: ChatSummary[]) {
  localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(history.slice(0, 30)))
  window.dispatchEvent(new Event(CHAT_HISTORY_EVENT))
}

function loadStoredMessages(sessionId: string) {
  return safelyReadJson<UIMessage[]>(`${CHAT_MESSAGES_PREFIX}${sessionId}`, [])
}

function saveStoredMessages(sessionId: string, messages: UIMessage[]) {
  localStorage.setItem(`${CHAT_MESSAGES_PREFIX}${sessionId}`, JSON.stringify(messages))
}

function getMessageText(message: UIMessage | undefined) {
  if (!message) return ''

  return message.parts
    .filter(part => part.type === 'text')
    .map(part => part.text)
    .join('\n')
    .trim()
}

function titleFromMessages(messages: UIMessage[]) {
  const firstUserText = messages
    .filter(message => message.role === 'user')
    .map(getMessageText)
    .find(Boolean)

  if (!firstUserText) return 'Nový chat'

  const singleLine = firstUserText.replace(/\s+/g, ' ').trim()
  return singleLine.length > 48 ? `${singleLine.slice(0, 45)}...` : singleLine
}

function ensureActiveSession() {
  if (typeof window === 'undefined') return crypto.randomUUID()

  const stored = localStorage.getItem(ACTIVE_SESSION_KEY)
  if (stored) return stored

  const id = crypto.randomUUID()
  const now = new Date().toISOString()
  localStorage.setItem(ACTIVE_SESSION_KEY, id)
  saveChatHistory([{ id, title: 'Nový chat', createdAt: now, updatedAt: now }])
  return id
}

export function ChatInterface() {
  const [isMounted, setIsMounted] = useState(false)
  
  useEffect(() => {
    setIsMounted(true)
  }, [])

  const [sessionId, setSessionId] = useState(ensureActiveSession)
  const initialMessages = useMemo(() => loadStoredMessages(sessionId), [sessionId])

  const transport = useMemo(() => new DefaultChatTransport({
    api: '/api/agent',
    prepareSendMessagesRequest: ({ messages, id }) => ({
      body: { messages, sessionId, id },
    }),
  }), [sessionId])

  const { messages, setMessages, sendMessage, status, error } = useChat({
    id: sessionId,
    messages: initialMessages,
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

  useEffect(() => {
    if (typeof window === 'undefined') return

    saveStoredMessages(sessionId, messages)
  }, [messages, sessionId])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const syncActiveSession = () => {
      const activeSessionId = localStorage.getItem(ACTIVE_SESSION_KEY)
      if (activeSessionId && activeSessionId !== sessionId) {
        setPendingFile(null)
        setInput('')
        setSessionId(activeSessionId)
      }
    }

    window.addEventListener(CHAT_SESSION_EVENT, syncActiveSession)
    window.addEventListener('storage', syncActiveSession)
    return () => {
      window.removeEventListener(CHAT_SESSION_EVENT, syncActiveSession)
      window.removeEventListener('storage', syncActiveSession)
    }
  }, [sessionId])

  const updateChatSummary = (id: string, title?: string) => {
    const now = new Date().toISOString()
    const history = loadChatHistory()
    const existing = history.find(chat => chat.id === id)
    const nextChat = {
      id,
      title: title || existing?.title || 'Nový chat',
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    }
    const next = [nextChat, ...history.filter(chat => chat.id !== id)]
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())

    saveChatHistory(next)
  }

  const createNewChat = () => {
    if (isLoading || uploadingFile) return

    const id = crypto.randomUUID()
    const now = new Date().toISOString()
    const chat = { id, title: 'Nový chat', createdAt: now, updatedAt: now }

    localStorage.setItem(ACTIVE_SESSION_KEY, id)
    saveStoredMessages(id, [])
    setPendingFile(null)
    setInput('')
    saveChatHistory([chat, ...loadChatHistory().filter(item => item.id !== id)])
    window.dispatchEvent(new Event(CHAT_SESSION_EVENT))
    setSessionId(id)
  }

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
        const reuseNote = data.reused_existing || data.duplicate
          ? 'Soubor už je uložený v systému, použij existující zpracovanou verzi.'
          : null
        messageText = [
          originalText || `Shrň mi přiložený soubor ${data.name || file.name}.`,
          '',
          ...(reuseNote ? [reuseNote] : []),
          `Přiložený soubor: ${data.name || file.name}`,
          `uploaded_file_id: ${data.id}`,
          `chunk_count: ${data.chunk_count}`,
          'Použij search_documents s tímto uploaded_file_id, pokud odpovídáš na obsah souboru.',
        ].join('\n')
        setPendingFile(null)
      }

      setInput('')
      updateChatSummary(sessionId, titleFromMessages([...messages, makeLocalMessage('user', messageText)]))
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
    updateChatSummary(sessionId, titleFromMessages([...messages, makeLocalMessage('user', text)]))
    await sendMessage({ text })
  }

  const submitMessage = (e?: FormEvent) => {
    e?.preventDefault()
    sendToAgent(input, pendingFile)
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendToAgent(input, pendingFile)
    }
  }

  // Pending approval logic
  const lastMsg = messages[messages.length - 1]
  const pendingApproval = getToolOutputs(lastMsg).find(output => output.requires_approval) || null

  const dismissModal = () => {
    setMessages(prev => prev.map((msg, idx) => {
      if (idx !== prev.length - 1) return msg
      return {
        ...msg,
        parts: msg.parts?.map(part => {
          if (part.type?.startsWith('tool-') && 'state' in part && part.state === 'output-available' && 'output' in part) {
            const output = part.output as any
            if (output && output.requires_approval) {
              return { ...part, output: { ...output, requires_approval: false } } as any
            }
          }
          return part
        }) || []
      }
    }))
  }

  return (
    <div className="flex h-full min-w-0 flex-col bg-transparent">
        <div className="flex shrink-0 items-center gap-3 border-b border-white/70 bg-white/60 px-4 py-3 backdrop-blur-xl md:px-6">
          <div>
            <h1 className="text-sm font-semibold text-slate-950">Chat</h1>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="ml-auto rounded-full border-sky-200 bg-white/70 text-blue-700 hover:bg-sky-50 lg:hidden"
            onClick={createNewChat}
            disabled={isLoading || uploadingFile}
          >
            <Plus className="h-3.5 w-3.5" />
            Nový chat
          </Button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {!isMounted || messages.length === 0 ? (
            <QuickActions onSelect={(text) => sendQuickAction(text)} />
          ) : (
            <div className="space-y-7 px-[clamp(1rem,9vw,12rem)] py-8">
              {messages.map(msg => (
                <MessageBubble key={msg.id} message={msg} />
              ))}
              {isLoading && messages[messages.length - 1]?.role !== 'assistant' && (
                <div className="mx-auto flex w-full max-w-3xl items-center gap-3 px-1 text-sm font-medium text-slate-500">
                  <AgentMark className="agent-mark-thinking h-9 w-9" />
                  <span>Agent přemýšlí</span>
                </div>
              )}
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

        {isMounted && pendingApproval && (
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
              dismissModal()
            }}
            onCancel={() => {
              dismissModal()
            }}
          />
        )}
    </div>
  )
}

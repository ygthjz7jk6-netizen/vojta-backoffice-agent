export interface Citation {
  source_file: string
  source_type: string
  rows?: string
  ingested_at?: string
  url?: string
}

export interface AgentMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  sources?: Citation[]
  tool_calls?: ToolCall[]
  requires_approval?: ApprovalRequest
  created_at: string
}

export interface ToolCall {
  name: string
  input: Record<string, unknown>
  output?: unknown
}

export interface ApprovalRequest {
  type: 'email' | 'schedule'
  description: string
  data: Record<string, unknown>
}

export interface PepaProfile {
  role: string
  preferences: {
    report_format: string
    language: string
    chart_style: string
  }
  frequent_tasks: string[]
  key_people: string[]
  calendar_email: string | null
  working_hours: string
  last_updated: string | null
}

export interface DocumentChunk {
  id: string
  content: string
  source_file: string
  source_row_start?: number
  source_row_end?: number
  source_type: string
  entity_tags: string[]
  ingested_at: string
}

export interface SearchResult {
  chunk: DocumentChunk
  similarity: number
}

import { supabaseAdmin } from '@/lib/supabase/client'
import { embedText } from '@/lib/memory/embed'
import type { SearchResult } from '@/types'

export async function searchDocuments(
  query: string,
  options: { sourceType?: string; limit?: number } = {}
): Promise<SearchResult[]> {
  const { sourceType, limit = 5 } = options
  const embedding = await embedText(query)

  const { data, error } = await supabaseAdmin.rpc('search_documents', {
    query_embedding: embedding,
    match_count: limit,
    filter_source_type: sourceType ?? null,
  })

  if (error) throw new Error(`RAG search failed: ${error.message}`)
  return (data ?? []) as SearchResult[]
}

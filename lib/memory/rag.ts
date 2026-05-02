import { supabaseAdmin } from '@/lib/supabase/client'
import { embedText } from '@/lib/memory/embed'
import type { SearchResult } from '@/types'

type DocumentChunkRow = {
  id: string
  content: string
  source_file: string
  source_row_start?: number
  source_row_end?: number
  source_type: string
  entity_tags?: string[]
  ingested_at: string
  similarity?: number
}

export async function searchDocuments(
  query: string,
  options: { sourceType?: string; limit?: number; sourceFile?: string; uploadedFileId?: string } = {}
): Promise<SearchResult[]> {
  const { sourceType, limit = 5, sourceFile, uploadedFileId } = options

  if (sourceFile || uploadedFileId) {
    let chunksQuery = supabaseAdmin
      .from('document_chunks')
      .select('id, content, source_file, source_row_start, source_row_end, source_type, entity_tags, ingested_at')

    if (uploadedFileId) chunksQuery = chunksQuery.eq('uploaded_file_id', uploadedFileId)
    if (sourceFile) chunksQuery = chunksQuery.eq('source_file', sourceFile)
    if (sourceType) chunksQuery = chunksQuery.eq('source_type', sourceType)

    const { data, error } = await chunksQuery
      .order('source_row_start', { ascending: true })
      .limit(limit)

    if (error) throw new Error(`Document chunk lookup failed: ${error.message}`)
    return ((data ?? []) as DocumentChunkRow[]).map(row => ({
      chunk: row,
      similarity: 1,
    })) as SearchResult[]
  }

  const embedding = await embedText(query)

  const { data, error } = await supabaseAdmin.rpc('search_documents', {
    query_embedding: embedding,
    match_count: limit,
    filter_source_type: sourceType ?? null,
  })

  if (error) throw new Error(`RAG search failed: ${error.message}`)
  return ((data ?? []) as DocumentChunkRow[]).map(row => ({
    chunk: {
      id: row.id,
      content: row.content,
      source_file: row.source_file,
      source_row_start: row.source_row_start,
      source_row_end: row.source_row_end,
      source_type: row.source_type,
      entity_tags: row.entity_tags ?? [],
      ingested_at: row.ingested_at,
    },
    similarity: row.similarity,
  })) as SearchResult[]
}

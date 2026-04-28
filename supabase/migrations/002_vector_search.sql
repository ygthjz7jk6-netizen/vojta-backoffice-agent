-- Vyhledávání v RAG dokumentech
create or replace function search_documents(
  query_embedding vector(768),
  match_count int default 5,
  filter_source_type text default null
)
returns table (
  id uuid,
  content text,
  source_file text,
  source_row_start int,
  source_row_end int,
  source_type text,
  entity_tags text[],
  ingested_at timestamptz,
  similarity float
)
language plpgsql
as $$
begin
  return query
  select
    dc.id,
    dc.content,
    dc.source_file,
    dc.source_row_start,
    dc.source_row_end,
    dc.source_type,
    dc.entity_tags,
    dc.ingested_at,
    1 - (dc.embedding <=> query_embedding) as similarity
  from document_chunks dc
  where
    (filter_source_type is null or dc.source_type = filter_source_type)
    and dc.embedding is not null
  order by dc.embedding <=> query_embedding
  limit match_count;
end;
$$;

-- Vyhledávání v episodické paměti
create or replace function search_conversations(
  query_embedding vector(768),
  match_count int default 3
)
returns table (
  id uuid,
  session_id uuid,
  role text,
  content text,
  sources jsonb,
  created_at timestamptz,
  similarity float
)
language plpgsql
as $$
begin
  return query
  select
    c.id,
    c.session_id,
    c.role,
    c.content,
    c.sources,
    c.created_at,
    1 - (c.embedding <=> query_embedding) as similarity
  from conversations c
  where
    c.embedding is not null
    and c.role = 'assistant'
  order by c.embedding <=> query_embedding
  limit match_count;
end;
$$;

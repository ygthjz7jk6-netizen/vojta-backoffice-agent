-- Dlouhodobá paměť agenta — fakta naučená z konverzací s Pepou
create table if not exists pepa_memory (
  id          uuid primary key default gen_random_uuid(),
  fact        text not null,
  category    text not null check (category in ('preference', 'habit', 'decision', 'context', 'person')),
  embedding   vector(768),
  strength    float not null default 1.0 check (strength >= 0.0 and strength <= 1.0),
  used_count  int not null default 0,
  last_used_at timestamptz default now(),
  updated_at  timestamptz default now(),
  created_at  timestamptz default now()
);

create index if not exists pepa_memory_embedding_idx on pepa_memory
  using ivfflat (embedding vector_cosine_ops) with (lists = 100);

-- Similarity search v paměti s minimální podobností
create or replace function search_memories(
  query_embedding vector(768),
  match_count     int     default 8,
  min_similarity  float   default 0.5
)
returns table (
  id           uuid,
  fact         text,
  category     text,
  strength     float,
  last_used_at timestamptz,
  similarity   float,
  score        float
)
language plpgsql
as $$
begin
  return query
  select
    ranked.id,
    ranked.fact,
    ranked.category,
    ranked.strength,
    ranked.last_used_at,
    ranked.similarity,
    ranked.score
  from (
    select
      pm.id,
      pm.fact,
      pm.category,
      pm.strength,
      pm.last_used_at,
      1 - (pm.embedding <=> query_embedding) as similarity,
      ((1 - (pm.embedding <=> query_embedding)) * 0.8 + pm.strength * 0.2) as score,
      pm.embedding <=> query_embedding as distance
    from pepa_memory pm
    where pm.embedding is not null
  ) ranked
  where ranked.similarity >= min_similarity
  order by ranked.score desc, ranked.distance
  limit match_count;
end;
$$;

-- Použití paměti ji posílí a obnoví její životnost
create or replace function reinforce_pepa_memories(
  memory_ids uuid[],
  boost      float default 0.08
)
returns void
language plpgsql
as $$
begin
  update pepa_memory
  set
    strength = least(1.0, strength + boost),
    used_count = used_count + 1,
    last_used_at = now(),
    updated_at = now()
  where id = any(memory_ids);
end;
$$;

-- Denní decay — voláno z cronu
create or replace function decay_pepa_memories(
  decay_factor      float default 0.9771599684342459,
  delete_threshold  float default 0.1
)
returns void
language plpgsql
as $$
begin
  update pepa_memory
  set
    strength = strength * decay_factor,
    updated_at = now();

  delete from pepa_memory where strength < delete_threshold;
end;
$$;

-- Enable pgvector extension
create extension if not exists vector;

-- Pepa profile (živý dokument o uživateli)
create table if not exists pepa_profile (
  id uuid primary key default gen_random_uuid(),
  key text unique not null,
  value jsonb not null,
  updated_at timestamptz default now()
);

-- Vložit výchozí profil
insert into pepa_profile (key, value) values
  ('profile', '{
    "role": "Back office manager, realitní firma",
    "preferences": {
      "report_format": "krátký bullet-point souhrn + čísla",
      "language": "česky, tykání",
      "chart_style": "jednoduchý sloupcový"
    },
    "frequent_tasks": [],
    "key_people": [],
    "calendar_email": null,
    "working_hours": "8:00-17:00",
    "last_updated": null
  }'::jsonb)
on conflict (key) do nothing;

-- Episodická paměť (konverzace)
create table if not exists conversations (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  tool_calls jsonb default '[]',
  sources jsonb default '[]',
  embedding vector(768),
  created_at timestamptz default now()
);

create index if not exists conversations_session_idx on conversations (session_id);
create index if not exists conversations_embedding_idx on conversations
  using ivfflat (embedding vector_cosine_ops) with (lists = 100);

-- RAG dokumenty
create table if not exists document_chunks (
  id uuid primary key default gen_random_uuid(),
  content text not null,
  embedding vector(768),
  source_file text not null,
  source_row_start int,
  source_row_end int,
  source_type text not null check (source_type in ('crm', 'contract', 'email', 'note', 'meeting', 'property', 'other')),
  entity_tags text[] default '{}',
  ingested_at timestamptz default now()
);

create index if not exists document_chunks_embedding_idx on document_chunks
  using ivfflat (embedding vector_cosine_ops) with (lists = 100);
create index if not exists document_chunks_source_type_idx on document_chunks (source_type);

-- CRM leady (strukturovaná data pro SQL dotazy)
create table if not exists crm_leads (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text,
  phone text,
  source text,        -- "sreality", "doporuceni", "web", "inzerat"
  status text default 'new',  -- "new", "contacted", "viewing", "offer", "closed", "lost"
  property_interest text,
  budget_min numeric,
  budget_max numeric,
  notes text,
  assigned_to text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists crm_leads_created_at_idx on crm_leads (created_at);
create index if not exists crm_leads_source_idx on crm_leads (source);
create index if not exists crm_leads_status_idx on crm_leads (status);

-- Nemovitosti
create table if not exists properties (
  id uuid primary key default gen_random_uuid(),
  address text not null,
  city text not null,
  district text,
  price numeric,
  area_sqm numeric,
  type text,          -- "byt", "dum", "kancelar", "pozemek"
  status text default 'available',  -- "available", "reserved", "sold"
  year_built int,
  last_reconstruction int,
  construction_notes text,
  missing_fields jsonb default '{}',
  listing_url text,
  images text[] default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists properties_district_idx on properties (district);
create index if not exists properties_status_idx on properties (status);

-- Naplánované úkoly
create table if not exists scheduled_tasks (
  id uuid primary key default gen_random_uuid(),
  cron text not null,
  action jsonb not null,
  description text not null,
  is_active boolean default true,
  last_run timestamptz,
  next_run timestamptz,
  last_result jsonb,
  created_at timestamptz default now()
);

-- Audit log
create table if not exists audit_log (
  id uuid primary key default gen_random_uuid(),
  action text not null,
  tool text,
  user_query text,
  sources_used jsonb default '[]',
  result_summary text,
  timestamp timestamptz default now()
);

-- Scraped listings (výsledky sledování realitních serverů)
create table if not exists scraped_listings (
  id uuid primary key default gen_random_uuid(),
  source_site text not null,
  external_id text,
  title text,
  price numeric,
  location text,
  area_sqm numeric,
  url text,
  raw_data jsonb,
  scraped_at timestamptz default now(),
  unique(source_site, external_id)
);

-- RLS policies (základní security)
alter table pepa_profile enable row level security;
alter table conversations enable row level security;
alter table document_chunks enable row level security;
alter table crm_leads enable row level security;
alter table properties enable row level security;
alter table scheduled_tasks enable row level security;
alter table audit_log enable row level security;
alter table scraped_listings enable row level security;

-- Service role má plný přístup (pro server-side API routes)
create policy "service_role_all" on pepa_profile for all using (true);
create policy "service_role_all" on conversations for all using (true);
create policy "service_role_all" on document_chunks for all using (true);
create policy "service_role_all" on crm_leads for all using (true);
create policy "service_role_all" on properties for all using (true);
create policy "service_role_all" on scheduled_tasks for all using (true);
create policy "service_role_all" on audit_log for all using (true);
create policy "service_role_all" on scraped_listings for all using (true);

-- Konfigurace sledování realitních nabídek (nastavuje agent)
create table if not exists monitoring_configs (
  id uuid primary key default gen_random_uuid(),
  location_name text not null unique,
  sreality_district_id integer,
  sreality_region_id integer,
  category_main integer not null default 1,  -- 1=byty, 2=domy
  category_type integer not null default 1,  -- 1=prodej, 2=pronájem
  notify_email text not null,
  active boolean not null default true,
  created_at timestamptz default now()
);

alter table monitoring_configs enable row level security;
create policy "service_role_all" on monitoring_configs for all using (true);

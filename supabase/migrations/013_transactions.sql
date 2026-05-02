-- Tabulka pro bankovní transakce (nájmy, údržba, provize).
-- Naplňuje se z CSV výpisů Banka_Vypis_*.csv přes Drive sync.

create table if not exists transactions (
  id uuid primary key default gen_random_uuid(),
  datum date not null,
  typ text not null check (typ in ('Příchozí', 'Odchozí', 'Chybějící')),
  castka numeric,
  popis text,
  id_nemovitosti text,
  id_najemnika text,
  najemnik text,
  vs text,
  kategorie text check (kategorie in ('Najem', 'Udrzba', 'Provize', 'Jine') or kategorie is null),
  poznamka text,
  external_id text unique,
  source_file text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists transactions_datum_idx on transactions(datum);
create index if not exists transactions_id_nemovitosti_idx on transactions(id_nemovitosti);
create index if not exists transactions_kategorie_idx on transactions(kategorie);
create index if not exists transactions_external_id_idx on transactions(external_id);
create index if not exists transactions_source_file_idx on transactions(source_file);

alter table transactions enable row level security;
create policy "service_role_all" on transactions for all to service_role using (true);

-- Rozšíření structured_imports aby podporovalo 'transactions' jako target_table
alter table structured_imports
  drop constraint if exists structured_imports_target_table_check;

alter table structured_imports
  add constraint structured_imports_target_table_check
  check (target_table in ('properties', 'crm_leads', 'transactions') or target_table is null);

-- Poznámka: drive_files.target_table nemá CHECK constraint — 'transactions' projde bez změny.

-- Úklid [DEMO] dat (spustit ručně po aplikaci migrace, před dalším Drive sync):
-- DELETE FROM properties WHERE name LIKE '[DEMO]%' OR address LIKE '[DEMO]%';
-- DELETE FROM crm_leads WHERE name LIKE '[DEMO]%' OR source_file IS NULL;

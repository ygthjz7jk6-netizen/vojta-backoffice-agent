-- Raw ulozeni tabulkovych souboru z Drive.
-- Kazdy XLSX/CSV/Google Sheet se ulozi 1:1 sem, i kdyz nejde namapovat
-- do business tabulek properties nebo crm_leads.

create table if not exists structured_imports (
  id uuid primary key default gen_random_uuid(),
  drive_file_id text,
  source_file text not null,
  sheet_name text,
  columns jsonb not null default '[]',
  row_count int not null default 0,
  status text not null default 'raw_only'
    check (status in ('mapped', 'raw_only', 'mapping_error')),
  target_table text
    check (target_table in ('properties', 'crm_leads') or target_table is null),
  error_message text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists structured_rows (
  id uuid primary key default gen_random_uuid(),
  import_id uuid not null references structured_imports(id) on delete cascade,
  row_index int not null,
  data jsonb not null,
  created_at timestamptz default now()
);

create index if not exists structured_imports_source_file_idx on structured_imports(source_file);
create index if not exists structured_imports_drive_file_id_idx on structured_imports(drive_file_id);
create index if not exists structured_imports_status_idx on structured_imports(status);
create index if not exists structured_rows_import_id_idx on structured_rows(import_id);

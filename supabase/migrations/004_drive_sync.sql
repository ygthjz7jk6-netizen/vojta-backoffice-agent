-- Tabulka pro sledování souborů z Google Drive
create table if not exists drive_files (
  id uuid primary key default gen_random_uuid(),
  drive_file_id text unique not null,
  name text not null,
  mime_type text not null,
  md5_checksum text,
  modified_time timestamptz,
  ingested_at timestamptz,
  status text default 'pending', -- pending | ingested | error | skipped
  error_message text,
  file_type text, -- 'rag' | 'structured'
  target_table text -- pro structured: 'properties' | 'crm_leads'
);

create index if not exists drive_files_drive_file_id_idx on drive_files(drive_file_id);
create index if not exists drive_files_status_idx on drive_files(status);

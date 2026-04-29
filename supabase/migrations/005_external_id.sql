-- Přidání external_id a source_file pro Drive import
alter table properties
  add column if not exists external_id text unique,
  add column if not exists source_file text,
  add column if not exists name text;

alter table crm_leads
  add column if not exists external_id text unique,
  add column if not exists source_file text;

create index if not exists properties_external_id_idx on properties(external_id);
create index if not exists crm_leads_external_id_idx on crm_leads(external_id);

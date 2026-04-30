# Back Office Operations Agent — Architektura

## Přehled

Jeden inteligentní agent pro back office manažera realitní firmy. Funguje v **NotebookLM režimu** — nikdy nevymýšlí data, vždy cituje zdroj.

---

## Stack

| Vrstva | Technologie |
|---|---|
| LLM | Gemini 2.5 Flash — Vertex AI přes OAuth Bearer token (fallback: AI Studio) |
| Embeddingy | gemini-embedding-001 (768 dims) |
| Frontend | Next.js 16 (App Router) |
| Hosting | Vercel (maxDuration=60) |
| Databáze | Supabase (PostgreSQL + pgvector) |
| Auth | NextAuth v5 — Google OAuth 2.0 |
| Google APIs | Calendar (freebusy), Gmail (draft), Drive (readonly), Vertex AI |
| Cron | Vercel Cron Functions |

---

## Google OAuth scopes

```
openid, email, profile
https://www.googleapis.com/auth/calendar.readonly
https://www.googleapis.com/auth/gmail.compose
https://www.googleapis.com/auth/cloud-platform      ← Vertex AI
https://www.googleapis.com/auth/drive.readonly       ← Drive sync
```

---

## Agent flow (každý request)

```
1. Načti Pepa profil + posledních 20 zpráv session (episodická paměť)
         ↓
2. Sestavení kontextu: system prompt + profil + historie + dotaz
         ↓
3. Vertex AI (OAuth token) nebo AI Studio (fallback) → tool calling loop (max 3x)
         ↓
4. Tools vrátí data + citations[]
         ↓
5. Agent sestaví odpověď POUZE z dat nástrojů (NotebookLM pravidla)
         ↓
6. Odpověď + citace + případný chart_config do UI
         ↓
7. Async: uložit konverzaci + embedding do Supabase
```

---

## Tools (7 nástrojů)

| Nástroj | Popis |
|---|---|
| `search_documents` | RAG similarity search v document_chunks |
| `query_structured_data` | SQL na crm_leads / properties / scraped_listings; filtry: name, status, district, has_missing_fields; aggregace: count, monthly_count (→ chart), avg_price, group_by_* |
| `get_calendar_slots` | Google Calendar freebusy, volné sloty 9-17h |
| `draft_communication` | Gmail draft přes API; approval flow pokud chybí token |
| `create_visualization` | Chart.js config (bar/line/pie); zobrazí se automaticky v UI |
| `generate_report` | Markdown report z live Supabase dat |
| `schedule_action` | Návrh cronu — vždy čeká na approval |

---

## Google Drive sync

```
Vercel cron (každou hodinu)
         ↓
/api/cron/drive-sync
         ↓
Drive API: seznam souborů s md5Checksum
         ↓
Porovnej md5 s drive_files tabulkou
  stejné md5 → skip (0 tokenů)
  různé md5  → stáhni + parsuj
         ↓
Podle typu:
  PDF / DOCX / TXT → chunk → embed → document_chunks (RAG)
  XLSX / CSV       → parse → upsert → properties / crm_leads
  Google Doc       → export jako DOCX → RAG
  Google Sheet     → export jako XLSX → structured
         ↓
Ulož md5 + ingested_at do drive_files
```

**Demo data na Drive** (složka "Vojta Back Office – Firemní data"):
- `Nemovitosti_databaze_2025` — 15 nemovitostí, 7 bez dat o rekonstrukci
- `CRM_Leady_Q1_2025` — 12 leadů Q1 2025, reálné kontakty
- `Zapis_tydenni_porada_14_dubna_2025` — meeting notes s úkoly
- `Smlouva_zprostredkovani_Horak_P007_2025` — vzorová smlouva

---

## Databázové schema

### `drive_files`
Sledování souborů z Google Drive pro md5 diff.
```sql
drive_file_id TEXT UNIQUE, name, mime_type,
md5_checksum, modified_time, ingested_at,
status TEXT,  -- pending | ingested | error | skipped
file_type TEXT,  -- rag | structured
target_table TEXT  -- properties | crm_leads
```

### `document_chunks`
RAG vrstva — chunky dokumentů s embeddingem.
```sql
content TEXT, embedding VECTOR(768),
source_file, source_type, source_row_start, source_row_end,
ingested_at TIMESTAMPTZ
```

### `crm_leads`
```sql
id, name, email, phone, source, status,
property_interest, budget_min, budget_max, notes,
external_id TEXT UNIQUE,  -- pro Drive upsert
source_file TEXT
```

### `properties`
```sql
id, address, city, district, price, area_sqm, type, status,
year_built, last_reconstruction, construction_notes,
missing_fields JSONB,  -- detekce chybějících dat
external_id TEXT UNIQUE,  -- pro Drive upsert
source_file TEXT, name TEXT
```

### `conversations`
```sql
session_id UUID, role, content,
tool_calls JSONB, sources JSONB,
embedding VECTOR(768), created_at
```

---

## Env proměnné

```
GOOGLE_AI_API_KEY          # AI Studio fallback
GOOGLE_CLOUD_PROJECT       # Vertex AI project ID
GOOGLE_CLIENT_ID           # OAuth
GOOGLE_CLIENT_SECRET       # OAuth
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
NEXTAUTH_SECRET
NEXTAUTH_URL
CRON_SECRET                # Vercel cron autorizace (volitelné)
```

---

## Deployment

- **URL**: https://vojta-backoffice-agent-nu.vercel.app
- **Repo**: github.com/ygthjz7jk6-netizen/vojta-backoffice-agent
- **Cron**: `/api/cron/drive-sync` — každou hodinu (`0 * * * *`)

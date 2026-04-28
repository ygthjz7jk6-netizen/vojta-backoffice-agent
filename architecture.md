# Back Office Operations Agent — Architektura

## Přehled

Jeden inteligentní agent pro back office manažera realitní firmy. Funguje v **NotebookLM režimu** — nikdy nevymýšlí data, vždy cituje zdroj. Každé tvrzení musí být podloženo nástrojem nebo dokumentem.

---

## Stack

| Vrstva | Technologie | Tier |
|---|---|---|
| LLM | Gemini 2.0 Flash (Google AI Studio) | Free |
| Embeddingy | text-embedding-004 (Google) | Free |
| Frontend | Next.js 14 (App Router) | Free |
| Backend | Next.js API Routes | Free |
| Hosting | Vercel | Free |
| Databáze | Supabase (PostgreSQL + pgvector) | Free |
| Auth | Supabase Auth | Free |
| Google integrace | Calendar, Gmail, Drive API (OAuth 2.0) | Free |
| Scraping | Firecrawl nebo Playwright | Free tier |
| Plánování | Vercel Cron Functions | Free |

---

## Adresářová struktura

```
vojta-backoffice-agent/
├── app/                          # Next.js App Router
│   ├── (auth)/
│   │   └── login/page.tsx        # Google OAuth login
│   ├── (dashboard)/
│   │   ├── layout.tsx
│   │   ├── page.tsx              # Hlavní chat rozhraní
│   │   ├── documents/page.tsx    # Správa nahraných dokumentů
│   │   └── scheduled/page.tsx   # Přehled naplánovaných úkolů
│   └── api/
│       ├── agent/route.ts        # Hlavní agent endpoint (streaming)
│       ├── ingest/route.ts       # Ingestion dokumentů do RAG
│       ├── ingest/drive/route.ts # Auto-sync z Google Drive
│       └── cron/
│           ├── scrape/route.ts   # Denní scraping nabídek
│           └── profile/route.ts  # Aktualizace Pepa profilu
│
├── lib/
│   ├── agent/
│   │   ├── core.ts              # Hlavní agent loop (Gemini + tools)
│   │   ├── prompt.ts            # System prompt (NotebookLM pravidla)
│   │   └── citations.ts         # Citační formátování
│   ├── memory/
│   │   ├── pepa-profile.ts      # Čtení/zápis Pepa profilu
│   │   ├── episodic.ts          # Episodická paměť (similarity search)
│   │   └── rag.ts               # RAG vyhledávání v dokumentech
│   ├── tools/
│   │   ├── index.ts             # Tool registry
│   │   ├── search-documents.ts  # RAG dotazy
│   │   ├── query-data.ts        # SQL dotazy na CRM/properties
│   │   ├── calendar.ts          # Google Calendar API
│   │   ├── email.ts             # Gmail API (draft + send s approval)
│   │   ├── visualize.ts         # Generování grafů (Chart.js)
│   │   ├── report.ts            # Generování reportů (MD/PPTX)
│   │   └── scraper.ts           # Web scraping realitních serverů
│   ├── ingest/
│   │   ├── pipeline.ts          # Orchestrace ingestace
│   │   ├── parsers/
│   │   │   ├── pdf.ts           # pdf-parse
│   │   │   ├── excel.ts         # xlsx
│   │   │   ├── docx.ts          # mammoth
│   │   │   └── email.ts         # .eml/.msg parsing
│   │   └── embed.ts             # Google embeddings + uložení do Supabase
│   ├── supabase/
│   │   ├── client.ts            # Supabase klient (server + browser)
│   │   └── schema.sql           # Kompletní DB schema
│   └── google/
│       ├── auth.ts              # OAuth 2.0 flow
│       ├── calendar.ts          # Calendar API wrapper
│       ├── gmail.ts             # Gmail API wrapper
│       └── drive.ts             # Drive API wrapper
│
├── components/
│   ├── chat/
│   │   ├── ChatInterface.tsx    # Hlavní chat okno
│   │   ├── MessageBubble.tsx    # Zpráva s citacemi
│   │   ├── SourcesPanel.tsx     # Panel citací (pravý sidebar)
│   │   ├── StreamingMessage.tsx # Streaming odpovědi
│   │   └── QuickActions.tsx     # Rychlé akce (tlačítka)
│   ├── charts/
│   │   └── ChartEmbed.tsx       # Chart.js wrapper
│   ├── approval/
│   │   └── ApprovalModal.tsx    # Potvrzení před email/cron akcemi
│   └── ui/                      # shadcn/ui komponenty
│
├── supabase/
│   └── migrations/
│       └── 001_initial.sql      # Počáteční schema
│
├── public/
│   └── demo-data/               # Ukázková data pro demo
│       ├── crm_leads_q1.xlsx
│       ├── properties_sample.csv
│       └── meeting_notes/
│
├── .env.local                   # Lokální env proměnné (gitignore)
├── .env.example                 # Šablona env proměnných
├── architecture.md              # Tento soubor
├── todo.md                      # Roadmapa projektu
└── vercel.json                  # Vercel konfigurace (cron jobs)
```

---

## Databázové schema (Supabase)

### `pepa_profile`
Živý profil uživatele. Auto-aktualizuje se po konverzacích.
```sql
id, key TEXT, value JSONB, updated_at TIMESTAMPTZ
```

### `conversations`
Episodická paměť — každá zpráva s embeddingem pro similarity search.
```sql
id, session_id UUID, role TEXT, content TEXT,
tool_calls JSONB, sources JSONB,
embedding VECTOR(768), created_at TIMESTAMPTZ
```

### `document_chunks`
RAG vrstva — chunky dokumentů s vektorovým embeddingem.
```sql
id, content TEXT, embedding VECTOR(768),
source_file TEXT, source_row_start INT, source_row_end INT,
source_type TEXT,  -- "crm" | "contract" | "email" | "note" | "meeting"
entity_tags TEXT[], ingested_at TIMESTAMPTZ
```

### `crm_leads`
Strukturovaná CRM data (SQL dotazy, ne jen vector search).
```sql
id, name TEXT, email TEXT, phone TEXT,
source TEXT, status TEXT,
property_interest TEXT, created_at TIMESTAMPTZ
```

### `properties`
Databáze nemovitostí.
```sql
id, address TEXT, city TEXT, district TEXT,
price NUMERIC, type TEXT, status TEXT,
missing_fields JSONB,  -- detekce chybějících dat
last_updated TIMESTAMPTZ
```

### `scheduled_tasks`
Naplánované úkoly agenta.
```sql
id, cron TEXT, action JSONB, description TEXT,
is_active BOOL, last_run TIMESTAMPTZ, next_run TIMESTAMPTZ,
created_by TEXT
```

### `audit_log`
Log všech akcí agenta.
```sql
id, action TEXT, tool TEXT, sources_used JSONB,
user_query TEXT, timestamp TIMESTAMPTZ
```

---

## Agent flow (každý request)

```
1. Načti Pepa profil z Supabase
         ↓
2. Embedding dotazu → similarity search v episodické paměti
   (top 3 relevantní minulé konverzace)
         ↓
3. Sestavení contextu:
   [System prompt: NotebookLM pravidla]
   [Pepa profil]
   [Top 3 episodické vzpomínky]
   [Posledních 5 zpráv aktuální session]
   [Aktuální dotaz]
         ↓
4. Gemini 2.0 Flash → rozhodne které tools volat
         ↓
5. Tools vrátí data + citations[]
         ↓
6. Gemini sestaví odpověď POUZE z dat nástrojů
   (každé tvrzení: "→ Zdroj: [soubor, řádek, datum]")
         ↓
7. Stream odpovědi do UI
         ↓
8. Uložit konverzaci + embedding do Supabase
         ↓
9. Async: zkontroluj zda se naučil něco nového o Pepovi → update profilu
```

---

## Tools (7 nástrojů)

| Nástroj | Vstup | Výstup | Citace |
|---|---|---|---|
| `search_documents` | query, filters | chunks + sources | soubor, chunk, datum ingestace |
| `query_structured_data` | table, filters, aggregation | rows + SQL | tabulka, řádky, datum exportu |
| `get_calendar_slots` | date_range, duration | available_slots | "google_calendar:email, datum" |
| `draft_communication` | type, context, template | draft, **requires_approval** | šablona, zdroje dat |
| `create_visualization` | data_source, chart_type | chart_url | data která byla použita |
| `generate_report` | period, sections, format | content, download_url | všechny použité zdroje |
| `schedule_action` | cron, action | job_id, **requires_approval** | "naplánováno: čas, akce" |

**Pravidlo:** `draft_communication` a `schedule_action` vždy vyžadují explicitní potvrzení uživatele v UI před provedením.

---

## NotebookLM systémový prompt (core)

```
Jsi Back Office Agent pro realitní firmu. Pracuješ pro Pepu.

PRAVIDLA (STRIKTNÍ):
1. NIKDY nevymýšlej data. Pokud nástroj nevrátil data, řekni to.
2. Každé tvrzení musí mít: → Zdroj: [název souboru/tabulky, řádky, datum]
3. Pokud data chybí: "Data nejsou dostupná v [zdroj]. Dostupné zdroje: [seznam]"
4. Nesmíš odhadovat ani interpolovat mimo rozsah dat.
5. Vždy nejprve zavolej nástroj, pak odpověz.

FORMÁT ODPOVĚDI:
→ Odpověď (s čísly a fakty)
→ Zdroj: [přesná citace]
→ Doporučený další krok (pokud relevantní)

JAZYK: Česky, tykání s Pepou.
```

---

## Deployment

- **Frontend + Backend**: Vercel (jeden deployment)
- **Databáze**: Supabase Cloud (free tier)
- **Cron jobs**: Vercel Cron Functions (v `vercel.json`)
- **Google APIs**: OAuth 2.0 přes nový projektový Gmail
- **Env proměnné**: nastaveny v Vercel dashboard

---

## Env proměnné (`.env.example`)

```
# Google AI
GOOGLE_AI_API_KEY=

# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Google OAuth (Cloud Console)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# App
NEXTAUTH_SECRET=
NEXTAUTH_URL=http://localhost:3000
```

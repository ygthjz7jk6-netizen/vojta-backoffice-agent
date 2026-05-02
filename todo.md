# TODO — Back Office Agent Roadmapa

> Stav: 🔴 Nezačato | 🟡 Probíhá | ✅ Hotovo

---

## Fáze 0 — Setup & infrastruktura ✅

- ✅ Gmail pro projekt, Google AI Studio API klíč
- ✅ Supabase projekt (URL + anon key + service role key)
- ✅ GitHub repo (ygthjz7jk6-netizen/vojta-backoffice-agent)
- ✅ Next.js + Vercel deployment aktivní
- ✅ Env proměnné ve Vercelu + `.env.local`

---

## Fáze 1 — Databáze ✅

- ✅ Migrace 001 — 8 tabulek (crm_leads, properties, conversations, document_chunks, pepa_profile, scheduled_tasks, audit_log, scraped_listings)
- ✅ Migrace 002 — pgvector: search_documents + search_conversations
- ✅ Migrace 003 — oprava vector dimensions
- ✅ Migrace 004 — drive_files tabulka (md5 tracking)
- ✅ Migrace 005 — external_id + source_file na properties + crm_leads
- ✅ Migrace 006 — monitoring_configs tabulka
- ✅ Migrace 007 — sreality_municipality_id (přidáno, nevyužito)
- ✅ Migrace 008 — location_name na scraped_listings (per-lokace tracking)
- ✅ Migrace 009 — pepa_memory + similarity search + decay/reinforce RPC
- ✅ Migrace 010 — structured_imports + structured_rows pro raw tabulkové importy

---

## Fáze 2 — Agent core ✅

- ✅ System prompt (NotebookLM pravidla, tool routing, česky, tykání)
- ✅ Gemini 2.5 Flash — Vertex AI přes OAuth Bearer token (fallback: AI Studio)
- ✅ OAuth token refresh — automatický refresh při expiraci (NextAuth jwt callback)
- ✅ Tool calling loop (max 5 iterací)
- ✅ Citační systém — každá odpověď vrací `citations[]`
- ✅ API route `/api/agent` — auth, accessToken, audit_log
- ✅ Episodická paměť — sessionId persistuje v localStorage, 20 zpráv kontextu
- ✅ Vertex AI fallback na AI Studio při 401/403

---

## Fáze 3 — Paměť ✅

- ✅ Pepa profil — Supabase, auto-merge
- ✅ Episodická paměť — ukládání + similarity search
- ✅ Dlouhodobá paměť Pepy — autonomní extrakce preferencí, zvyků, rozhodnutí a kontextu
- ✅ Paměťový decay — strength, last_used_at, used_count, poločas cca 30 dní
- ✅ Relevantní paměti v promptu — pgvector search přes aktuální dotaz
- ✅ RAG search — similarity search v document_chunks
- ✅ RAG ingestion pipeline — `lib/drive/ingest.ts` (chunking, embedding, upsert)
- ✅ File parsery — PDF (pdf-parse), DOCX (mammoth), XLSX (xlsx), plain text

---

## Fáze 4 — Tools ✅

- ✅ `search_documents` — RAG dotaz s citacemi
- ✅ `query_structured_data` — filtry: status, district, source, name, has_missing_fields, monthly_count
- ✅ `get_calendar_slots` — live Google Calendar API (fallback: demo sloty)
- ✅ `draft_communication` — Gmail draft přes API, approval flow
- ✅ `create_visualization` — Chart.js config, zobrazení v UI
- ✅ `generate_report` — markdown report z live dat
- ✅ `create_presentation` — agent definuje slides[], PPTX přes `/api/export/pptx`
- ✅ `schedule_action` — approval flow, cron výraz
- ✅ `setup_monitoring` — approval flow, okamžitý baseline scrape při aktivaci
- ✅ `manage_monitoring` — list / delete / delete_all sledování přes chat

---

## Fáze 5 — Google API integrace ✅

- ✅ Google OAuth — NextAuth v5, scopes: calendar, gmail.compose, cloud-platform, drive.readonly
- ✅ Google Calendar API — freebusy, volné sloty 9-17h
- ✅ Gmail API — createGmailDraft (gmail.compose scope)
- ✅ Vertex AI — REST API s OAuth Bearer tokenem + automatický token refresh

---

## Fáze 6 — Google Drive sync ✅

- ✅ `lib/drive/sync.ts` — listuje soubory, md5 diff, přeskočí nezměněné
- ✅ `lib/drive/parsers.ts` — router: PDF/DOCX/TXT → RAG, XLSX/CSV/Google Sheets → structured
- ✅ `lib/drive/ingest.ts` — RAG chunking + embedding; tabulky raw 1:1 + volitelný business mapping
- ✅ Raw tabulkové importy — `structured_imports` + `structured_rows`
- ✅ Známé tabulky — mapování do `properties` / `crm_leads`
- ✅ Neznámé tabulky — `raw_only`, bez pádu syncu
- ✅ Mapping error režim — raw data zůstanou uložená i když business upsert selže
- ✅ České názvy sloupců — normalizace bez diakritiky + synonymní mapování
- ✅ `/api/cron/drive-sync` — endpoint pro Vercel cron + manuální trigger
- ✅ `vercel.json` — cron každý den v 8:00
- ✅ Demo data na Google Drive (4 soubory, realistický obsah)

---

## Fáze 7 — Frontend / UI ✅

- ✅ AppShell — backoffice layout s navigací
- ✅ AppShell redesign — světlý modro-cyan gradient sidebar se šumem
- ✅ Collapsible sidebar — ikonkový režim, hover overlay přes logo agenta, stav uložený v localStorage
- ✅ AgentMark — modrá zaoblená ikona agenta s bílýma očima
- ✅ Chat rozhraní — funkční, live na Vercelu
- ✅ Chat redesign — centrovaný responzivní sloupec s větším bočním prostorem na desktopu
- ✅ MessageBubble redesign — kompaktní user pill bubliny a assistant odpovědi bez velké karty
- ✅ Composer redesign — glass/gradient input panel s uploadem a modrým send tlačítkem
- ✅ MessageBubble — citace, grafy (ChartEmbed.tsx)
- ✅ ChartEmbed redesign — modro-cyan paleta, jemné gridy a glass panel
- ✅ PPTX download tlačítko — volá `/api/export/pptx`, stáhne soubor na disk
- ✅ QuickActions — 6 rychlých akcí ve světlém card/chip stylu
- ✅ ApprovalModal — potvrzení monitoring setupu (location, category)
- ✅ LoginButton — Google OAuth, sladěný s novým vizuálním stylem
- ✅ "Nový chat" tlačítko — reset session ID
- ✅ /documents stránka — přehled nasátých Drive souborů
- ✅ /documents redesign — sjednocené glass panely, složková navigační ikona, modernější grid/list
- ✅ /documents filtry — stav, typ, hledání podle názvu
- ✅ /documents metrics — soubory, nasáté, chunky, řádky tabulek, poslední sync
- ✅ /documents structured status — mapped / raw_only / mapping_error
- ✅ /documents Drive link — otevření originálu v Google Drive přes drive_file_id
- 🔴 Streaming odpovědí

---

## Fáze 8 — Cron & scraping ✅

- ✅ `vercel.json` — 2 crony: drive-sync (8:00) + scrape-notify (8:05)
- ✅ Sreality scraper — `region_entity_type=osmm` pro přesné filtrování na obec
- ✅ Paginace — `scrapeAllSreality` stáhne vše bez limitu (per_page=60, N stránek)
- ✅ Lokality lookup — Praha: statická mapa (district ID), ostatní: osmm ověření (1 API call)
- ✅ Post-filter — `stripOkres` + `cityFilter` odstraní stray výsledky z jiných měst
- ✅ Baseline při aktivaci — `/api/monitoring/activate` okamžitě scrape + uloží, bez emailu
- ✅ Stale detection — nabídky prodané/smazané se automaticky mažou z DB
- ✅ Per-lokace tracking — `location_name` na `scraped_listings`, každá lokace má vlastní set
- ✅ Resend API email — HTML tabulka nových nabídek, funkční odkazy
- ✅ `manage_monitoring` — agent umí vypsat a smazat sledování přes chat

---

## Fáze 10 — Upload souborů přes UI ✅

- ✅ Migrace 011 — `uploaded_files` tabulka + FK `uploaded_file_id` na `document_chunks`
- ✅ `lib/upload/process.ts` — parse + RAG ingest s vazbou na uploaded_files
- ✅ `lib/upload/categorize.ts` — AI kategorizace (Gemini 2.0 Flash, best-effort, na pozadí)
- ✅ `POST /api/upload` — multipart upload, max 4 MB, after() pro kategorii
- ✅ `GET /api/documents/uploaded` — seznam nahraných souborů
- ✅ `DELETE /api/documents/uploaded/:id` — smazání + kaskáda chunků
- ✅ `PATCH /api/documents/uploaded/:id` — změna kategorie
- ✅ `manage_documents` tool — agent umí list / delete / list_categories
- ✅ `/documents` — Finder-like UI: sidebar kategorií, grid/list view, drag & drop, inline edit kategorie
- ✅ Chat — tlačítko 📎 pro upload souboru přímo z konverzace
- 🔴 Streaming odpovědí (přesunuto z Fáze 7)

---

## Fáze 9 — Demo data & polish 🟡

- ✅ Demo data v Supabase (62 leadů, 14 nemovitostí)
- ✅ Demo data na Google Drive (4 soubory, realistický obsah)
- 🔴 README pro GitHub
- 🔴 Demo video

---

## 6 scénářů ze zadání

- ✅ „Jaké nové klienty máme za Q1? Odkud přišli? Znázorni graficky."
- ✅ „Vytvoř graf vývoje leadů za 6 měsíců."
- ✅ „Napiš e-mail zájemci a doporuč termín podle mé dostupnosti." — Gmail draft ✅, Calendar ✅
- ✅ „Najdi nemovitosti s chybějícími daty o rekonstrukci."
- ✅ „Shrň výsledky minulého týdne, připrav 3-slidovou prezentaci." — report ✅, PPTX ✅
- ✅ „Sleduj nabídky v Holešovicích a každé ráno informuj." — monitoring ✅, osmm filtr ✅, baseline ✅

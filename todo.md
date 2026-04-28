# TODO — Back Office Agent Roadmapa

> Stav: 🔴 Nezačato | 🟡 Probíhá | ✅ Hotovo

---

## Fáze 0 — Setup & infrastruktura ✅

- ✅ Vytvořit nový Gmail pro projekt
- ✅ Google AI Studio API klíč (gemini-2.5-flash + gemini-embedding-001)
- ✅ Supabase projekt — URL + anon key + service role key
- ✅ GitHub repo (`vojta-backoffice-agent` na profilu ygthjz7jk6-netizen)
- ✅ Next.js projekt inicializován, Vercel deployment aktivní
- ✅ Env proměnné nastaveny ve Vercelu přes CLI
- ✅ `.env.local` kompletní (všechny klíče)

---

## Fáze 1 — Databáze ✅

- ✅ Supabase migrace `001_initial.sql` — 8 tabulek (crm_leads, properties, conversations, document_chunks, pepa_profile, scheduled_tasks, audit_log, scraped_listings)
- ✅ Supabase migrace `002_vector_search.sql` — pgvector funkce search_documents + search_conversations
- ✅ Supabase klient (server + browser, lazy init)
- 🔴 Auth — Google OAuth login (zatím bez autentizace)

---

## Fáze 2 — Agent core ✅

- ✅ System prompt (NotebookLM pravidla, česky, tykání)
- ✅ Gemini 2.5 Flash integrace s tool calling loop (max 5 iterací)
- ✅ Citační systém — každá odpověď vrací `citations[]`
- ✅ API route `/api/agent` — POST, uložení do audit_log
- 🔴 Streaming odpovědi (aktuálně synchronní)

---

## Fáze 3 — Paměť (3 vrstvy) 🟡

- ✅ **Pepa profil** — čtení/zápis ze Supabase, auto-merge, default hodnoty
- ✅ **Episodická paměť** — ukládání konverzací s embeddingem (gemini-embedding-001, 768 dims)
- ✅ **Episodická paměť** — similarity search (top 3 relevantní historické konverzace)
- 🔴 **RAG ingestion** — pipeline pro nahrávání dokumentů (PDF, XLSX, DOCX)
- 🔴 **RAG ingestion** — `/api/ingest` endpoint + parsery
- ✅ **RAG search** — similarity search v document_chunks při každém dotazu

---

## Fáze 4 — Tools 🟡

- ✅ `search_documents` — RAG dotaz s citacemi
- ✅ `query_structured_data` — SQL dotazy na CRM + properties + scraped_listings, včetně `has_missing_fields` filtru
- 🟡 `get_calendar_slots` — vrací demo termíny (Google Calendar API zatím nepropojeno)
- ✅ `draft_communication` — návrh emailu s approval flow
- ✅ `create_visualization` — generuje Chart.js config (zobrazení v UI chybí)
- ✅ `generate_report` — markdown report z live dat
- ✅ `schedule_action` — návrh cronu s approval flow

---

## Fáze 5 — Google API integrace 🔴

- 🔴 Google Cloud Console — OAuth consent screen + credentials
- 🔴 Google Calendar API wrapper (read availability)
- 🔴 Gmail API wrapper (draft + send s approval)
- 🔴 Google Drive API — auto-sync nových souborů do RAG

---

## Fáze 6 — Frontend / UI 🟡

- ✅ Chat rozhraní (`ChatInterface.tsx`) — funkční, live na Vercelu
- ✅ `MessageBubble` — zobrazuje citace (žlutý panel pod odpovědí)
- ✅ `QuickActions` — 6 rychlých akcí na úvodní obrazovce
- ✅ `ApprovalModal` — potvrzení před email/cron akcemi
- ✅ Zobrazení grafů v UI (Chart.js komponenta — ChartEmbed.tsx, automaticky se zobrazí v MessageBubble)
- 🔴 Streaming odpovědí (animace psaní)
- 🔴 Upload dokumentů do RAG (`/documents` stránka)
- 🔴 Přehled naplánovaných úkolů (`/scheduled` stránka)

---

## Fáze 7 — Cron & scraping 🔴

- 🔴 `vercel.json` s cron definicemi
- 🔴 Scraper — Sreality.cz, Bezrealitky.cz (Playwright nebo Firecrawl)
- 🔴 Filtrování podle lokality
- 🔴 Notifikace výsledků (email nebo zápis do Supabase)
- 🔴 Denní cron: auto-update Pepa profilu z konverzací

---

## Fáze 8 — Demo data & polish 🟡

- ✅ 62 demo leadů (Q4 2024 + Q1 2025, různé zdroje)
- ✅ 14 demo nemovitostí (7 s kompletními daty, 7 s chybějícími)
- ✅ 4 demo scraped listings (Praha 7 - Holešovice)
- ✅ Vše označeno `[DEMO]` prefixem
- 🔴 Responsive design (mobile)
- 🔴 README pro GitHub

---

## Fáze 9 — Nasazení 🟡

- ✅ Vercel deployment aktivní — https://vojta-backoffice-agent-nu.vercel.app
- ✅ GitHub repo veřejný — github.com/ygthjz7jk6-netizen/vojta-backoffice-agent
- 🔴 Vercel Cron Functions zapnuté
- 🔴 Finální test všech 6 scénářů
- 🔴 Demo video

---

## 6 scénářů ze zadání

- ✅ „Jaké nové klienty máme za Q1? Odkud přišli? Znázorni graficky." — data ✅, graf v UI ✅
- ✅ „Vytvoř graf vývoje leadů za 6 měsíců." — data ✅, graf v UI ✅
- 🔴 „Napiš e-mail zájemci a doporuč termín podle mé dostupnosti." — draft ✅, kalendář 🔴
- ✅ „Najdi nemovitosti s chybějícími daty o rekonstrukci." — funguje live
- 🔴 „Shrň výsledky minulého týdne, připrav 3-slidovou prezentaci." — report ✅, PPTX 🔴
- 🔴 „Sleduj nabídky v Holešovicích a každé ráno informuj." — cron 🔴

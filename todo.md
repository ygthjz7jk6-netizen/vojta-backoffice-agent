# TODO — Back Office Agent Roadmapa

> Stav: 🔴 Nezačato | 🟡 Probíhá | ✅ Hotovo

---

## Fáze 0 — Setup & infrastruktura

- ✅ Vytvořit nový Gmail pro projekt
- ✅ Aktivovat Google AI Studio API klíč (Gemini 2.0 Flash)
- ✅ Vytvořit Supabase projekt, získat URL + anon key
- ✅ Vytvořit GitHub repo (`vojta-backoffice-agent` na profilu ygthjz7jk6-netizen)
- ✅ Inicializovat Next.js projekt (`create-next-app`)
- 🔴 Nastavit Vercel projekt + propojit s GitHub
- 🟡 Nastavit `.env.local` s klíči (chybí GOOGLE_AI_API_KEY + SERVICE_ROLE_KEY)

---

## Fáze 1 — Databáze & základní backend

- ✅ Napsat Supabase migrace (`001_initial.sql`, `002_vector_search.sql`) — všechny tabulky
- 🔴 Spustit migrace v Supabase (SQL Editor)
- ✅ Nastavit Supabase klienta (server + browser)
- 🔴 Základní Supabase Auth (Google OAuth login)

---

## Fáze 2 — Agent core

- ✅ System prompt (NotebookLM pravidla, česky)
- ✅ Gemini 2.0 Flash integrace (`@google/generative-ai`)
- ✅ Základní tool loop (function calling)
- ✅ Citační systém (v `handlers.ts`)
- 🔴 Streaming odpovědi přes Server-Sent Events

---

## Fáze 3 — Paměť (3 vrstvy)

- ✅ **Pepa profil** — čtení/zápis JSON dokumentu ze Supabase
- ✅ **Episodická paměť** — ukládání konverzací s Google embeddingem
- ✅ **Episodická paměť** — similarity search pro relevantní historii
- 🔴 **RAG** — ingestion pipeline (chunking + embedding + uložení)
- 🔴 **RAG** — `/api/ingest` endpoint pro nahrávání souborů
- 🔴 **RAG** — parsery: PDF, Excel/CSV, DOCX, e-mail
- ✅ **RAG** — similarity search při každém dotazu

---

## Fáze 4 — Tools

- ✅ `search_documents` — RAG dotaz s citacemi
- ✅ `query_structured_data` — SQL dotazy na CRM + properties tabulky
- 🟡 `get_calendar_slots` — demo placeholder (Google Calendar API ve fázi 5)
- ✅ `draft_communication` — návrh emailu s approval flow
- ✅ `create_visualization` — Chart.js konfigurace
- ✅ `generate_report` — markdown report
- ✅ `schedule_action` — návrh s approval flow

---

## Fáze 5 — Google API integrace

- 🔴 Google OAuth 2.0 flow (Cloud Console nastavení)
- 🔴 Google Calendar API wrapper
- 🔴 Gmail API wrapper (čtení + draft)
- 🔴 Google Drive API — auto-sync nových souborů do RAG

---

## Fáze 6 — Frontend / UI

- ✅ Hlavní chat rozhraní (`ChatInterface.tsx`)
- 🔴 Streaming zprávy s animací
- ✅ Sources panel — zobrazení citací v MessageBubble
- ✅ Quick Actions tlačítka (6 akcí)
- ✅ Approval modal (email + cron potvrzení)
- 🔴 Upload dokumentů do RAG
- 🔴 Přehled naplánovaných úkolů (`/scheduled`)
- 🔴 Přehled nahraných dokumentů (`/documents`)

---

## Fáze 7 — Cron & scraping

- 🔴 `vercel.json` s cron definicemi
- 🔴 Scraper — Sreality.cz, Bezrealitky.cz
- 🔴 Filtrování podle lokality (Praha Holešovice atd.)
- 🔴 Notifikace výsledků (zápis do Supabase + email)
- 🔴 Denní cron: aktualizace Pepa profilu z nových konverzací

---

## Fáze 8 — Demo data & polish

- 🔴 Připravit demo data (CRM xlsx, properties CSV, meeting notes)
- 🔴 Nahrát demo data přes ingest pipeline
- 🔴 Otestovat všech 6 scénářů ze zadání
- 🔴 Responsive design (mobile)
- 🔴 Loading stavy, error handling
- 🔴 README pro GitHub

---

## Fáze 9 — Nasazení

- 🔴 Env proměnné nastaveny ve Vercel dashboard
- 🔴 Vercel Cron Functions aktivní
- 🔴 Custom doména (volitelné)
- 🔴 Finální test všech funkcí na produkci
- 🔴 Nahrát demo video

---

## Scénáře k otestování (ze zadání)

- 🔴 „Jaké nové klienty máme za Q1? Odkud přišli? Znázorni graficky."
- 🔴 „Vytvoř graf vývoje leadů a prodaných nemovitostí za 6 měsíců."
- 🔴 „Napiš e-mail zájemci a doporuč termín podle mé dostupnosti."
- 🔴 „Najdi nemovitosti s chybějícími daty o rekonstrukci."
- 🔴 „Shrň výsledky minulého týdne, připrav 3-slidovou prezentaci."
- 🔴 „Sleduj nabídky v Praze Holešovice a každé ráno mě informuj."

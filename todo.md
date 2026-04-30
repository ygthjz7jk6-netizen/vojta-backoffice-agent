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
- 🔴 Spustit migrace 004 + 005 v Supabase dashboard

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

---

## Fáze 5 — Google API integrace ✅

- ✅ Google OAuth — NextAuth v5, scopes: calendar, gmail.compose, cloud-platform, drive.readonly
- ✅ Google Calendar API — freebusy, volné sloty 9-17h
- ✅ Gmail API — createGmailDraft (gmail.compose scope)
- ✅ Vertex AI — REST API s OAuth Bearer tokenem + automatický token refresh
- 🔴 Přidat `Vertex AI User` IAM roli pro přihlášený Google účet v GCP projektu
- 🔴 Přidat drive.readonly do OAuth consent screenu v Google Cloud Console
- 🔴 Re-login po přidání drive scope

---

## Fáze 6 — Google Drive sync ✅ (kód) / 🔴 (aktivace)

- ✅ `lib/drive/sync.ts` — listuje soubory, md5 diff, přeskočí nezměněné
- ✅ `lib/drive/parsers.ts` — router: PDF/DOCX → RAG, XLSX/CSV → structured
- ✅ `lib/drive/ingest.ts` — RAG chunking + embedding + upsert; structured upsert s external_id
- ✅ `/api/cron/drive-sync` — endpoint pro Vercel cron + manuální trigger
- ✅ `vercel.json` — cron každý den v 8:00 (Hobby plan limit)
- ✅ Demo data na Google Drive (složka "Vojta Back Office – Firemní data"):
  - Nemovitosti_databaze_2025 (15 nemovitostí, 7 bez dat o rekonstrukci)
  - CRM_Leady_Q1_2025 (12 leadů, reálné emaily + telefony)
  - Zapis_tydenni_porada_14_dubna_2025 (meeting notes)
  - Smlouva_zprostredkovani_Horak_P007_2025 (zprostředkovatelská smlouva)
- 🔴 Spustit migrace 004+005 → pak otestovat drive-sync endpoint manuálně

---

## Fáze 7 — Frontend / UI ✅

- ✅ Chat rozhraní — funkční, live na Vercelu
- ✅ MessageBubble — citace, grafy (ChartEmbed.tsx)
- ✅ PPTX download tlačítko — volá `/api/export/pptx`, stáhne soubor na disk
- ✅ QuickActions — 6 rychlých akcí
- ✅ ApprovalModal — potvrzení před email/cron
- ✅ LoginButton — Google OAuth
- 🔴 Streaming odpovědí
- 🔴 /documents stránka (přehled nasátých Drive souborů)

---

## Fáze 8 — Cron & scraping 🔴

- ✅ vercel.json — Drive sync cron (každý den v 8:00)
- 🔴 Scraper — Sreality.cz / Bezrealitky.cz
- 🔴 Denní email notifikace nových nabídek

---

## Fáze 9 — Demo data & polish 🟡

- ✅ Demo data v Supabase (62 leadů, 14 nemovitostí, 4 scraped listings)
- ✅ Demo data na Google Drive (4 soubory, realistický obsah)
- 🔴 README pro GitHub
- 🔴 Demo video

---

## 6 scénářů ze zadání

- ✅ „Jaké nové klienty máme za Q1? Odkud přišli? Znázorni graficky."
- ✅ „Vytvoř graf vývoje leadů za 6 měsíců."
- ✅ „Napiš e-mail zájemci a doporuč termín podle mé dostupnosti." — Gmail draft ✅, Calendar ✅
- ✅ „Najdi nemovitosti s chybějícími daty o rekonstrukci."
- ✅ „Shrň výsledky minulého týdne, připrav 3-slidovou prezentaci." — report ✅, PPTX ✅ (univerzální, libovolný počet slidů)
- 🔴 „Sleduj nabídky v Holešovicích a každé ráno informuj." — cron + scraper 🔴

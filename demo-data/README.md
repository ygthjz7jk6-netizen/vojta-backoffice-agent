# Demo data pro Back Office Operations Agenta

Tato slozka simuluje data realitni firmy, ktera spravuje, prodava a akviruje nemovitosti. Data jsou umele, ale navrzena tak, aby odpovidala realnym agendam back office managera.

## Co v takove firme typicky vznika za data

- CRM data: klienti, leady, zdroje akvizice, stav komunikace, vlastnik vztahu.
- Portfolio nemovitosti: lokalita, dispozice, plocha, cena, stav prodeje, vlastnik, technicke parametry.
- Transakcni data: rezervace, kupni ceny, provize, faze obchodu, prodane nemovitosti.
- Operativni data: prohlidky, kalendar, ukoly, follow-upy, interni poznamky.
- Dokumentova evidence: listy vlastnictvi, PENB, SVJ zapisy, rekonstrukce, smlouvy, chybejici podklady.
- Marketing a monitoring trhu: nabidky z realitnich serveru, konkurencni ceny, zdroje leadu, kampane.
- Reporting: tydenni vysledky, funnel, rychlost reakce, rizika, otevrene blokery.

## Jak data pouziva Pepa

Pepa typicky nesedi nad jednou databazi. Sklada odpoved z CRM, e-mailu, kalendare, sdilenych dokumentu, exportu z realitnich portalu a internich tabulek. Proto dataset obsahuje vice propojenych souboru pres identifikatory jako `client_id`, `property_id` a `deal_id`.

## Ukazkove dotazy pokryte daty

- "Jake nove klienty mame za 1. kvartal? Odkud prisli? Znazorni to graficky."
  - Pouzij `clients.csv` a `leads.csv`, filtr `acquired_at` mezi 2026-01-01 a 2026-03-31, agregace podle `acquisition_channel`.
- "Vytvor graf vyvoje poctu leadu a prodanych nemovitosti za poslednich 6 mesicu."
  - Pouzij `monthly_metrics.csv`, sloupce `leads_total` a `properties_sold`.
- "Napis e-mail pro zajemce o moji nemovitost a doporuc mu termin prohlidky na zaklade me dostupnosti."
  - Primarne pouzij `google-calendar/google_calendar_events_mock.json` jako napodobeninu Google Calendar API. `calendar_availability.csv` je jen zjednoduseny analyticky export.
  - Doplň kontext z `emails.csv`, `viewings.csv` a `properties.csv`.
- "Najdi nemovitosti, u kterych chybi data o rekonstrukci a stavebnich upravach."
  - Pouzij `properties.csv`, filtr prazdny `last_reconstruction_year` nebo `reconstruction_scope`, dopln `documents.csv`.
- "Shrn vysledky minuleho tydne do reportu pro vedeni a priprav 3 slidy."
  - Pouzij `weekly_report_inputs.csv`, `monthly_metrics.csv`, `tasks.csv`.
- "Sleduj realitni servery a kazde rano informuj o novych nabidkach v Praze Holesovicich."
  - Pouzij `portal_monitoring.csv`, filtr lokalita `Praha 7 - Holesovice`, `detected_at` posledni den.

## Doporučene demo flow

1. Nejdriv ukazat, ze agent umi odpovidat nad tabulkami: Q1 klienti a zdroje.
2. Pak ukazat analytiku: 6mesicni trend leadu/prodeju.
3. Pak workflow: navrh e-mailu podle kalendare.
4. Pak data quality: chybejici rekonstrukce a dokumenty.
5. Nakonec automatizace: ranni monitoring portalu.

## Napodobeniny reálných souborů

Kromě CSV exportů je ve složce `files/` druhá vrstva dat, která víc odpovídá tomu, co Pepa reálně dostává:

- `files/excel/`: Excel pipeline, měsíční KPI report a data-quality seznam.
- `files/pdf/`: mock PDF výzvy, list vlastnictví a pracovní rezervační smlouva.
- `files/docx/`: týdenní report a zápis z akviziční porady.
- `files/contracts/`: smluvní PDF s otevřenými body.
- `google-calendar/`: JSON napodobující odpověď Google Calendar API a `.ics` export.
- `file_manifest.csv`: index příloh, aby bylo jasné, ke kterému klientovi/nemovitosti/workflow se soubor váže.

Prakticky by agent nejdřív četl soubory z Google Drive/Gmailu, extrahoval strukturované informace a ukládal je do indexu. CSV v této složce proto reprezentují už očištěnou analytickou vrstvu, zatímco PDF/DOCX/XLSX ukazují původní pracovní realitu.

// @ts-nocheck
import { tool } from 'ai'
import { z } from 'zod'
import { handleToolCall } from './handlers'

export const getTools = (accessToken?: string | null) => ({
  search_documents: tool({
    description: 'Prohledá RAG databázi firemních dokumentů (CRM exporty, smlouvy, poznámky, emaily, meeting záznamy). Vždy použij pro dotazy na firemní data.',
    parameters: z.object({
      query: z.string().describe('Vyhledávací dotaz v češtině'),
      source_type: z.string().optional().describe('Filtr typu dokumentu: crm, contract, email, note, meeting, property'),
      limit: z.number().optional().describe('Počet výsledků (default 5)'),
    }),
    execute: async (args) => handleToolCall('search_documents', args, accessToken),
  }),
  query_structured_data: tool({
    description: 'Dotaz na strukturovaná data. Parametr table MUSÍ být přesně jeden z: "crm_leads", "properties", "scraped_listings". Nikdy nepsat SQL do table. Pro grafy vývoje použij aggregation="monthly_count".',
    parameters: z.object({
      table: z.enum(['crm_leads', 'properties', 'scraped_listings']).describe('POVINNÉ: přesně "crm_leads", "properties", nebo "scraped_listings"'),
      filters: z.object({
        name: z.string().optional().describe('Hledání podle jména kontaktu (částečná shoda)'),
        status: z.string().optional(),
        district: z.string().optional(),
        source: z.string().optional(),
        created_after: z.string().optional().describe('Datum od ve formátu YYYY-MM-DD'),
        created_before: z.string().optional().describe('Datum do ve formátu YYYY-MM-DD'),
        has_missing_fields: z.string().optional().describe('Pokud "true", vrátí jen záznamy s chybějícími daty'),
      }).optional().describe('Filtry'),
      aggregation: z.string().optional().describe('Jedna z hodnot: "count", "avg_price", "group_by_source", "group_by_status", "monthly_count" (pro graf vývoje po měsících)'),
    }),
    execute: async (args) => handleToolCall('query_structured_data', args, accessToken),
  }),
  get_calendar_slots: tool({
    description: 'Načte volné termíny z Google Kalendáře pro plánování schůzek a prohlídek.',
    parameters: z.object({
      date_from: z.string().describe('Datum od (YYYY-MM-DD)'),
      date_to: z.string().describe('Datum do (YYYY-MM-DD)'),
      duration_minutes: z.number().optional().describe('Délka schůzky v minutách (default 60)'),
    }),
    execute: async (args) => handleToolCall('get_calendar_slots', args, accessToken),
  }),
  draft_communication: tool({
    description: 'Připraví návrh emailu nebo SMS. NEVYSÍLÁ automaticky — vždy čeká na potvrzení uživatele.',
    parameters: z.object({
      type: z.string().describe('email nebo sms'),
      recipient_name: z.string().optional().describe('Jméno příjemce'),
      recipient_email: z.string().optional().describe('Email příjemce'),
      context: z.string().describe('Kontext zprávy'),
      proposed_slots: z.array(z.string()).optional().describe('Navrhované termíny ze search_calendar'),
    }),
    execute: async (args) => handleToolCall('draft_communication', args, accessToken),
  }),
  create_visualization: tool({
    description: 'Vytvoří graf z dat. Vrací konzistentní designový artifact pro UI/PPTX a současně Excel-kompatibilní datový podklad.',
    parameters: z.object({
      chart_type: z.string().describe('bar, line, area, pie, doughnut'),
      title: z.string().describe('Název grafu'),
      subtitle: z.string().optional().describe('Krátký popis co graf zobrazuje'),
      labels: z.array(z.string()).describe('Popisky osy X nebo segmentů'),
      datasets: z.array(z.any()).describe('Data pro graf: [{ label, data: [čísla] }]'),
      source_description: z.string().describe('Popis zdroje dat pro citaci'),
      unit: z.string().optional().describe('Jednotka hodnot, např. Kč, leadů, ks, %'),
      x_axis_label: z.string().optional().describe('Popisek osy X'),
      y_axis_label: z.string().optional().describe('Popisek osy Y'),
    }),
    execute: async (args) => handleToolCall('create_visualization', args, accessToken),
  }),
  create_presentation: tool({
    description: 'Vytvoří PowerPoint prezentaci (.pptx) s libovolným obsahem. Agent sám definuje každý slide — používej po tom, co máš data z jiných nástrojů (search_documents, query_structured_data, ...). Titulní slide se přidá automaticky.',
    parameters: z.object({
      title: z.string().describe('Název prezentace'),
      subtitle: z.string().optional().describe('Podtitul (volitelný, např. datum nebo lokalita)'),
      slides: z.array(z.object({
        heading: z.string().describe('Nadpis slidu'),
        bullets: z.array(z.string()).optional().describe('Odrážky — krátké věty s klíčovými informacemi'),
        kpis: z.array(z.object({
          label: z.string(),
          value: z.string(),
          highlight: z.boolean().optional(),
        })).optional().describe('KPI karty s čísly (max 4). Pole: label, value, highlight (zvýrazní oranžově)'),
        table: z.object({
          headers: z.array(z.string()),
          rows: z.array(z.array(z.string())),
        }).optional().describe('Tabulka s daty (max 10 řádků zobrazeno)'),
        note: z.string().optional().describe('Poznámka o zdroji dat (zobrazí se malým písmem)'),
      })).describe('Obsah slidů (max 9 content slidů + titulní = 10 celkem)'),
    }),
    execute: async (args) => handleToolCall('create_presentation', args, accessToken),
  }),
  generate_report: tool({
    description: 'Vygeneruje strukturovaný report z dostupných dat.',
    parameters: z.object({
      title: z.string().describe('Název reportu'),
      period: z.string().describe('Období (např. "Q1 2025", "minulý týden")'),
      sections: z.array(z.string()).describe('Sekce reportu: ["leads", "deals", "properties", "recommendations"]'),
      format: z.string().describe('Vždy "markdown"'),
    }),
    execute: async (args) => handleToolCall('generate_report', args, accessToken),
  }),
  manage_monitoring: tool({
    description: 'Zobrazí nebo smaže nastavená sledování nabídek. Použij pro: výpis všech sledování, smazání konkrétního města, smazání všeho.',
    parameters: z.object({
      action: z.string().describe('list — výpis všech, delete — smazání podle lokality, delete_all — smazání všeho včetně scraped listings'),
      location_name: z.string().optional().describe('Název lokality pro delete (nepovinné)'),
    }),
    execute: async (args) => handleToolCall('manage_monitoring', args, accessToken),
  }),
  setup_monitoring: tool({
    description: 'Nastaví automatické sledování realitních nabídek pro zadanou lokalitu. Po potvrzení uživatelem bude každý den ráno chodit email s novými nabídkami. Použij vždy když uživatel chce sledovat nabídky v nějaké lokalitě.',
    parameters: z.object({
      location: z.string().describe('Lokalita česky — např. "Holešovice", "Brno-střed", "Praha 6"'),
      category_type: z.string().optional().describe('prodej (default) nebo pronájem'),
      category_main: z.string().optional().describe('byty (default) nebo domy'),
    }),
    execute: async (args) => handleToolCall('setup_monitoring', args, accessToken),
  }),
  manage_documents: tool({
    description: 'Správa ručně nahraných dokumentů (ne Drive souborů). Vypiš, filtruj nebo smaž dokumenty podle kategorie nebo data nahrání.',
    parameters: z.object({
      action: z.string().describe('list — výpis souborů, delete — smazání, list_categories — výpis kategorií s počty'),
      category: z.string().optional().describe('Filtr nebo cíl operace podle kategorie'),
      uploaded_before: z.string().optional().describe('YYYY-MM-DD — vypiš nebo smaž soubory nahrané před tímto datem'),
      uploaded_after: z.string().optional().describe('YYYY-MM-DD — filtr souborů nahraných po tomto datu'),
      file_id: z.string().optional().describe('UUID konkrétního souboru pro smazání'),
    }),
    execute: async (args) => handleToolCall('manage_documents', args, accessToken),
  }),
  schedule_action: tool({
    description: 'Naplánuje opakující se úkol (scraping, report, notifikace). NEVYTVOŘÍ automaticky — čeká na potvrzení.',
    parameters: z.object({
      cron: z.string().describe('Cron výraz (např. "0 8 * * 1-5")'),
      action_type: z.string().describe('scrape_listings, send_report, notify'),
      action_params: z.object({
        location: z.string().optional(),
        format: z.string().optional(),
        recipient: z.string().optional(),
      }).optional().describe('Parametry akce'),
      description: z.string().describe('Popis úkolu česky'),
    }),
    execute: async (args) => handleToolCall('schedule_action', args, accessToken),
  }),
})
